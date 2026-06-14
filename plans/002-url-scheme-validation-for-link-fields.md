# Plan 002: Extend safe-URL-scheme validation to all five unvalidated link fields

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 176e34e..HEAD -- packages/schema/src packages/renderer/src/blocks`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (existing fixture/user data with non-conforming URLs will now fail schema validation — see Maintenance notes)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `176e34e`, 2026-06-12

## Why this matters

The renderer emits user-supplied URL strings directly into `<a href>` on the
**published static site**. JSX attribute escaping prevents breaking out of the
attribute, but it does nothing about the URL _scheme_ — a `javascript:` URL in
an `href` executes when a site visitor clicks it. Site data is not always
typed in by the owner: the editor imports `data.json` from zip archives
(`@sosb/zip`), so a shared/template zip is an untrusted input channel into
published HTML. The repo already decided how to handle this — the cta-banner
block validates button URLs against a scheme whitelist and rejects
`javascript:`/`data:` — but five other blocks with identical `href` sinks
never got that validation. This plan hoists the existing validator into a
shared module and applies it to the remaining five fields, closing the class.

## Current state

**The existing validator (the pattern to reuse)** —
`packages/schema/src/blocks/cta-banner.ts:25-47`:

```ts
const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Validate a button URL string. Returns true iff the value is safe to put on
 * an outbound `<a href>` attribute on a published static site.
 * ...
 */
function isAcceptableButtonUrl(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  // Site-relative paths are allowed — they resolve against the deployed origin.
  if (value.startsWith("/")) return true;
  // Otherwise, the value must parse as an absolute URL with an allowed scheme.
  try {
    const parsed = new URL(value);
    return SAFE_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}
```

and its use at `cta-banner.ts:53`:

```ts
url: z.string().min(1, "Button URL is required.").refine(isAcceptableButtonUrl, {
  message:
    "Button URL is malformed. Use a full URL (https://example.org), a site-relative path (/contact), or mailto:/tel: links.",
```

**The five unvalidated fields** (each is a plain string with no scheme
check), with the renderer sink that proves each reaches an `href`:

| Schema field                                                                      | Schema location                                       | Renderer sink                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `SocialLinkSchema.url` (contact card)                                             | `packages/schema/src/blocks/contact-card.ts:22-25`    | `packages/renderer/src/blocks/contact-card.tsx:190`               |
| `SocialLinkSchema.url` (team grid — a _separate_ local schema with the same name) | `packages/schema/src/blocks/team-grid.ts:20-23`       | `packages/renderer/src/blocks/team-grid.tsx:186`                  |
| `PartnerSchema.url` (optional)                                                    | `packages/schema/src/blocks/partner-logos.ts:33-37`   | `packages/renderer/src/blocks/partner-logos.tsx:73`               |
| `EventItemSchema`-level `url` (optional)                                          | `packages/schema/src/blocks/event-list.ts:63`         | `packages/renderer/src/blocks/event-list.tsx:101`                 |
| `ActivityLinkSchema.href`                                                         | `packages/schema/src/blocks/activities-list.ts:50-53` | `packages/renderer/src/blocks/activities-list.tsx:128` and `:142` |

Excerpts as they exist today:

`contact-card.ts:22-25`:

```ts
const SocialLinkSchema = z.looseObject({
  platform: z.string().min(1),
  url: z.string().min(1),
});
```

`team-grid.ts` (around line 20-23, same shape):

```ts
const SocialLinkSchema = z.looseObject({
  platform: z.string().min(1),
  url: z.string().min(1),
});
```

`partner-logos.ts:33-37`:

```ts
const PartnerSchema = z.looseObject({
  name: z.string().min(1),
  url: z.string().min(1).optional(),
  logo: AssetRefSchema,
});
```

`event-list.ts:63` (inside the event item schema):

```ts
  url: z.string().optional(),
```

`activities-list.ts:50-53`:

```ts
export const ActivityLinkSchema = z.looseObject({
  href: z.string().min(1),
  label: z.string().optional(),
});
```

**Deliberately excluded** (do not add validation to these):

- `document-downloads` — its renderer `href` (`document-downloads.tsx:178`)
  is derived from a `DocumentAssetRef`, not a free-text URL field.
- `embed` — `embed.tsx:248` uses `resolved.linkUrl`, which is produced by the
  provider whitelist (ADR 0039), not raw user input.
- `theme.id` and other spine fields — no URL semantics.

**Conventions that apply**:

- This is a Zod-schema repo (`@sosb/schema`); validation belongs in the
  schema layer, not in the renderer (precedent: cta-banner, and ADR 0002's
  rule that UI-adjacent concerns layer on top of the schema, never inside the
  renderer).
- Relative imports inside `packages/schema/src` use explicit `.js` suffixes
  (ESM style) — match the import style you see at the top of the file you are
  editing.
- Each block has a co-located test file under `packages/schema/test/`
  (e.g. `cta-banner-block.test.ts`, `contact-card-block.test.ts`,
  `event-list-block.test.ts`, `activities-list-block.test.ts`). Model new
  test cases on the URL-rejection cases in `cta-banner-block.test.ts`.

## Commands you will need

| Purpose           | Command                           | Expected on success |
| ----------------- | --------------------------------- | ------------------- |
| Typecheck         | `pnpm typecheck`                  | exit 0              |
| Schema tests only | `pnpm vitest run packages/schema` | all pass            |
| Full unit suite   | `pnpm test`                       | all 191+ files pass |
| Lint              | `pnpm lint`                       | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/schema/src/url.ts` (create)
- `packages/schema/src/blocks/cta-banner.ts` (refactor to import the shared validator)
- `packages/schema/src/blocks/contact-card.ts`
- `packages/schema/src/blocks/team-grid.ts`
- `packages/schema/src/blocks/partner-logos.ts`
- `packages/schema/src/blocks/event-list.ts`
- `packages/schema/src/blocks/activities-list.ts`
- The corresponding test files under `packages/schema/test/`
- Fixture data files **only if** the full test run reveals fixtures carrying
  URLs that fail the new validation (see Step 5) — fix the fixture URL, never
  relax the validator.

**Out of scope** (do NOT touch):

- `packages/renderer/**` — the fix is schema-level; renderer markup must not change.
- `packages/markdown/**` — it has its own `sanitizeUrl`; do not try to merge
  the two (cross-package import would invert the dependency direction).
- `packages/schema/src/validate.ts` — severity-tier logic is not involved;
  Zod refine failures surface through the existing parse path.
- The embed whitelist and document-downloads (see "Deliberately excluded").

## Git workflow

- Branch: `advisor/002-url-scheme-validation`
- One commit per logical unit is fine (e.g. extract + apply + tests can be a
  single commit); message style verb-first, e.g.
  `Add safe-URL-scheme validation to social/partner/event/activity links`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the validator into `packages/schema/src/url.ts`

Create `packages/schema/src/url.ts` containing `SAFE_URL_SCHEMES` and the
function moved **verbatim in behavior** from `cta-banner.ts:25-47`, renamed to
`isAcceptableLinkUrl`, with one addition: treat the empty string as
acceptable (optional fields may carry `""` as "unset"; required fields
already enforce non-emptiness via their own `.min(1)`):

```ts
import { z } from "zod"; // only if needed; otherwise no imports

export const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Validate a user-entered link URL. Returns true iff the value is safe to
 * put on an outbound `<a href>` attribute on a published static site.
 * Empty string is acceptable here ("unset"); required fields enforce
 * non-emptiness separately via `.min(1)`.
 */
export function isAcceptableLinkUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length === 0) return true;
  if (value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    return SAFE_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}
```

(Drop the `import { z }` line — it is not needed; shown only to flag that the
file should have no Zod dependency.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Refactor cta-banner to use the shared validator

In `packages/schema/src/blocks/cta-banner.ts`: delete the local
`SAFE_URL_SCHEMES` and `isAcceptableButtonUrl`, import
`isAcceptableLinkUrl` from `../url.js`, and use it in the existing
`.refine(...)` at line 53. Keep the existing `.min(1, "Button URL is
required.")` and the existing message text exactly as they are.

Note the behavioral equivalence: the old function returned `false` for `""`,
the new one returns `true` — but the field's `.min(1)` already rejects `""`,
so the schema's verdict for every input is unchanged.

**Verify**: `pnpm vitest run packages/schema` → all pass (the existing
cta-banner URL tests are the regression gate for this refactor).

### Step 3: Apply the refine to the five fields

Add `.refine(isAcceptableLinkUrl, { message: ... })` to each field listed in
"Current state", importing `isAcceptableLinkUrl` from `../url.js` in each
file. Use this message text, adjusted per field name:

> `"<Field> URL is malformed. Use a full URL (https://example.org), a site-relative path (/contact), or mailto:/tel: links."`

Concretely:

- `contact-card.ts` → `url: z.string().min(1).refine(isAcceptableLinkUrl, { message: "Social link URL is malformed. ..." })`
- `team-grid.ts` → same shape as contact-card (it has its own local `SocialLinkSchema`)
- `partner-logos.ts` → `url: z.string().min(1).refine(...).optional()` — keep `.optional()` **last**, matching the current chain order
- `event-list.ts` → `url: z.string().refine(...).optional()`
- `activities-list.ts` → `href: z.string().min(1).refine(...)` with message naming "Activity link URL"

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Add rejection/acceptance tests per block

In each of the five blocks' existing test files under
`packages/schema/test/`, add cases modeled on the URL cases in
`cta-banner-block.test.ts`:

- rejects a `javascript:`-scheme URL (use a harmless placeholder like
  `javascript:void(0)` — never an executable payload)
- rejects a `data:`-scheme URL
- rejects a bare domain without scheme (`www.example.org`)
- accepts `https://example.org`
- accepts a site-relative path `/contact`
- for the two optional fields (partner-logos, event-list): accepts the field
  being absent

**Verify**: `pnpm vitest run packages/schema` → all pass, including the new
cases (expect roughly 5 blocks × 5–6 cases of new assertions).

### Step 5: Run the full suite and reconcile fixtures

Run `pnpm test`. If any fixture-driven test outside `packages/schema` fails
(renderer goldens, themes templates, e2e fixtures, editor-app tests), inspect
the failing fixture's URL value:

- If it's a placeholder like `#`, a bare domain, or otherwise non-conforming:
  update the fixture to a conforming URL (`https://example.org/...` or a
  site-relative path). Golden files under
  `packages/renderer/test/__golden__/` regenerate via the documented
  golden-update flow in the failing test file's header — read it before
  regenerating; do not hand-edit goldens.
- If a fixture uses a scheme that looks legitimately needed (e.g. `geo:`,
  `whatsapp:`): STOP condition — the whitelist decision belongs to the
  maintainer.

**Verify**: `pnpm test` → exit 0; `pnpm lint` → exit 0.

## Test plan

- New tests: the per-block cases in Step 4, in the five existing
  `packages/schema/test/<block>-block.test.ts` files.
- Structural pattern: the URL-rejection cases in
  `packages/schema/test/cta-banner-block.test.ts`.
- Verification: `pnpm vitest run packages/schema` then full `pnpm test`, both
  exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0, including new URL cases in five block test files
- [ ] `grep -rn "isAcceptableButtonUrl" packages/schema/src` returns no matches
      (the local copy was removed)
- [ ] `grep -rln "isAcceptableLinkUrl" packages/schema/src/blocks` lists all
      six block files (cta-banner + the five)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift).
- Any in-repo fixture/template legitimately needs a scheme outside
  `http/https/mailto/tel` — extending the whitelist is a maintainer decision.
- Applying the refine breaks zip-import tests in a way that is **not** a
  fixture URL problem — i.e. if you find that `importFromZip` hard-crashes
  (rather than producing its typed `zip.dataJson.invalidShape` error carrying
  a `ValidationResult`) when `data.json` contains a bad URL, report that as a
  separate bug instead of working around it.
- You feel the need to modify renderer markup or `validate.ts`.

## Maintenance notes

- **Backward-compat tradeoff (flag in PR description)**: site exports created
  before this change that contain scheme-less URLs (`www.example.org`) in
  these five fields will now fail schema validation on import with
  `zip.dataJson.invalidShape`. This is the same posture cta-banner already
  shipped (its validator JSDoc: rejects "`javascript:` and `data:`, which are
  XSS vectors and have no legitimate use in this context"). The reviewer
  should confirm they accept retroactivity for the five new fields.
- Future block types with link fields must import `isAcceptableLinkUrl` —
  consider noting it in `docs/how-to-add-a-block.md` in a follow-up.
- The editor UI surfaces Zod messages as field errors; the message copy above
  follows the cta-banner phrasing so i18n treatment stays uniform.
