# Editor theming UI — design (PRD §41–46)

**Date:** 2026-05-07
**Author:** orchestrated brainstorming session
**PRD anchors:** §41 (theme picker), §42 (descriptions/preview), §43 (mid-edit
switching), §44 (token customization), §45 (contrast warnings), §46 (skip-
customization path)
**Status:** ready for implementation planning

---

## Problem

The renderer-side theming pipeline is complete: 5 themes ship CSS and per-theme
token defaults; `emitTokenRoot()` composes baseline → theme defaults → user
overrides into a `:root` rule that the live preview iframe and the exported
`dist/` build both consume; an axe-core CI gate runs against every theme via
`KNOWN_THEME_IDS`.

What is missing is the editor UI that lets a user **exercise** that pipeline:

- The wizard's identity step (`packages/wizard/src/steps/identity.tsx`) is the
  only place a theme can be picked. Once the editor opens, `theme.id` is shown
  by the schema-driven `spine-form` as a **plain text input**.
- `theme.tokens.colorPrimary`, `colorAccent`, `fontHeadline`, `fontBody`,
  `density`, and `radius` are defined in the schema and consumed by the
  renderer, but the spine-form renders all six as plain text inputs.
- There is no contrast warning, no preview-while-picking, no
  reset-to-theme-defaults affordance.

The schema is ready, the renderer is ready. The gap is purely an
`@sosb/editor-app` UI layer plus a shared theme-metadata registry in
`@sosb/themes`.

## Non-goals

- **No new themes.** The 5 themes shipped via PRs #81–#85 are the v1 set.
- **No new tokens.** The six-token surface (`colorPrimary`, `colorAccent`,
  `fontHeadline`, `fontBody`, `density`, `radius`) is fixed for v1.x by PRD
  §44 and the schema's additive-only commitment.
- **No custom CSS escape hatch.** PRD's "out of scope" section explicitly
  forbids custom CSS, plugin systems, or third-party themes.
- **No dark/light mode toggle.** PRD §211 defers this, with derivation from
  `bg`/`fg` tokens noted as the future path.
- **No schema migration.** All proposed changes are additive at the UI layer;
  `SITE_SCHEMA_VERSION` stays at `1`.
- **No replacement for the wizard's identity step.** The wizard keeps its
  own theme picker; both pickers consume the new shared registry so they
  agree on labels and descriptions.

## Architecture

### Layering, in one sentence

**`@sosb/themes`** owns the theme-metadata registry; **`@sosb/renderer`**
keeps owning the CSS modules and reads token defaults from the registry;
**`@sosb/editor-app`** introduces a `<ThemeEditor>` component that
`spine-form.tsx` mounts in place of the generic `theme` field tree, mirroring
the existing "spine carves out blocks" carve-out pattern.

### Module changes

```
packages/themes/src/registry.ts            (NEW)
  - export interface ThemeDescriptor { id, label, description, tokenDefaults }
  - export const THEMES: readonly ThemeDescriptor[]
  - re-exported from packages/themes/src/index.ts

packages/themes/src/index.ts               (MODIFIED — add registry exports)

packages/renderer/src/themes/<theme>.ts    (UNCHANGED)
  - The renderer keeps owning its per-theme constants (e.g. `ACADEMIC_THEME_TOKENS`
    as `[cssProp, value]` array, `EDITORIAL_THEME_TOKENS` as schema-keyed record).
  - These already include renderer-internal extras (type scale, measures, etc.)
    that have no place in a cross-package metadata registry.
  - The registry IMPORTS these constants and derives only the schema-keyed
    subset (6 tokens) it needs for the editor's `<TokenForm>` placeholders.
  - Net behavior unchanged: the renderer's `themeCssFor`, `themeDefaultsFor`,
    and `themeBaselineTokensFor` switches all keep working exactly as today.

packages/wizard/src/steps/identity.tsx     (MODIFIED)
  - delete the local `THEMES` array
  - import `THEMES` from `@sosb/themes`
  - render the same radio UI from descriptors (no behavior change)

packages/editor-app/src/contrast.ts         (NEW)
  - hex/rgb parsing + WCAG 2.2 relative-luminance formula
  - `contrastRatio(foreground, background): number`
  - `meetsAaNormal(ratio): boolean` — ratio ≥ 4.5
  - ~25 lines, no dependencies

packages/editor-app/src/theme-editor.tsx   (NEW)
  - <ThemeEditor site={site} onPatch={onPatch}>
  -   <ThemePicker /> (PRD §41 §42 §43)
  -   <TokenForm />   (PRD §44 §46)
  -   <ContrastWarning /> (PRD §45)
  -   <ResetToThemeDefaults /> (PRD §46)
  - all controls call onPatch(path, value) so undo/redo & preview live-update
    work via existing wiring

packages/editor-app/src/spine-form.tsx     (MODIFIED — minimal carve-out)
  - in `case "object"` branch: if node.path equals ["theme"], render
    <ThemeEditor> instead of recursing into children
```

No changes to `@sosb/schema`, `@sosb/build`, `@sosb/preview-bridge`,
`@sosb/editor-state`, the iframe-render contract, or the `:root` CSS shape.

### Data flow

```
User clicks a theme card in <ThemePicker>
   └─ onPatch(["theme", "id"], "civic")
       └─ editor-state reducer updates the snapshot
           └─ preview-bridge posts the new site to the iframe
               └─ iframe calls renderSite(site, "civic")
                   └─ themeCssFor("civic") + emitTokenRoot(site, civicDefaults)
                       └─ <style> in iframe re-applies
                           ⇒ live theme switch, no DOM rebuild

User drags the density slider in <TokenForm>
   └─ onPatch(["theme", "tokens", "density"], "1.15")
       └─ same path; emitTokenRoot picks up the user override
           ⇒ live density change

User exports the site
   └─ packages/build calls renderSite(site, themeId) — same code path
       ⇒ user overrides land in dist/index.html's :root rule
```

The "site CSS" verification reduces to a single guarantee:
**`renderSite()` is the sole producer of `:root` tokens, called identically
by the live iframe preview and the exported build.** No new pipeline; the
spec adds a regression test that asserts this round-trip.

## Component design

### `<ThemePicker>`

**Layout.** Five cards in a 5×1 grid (mobile: 1×5). Each card shows the
theme's display name (PRD §41), the one-line description (PRD §42), and a
small color-swatch row drawn from `tokenDefaults.colorPrimary` and
`colorAccent`. The active card has a checked-radio state; cards are
keyboard-focusable and Space/Enter selects.

**Behavior.** Clicking a card calls `onPatch(["theme", "id"], descriptor.id)`.
PRD §43 ("switch themes mid-edit without losing content") is satisfied for
free: changing `theme.id` does not touch any other field.

**i18n.** Labels and descriptions resolve through `useTranslator()` and the
descriptor's `label.{ro,en}` / `description.{ro,en}` fields.

### `<TokenForm>`

**Default state: collapsed.** PRD §46 ("skip token customization, accept
the theme's intended palette") is the default. The form renders a single
"Customize colors and typography" disclosure button. Expanding it reveals
six controls — pre-populated with the active theme's defaults so the user
sees current values, but the schema fields stay `undefined` until edited
(so removing customization reverts to defaults cleanly).

**Six controls, by token:**

| Token            | Control                          | Why this control                                        |
| ---------------- | -------------------------------- | ------------------------------------------------------- |
| `colorPrimary`   | `<input type="color">` + hex     | Native color picker is zero-bytes, accessible, OS-themed |
| `colorAccent`    | same                             | same                                                    |
| `fontHeadline`   | `<select>`                       | Curated list (see "user contribution" below)            |
| `fontBody`       | `<select>`                       | same                                                    |
| `density`        | `<select>` of named scales       | Discrete choices map cleanly to a multiplier string     |
| `radius`         | `<select>` of named scales       | same                                                    |

**Patch shape.** Every control calls `onPatch(["theme", "tokens", <key>], value)`.
Choosing the empty option ("Use theme default") calls
`onPatch(["theme", "tokens", <key>], undefined)`, which removes the field
on the next snapshot — letting `emitTokenRoot` fall back to the theme's
default value.

**Design rationale — why `<select>` for density and radius rather than
`<input type="range">`?** Sliders feel continuous, but the underlying
schema is `z.string()` and the rendered values must be a small named set
(or the user can produce visually broken pages with `density: "0.41"`).
A select with three or four named entries removes that risk and labels
the UX intent.

### `<ContrastWarning>` (PRD §45)

**Computation.** Compute contrast against the **effective** `--color-bg`
the renderer would emit for the current site, not the bare baseline. The
rule mirrors `emitTokenRoot`'s order:

```
effectiveBg =
   user override (site.theme.tokens.colorBg)            // not in v1 tokens — null
   ?? activeTheme.tokenDefaults["--color-bg"]           // theme-specific bg if set
   ?? activeTheme.themeBaseline `--color-bg` entry      // CSS-prop baseline
   ?? "#ffffff"                                          // tokens.ts BASELINE
```

Today, `--color-bg` is only set in the renderer's `BASELINE_TOKENS`
(`#ffffff`) — no theme overrides it through `themeDefaults` or
`themeBaseline`. The lookup helper still walks the chain so the contrast
util stays correct if a theme later defines its own bg (civic was
considered for cream but ships white). The lookup helper lives in
`packages/editor-app/src/contrast.ts` next to the ratio calculation;
it has no schema dependency, only the registry and the renderer's exposed
baseline.

When the user has set a custom `colorPrimary` or `colorAccent`, compute
the contrast ratio between that hex and `effectiveBg`. If ratio < 4.5
(WCAG 2.2 AA normal text), render a warning under the affected color
field with the offending ratio shown to one decimal place.

**Severity.** Warning, not error. PRD §66 ("low contrast → warnings, not
errors"). The user can ignore it and ship; PRD §58 ("publish with
warnings via confirmation") covers the egress side.

### `<ResetToThemeDefaults>`

**Behavior.** A button visible only when `site.theme.tokens` has any
defined keys. Clicking it calls
`onPatch(["theme", "tokens"], undefined)`, clearing the override object
entirely. Confirmation modal: "Discard your color/font/density/radius
customizations and return to <theme-name>'s defaults?"

This is the explicit form of PRD §46; the implicit form (per-field "Use
theme default" entries in each control) covers granular reset.

### Spine-form carve-out (in `spine-form.tsx`)

The change is two lines. Inside `FieldRenderer`'s `"object"` branch, before
recursing:

```tsx
if (node.path.length === 1 && node.path[0] === "theme") {
  return <ThemeEditor site={site} onPatch={onPatch} />;
}
```

Same precedent as the docstring's "block forms are intentionally not
rendered here". The carve-out is by-path, not by-name, so it survives
field renames in the schema (which won't happen in v1.x anyway).

## Validation & error handling

- **Hex parsing.** `<input type="color">` always emits valid `#rrggbb`. We
  don't accept free-form hex from a text input, so there is no parse
  failure surface.
- **Empty/cleared field.** Each `<select>` has a "Use theme default" option
  whose value is `""`; on selection, the patch is `undefined`. The schema
  treats `tokens.<x>` as `optional()`, so the patch round-trips cleanly.
- **Reset.** `onPatch(["theme", "tokens"], undefined)` produces a site
  with `theme.tokens` absent. `emitTokenRoot` already guards on
  `site.theme.tokens ?? {}` and continues without overrides.
- **Unknown theme id.** Already handled by the renderer (`themeCssFor`
  falls through to `STUB_THEME_CSS`). The picker only emits ids from the
  registry, so this is defense-in-depth.

## Test plan

### Unit (vitest, co-located)

- `packages/themes/test/registry.test.ts` — descriptor shape, every
  registered id has matching CSS in the renderer, every `tokenDefaults`
  uses keys from `SCHEMA_TOKEN_MAP`.
- `packages/editor-app/test/contrast.test.ts` — golden values
  (white/black ⇒ 21, white/yellow ⇒ ~1.07, civic primary on white ⇒ ratio).
- `packages/editor-app/test/theme-editor.test.tsx` — `<ThemePicker>` patch
  shape, `<TokenForm>` patch shape, "Use theme default" emits `undefined`,
  reset emits `undefined` at the `tokens` path, contrast warning appears
  iff custom color < 4.5 against bg.
- `packages/renderer/test/tokens.test.ts` (existing file, add cases) —
  user override beats theme default beats baseline (covers the §44 round-
  trip from a renderer-pure angle).

### Integration

- `packages/editor-app/test/spine-form.test.tsx` — when site has
  `theme: { id: "civic" }`, the spine-form renders `<ThemeEditor>` and
  *does not* render the generic object-fieldset for `theme`.
- `packages/wizard/test/identity.test.tsx` — wizard's identity step still
  renders the same five radios with descriptions sourced from the new
  shared registry (regression).

### E2E (Playwright)

- `e2e/theming.spec.ts` — open a fresh site, switch from `academic` to
  `civic` via the picker, assert the iframe's computed `--color-primary`
  changed; expand the token form, set a custom `colorPrimary` to a poor-
  contrast hex, assert the warning appears; export, unzip, parse
  `dist/index.html`'s `:root` rule, assert the custom color is present.

This last test is the **"site CSS verification"** the user called out:
end-to-end proof that token edits made in the editor reach the exported
build's CSS.

## Acceptance criteria (PRD coverage matrix)

| PRD § | Story (abbrev.)                                    | Verified by                        |
| ----- | -------------------------------------------------- | ---------------------------------- |
| §41   | Pick from 5 themes mid-edit                        | `<ThemePicker>` test + e2e         |
| §42   | One-line description + preview                     | Registry test + visual snapshot    |
| §43   | Switch themes mid-edit without losing content      | E2E theme-switch test              |
| §44   | Customize 6 tokens via UI                          | `<TokenForm>` tests + e2e          |
| §45   | Contrast warning under AA                          | Contrast util + `<TokenForm>` test |
| §46   | Skip token customization                           | Default-collapsed state, reset test |

CI gates already in place that this work must not regress:

- Per-theme axe-core a11y (`e2e/a11y.spec.ts`) — themes still pass after
  any token-default reorganization in the renderer.
- Lighthouse 95+ budgets (`lighthouserc.json`) — exporter still hits
  budgets after token overrides land in `dist/`.

## Open decisions for the user (learning-mode contributions)

These three are **not blockers for the spec** — they are decisions whose
default implementation I will leave as TODOs in the prepared files, for
the user to fill in during the implementation pass. Each is 5–10 lines of
domain-judgment code where the user's input genuinely shapes the result.

### Decision 1 — Theme descriptions

**File:** `packages/themes/src/registry.ts`
**Lines:** 5 themes × `{ ro: string; en: string }` description fields.
**Why it matters:** PRD §42 demands a one-line description that helps a
non-technical officer pick the right theme without committing. The
existing wizard descriptions are functional but written by a developer
mid-stream — content/voice review is high-leverage.
**Trade-off:** Punchy and evocative ("Senate-floor gravitas") risks
sounding pretentious; bland and literal ("Blue with serif headings")
fails to differentiate. Find the middle.

### Decision 2 — Density and radius scale values

**File:** `packages/editor-app/src/theme-editor.tsx`, `<TokenForm>`
**Lines:** ~6 lines per scale defining the named entries.

```ts
// Density — multiplier applied to spacing tokens at render time.
// Picking these wrong makes pages look cramped or empty.
const DENSITY_OPTIONS = [
  { id: "compact",     label: "Compact",     value: "0.85" },  // TODO: tune
  { id: "comfortable", label: "Comfortable", value: "1" },     // theme default
  { id: "spacious",    label: "Spacious",    value: "1.15" },  // TODO: tune
];

// Radius — applied to --radius. Shipped themes range from 0px (civic) to
// 16px (modern). User picks the named bucket.
const RADIUS_OPTIONS = [
  { id: "square",  label: "Square",  value: "0px" },
  { id: "subtle",  label: "Subtle",  value: "4px" },
  { id: "rounded", label: "Rounded", value: "8px" },
  { id: "soft",    label: "Soft",    value: "16px" },
];
```

**Why it matters:** These multiplier values are a designer judgement call.
0.85 might be too tight, 1.15 too generous; a 24px "soft" entry might be
better than 16px. The shipped themes' baseline values give a calibration
point, but the named scale needs to feel intentional.

### Decision 3 — Font dropdown candidates

**File:** `packages/editor-app/src/theme-editor.tsx`, `<TokenForm>`
**Lines:** Two `FONT_OPTIONS_HEADLINE` / `FONT_OPTIONS_BODY` arrays,
~5 entries each.

**Why it matters:** PRD §80 forbids third-party scripts by default.
Google Fonts (or any external font CDN) violates that. So the candidate
set is constrained to system fonts plus whatever the themes already
declare in their CSS modules. The choice of which 5–6 system stacks to
expose (Georgia / Cambria / Charter for serif; Inter / system-ui /
Helvetica for sans) shapes the expressive range of the tool.

**Constraint:** Every offered value must be safe across Mac / Windows /
Linux. A "Charter" entry that exists on Mac but falls back to Times on
Windows isn't acceptable without the fallback being equivalently nice.

## Out-of-band: assumptions worth flagging

1. The renderer's per-theme token constants come in two shapes today:
   schema-keyed records (`EDITORIAL_THEME_TOKENS`) and raw `[cssProp,
   value]` arrays with renderer-internal extras (`ACADEMIC_THEME_TOKENS`,
   `CIVIC_THEME_BASELINE_TOKENS`). The registry derives a schema-keyed
   subset from whichever shape each theme uses, so both layouts can
   continue to coexist. The renderer keeps its current switches.
2. The wizard's existing translation strings for the 5 themes
   (`packages/i18n/...` keys for theme labels and descriptions) are the
   starting point for the registry's `label`/`description` fields. The
   wizard becomes a passthrough; the i18n keys may be renamed for clarity
   but no string content is lost.
3. The e2e test relies on the existing browser-shell export flow being
   green. If `MERGE_HANDOFF.md`'s follow-up #2 (assets browser pipeline
   recovery) is still pending when this work lands, the e2e site-CSS
   round-trip test will be skipped with an explicit `test.skip` and a
   reference to the blocking issue. The unit and integration tests are
   not affected.

## Sequencing

Implementation arrives in dependency order:

1. **Registry first.** `packages/themes/src/registry.ts` + index export.
   Registry imports each theme's existing token constants from the
   renderer and derives the schema-keyed subset it needs. Wizard switches
   to consume the registry's `label`/`description`. Renderer untouched.
   (Pure additive change, no UI change yet.)
2. **Contrast util.** `packages/editor-app/src/contrast.ts` + unit tests.
   (Standalone module, easy to land.)
3. **`<ThemeEditor>` component.** Build it against the registry; keep it
   un-mounted from the spine-form initially so it can be tested in
   isolation.
4. **Spine-form carve-out.** Two-line change to `spine-form.tsx`
   ("if `theme`, render `<ThemeEditor>`"). Now the UI is wired.
5. **E2E and verification.** Playwright theming spec, regression
   guards, golden updates if needed.

Each step lands as its own PR. The full sequence ships PRD §41–46.
