# 0027 — DEPLOY.md generator

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #43

## Context

Issue #43 asks for the user-facing handoff that ships inside every
export zip: a `DEPLOY.md` walking a non-technical org officer through
publishing the site to Cloudflare Pages, in the user's editor language
(RO/EN), with both deploy paths (direct upload + Git-connected) and a
custom-domain section. The same content must render in the in-app
"Open guide" modal.

The PRD pins related decisions:

- **Cloudflare Pages is the only documented host.** The doc must not
  promise other hosts will work in v1.
- **`data.json` is portable across deploys.** `siteUrl` is a build-time
  option (ADR 0004), not a schema field — the doc treats it as an
  optional input, not a required one.
- **Editor UI is bilingual (RO default, EN parity from day one).** The
  generator must already support both; adding a third language must
  not require rewriting the generator.
- **No third-party scripts in published sites; no telemetry.** The doc
  must not encourage analytics integration or external tracking.

The PRD does **not** pin:

- where the doc copy lives (separate translation files? inline in the
  generator? `@sosb/i18n` keys?)
- how screenshots are handled (committed images? URL placeholders?
  inline base64?)
- whether the generator emits a string or writes a file
- whether it lives in `@sosb/zip`, `@sosb/build`, or a new package
- how it interacts with `@sosb/i18n` (which is empty in v1, #42)

This ADR records those choices.

## Decision

### Module: **`@sosb/zip`**

The generator lives at `packages/zip/src/deploy-md.ts` and is exported
from `@sosb/zip`'s public API. Reasoning:

- The generator's output is a **zip artefact** — `DEPLOY.md` is one of
  the four files every export ships (`data.json`, `assets/`, `dist/`,
  `DEPLOY.md`), and the zip module is the canonical place where
  exports are assembled (issue #6 / PR #51).
- The generator has zero runtime deps (pure string templating). It
  does not need its own package — it would be one file plus tests in
  isolation, and splitting it from `@sosb/zip` would add a workspace
  link without unlocking any independent reuse.
- The build pipeline (`@sosb/build`) intentionally produces only the
  `dist/` folder (ADR 0004). Adding a `DEPLOY.md` to its output would
  conflate two concerns (build the site vs. write a handoff doc) and
  break the "dist is byte-identical to renderer" determinism contract.

Rejected:

- **A new `@sosb/deploy-md` package.** Premature for ~400 lines of
  copy + ~80 lines of code.
- **Inside `@sosb/build`.** The build pipeline is "site data → static
  HTML"; the deploy doc is "site context → user-facing prose." They
  consume different inputs and have unrelated determinism contracts.

### API surface: **pure `(input) -> string`**

```ts
generateDeployMd(input: {
  language: "ro" | "en";
  org: { name: string };
  siteUrl?: string;
  customDomain?: string;
  screenshotsBaseUrl?: string;
}): string;
```

The function is pure: no I/O, no clock, no globals. The caller is
responsible for materialising the string into the zip (or rendering
it in the modal).

Reasoning:

- Same shape as `@sosb/build`'s `build()` — pure function, caller
  decides what to do with the output. Consistent with the
  "data flows through pure functions" stance of ADR 0003 and 0004.
- The in-app modal can call `generateDeployMd(input)` and pipe the
  string through any Markdown renderer (likely a strict-whitelist
  pass via `@sosb/markdown`, #9). The export path can call the same
  function and write the bytes verbatim into the zip. Both consumers
  see identical content.
- Determinism: same input produces byte-identical output. The test
  suite asserts this explicitly (`structuredClone(input)` produces
  the same bytes).

Rejected:

- **A class with chained methods (`new DeployMd().withLang("ro")...`).**
  Introduces stateful API for a single-call function. Pure functions
  are easier to test, easier to memoize, and impossible to misuse.
- **Async / streaming.** The string is small (~3 KB rendered). No
  reason to introduce async machinery.
- **Take a parsed `Site` directly.** Would couple the generator to the
  full schema. Most of the site data is irrelevant to the doc; a
  narrow input shape (org name, optional URLs) keeps the test surface
  small and means the generator does not break when the schema gains
  unrelated fields.

### Copy storage: **inline TypeScript constants, structurally typed**

Both language bundles live in the same file, bound to a `Copy`
interface. Adding a new language is two changes:

1. Extend the `DeployLanguage` union.
2. Add a `Copy`-conformant constant in the same file.

The interface enforces that no string is missing in any language —
adding a new section to the bundle without translating it is a
compile error.

Reasoning:

- `@sosb/i18n` is a placeholder package in v1 (#42 is still
  ready-for-human). The generator cannot depend on a key-lookup
  layer that does not exist.
- A separate `.json` per language would mean we cannot use template
  literals or computed values (the title and DNS body need
  interpolation). We could split into `.ts` per language, but that
  fragments review for a small bundle. One file, two constants,
  diff-friendly.
- When `@sosb/i18n` lands, this generator's bundles can move behind
  the same key-lookup interface without changing the public API:
  callers still pass `language: "ro" | "en"`, the generator either
  holds the strings inline (today) or fetches them through `@sosb/i18n`
  (tomorrow). The migration is internal.

Rejected:

- **Translation files in `@sosb/i18n`.** Package is empty in v1.
- **Separate `.md` template files with mustache-style placeholders.**
  Would need a templating engine (`{{customDomain}}`); current
  implementation uses TypeScript template literals with full type
  safety.

### Section order: **fixed, asserted by the test suite**

The doc emits sections in this order, every time:

1. Title + intro
2. (Optional) `siteUrl` note — only when `siteUrl` is provided
3. Prerequisites
4. Path 1: Direct upload
5. Path 2: Git-connected
6. Custom domain (with DNS + HTTPS sub-sections)
7. Next steps
8. Footer

The test suite asserts the order. Two reasons:

- The user-facing modal renders the same string; a stable order means
  scroll positions and section anchors stay consistent across
  rebuilds.
- The PRD's "two paths documented" implies a deliberate order — the
  non-technical path comes first (direct upload), the more advanced
  path second (Git-connected).

### Screenshot references: **committed-image filenames + repo-relative path**

The generator emits Markdown image references against
`docs/deploy/screenshots/<filename>.png`. The actual images are
committed by the maintainer after a real Cloudflare-dashboard walk
(see `docs/deploy/screenshots/README.md`).

Reasoning:

- The AC requires "screenshots produced and stored in repo (sourced
  from real Cloudflare dashboard)." Embedding base64 images would
  bloat the generator. URL-pointing to an external host would create a
  link-rot risk and violate the privacy stance ("no third-party
  scripts on published sites").
- `screenshotsBaseUrl` is an optional override so the in-app modal
  can serve images from a different origin if needed (e.g. a CDN
  origin distinct from the GitHub raw-content origin).
- Until the maintainer captures and commits the images, the doc still
  works as a text-only walkthrough — Markdown gracefully degrades
  broken images to alt text.

### Markdown safety: **inline-escape user-supplied strings**

The org name flows through a small inline-escape (`<` / `>` / `*` /
`_` / `` ` `` / `\` get escaped). We do **not** escape ampersand —
Markdown treats `&` as literal text, and `AT&T` should render as
`AT&T`, not `AT&amp;T`. The test suite asserts `<script>` does not
appear unescaped in output.

Reasoning:

- Org names are author-supplied and most Markdown renderers honour
  inline HTML, so a literal `<script>...` substring would execute in
  some viewers. Escape angle brackets defensively.
- We do not run a full Markdown sanitiser here because the generator
  is single-author (the user editing the org name) and the output is
  consumed by Markdown viewers, not rendered as HTML. The escape
  protects against the most common viewer behaviours; the actual
  hardening is the user's Markdown viewer choice.

### Language: **fail loudly on unsupported values**

Passing `language: "fr"` throws a `TypeError` at runtime. The TS type
already constrains the union, so this only triggers when a caller
casts past the type system. The error includes the bad value so a
caller diagnosing JSON deserialisation does not have to log
internally.

Rejected: **Fall back to RO silently.** Would hide the bug — a
deserialisation that lost the language flag would ship a Romanian
guide to an English-speaking user.

## Rationale

The most subtle requirement is "in-app modal shows the same content
as DEPLOY.md." The cleanest answer is to make the generator a pure
function with a single output: both consumers call it, both render the
result. The export path writes the bytes; the modal renders them
through the editor's Markdown viewer. Neither consumer transforms the
content; both see identical strings.

The second-most-subtle requirement is forward-compatibility with
`@sosb/i18n` (#42). By keeping the bundle structurally typed (`Copy`
interface) and the public API language-keyed (`language: DeployLanguage`),
we can swap the in-line constants for `@sosb/i18n` lookups when that
module lands without changing a single caller.

The decision to live in `@sosb/zip` is a directness call: this is one
of the four files exports always ship, the zip module is where exports
are assembled, and there is no second consumer that would justify a
new package.

## Consequences

- `packages/zip` gains a `tsconfig.test.json` (mirroring the schema
  and build packages) so the test suite and source can be type-checked
  together.
- `packages/zip/test/__golden__/` is an additive directory; the
  existing `packages/*/test/__golden__/**` glob in `.prettierignore`
  covers it without modification.
- `docs/deploy/cloudflare-pages.md` (maintainer reference) and
  `docs/deploy/screenshots/README.md` (capture protocol) join the
  docs tree.
- The placeholder `@sosb/zip` index now exports `generateDeployMd`
  and the related types; the rest of the zip API (`exportToZip` /
  `importFromZip`) lands later in #6 / #51 and does not conflict
  with this surface.

## Alternatives considered

- **Generate the doc inside the build pipeline.** Couples build
  (which produces the `dist/` folder) to a user-facing prose
  artefact. Their determinism contracts differ.
- **Render the doc directly to HTML via the renderer.** Markdown is
  the right format because (a) it's the project's strict-whitelist
  format already (#9), (b) the in-app modal needs a Markdown render
  step regardless, (c) a `.md` file ships well in a zip — many
  viewers and editors handle it natively.
- **Bundle screenshots as base64 inside DEPLOY.md.** Every export zip
  would carry ~MB of duplicate image data per release. The image
  files are far better stored once, in the repo, and referenced.
- **Make `siteUrl` and `customDomain` mandatory.** Would prevent
  early-stage exports (when the user has not yet picked a host or
  domain). The PRD positions the editor as fully usable before any
  deployment decision.
- **Generate prose from a YAML / JSON template + a renderer.** Would
  push complexity into a templating runtime for ~400 lines of copy.
  Direct TypeScript with structural types reads more clearly and
  type-checks for free.

## Out of scope

- **Hosts other than Cloudflare Pages.** Per PRD's distribution
  decision.
- **Capturing the actual screenshots.** Maintainer responsibility,
  documented in `docs/deploy/screenshots/README.md`.
- **In-app modal implementation.** Editor UI is #7; this ADR pins the
  generator the modal will call but does not implement the modal.
- **`@sosb/i18n` integration.** That module is #42; this generator
  uses inline constants today and can swap to `@sosb/i18n` lookups
  without changing its public API.
- **Lighthouse / accessibility budgets for the rendered modal
  content.** Markdown-only doc, rendered through the editor's existing
  Markdown viewer (covered by the editor's own tests).
