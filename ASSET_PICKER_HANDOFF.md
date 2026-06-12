# Handoff — universal Asset picker (scope D)

**For:** Subagent-driven development (`subagent-driven-development` skill)  
**Branch:** Create a feature branch / worktree before Task 1 (see `using-git-worktrees`)  
**Glossary:** `CONTEXT.md` (updated this session — **Asset picker**, **Sibling alt**, **Document picker**)  
**Do not commit** unless the human explicitly asks.

---

## Goal

Every image slot in the editor uses the **Asset picker** (upload + thumbnail + Replace + Remove on optional slots). No human-editable `hash` / `path` / `mime` text fields (ADR 0044). Sibling alt fields stay the user-facing “Image description”; **dual-write** keeps them identical to `AssetRef.alt`.

Wizard stays upload-free (editor only).

---

## Locked decisions (do not re-litigate)

| Topic                           | Decision                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Scope                           | All image slots: existing `AssetRef` blocks + **hero**, **quote**, **eventList**, **`org.logo`**           |
| Legacy `z.string()` image paths | **No migrations** — change schema + rewrite in-repo fixtures in same PR                                    |
| Hero / quote alt                | Keep **`backgroundAlt`** / **`authorImageAlt`** siblings                                                   |
| Events / org alt                | Add **`events[].imageAlt`** / **`org.logoAlt`** siblings                                                   |
| Alt sync                        | **Dual-write** on sibling patch and on upload/replace                                                      |
| Wizard                          | **Editor only** — no picker in `@sosb/wizard`                                                              |
| Spine                           | Extend **`SpineForm`** like **`BlockForm`** (`schemaRenderers`, `uploader`, `displayUrlFor`)               |
| Picker UX                       | **Replace image** always when value set; **Remove image** on optional slots clears ref **and** sibling alt |
| Block envelope `version`        | Stay **`1`** — no `BLOCK_MIGRATIONS` entries                                                               |

---

## Already exists (extend, don’t reinvent)

| Artifact                     | Path                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Asset picker component       | `packages/editor-app/src/asset-picker.tsx`                                                       |
| Document picker              | `packages/editor-app/src/document-picker.tsx`                                                    |
| BlockForm dispatch           | `packages/editor-app/src/block-form.tsx` (`SCHEMA_RENDERERS`, `asset-picker` arm)                |
| Upload wiring                | `packages/editor-app/src/editor-app.tsx` (`uploadAssetForPicker`, `displayUrlForAsset`, VFS ref) |
| Canonical AssetRef schema    | `packages/schema/src/blocks/asset-ref.ts`                                                        |
| Form overrides ADR           | `docs/adr/0043-form-override-architecture.md`                                                    |
| No technical inputs ADR      | `docs/adr/0044-no-technical-field-escape-hatches.md`                                             |
| Prior plan (partial overlap) | `docs/plans/2026-05-11-form-overrides-and-pickers.md`                                            |
| E2e upload / round-trip      | `e2e/asset-picker-upload.spec.ts`, `e2e/round-trip-zero-reuploads.spec.ts`                       |

**Gaps called out in code today:**

- `hero.backgroundImage`, `quote.authorImage`, `eventList.events[].image`, `org.logo` are still **`z.string()`** (`packages/schema/src/blocks/hero.ts`, `quote.ts`, `event-list.ts`, `site.ts`).
- `uploadAssetForPicker` uses `alt: file.name` only — comment says sibling alt is “later issue”.
- `AssetPicker` has no **Replace** when thumbnail loads (only **Re-upload** on missing bytes).
- `SpineForm` has no `schemaRenderers` / upload props.

---

## Task graph (sequential subagents — one implementer at a time)

Execute in order. Each task: TDD → tests green → self-review → **spec reviewer** → **code quality reviewer** (per `subagent-driven-development`). Provide the **full task text** to each subagent; do not make them read this file.

### Task 1 — Schema + validation

**Files:** `packages/schema/src/blocks/hero.ts`, `quote.ts`, `event-list.ts`, `site.ts`, `validate.ts`, `packages/schema/test/*`

- Change image fields to `AssetRefSchema` (import from `./asset-ref.js`).
- Add `imageAlt` on `EventEntrySchema`, `logoAlt` on `OrgSchema`.
- Keep hero `backgroundAlt`, quote `authorImageAlt`.
- Update `validate.ts` warnings to use sibling alt rules for events; keep hero/quote rules.
- Rewrite schema tests + any fixtures under `packages/schema/test/fixtures/`.

**Acceptance:** `pnpm --filter @sosb/schema test` passes.

---

### Task 2 — Dual-write helper

**Files:** new `packages/editor-app/src/alt-sync.ts` (+ unit tests)

- Export helpers, e.g.:
  - `pairedAltPaths(assetPath, siblingAltPath)` for known block/spine shapes
  - `patchWithAltSync(onPatch, path, value, data)` — when patching sibling alt, also patch `AssetRef.alt` if ref exists; when patching asset ref from picker, set alt from sibling or upload input
- Document which path pairs exist (hero, quote, event item, org logo, gallery `images[].alt` + `images[].asset`, etc.).

**Acceptance:** `pnpm --filter @sosb/editor-app test` (unit) passes.

---

### Task 3 — Renderer + build + SEO

**Files:** `packages/renderer/src/blocks/hero.tsx`, `quote.tsx`, `event-list.tsx` (if applicable), `page-shell.tsx`, `packages/build/src/json-ld.ts`, `packages/build/test/*`, renderer tests/goldens

- Read `AssetRef.path` (and alt from ref — must match sibling after dual-write).
- Update `firstHeroBackgroundImage` / Twitter / `og:image` helpers that assumed string hero bg.
- Update JSON-LD `org.logo` when `org.logo` becomes `AssetRef`.
- Regenerate goldens if the project uses golden tests for affected blocks.

**Acceptance:** `pnpm --filter @sosb/renderer test` and `pnpm --filter @sosb/build test` pass.

---

### Task 4 — AssetPicker UX (Replace + Remove)

**Files:** `packages/editor-app/src/asset-picker.tsx`, `packages/editor-app/test/asset-picker.test.tsx`

- When `value` set: show **Replace image** (mirror `document-picker.tsx` replace button).
- Optional: `onClear?: () => void` prop — **Remove image** calls `onChange(undefined)` and parent clears sibling alt.
- Keep missing-asset **Re-upload** path.

**Acceptance:** component tests pass.

---

### Task 5 — Upload + BlockForm dual-write

**Files:** `packages/editor-app/src/editor-app.tsx`, `block-form.tsx`, `field-metadata.ts`

- Change uploader shape or wrap picker so upload receives **sibling alt** (fallback `file.name` if empty).
- Wire `alt-sync` into `BlockForm` `onPatch` for sibling alt fields and picker `onChange` / `onClear`.
- Add `eventList` → `imageAlt` and relabels in `BLOCK_FIELD_METADATA`.
- Add `hero` picker path if field tree now exposes `backgroundImage` as custom node (should auto-dispatch via `AssetRefSchema`).

**Acceptance:** `pnpm --filter @sosb/editor-app test` passes.

---

### Task 6 — SpineForm + org logo

**Files:** `packages/editor-app/src/spine-form.tsx`, `editor-app.tsx`, `field-metadata.ts` (`SPINE_FIELD_METADATA`)

- Pass `schemaRenderers` (same map as BlockForm for `AssetRefSchema`), `uploader`, `displayUrlFor` into `SpineForm`.
- Dispatch `asset-picker` in spine `FieldRenderer` (copy pattern from `block-form.tsx`).
- `org.logoAlt` label in `SPINE_FIELD_METADATA`; dual-write for `org.logo` / `org.logoAlt`.

**Acceptance:** spine-form tests + editor tests pass.

---

### Task 7 — Fixture / template sweep

**Files:** `packages/schema/test/fixtures/historipol.json`, `packages/themes/src/templates/**/data.json`, wizard-linked demo data, renderer/build goldens, `packages/editor-app` test fixtures

- Convert string image paths to full `AssetRef` objects (use placeholder assets already in repo where possible).
- Ensure sibling alt strings preserved on migration of shape.
- No `migrate.ts` entries.

**Acceptance:** full monorepo test target relevant to touched packages; `pnpm test` or package scripts per `package.json`.

---

### Task 8 — E2E

**Files:** `e2e/asset-picker-upload.spec.ts`, new or extended specs for hero bg + org logo in Site settings + round-trip

- Hero: drill in → upload → thumbnail → Replace.
- Site settings: `org.logo` upload.
- Export/import: zero re-upload for hero + logo.

**Acceptance:** e2e script from repo root (see `package.json` / CI).

---

## Verification (coordinator runs between tasks)

```bash
pnpm --filter @sosb/schema test
pnpm --filter @sosb/editor-app test
pnpm --filter @sosb/renderer test
pnpm --filter @sosb/build test
# e2e when Task 8 done — check package.json for exact command
```

Use **`verification-before-completion`** before claiming done.

---

## Subagent prompts (coordinator)

- Implementer template: `.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/subagent-driven-development/implementer-prompt.md`
- One implementer **at a time**; no parallel implementers (merge conflicts).
- After each task: spec reviewer → then code quality reviewer; loop until ✅.
- Model hint from skill: Tasks 1–4 often mechanical (faster model); Tasks 5–6 integration (standard); goldens/e2e (standard).

**Scene-setting snippet for every implementer:**

> You are implementing the universal Asset picker rollout for anosr-site-builder. Decisions are in `CONTEXT.md` and this handoff. Follow ADR 0043/0044. Do not add migration functions. Do not commit unless the user asked.

---

## Optional follow-up (out of scope unless human asks)

- ADR for **dual-write alt sync** (`docs/adr/`)
- Wizard logo step (explicitly deferred)
- Threading alt into re-upload when sibling was edited after upload

---

## Skills for next session

| Skill                            | Use                            |
| -------------------------------- | ------------------------------ |
| `subagent-driven-development`    | Execute tasks 1–8              |
| `using-git-worktrees`            | Isolate branch before Task 1   |
| `test-driven-development`        | Each implementer subagent      |
| `verification-before-completion` | Before marking tasks done      |
| `finishing-a-development-branch` | After all tasks + final review |

---

## Session origin

Design grilled in Cursor (`/grill-with-docs`): scope D, no migrations, sibling alt + dual-write, editor-only, SpineForm extension, Replace/Remove UX. User signed off with **lgtm**.
