# Plan 003: Enforce decompression limits on zip import (anti-bomb)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 176e34e..HEAD -- packages/vfs/src/zip-driver.ts packages/zip/src`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `176e34e`, 2026-06-12

## Why this matters

`ZipDriver.fromZipBytes` decompresses imported zip archives with fflate's
`unzipSync` and no limits of any kind — no entry count cap, no per-entry size
cap, no total size cap. A crafted archive (kilobytes compressed, gigabytes
decompressed) will out-of-memory the browser tab or the Electron renderer the
moment a user imports it. Zip import is a first-class user flow (the product's
portability story is "round-trip through a zip"), and imported zips are
untrusted input — a template zip shared between orgs is the realistic carrier.
The existing path validation in the same function (rejects `..`, absolute
paths, backslashes) shows the import boundary is already treated as hostile;
this plan extends that posture to resource exhaustion.

## Current state

- `packages/vfs/src/zip-driver.ts` — the ZIP-backed VFS driver; the import
  boundary is `ZipDriver.fromZipBytes` (lines 51–77):

```ts
  static fromZipBytes(input: Uint8Array): ZipDriver {
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(input);
    } catch (cause) {
      const err = new Error("zip: failed to decode zip bytes (input is not a valid zip)");
      (err as Error & { cause?: unknown }).cause = cause;
      throw err;
    }
    const driver = new ZipDriver();
    for (const [rawName, body] of Object.entries(unzipped)) {
      // ... name normalisation; rejects "/", "\\", ".." with
      // `new Error('zip: malformed entry name ...')`
      driver.entries.set(name, cloneBytes(body));
    }
    return driver;
  }
```

- Error convention in this file: throw plain `Error` whose `message` starts
  with `"zip:"`; `@sosb/zip` wraps these into a typed `ZipImportError`.
- `packages/zip/src/errors.ts` — defines the stable code union:

```ts
export type ZipImportErrorCode =
  | "zip.invalid"
  | "zip.dataJson.missing"
  | "zip.dataJson.invalidJson"
  | "zip.dataJson.invalidShape"
  | "zip.dataJson.versionTooNew";
```

- `packages/zip/src/import.ts` — `importFromZip` calls
  `ZipDriver.fromZipBytes(buf)` and currently maps any throw from it to
  `ZipImportError("zip.invalid", ...)` (around line 49).
- fflate is pinned at `^0.8.2` (`packages/vfs/package.json:32`). fflate's
  `unzipSync(data, opts)` accepts an `UnzipOptions` object with a
  `filter?: (file: UnzipFileInfo) => boolean` callback that is invoked per
  entry **before** that entry is inflated; `UnzipFileInfo` carries `name`,
  `size` (compressed) and `originalSize` (declared uncompressed size).
  **You must confirm these exact names against the installed package** (see
  Step 1) — if the API differs, STOP.
- Existing tests for this driver: `packages/vfs/test/zip-driver.test.ts`
  (30 tests) — use it as the structural pattern; it already synthesizes zips
  in-test (via `zipSync` / driver round-trips).
- Vocabulary note (from `CONTEXT.md`): the zip is the product's portable
  artifact (`data.json` + `assets/` + `dist/`); the import path feeds the
  editor. Keep names in code aligned with "import" (not "load"/"open").

## Commands you will need

| Purpose    | Command                        | Expected on success |
| ---------- | ------------------------------ | ------------------- |
| Typecheck  | `pnpm typecheck`               | exit 0              |
| VFS tests  | `pnpm vitest run packages/vfs` | all pass            |
| Zip tests  | `pnpm vitest run packages/zip` | all pass            |
| Full suite | `pnpm test`                    | exit 0              |
| Lint       | `pnpm lint`                    | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/vfs/src/zip-driver.ts`
- `packages/vfs/test/zip-driver.test.ts`
- `packages/zip/src/errors.ts` (add one error code)
- `packages/zip/src/import.ts` (map limit errors to the new code)
- `packages/zip/test/**` (one new mapping test)

**Out of scope** (do NOT touch):

- `packages/vfs/src/path.ts` and the existing entry-name validation — already
  correct; don't refactor it.
- `toZipBytes` / export path — bombs are an import problem.
- Electron/browser shells, editor-app import UI — they consume the typed
  error transparently.
- Asset-pipeline-level size limits (per-image caps) — different concern,
  different layer.

## Git workflow

- Branch: `advisor/003-zip-import-limits`
- Message style verb-first, e.g.
  `Add decompression limits to zip import (entry count, per-entry, total)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the fflate filter API against the installed version

Open `node_modules/fflate/lib/index.d.ts` (or `node_modules/.pnpm/fflate@*/...`)
and confirm: `unzipSync(data: Uint8Array, opts?: ...)` accepts an options
object with `filter(file)` where `file` exposes `name`, `size`, and
`originalSize`. If the option or those property names don't exist, STOP and
report — the implementation strategy below depends on them.

**Verify**: quote the relevant `.d.ts` lines in your report.

### Step 2: Add limits to `fromZipBytes`

In `packages/vfs/src/zip-driver.ts`, add exported constants (top of file,
near `ZIP_DRIVER_MTIME`, with a JSDoc stating the rationale and that they are
deliberately generous for v1):

```ts
export const ZIP_IMPORT_MAX_ENTRIES = 2_000;
export const ZIP_IMPORT_MAX_ENTRY_BYTES = 50 * 1024 * 1024; // 50 MiB per entry
export const ZIP_IMPORT_MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MiB declared total
```

Give `fromZipBytes` an optional second parameter so tests can inject tiny
limits without slow fixtures:

```ts
static fromZipBytes(
  input: Uint8Array,
  limits: { maxEntries?: number; maxEntryBytes?: number; maxTotalBytes?: number } = {},
): ZipDriver
```

Implementation inside the existing method:

1. Resolve effective limits from the parameter with the exported constants as
   defaults.
2. Pass a `filter` to `unzipSync` that counts entries and accumulates
   `originalSize`; when a limit is exceeded, `throw new Error("zip: import limits exceeded (<which limit>)")`.
   Skip directory-marker entries (`name.endsWith("/")`) from the count, to
   stay consistent with the existing loop's semantics.
3. The existing `catch (cause)` currently rebrands **every** throw as
   "input is not a valid zip". Limit errors must not be masked: in the catch,
   if `cause instanceof Error && cause.message.startsWith("zip: import limits exceeded")`,
   rethrow `cause` as-is; otherwise keep the current wrapping behavior.
4. After `unzipSync` returns, defense-in-depth against lying headers: sum the
   actual `body.byteLength` over all kept entries inside the existing
   `for` loop and throw the same `"zip: import limits exceeded (total size)"`
   error if the running total exceeds the effective `maxTotalBytes`.

**Verify**: `pnpm typecheck` → exit 0; `pnpm vitest run packages/vfs` → all
30 existing tests still pass (no behavior change for legitimate zips).

### Step 3: Tests in `packages/vfs/test/zip-driver.test.ts`

Add a `describe("fromZipBytes import limits", ...)` group, synthesizing
inputs with fflate's `zipSync` (already used in this package). Use the
injectable `limits` parameter with tiny values — do not allocate
multi-megabyte buffers:

- entry count: zip with 3 small entries + `{ maxEntries: 2 }` → throws,
  message matches `/zip: import limits exceeded/`
- per-entry size: one entry of 1 KiB + `{ maxEntryBytes: 512 }` → throws
- total size: two 1 KiB entries + `{ maxTotalBytes: 1024 }` → throws
- happy path: same zips with default limits → parses fine
- the error is **not** the "input is not a valid zip" wrapper (assert message)

**Verify**: `pnpm vitest run packages/vfs` → all pass including new group.

### Step 4: Map to a stable `ZipImportError` code

- `packages/zip/src/errors.ts`: add `"zip.limitsExceeded"` to
  `ZipImportErrorCode` and one line to the doc comment above it, matching the
  existing comment style ("- `zip.limitsExceeded` — the archive exceeds the
  import resource limits (entry count or decompressed size).").
- `packages/zip/src/import.ts`: where the `fromZipBytes` throw is currently
  wrapped into `ZipImportError("zip.invalid", ...)` (~line 49), branch first:
  if the caught error's message starts with `"zip: import limits exceeded"`,
  throw `new ZipImportError("zip.limitsExceeded", "The zip archive exceeds the import size limits.", { cause })` instead.
- Add one test in `packages/zip/test/` (model after the existing import-error
  tests there): a zip that trips a limit produces `code === "zip.limitsExceeded"`,
  not `"zip.invalid"`. To trip the limit without huge fixtures, this test can
  construct the driver-level error path via a zip with >`ZIP_IMPORT_MAX_ENTRIES`
  tiny entries **only if** that builds in well under a second; otherwise
  restructure `importFromZip` to accept optional limits and thread them
  through — if that threading turns out to require changing `importFromZip`'s
  public signature in a way existing callers notice, STOP and report instead.

**Verify**: `pnpm vitest run packages/zip` → all pass; `pnpm test` → exit 0;
`pnpm lint` → exit 0.

## Test plan

- New driver-level tests (Step 3) in `packages/vfs/test/zip-driver.test.ts`,
  modeled on its existing synthesized-zip tests.
- New mapping test (Step 4) in `packages/zip/test/`, modeled on existing
  `ZipImportError` code assertions.
- Full-suite regression: `pnpm test` exit 0 (existing round-trip and
  determinism tests prove legitimate zips are unaffected).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, including the new limit tests
- [ ] `grep -n "ZIP_IMPORT_MAX_ENTRIES" packages/vfs/src/zip-driver.ts` → present, exported
- [ ] `grep -n "zip.limitsExceeded" packages/zip/src/errors.ts` → present in the union
- [ ] A limit-tripping zip yields `ZipImportError.code === "zip.limitsExceeded"` (test asserts it)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The installed fflate's `unzipSync` lacks the `filter` option or the
  `originalSize` field (Step 1).
- The current-state excerpt of `fromZipBytes` doesn't match the live code.
- Mapping the new error requires changing `importFromZip`'s public signature
  in a way that breaks existing callers (Step 4's last bullet).
- Any _existing_ vfs/zip test fails after your change — legitimate zips must
  be entirely unaffected; do not adjust existing tests to pass.

## Maintenance notes

- The three constants are deliberately generous (a real org site's zip is a
  few MB). If users ever hit them legitimately (e.g. huge photo galleries),
  raise `ZIP_IMPORT_MAX_TOTAL_BYTES` — and consider surfacing a friendlier
  editor-side message keyed off `zip.limitsExceeded` via `@sosb/i18n`
  (follow-up, not this plan).
- `originalSize` comes from zip headers and can lie; the post-decode actual
  byte-length check (Step 2.4) is the backstop. Reviewers should confirm both
  layers are present.
- If the editor ever moves to streaming import (fflate `Unzip`), the limits
  must move with it — they are the import boundary's contract, not an
  implementation detail of `unzipSync`.
