# Hero Overlay + Eyebrow Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every theme a single, foolproof full-bleed hero — text composited over the background image with a guaranteed-legible scrim, fluid title — and remove the `eyebrow` field entirely.

**Architecture:** One universal hero treatment lives in the shared `production-base.ts` layer and consumes engine tokens from Plan 1 (`--type-3xl`, `--color-fg-rgb`, `--measure-*`). All five themes' bespoke per-theme hero CSS is stripped so the shared overlay wins uncontested (the renderer composes `stub → production-base → theme` as one stylesheet, theme last, so per-theme hero rules would otherwise override the shared overlay). The `eyebrow` schema field, its renderer branch, editor metadata, and seed/fixtures are removed; `z.looseObject` keeps old snapshots valid. The renderer's pure `(Site, themeId) → HTML` contract is unchanged.

**Tech Stack:** TypeScript, Preact (build-time templating), Vitest (unit + `toMatchFileSnapshot` goldens), pnpm workspaces, Zod schema.

**Base branch:** `feat/theme-engine-base` (`a3b80d9` — contains the Plan 1 engine: fluid type scale, `--color-*-rgb`, contrast-safe on-colors, density/radius wiring). Create the execution worktree from THIS commit (it already includes the engine + the WIP themes).

**Conventions (every task):**

- Single test file: `pnpm vitest run <path>`; by name: `pnpm vitest run <path> -t "<name>"`.
- Regenerate goldens: `pnpm vitest run -u packages/renderer` (and `pnpm vitest run -u packages/build` for build goldens).
- Typecheck: `pnpm --filter @sosb/renderer run typecheck` / `pnpm --filter @sosb/schema run typecheck` / `pnpm --filter @sosb/editor-app run typecheck`.
- Whole repo: `pnpm test`. All commands from repo root.

**Design of the universal hero (no ornament — fundamentals only):**

- **No image:** left-aligned lockup on the page background; title in `--color-primary` at fluid `--type-3xl`; subtitle in `--color-fg` at `--type-lg`; both capped to a readable measure.
- **With image (`hero--has-image`):** the `<img>` becomes a full-bleed background layer (`position:absolute; inset:0; object-fit:cover`); a bottom-anchored dark scrim (`rgba(var(--color-fg-rgb), …)`) guarantees legibility; the lockup sits bottom-left in white. No CTA (the hero schema has no CTA field; CTAs are separate `ctaBanner` blocks).
- The scrim tints from the theme's `--color-fg` (dark by contract for every theme), so it's palette-tied yet always dark enough for white text.

---

## File Structure

- **Modify** `packages/schema/src/blocks/hero.ts` — delete the `eyebrow` field + its doc mention.
- **Modify** `packages/schema/test/hero-block.test.ts` — drop the `eyebrow` line from the populated-fields fixture.
- **Modify** `packages/renderer/src/blocks/hero.tsx` — remove eyebrow; restructure markup for overlay (`hero--has-image`, media as first child / background layer).
- **Modify** `packages/renderer/src/themes/production-base.ts` — add the universal hero treatment (base + `hero--has-image` overlay + fluid title).
- **Modify** `packages/renderer/src/themes/{academic,civic,editorial,minimal,modern}.ts` — strip all per-theme hero CSS rules (and the dead eyebrow rules).
- **Modify** `packages/renderer/src/themes/stub.ts` — remove the now-dead `.hero__eyebrow` rule (optional hygiene; keeps the stub golden tidy).
- **Modify** `packages/editor-app/src/field-metadata.ts` + `packages/editor-app/test/field-metadata.test.ts` — remove the hero `eyebrow` override + its test.
- **Modify** `packages/renderer/test/render-site.test.ts` — replace the eyebrow-rendering test with a hero-markup test.
- **Modify** the five rendered-production-theme hygiene tests — loosen the `rgb()` assertion to permit `rgba(var(--token), …)`.
- **Modify** seed + `.ts` fixtures that statically type hero data — strip `eyebrow` (required for typecheck): `packages/themes/src/templates/asociatia-studenteasca-demo/data.json`, `packages/renderer/test/a11y-fixture.ts`, `scripts/generate-historipol-site.ts`.
- **Add** a hero-overlay CSS test: `packages/renderer/test/hero-overlay.test.ts`.
- **Regenerate** hero + affected goldens (`packages/renderer/test/__golden__/*`, `packages/build/test/__golden__/*`).
- **Optional cleanup** (do, low-risk): strip `eyebrow` from JSON fixtures so fixtures/goldens stay honest (`hero-only*.json`, `civic-hero.json`, `multi-page.json`, `bilingual.json`, build fixtures). `z.looseObject` makes these non-blocking, but stripping keeps goldens free of stale eyebrow paragraphs.

---

## Task 1: Remove the `eyebrow` schema field + non-renderer touchpoints

Do schema + editor + their tests first; the renderer change (Task 2) depends on the field being gone for a clean TS type.

**Files:**

- Modify: `packages/schema/src/blocks/hero.ts`
- Modify: `packages/schema/test/hero-block.test.ts`
- Modify: `packages/editor-app/src/field-metadata.ts`
- Modify: `packages/editor-app/test/field-metadata.test.ts`

- [ ] **Step 1: Delete the schema field**

In `packages/schema/src/blocks/hero.ts`, change `HeroDataSchema` from:

```ts
export const HeroDataSchema = z.looseObject({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: AssetRefSchema.optional(),
  backgroundAlt: z.string().optional(),
});
```

to:

```ts
export const HeroDataSchema = z.looseObject({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImage: AssetRefSchema.optional(),
  backgroundAlt: z.string().optional(),
});
```

Also update the doc comment just above it: change "may carry an optional eyebrow and a background image" to "may carry a background image". `z.looseObject` preserves any `eyebrow` key still present in old snapshots, so this is non-breaking for stored data.

- [ ] **Step 2: Drop the eyebrow line from the schema test fixture**

In `packages/schema/test/hero-block.test.ts`, find the "all optional fields populated" test data object (~line 26) and delete its `eyebrow: "Bun venit",` line. (No assertion checks eyebrow, so this is cleanup, but it must not claim a field that no longer exists.)

- [ ] **Step 3: Remove the editor field-metadata override**

In `packages/editor-app/src/field-metadata.ts`, in the `hero` entry of `BLOCK_FIELD_METADATA` (~lines 61-64), delete the object `{ path: "eyebrow", label: "Small label above title" }`. Keep the `backgroundAlt` entry.

- [ ] **Step 4: Delete the field-metadata eyebrow test**

In `packages/editor-app/test/field-metadata.test.ts`, delete the entire test case "BLOCK_FIELD_METADATA uses plain copy for hero eyebrow" (~lines 69-72) that asserts the `eyebrow` override label. The "relabels every alt-bearing block" test is unaffected (it matches on `backgroundAlt`).

- [ ] **Step 5: Run the schema + editor tests + typecheck**

Run: `pnpm vitest run packages/schema/test/hero-block.test.ts packages/editor-app/test/field-metadata.test.ts`
Expected: PASS.
Run: `pnpm --filter @sosb/schema run typecheck` and `pnpm --filter @sosb/editor-app run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/blocks/hero.ts packages/schema/test/hero-block.test.ts packages/editor-app/src/field-metadata.ts packages/editor-app/test/field-metadata.test.ts
git commit -m "feat(schema): remove hero eyebrow field + editor metadata"
```

---

## Task 2: Restructure the hero markup for overlay (and drop eyebrow JSX)

**Files:**

- Modify: `packages/renderer/src/blocks/hero.tsx`
- Modify: `packages/renderer/test/render-site.test.ts`
- Test: `packages/renderer/test/render-site.test.ts`

- [ ] **Step 1: Replace the eyebrow-rendering test with a hero-markup test**

In `packages/renderer/test/render-site.test.ts`, replace the test "renders the eyebrow as a small grouping label above the heading" (~lines 126-129) with:

```ts
test("hero with a background image marks the section and layers media before the lockup", () => {
  const html = renderSite(fixture, "stub");
  // The hero fixture (hero-only.json) carries a backgroundImage.
  expect(html).toMatch(/<section[^>]*data-block="hero"[^>]*class="hero hero--has-image"/);
  // Media comes before the lockup so it can sit behind the text.
  const mediaIdx = html.indexOf('class="hero__media"');
  const innerIdx = html.indexOf('class="hero__inner"');
  expect(mediaIdx).toBeGreaterThan(-1);
  expect(innerIdx).toBeGreaterThan(mediaIdx);
  // Eyebrow is gone.
  expect(html).not.toContain("hero__eyebrow");
});
```

Note: this assumes `hero-only.json` has a `backgroundImage`. Verify with `grep -n backgroundImage packages/renderer/test/fixtures/hero-only.json`. If it does NOT, instead point the test at a fixture that does (e.g. `hero-only-modern.json`) by importing it, or add a `backgroundImage` to the test's cloned fixture. Confirm before writing the assertion.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/renderer/test/render-site.test.ts -t "background image marks the section"`
Expected: FAIL (current markup has no `class` on the section, media is after the lockup, and `data.eyebrow` still renders).

- [ ] **Step 3: Rewrite `hero.tsx`**

Replace the body of the `Hero` component in `packages/renderer/src/blocks/hero.tsx` with:

```tsx
export function Hero(props: {
  block: HeroBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { id, data } = props.block;
  const title = data.title;
  const subtitle = typeof data.subtitle === "string" ? data.subtitle : undefined;
  const backgroundImagePath = assetRefPath(data.backgroundImage);
  const backgroundImage =
    backgroundImagePath !== undefined
      ? resolveAssetUrl(backgroundImagePath, props.assetUrlForPath)
      : undefined;
  const backgroundAlt =
    typeof data.backgroundAlt === "string" && data.backgroundAlt.length > 0
      ? data.backgroundAlt
      : assetRefAlt(data.backgroundImage);
  const hasImage = backgroundImage !== undefined;

  return (
    <section
      data-block="hero"
      data-block-id={id}
      class={hasImage ? "hero hero--has-image" : "hero"}
      aria-labelledby={`${id}__title`}
    >
      {hasImage && (
        <div class="hero__media">
          <img src={backgroundImage} alt={backgroundAlt} loading="lazy" />
        </div>
      )}
      <div class="hero__inner">
        <h1 id={`${id}__title`} class="hero__title">
          {title}
        </h1>
        {subtitle !== undefined && <p class="hero__subtitle">{subtitle}</p>}
      </div>
    </section>
  );
}
```

This removes the `eyebrow` derivation and JSX branch, adds the `hero`/`hero--has-image` class hook, and moves `.hero__media` before `.hero__inner` so CSS can layer it behind the lockup. Reading order keeps the image (with `alt`) then the title/subtitle; the section stays `aria-labelledby` the title.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run packages/renderer/test/render-site.test.ts -t "background image marks the section"`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sosb/renderer run typecheck`
Expected: no errors (note `data.eyebrow` is gone from `HeroData`; the old derivation referencing it has been removed).

- [ ] **Step 6: Commit (goldens regenerated in Task 6)**

```bash
git add packages/renderer/src/blocks/hero.tsx packages/renderer/test/render-site.test.ts
git commit -m "feat(renderer): overlay-ready hero markup, drop eyebrow JSX"
```

---

## Task 3: Universal hero treatment in `production-base.ts`

> **EXECUTION ORDER:** The scrim added here introduces `rgba(var(--color-fg-rgb), …)` into production-theme CSS, which trips the `rgb()` hygiene assertions in the five theme tests. **Execute Task 5 (loosen those assertions) IMMEDIATELY BEFORE this task** so the suite never goes red across a commit. Treat Tasks 5 → 3 → 4 as a contiguous run (Task 5 first). The numbering reflects topical grouping, not execution order.

**Files:**

- Modify: `packages/renderer/src/themes/production-base.ts`
- Test: `packages/renderer/test/hero-overlay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/renderer/test/hero-overlay.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { PRODUCTION_SITE_BASE_CSS } from "../src/themes/production-base.js";

describe("universal hero treatment (production base)", () => {
  test("base hero title uses the fluid --type-3xl token and primary color", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero__title\s*\{[^}]*font-size:\s*var\(--type-3xl\)/,
    );
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero__title\s*\{[^}]*color:\s*var\(--color-primary\)/,
    );
  });

  test("has-image hero makes media a full-bleed absolute layer", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero--has-image");
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero--has-image\s+\.hero__media\s*\{[^}]*position:\s*absolute/,
    );
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero--has-image\s+\.hero__media\s+img\s*\{[^}]*object-fit:\s*cover/,
    );
  });

  test("has-image hero applies a token-based dark scrim and white lockup text", () => {
    // Scrim uses rgba(var(--color-fg-rgb), …) — a token, never a literal color.
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/rgba\(var\(--color-fg-rgb\)/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(
      /\.hero--has-image[^{]*\.hero__title[^{]*\{[^}]*color:\s*#ffffff/,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/renderer/test/hero-overlay.test.ts`
Expected: FAIL (no hero overlay rules yet in `PRODUCTION_SITE_BASE_CSS`).

- [ ] **Step 3: Add the hero treatment**

In `packages/renderer/src/themes/production-base.ts`, the template currently has the overflow/aspect rules added in the engine plan. The image rule block (added in Plan 1) reads:

```
[data-block="hero"] .hero__media img,
[data-block="imageGallery"] .image-gallery__figure > img,
[data-block="imageGallery"] .image-gallery__trigger img,
[data-block="activitiesList"] .activities-list__media img,
[data-block="event-list"] .event-list__item-media img {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  height: auto;
}
```

Leave that rule as-is (it governs non-hero content images and the _stacked, no-image_ hero is not affected). Insert the following hero-treatment block **immediately before** the final `@media (max-width: 640px) {` block (i.e. after the image-aspect rule group, before the media query):

```css
[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="hero"] .hero__inner {
  width: min(100%, var(--site-max-width));
  margin-inline: auto;
}
[data-block="hero"] .hero__title {
  font-size: var(--type-3xl);
  line-height: 1.08;
  color: var(--color-primary);
  max-width: var(--measure-title);
  margin: 0 0 var(--space-md);
}
[data-block="hero"] .hero__subtitle {
  font-size: var(--type-lg);
  line-height: 1.5;
  color: var(--color-fg);
  max-width: var(--measure-body);
  margin: 0;
}
[data-block="hero"].hero--has-image {
  position: relative;
  display: grid;
  align-items: end;
  min-height: clamp(20rem, 13rem + 32vw, 34rem);
  padding: var(--space-xl) var(--space-md);
  overflow: hidden;
  isolation: isolate;
}
[data-block="hero"].hero--has-image .hero__media {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  overflow: hidden;
}
[data-block="hero"].hero--has-image .hero__media img {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
  display: block;
}
[data-block="hero"].hero--has-image .hero__media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(var(--color-fg-rgb), 0.8) 0%,
    rgba(var(--color-fg-rgb), 0.45) 40%,
    rgba(var(--color-fg-rgb), 0.05) 100%
  );
}
[data-block="hero"].hero--has-image .hero__inner {
  position: relative;
  z-index: 1;
  align-self: end;
}
[data-block="hero"].hero--has-image .hero__title,
[data-block="hero"].hero--has-image .hero__subtitle {
  color: #ffffff;
}
```

Notes:

- The scrim uses `rgba(var(--color-fg-rgb), …)` — the comma-separated triplet the engine emits expands to a valid `rgba(26, 26, 26, 0.8)`. It is a token, not a literal, so it passes the (loosened) no-raw-color hygiene rule in Task 5.
- `aspect-ratio: auto` on `.hero--has-image .hero__media img` overrides the global `16 / 9` from Plan 1 so the image fills the hero box.
- The `#ffffff` literal lives in a non-`:root` rule, but the hygiene assertions forbid only `rgb()`/`rgba()` literal channels and bare `#hex` via `/#[0-9a-fA-F]{3,8}\b/` — `#ffffff` WOULD trip the hex check. **Use `var(--color-bg)` is wrong here (bg may be cream/paper).** Instead emit white via a token: the engine already emits `--color-on-primary`/`--color-on-accent`; neither is guaranteed white. So add a dedicated token. See Step 3a.

- [ ] **Step 3a: Add a `--hero-on-image` token so the white lockup text is token-based (passes hex hygiene)**

In `packages/renderer/src/tokens.ts`, add to `BASELINE_TOKENS` (near the color tokens) a fixed token for text over the hero scrim:

```ts
  ["--color-on-image", "#ffffff"],
```

Then in the production-base hero block above, replace `color: #ffffff;` with `color: var(--color-on-image);` in the `.hero--has-image .hero__title, … .hero__subtitle` rule. Update the Task 3 test's last assertion accordingly:

```ts
expect(PRODUCTION_SITE_BASE_CSS).toMatch(
  /\.hero--has-image[^{]*\.hero__title[^{]*\{[^}]*color:\s*var\(--color-on-image\)/,
);
```

Rationale: the scrim guarantees a dark backdrop, so white is always legible; keeping it a `:root` token avoids a raw `#ffffff` outside `:root`. (A theme could override `--color-on-image` later if it ever wanted a non-white lockup, but none do.)

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run packages/renderer/test/hero-overlay.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sosb/renderer run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit (goldens regenerated in Task 6)**

```bash
git add packages/renderer/src/themes/production-base.ts packages/renderer/src/tokens.ts packages/renderer/test/hero-overlay.test.ts
git commit -m "feat(renderer): universal full-bleed hero overlay + fluid title in production base"
```

---

## Task 4: Strip per-theme hero CSS (so the shared overlay wins)

Each theme file owns hero rules that would override the shared overlay (theme CSS composes last). Remove ALL hero-related rules from each of the five theme CSS strings. After this, production themes render the shared overlay; only their palette/font tokens differ.

**Files:**

- Modify: `packages/renderer/src/themes/academic.ts`
- Modify: `packages/renderer/src/themes/civic.ts`
- Modify: `packages/renderer/src/themes/editorial.ts`
- Modify: `packages/renderer/src/themes/minimal.ts`
- Modify: `packages/renderer/src/themes/modern.ts`
- Modify: `packages/renderer/src/themes/stub.ts` (remove dead `.hero__eyebrow` only)
- Test: `packages/renderer/test/hero-overlay.test.ts`

- [ ] **Step 1: Write the failing test (overlay wins for every production theme)**

Append to `packages/renderer/test/hero-overlay.test.ts`:

```ts
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

describe("no theme overrides the shared hero (per-theme hero CSS stripped)", () => {
  const PRODUCTION_THEME_IDS = ["minimal", "modern", "editorial", "civic", "academic"];
  for (const id of PRODUCTION_THEME_IDS) {
    test(`${id}: emits no theme-level [data-block="hero"] rule`, () => {
      const site = structuredClone(fixture) as Site;
      site.theme = { id, tokens: {} };
      const html = renderSite(site, id);
      const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
        .map((m) => m[1]!)
        .join("\n");
      // Count selectors that target the hero block. Shared layers (stub +
      // production-base) legitimately style it; this test guards that THEMES
      // no longer ship their own hero rules. We assert no per-theme hero
      // *font-size* (the override that fought the fluid title) and no
      // per-theme .hero__eyebrow remains.
      expect(styles).not.toContain(".hero__eyebrow");
      // The theme's own hero h1 font-size override is gone: the only hero
      // font-size declaration is the shared --type-3xl one.
      const heroTitleSizes = [
        ...styles.matchAll(/\[data-block="hero"\][^{]*h1[^{]*\{[^}]*font-size[^}]*\}/g),
      ];
      expect(heroTitleSizes.length).toBe(0);
    });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/renderer/test/hero-overlay.test.ts -t "no theme overrides"`
Expected: FAIL (themes still emit `[data-block="hero"] h1 { font-size … }` and `.hero__eyebrow`).

- [ ] **Step 3: Strip hero rules from each theme file**

For EACH theme file, remove every CSS rule whose selector targets the hero block or its parts. The recon enumerated them; remove all of these per file (READ the file and delete each matching rule block, leaving non-hero rules intact):

- **academic.ts**: the two `[data-block="hero"] { … }` blocks (one with `border-bottom`, one with `border-top` accent — both, ~lines 149 & 208), `[data-block="hero"] .hero__inner`, `[data-block="hero"] .hero__eyebrow`, `[data-block="hero"] h1`, `[data-block="hero"] .hero__subtitle`, `[data-block="hero"] .hero__media`, `[data-block="hero"] .hero__media img`.
- **civic.ts**: `[data-block="hero"] { … }` (border-block-end), `.hero__inner`, `.hero__eyebrow`, `[data-block="hero"] h1`, `.hero__subtitle`, `.hero__media` (border+radius), `.hero__media img`.
- **editorial.ts**: `[data-block="hero"] { … }` (border-bottom), BOTH `.hero__inner` rules (the 56rem one and the later `--site-wide-width` override), `.hero__eyebrow`, `[data-block="hero"] h1`, `.hero__subtitle`, `.hero__media`, `.hero__media img`.
- **minimal.ts**: `[data-block="hero"] { … }` (the one with `max-width:56rem; margin:0 auto` ON THE SECTION), `.hero__eyebrow`, `[data-block="hero"] h1`, `.hero__subtitle`, `.hero__media`, `.hero__media img`. (minimal has no `.hero__inner` rule.)
- **modern.ts**: `[data-block="hero"] { … }` (padding with `--space-2xl`), `[data-block="hero"] .hero__inner` (the `display:grid` rule), `.hero__eyebrow`, `[data-block="hero"] h1`, `.hero__subtitle`, `.hero__media`, `.hero__media img`, AND the `@media (min-width: 720px)` block that re-grids `.hero__inner` / bumps the h1. (If `--space-2xl` in modern's `:root` becomes unused after this, leave it — harmless — or remove it; verify with a grep.)
- **stub.ts**: remove only the `[data-block="hero"] .hero__eyebrow { … }` rule (dead after eyebrow removal). Leave stub's other hero rules — stub is the renderer sentinel and is allowed to render a basic stacked hero; production themes get the shared overlay via production-base.

Do NOT remove any non-hero rules. After each file, the theme's remaining CSS should be its non-hero block styling + its `:root`/baseline tokens.

- [ ] **Step 4: Run the overlay-wins test + each theme's own test**

Run: `pnpm vitest run packages/renderer/test/hero-overlay.test.ts -t "no theme overrides"`
Expected: PASS.
Run: `pnpm vitest run packages/renderer/test/academic-theme.test.ts packages/renderer/test/civic-theme.test.ts packages/renderer/test/editorial-theme.test.ts packages/renderer/test/minimal-theme.test.ts packages/renderer/test/modern-theme.test.ts`
Expected: token/determinism/hygiene tests PASS. If any NON-golden assertion fails because it checked a hero rule you removed, update that assertion to reflect that hero styling now lives in the shared layer (the recon found theme tests mostly assert tokens + hygiene + determinism, not specific hero CSS — so breakage here should be minimal). Report any you change.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sosb/renderer run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit (goldens regenerated in Task 6)**

```bash
git add packages/renderer/src/themes/academic.ts packages/renderer/src/themes/civic.ts packages/renderer/src/themes/editorial.ts packages/renderer/src/themes/minimal.ts packages/renderer/src/themes/modern.ts packages/renderer/src/themes/stub.ts
git commit -m "refactor(renderer): strip per-theme hero CSS in favor of the shared overlay"
```

---

## Task 5: Loosen the `rgb()` hygiene assertions for the token scrim

The scrim adds `rgba(var(--color-fg-rgb), …)` to `production-base.ts`, which is composed into every production theme's CSS. The five rendered-production-theme tests assert `not.toMatch(/\brgb\(/)` / `/\brgba\(/` on non-`:root` CSS — these now fire on the token scrim. Loosen them to forbid only literal-channel color while permitting `var()`.

**Files:**

- Modify: `packages/renderer/test/civic-theme.test.ts`
- Modify: `packages/renderer/test/academic-theme.test.ts`
- Modify: `packages/renderer/test/editorial-theme.test.ts`
- Modify: `packages/renderer/test/modern-theme.test.ts`
- Modify: `packages/renderer/test/minimal-theme.test.ts` (the RENDERED-site assertion block only, not the static-CSS one)

- [ ] **Step 1: Apply the regex change to each file**

In each file, find the adjacent pair:

```ts
    expect(<var>).not.toMatch(/\brgb\(/);
    expect(<var>).not.toMatch(/\brgba\(/);
```

(where `<var>` is `nonRootRules` / `css` / `nonRootRules` depending on the file — civic L104-105, academic L113-114, editorial L70-71, modern L73-74, minimal RENDERED L108-109) and replace BOTH lines with a single assertion:

```ts
    expect(<var>).not.toMatch(/\brgba?\(\s*[#0-9.]/);
```

Keep the existing `expect(<var>).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);` hex line UNCHANGED. This forbids `rgb(12,…)` / `rgba(0,…)` (literal channels) but permits `rgba(var(--color-fg-rgb), 0.8)`.

Do NOT change:

- `minimal-theme.test.ts` lines 87-89 (they assert the STATIC `MINIMAL_THEME_CSS` constant, which has no scrim).
- `render-site.test.ts`, `value-list.test.ts`, `team-grid.test.ts`, `activities-list.test.ts`, `cta-banner-css.test.ts` — these render the **stub** theme (no production-base, no scrim), so their assertion never sees `rgba(var())` and stays valid as-is.

- [ ] **Step 2: Run the five theme tests**

Run: `pnpm vitest run packages/renderer/test/civic-theme.test.ts packages/renderer/test/academic-theme.test.ts packages/renderer/test/editorial-theme.test.ts packages/renderer/test/modern-theme.test.ts packages/renderer/test/minimal-theme.test.ts`
Expected: PASS (the hygiene assertions now permit the token scrim; literal-color discipline still enforced).

- [ ] **Step 3: Commit**

```bash
git add packages/renderer/test/civic-theme.test.ts packages/renderer/test/academic-theme.test.ts packages/renderer/test/editorial-theme.test.ts packages/renderer/test/modern-theme.test.ts packages/renderer/test/minimal-theme.test.ts
git commit -m "test(renderer): permit rgba(var(--token)) scrim in hero hygiene assertions"
```

---

## Task 6: Strip eyebrow from typed fixtures/seed, regenerate goldens, full green

**Files:**

- Modify: `packages/themes/src/templates/asociatia-studenteasca-demo/data.json`
- Modify: `packages/renderer/test/a11y-fixture.ts`
- Modify: `scripts/generate-historipol-site.ts`
- Optional: JSON fixtures listed in the plan header
- Regenerate: golden snapshots

- [ ] **Step 1: Remove eyebrow from TS-typed sources (required for typecheck)**

- `packages/renderer/test/a11y-fixture.ts`: delete the two `eyebrow: HOMEPAGE_EYEBROW_RO/EN` lines (~107, ~133) and the now-unused `HOMEPAGE_EYEBROW_RO`/`HOMEPAGE_EYEBROW_EN` consts (~82-83).
- `scripts/generate-historipol-site.ts`: delete the four `eyebrow:` lines (~244, 335, 429, 468).
- `packages/themes/src/templates/asociatia-studenteasca-demo/data.json`: delete the two `"eyebrow": …` lines (~65, ~326).

- [ ] **Step 2: Strip eyebrow from JSON fixtures (keeps goldens honest)**

Remove the `"eyebrow": …` line from: `packages/renderer/test/fixtures/{hero-only,hero-only-modern,hero-only-minimal,hero-only-editorial,civic-hero,multi-page,bilingual}.json` and `packages/build/test/fixtures/{single-page-site,multi-page-site,bilingual-site,lighthouse-fixture}.json`. (Each is non-breaking via `looseObject`, but stripping prevents stale eyebrow paragraphs from lingering in regenerated goldens.) Leave `packages/schema/test/fixtures/historipol.json` and `packages/zip/test/fixtures/historipol.json` (pure round-trip fixtures; optional).

- [ ] **Step 3: Confirm only golden + intended changes remain failing**

Run: `pnpm vitest run packages/renderer`
Expected: failures are ONLY `toMatchFileSnapshot` golden mismatches (hero markup + overlay CSS changes; eyebrow removed). If any NON-golden test fails, STOP and fix it (it indicates a missed assertion).

- [ ] **Step 4: Regenerate renderer goldens + review**

Run: `pnpm vitest run -u packages/renderer`
Then review: `git --no-pager diff packages/renderer/test/__golden__/civic-theme-hero.html packages/renderer/test/__golden__/stub-theme-hero.html`
Expected changes: the `<section data-block="hero">` gains `class="hero hero--has-image"` (when fixture has an image) or `class="hero"`; `.hero__media` moves before `.hero__inner`; no `<p class="hero__eyebrow">`; the per-theme hero CSS is gone and the shared overlay CSS is present; theme `:root` blocks gain `--color-on-image`. No unrelated block markup changes. If anything else changed structurally, investigate.

- [ ] **Step 5: Typecheck + whole repo, regenerate build goldens**

Run: `pnpm --filter @sosb/renderer run typecheck` → no errors.
Run: `pnpm test` → build goldens (`packages/build/test/__golden__/*`) will drift (hero markup + eyebrow). Regenerate: `pnpm vitest run -u packages/build`, review the diff (hero markup change + eyebrow removal + `--color-on-image` token only), then `pnpm test` again. Any non-golden failure anywhere → STOP and report.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(renderer): regenerate goldens for hero overlay + eyebrow removal; strip seed/fixture eyebrow"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-14-themes-identity-refresh-design.md` → "Schema cleanup — remove eyebrow" + "Hero markup change" + the no-pizzaz universal hero):

| Spec/decision                                              | Task            |
| ---------------------------------------------------------- | --------------- |
| Remove `eyebrow` from schema                               | Task 1          |
| Remove eyebrow renderer branch                             | Task 2          |
| Remove eyebrow editor field/metadata                       | Task 1          |
| Strip eyebrow from seed/fixtures/goldens                   | Task 6          |
| Hero composites text over image + scrim                    | Tasks 2-3       |
| Legible scrim via `--color-*-rgb` (kept strict via tokens) | Task 3 + Task 5 |
| Fluid hero title (`--type-3xl`, deferred from Plan 1)      | Task 3          |
| No per-theme hero ornament (single universal treatment)    | Tasks 3-4       |

**2. Placeholder scan:** Every step has exact code or an exact command. The two "verify before writing" notes (Task 2 Step 1 fixture check; Task 4 Step 4 assertion-breakage) are explicit verification instructions, not deferred work.

**3. Type/selector consistency:** `--color-on-image` is defined in Task 3a (`tokens.ts`) and consumed in the same task's CSS + asserted in Task 3/4 tests. `hero--has-image` is emitted by `hero.tsx` (Task 2) and targeted by `production-base.ts` (Task 3) and the Task 4 test. The hygiene regex `/\brgba?\(\s*[#0-9.]/` (Task 5) matches the scrim form `rgba(var(--color-fg-rgb), …)` introduced in Task 3. `PRODUCTION_SITE_BASE_CSS` is the existing export. No drift.

**4. Ordering (resolved):** Execute in the order **1 → 2 → 5 → 3 → 4 → 6**. Task 5 (hygiene loosening) must precede Task 3 (scrim) so no commit leaves the five theme tests red — the loosened regex still passes on the pre-scrim CSS, so Task 5 stays green on its own. Goldens are intentionally stale from Task 2 onward and regenerated once in Task 6 (same pattern as the engine plan). Per-task, the task's own targeted tests are green.
