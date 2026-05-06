# 0028 — i18n framework + RO/EN editor catalogs

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #42

## Context

Issue #42 asks for the editor's i18n framework with TS-typed message keys.
RO is the source-of-truth language; EN parity is required from day one.
Default detection rule (PRD Implementation Decisions → Editor experience):
`ro-*` browser language → RO, everything else → EN. The user can override
the choice in editor settings, and the override persists across sessions.
The PRD also pins:

- "Editor UI is bilingual (RO default, EN parity from day one). Translation
  system with TS-typed message keys; missing-key detector in dev builds."
- A wider testing decision ("i18n: unit tests; missing-translation
  detector; fallback behavior").
- Out of scope for v1: locale-aware date/number formatting on built sites,
  RTL languages, mixed-language single pages, translation memory / AI
  translation, languages beyond RO/EN.

The PRD does **not** pin:

- The runtime library / engine. Hand-rolled is acceptable; so is
  `@formatjs/intl`, `i18next`, `lingui`, etc.
- The shape of the message keys (flat / nested, dot-namespaced or otherwise).
- The persistence mechanism (storage choice, location).
- The detection mechanism (when does the editor look at `navigator.language`,
  and what does the override take precedence over?).
- Where the runtime translator surface lives (a single React-style hook? a
  callable? a context?).

This ADR records those choices.

## Decision

### Library: hand-rolled

A 60-line message engine in `@sosb/i18n` with no runtime dependency on a
third-party i18n library. The engine supports:

1. **Named placeholders** — `Hello, {name}!` → substitutes `params.name`.
2. **Single-form ICU plural** — `{count, plural, one {# item} other {# items}}`
   → selects `one`/`other` per the active locale's plural rule.

That is the entirety of the format surface used by the editor's UI. We
deliberately stopped short of full ICU MessageFormat (no `select`, no
nested formats, no date/number/currency formatters, no RTL bidi handling)
because the PRD's scope-cuts already exclude every feature beyond named
substitution + count-aware plurals.

**Rejected: `@formatjs/intl-messageformat`.** Pulls ~20 KB of runtime plus
a CLDR plural-rule data table; for two locales whose plural rules are two
lines of TypeScript, the cost outweighs the benefit. Revisit if v2 adds
locales whose plural rules are non-trivial (Russian, Arabic, etc.).

**Rejected: `i18next`.** Designed around runtime catalog loading, namespace
hierarchies, post-processors, and language-detection plugins. We need a
single static catalog per locale, a simple string lookup, and a small
detector function. The library would be 90% inert weight.

**Rejected: `lingui` / `react-intl`.** React-coupled (we use Preact) and
require a build-time extraction step that fights the project's TS-typed
message-key model.

### Key naming convention: dot-namespaced flat string keys

```
topbar.import
topbar.export
tabs.editor
tabs.preview
form.array.itemCount
form.field.unset
settings.locale.legend
wizard.step.basics.title
wizard.action.next
welcome.action.template
welcome.recent.empty
```

The first segment is the **surface** (`topbar`, `tabs`, `form`, `settings`,
`wizard`, `welcome`). Subsequent segments narrow the location. The flat
shape (a `Record<string, string>` rather than nested objects) keeps:

- Catalog parity testable via a single `Object.keys(catalog)` diff.
- The TypeScript type a simple union — no recursive type machinery.
- Diff-friendly merges in PRs (one key per line).

The keys are TS-typed as a `EditorMessageKey` union exported from
`@sosb/i18n`. Both `en.ts` and `ro.ts` are typed `Record<EditorMessageKey,
string>`, so missing or stray keys fail typecheck.

**Rejected: nested namespace objects** (`{ topbar: { import: "Import" } }`).
Pretty in source files, but the type machinery for "every leaf is a string,
nested keys are typed paths" is heavier than the benefit. Flat string keys
also let the catalog-parity test stay one assertion long.

**Rejected: ICU-style `bundle:key` syntax.** Adds a parser at lookup time
without any structural advantage over `bundle.key`.

### Runtime, not build-time

Translations ship as TypeScript modules (`en.ts`, `ro.ts`) loaded at editor
boot. There is no build-time string extractor (à la lingui) and no runtime
catalog fetch. Both catalogs are a few KB total and cost less than a
single network round-trip; lazy-loading would buy nothing measurable while
forcing all consumers into an async-aware API.

This means adding a key is a strict-typing exercise:

1. Extend the `EditorMessageKey` union in `packages/i18n/src/locales/keys.ts`.
2. Add the message to `en.ts` AND `ro.ts`. TypeScript fails the build if
   either is missing the new key.
3. The catalog-parity vitest also fails CI as a backstop (the runtime test
   exists for the rare case where `EditorMessageKey` is widened by a
   refactor that doesn't immediately update both locales — e.g. a
   merge-conflict resolution that loses one side).

**Rejected: build-time string extraction.** The editor has under 200
strings. A custom Babel/TS plugin (or lingui CLI) is overkill, and the
indirection (`<Trans id="..." />` macro that the build replaces) makes
grepping the source for a string harder.

### Translator API: a callable function with attached methods

`createTranslator(...)` returns an object that is both callable
(`t("topbar.import")`) and carries methods (`t.locale`, `t.setLocale`,
`t.subscribe`). The shape is one symbol the JSX consumer imports, and the
ergonomics in markup are what readers expect:

```tsx
<button>{t("topbar.import")}</button>
```

The Preact binding lives in `@sosb/editor-app` (`I18nProvider` +
`useTranslator()`), not in `@sosb/i18n` itself. The framework-agnostic
package is therefore importable from non-Preact contexts (build pipeline
strings if we ever add them, the wizard's state machine, the Electron
shell's native dialogs).

**Rejected: a hook-only API.** Forces a Preact dependency on the i18n
package. The framework-agnostic version composes cleanly into the Preact
context binding without the reverse coupling.

**Rejected: a class.** No state worth class-shaped encapsulation; the
closure-over-listeners pattern of the rest of the codebase
(`createEditorState`, `createPreviewHost`) is consistent here too.

### Detection rule and override precedence

The PRD pins the rule: `ro-*` → RO, everything else → EN. We generalise to
a pure resolver in `detectLocale({ supported, defaultLocale,
navigatorLanguages })` that walks `navigator.languages` in priority order,
normalises each entry to its BCP-47 primary subtag, and returns the first
match against `supported`.

The host shell composes detection + persistence at boot:

1. Read `loadStoredLocale(vfs, SUPPORTED_LOCALES)`.
2. If null, fall back to `detectLocale(...)`.
3. Construct the translator with that locale.

The user override (the editor's settings toggle) calls
`saveLocale(vfs, locale)` plus `translator.setLocale(locale)`, so the
chosen locale persists into the same VFS the editor's auto-save uses. On
next boot step 1 wins, and the override is "always wins" by construction.

### Persistence: VFS-backed at `editor/locale.json`

The locale preference is a single-property JSON file
(`{"locale":"ro"}`) at `LOCALE_PREFERENCE_PATH = "editor/locale.json"`.
Same indent + trailing-newline convention as `@sosb/editor-state`'s
auto-save (see ADR 0005), so the editor's persisted state remains a
human-readable artifact across packages.

We deliberately do **not** wire `localStorage` or `IndexedDB` writes into
this package. The same reasoning ADR 0005 used applies here: the project
already has a VFS abstraction (#6), and adding a parallel storage layer
just for a single string is overhead. The host shell wires the appropriate
driver.

**Rejected: a locale field in `Site` / `data.json`.** The locale is a
**user preference**, not site content. Bundling it into the site export
would make a portable zip carry the original author's UI preference into
every reopen of that site — confusing and wrong.

**Rejected: cookie-based persistence.** Doesn't survive Electron, doesn't
survive a fresh browser profile, and conflates per-site preference with
per-domain preference.

### Missing-key behaviour: warn-once + return key

When `t("missing.key")` finds no message in either the active locale or
the default-locale fallback, the engine:

1. Returns the literal key (`"missing.key"`).
2. Emits `console.warn(...)` ONCE per key (subsequent lookups stay silent).

This is deliberately not a thrown error: in dev builds the developer sees
the warning and the missing key shows up visibly in the UI; in production
the worst-case outcome is a string that reads as a key rather than an
empty pane. Throwing would replace one cosmetic bug (missing translation)
with a functional one (crash on render).

The "missing-key detector in dev builds" the PRD requires is satisfied by
two layers:

1. **Build-time:** the catalog-parity test in `@sosb/i18n` fails CI if
   either locale lacks a key the other defines.
2. **Runtime:** `findMissingKeys(base, target)` is exported for any future
   in-editor "translation health" panel, and the per-key console.warn
   serves the dev-builds-only spirit of the PRD note (production builds
   could strip console statements; we keep them in v1 for honesty).

### Wizard fallback policy

The PRD says "Wizard fully translated (no fallback to RO); other strings
may fall back with console warning." We deliver the stricter contract by
having the catalog-parity test treat **every** key (including
`wizard.step.*` and `wizard.action.*` and `welcome.*`) as required across
both locales. The fallback chain still exists for safety against future
key additions racing one of the two catalogs, but the test makes the gap
visible immediately rather than waiting for a wizard user to hit it.

## Rationale

The dominant force here is "smallest implementation that satisfies every
PRD-level i18n requirement." Each library we considered would have added
runtime weight, indirection, or coupling that the editor's actual usage
does not justify. A small static engine, two flat catalogs, and a thin
Preact binding is enough.

The TS-typed `EditorMessageKey` union does the heavy lifting on
correctness: it makes "translate this string" a one-edit-per-locale
exercise that the compiler verifies. The catalog-parity test is a
backstop for cases where the union is widened mechanically (auto-merge,
codemod) without the corresponding catalog edits.

The persistence + detection design mirrors the auto-save design (ADR 0005) on purpose: the editor's "what does this user prefer" state lives
in one place — the VFS — and its driver is host-controlled.

## Consequences

- `@sosb/i18n` exports `createTranslator`, `detectLocale`,
  `loadStoredLocale`, `saveLocale`, `findMissingKeys`, the two catalogs
  (`enCatalog`, `roCatalog`), the `EditorMessageKey` union, and the locale
  constants.
- `@sosb/editor-app` exports `I18nProvider` and `useTranslator()` and
  accepts an optional `translator` prop on `<EditorApp>`. When omitted,
  it constructs a default English translator so existing callers and
  tests keep working unchanged.
- A new `<LocaleToggle />` component renders the editor-settings locale
  switch. Persistence is the host shell's responsibility (subscribe →
  `saveLocale`).
- `@sosb/wizard` exports `WIZARD_STEPS` and the `WIZARD_STEP_TITLE_KEY`
  map so #33's UI can iterate steps and look up titles via the same
  catalog the rest of the editor uses.
- Romanian translations are marked AI-drafted in
  `packages/i18n/src/locales/ro.ts`'s header comment. Native review is a
  documented follow-up rather than a blocker on the framework.
- `CONTRIBUTING.md` gains a "Translations" section documenting how to
  add a key and a small "what to translate / what not to" table.

## Alternatives considered

- **`@formatjs/intl-messageformat`** — full ICU at runtime cost. Rejected:
  feature surface vastly exceeds the editor's needs.
- **`i18next` / `lingui` / `react-intl`** — opinionated runtimes with
  build-time tooling. Rejected: framework coupling and weight outweigh the
  zero ergonomic benefit at this scale.
- **Build-time extraction macro** (`<Trans id="..." />`). Rejected:
  obfuscates source-grep for strings; saves nothing since we're not
  shipping a runtime translator API to consumers.
- **A locale field on `Site`.** Rejected: locale is a user preference, not
  site content.
- **`localStorage`** persistence. Rejected: same VFS-vs-parallel-storage
  reasoning ADR 0005 used; locks browsers into a path that doesn't suit
  Electron.
- **Throw on missing key in dev.** Rejected: turns a cosmetic UI bug into
  a render crash. The catalog-parity test catches the same class of error
  at CI time before it reaches a user.

## Out of scope

- Translating the rendered website output (only the editor UI is in
  scope; PRD: "No locale-aware date/number formatting in built sites in
  v1"). The site-author's own bilingual content lives in `pages[].lang`
  per ADR 0002 / the schema.
- Languages beyond RO/EN. Adding `hu`, `de`, etc. is "register a catalog
  in `SUPPORTED_LOCALES`, add a file under `locales/`"; the framework is
  ready, but the editorial cost is real (every key needs a quality
  translation per locale).
- Native-speaker review of the Romanian catalog. Tracked as the
  "ready-for-human" follow-up referenced in the issue body.
- A translation-health panel inside the editor (visualises
  `findMissingKeys`). The detector is wired to CI; an in-editor view is a
  nice-to-have for a future issue.
