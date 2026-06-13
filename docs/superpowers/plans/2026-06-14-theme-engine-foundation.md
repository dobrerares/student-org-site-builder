# Theme Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, foolproof rendering engine — fluid type scale, wired density/radius controls, contrast-safe on-colors, scrim RGB tokens, and content-overflow/image-aspect guards — so every theme inherits responsive, unbreakable defaults.

**Architecture:** All universal mechanics live in the two shared layers — `packages/renderer/src/tokens.ts` (the `:root` token set + composition) and `packages/renderer/src/themes/production-base.ts` (shared layout rules). Pure color math lives in a new focused `packages/renderer/src/color-math.ts`. No per-theme files, no schema, no markup change in this plan — those are later plans. The renderer's pure `(Site, themeId) → HTML` contract is unchanged.

**Tech Stack:** TypeScript, Preact (build-time templating via `preact-render-to-string`), Vitest (unit + golden snapshots via `toMatchFileSnapshot`), pnpm workspaces. CSS is emitted as strings; tokens are CSS custom properties.

**Scope note:** This is the first of the spec's PR1 split into two plans. This plan = the token engine (tokens.ts + production-base.ts). The companion plan (Hero overlay + eyebrow removal) covers the hero markup change, the legible scrim that consumes the `--color-*-rgb` tokens this plan emits, and the `eyebrow` schema cleanup. Per-theme identity application (consuming the fluid type scale, measure caps, and on-colors) and section-rhythm application come in the per-theme plans. See `docs/superpowers/specs/2026-06-14-themes-identity-refresh-design.md`.

**Conventions for every task below:**
- Run a single test file: `pnpm vitest run <path>` (e.g. `pnpm vitest run packages/renderer/test/color-math.test.ts`).
- Run by test name: `pnpm vitest run <path> -t "<name>"`.
- Regenerate golden snapshots: `pnpm vitest run -u packages/renderer` (vitest `-u` rewrites every `toMatchFileSnapshot` target).
- Typecheck the renderer: `pnpm --filter @sosb/renderer run typecheck`.
- All commands run from the repo root `C:\Users\rdobr\Documents\anosr-site-builder`.

---

## File Structure

- **Create** `packages/renderer/src/color-math.ts` — pure hex→rgb, WCAG relative luminance, contrast ratio, and readable on-color picker. Single responsibility: color math, no token/CSS knowledge.
- **Create** `packages/renderer/test/color-math.test.ts` — unit tests for the above.
- **Modify** `packages/renderer/src/tokens.ts` — rework `BASELINE_TOKENS` (fluid type, density-scaled spacing, base-derived radius, measure caps), add `densityScale`/`radiusBase` mappers, and rework `emitTokenRoot` to translate density/radius overrides and emit resolution-dependent `--color-*-rgb` + `--color-on-*` tokens.
- **Create** `packages/renderer/test/token-engine.test.ts` — unit tests for the reworked token composition.
- **Modify** `packages/renderer/src/themes/production-base.ts` — add overflow/hyphenation safety on titles & prose, and image aspect-ratio normalization.
- **Regenerate** `packages/renderer/test/__golden__/*.html` — every golden's `:root` gains the new tokens; production-theme goldens gain the new safety rules. Bulk-regenerated and diff-reviewed in Task 5.

---

## Task 1: Pure color math (`color-math.ts`)

**Files:**
- Create: `packages/renderer/src/color-math.ts`
- Test: `packages/renderer/test/color-math.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/renderer/test/color-math.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { hexToRgbTriplet, relativeLuminance, contrastRatio, onColorFor } from "../src/color-math.js";

describe("hexToRgbTriplet", () => {
  test("parses 6-digit hex into an 'r, g, b' triplet", () => {
    expect(hexToRgbTriplet("#1f3a5f")).toBe("31, 58, 95");
    expect(hexToRgbTriplet("#FFFFFF")).toBe("255, 255, 255");
  });

  test("parses 3-digit shorthand hex", () => {
    expect(hexToRgbTriplet("#fff")).toBe("255, 255, 255");
    expect(hexToRgbTriplet("#1a2")).toBe("17, 170, 34");
  });

  test("returns undefined for non-hex input", () => {
    expect(hexToRgbTriplet("rebeccapurple")).toBeUndefined();
    expect(hexToRgbTriplet("rgb(1,2,3)")).toBeUndefined();
    expect(hexToRgbTriplet("#12")).toBeUndefined();
  });
});

describe("relativeLuminance", () => {
  test("white is ~1 and black is ~0", () => {
    expect(relativeLuminance("#ffffff")!).toBeCloseTo(1, 3);
    expect(relativeLuminance("#000000")!).toBeCloseTo(0, 3);
  });

  test("returns undefined for non-hex input", () => {
    expect(relativeLuminance("teal")).toBeUndefined();
  });
});

describe("contrastRatio", () => {
  test("white on black is 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")!).toBeCloseTo(21, 0);
  });
});

describe("onColorFor", () => {
  test("picks dark ink on a light/gold accent (white would fail AA)", () => {
    // Scholarly gold + the baseline academic/civic gold both need dark ink.
    expect(onColorFor("#b8893e")).toBe("#16181c");
    expect(onColorFor("#c08a3e")).toBe("#16181c");
  });

  test("picks white on a saturated/dark accent", () => {
    expect(onColorFor("#cb2b2b")).toBe("#ffffff"); // activist crimson
    expect(onColorFor("#2563eb")).toBe("#ffffff"); // tech blue
    expect(onColorFor("#1f3a5f")).toBe("#ffffff"); // navy primary
    expect(onColorFor("#1a1a1a")).toBe("#ffffff"); // calm near-black
  });

  test("falls back to white for unparseable colors", () => {
    expect(onColorFor("currentColor")).toBe("#ffffff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/renderer/test/color-math.test.ts`
Expected: FAIL — `Failed to resolve import "../src/color-math.js"`.

- [ ] **Step 3: Write the implementation**

Create `packages/renderer/src/color-math.ts`:

```ts
/**
 * Pure color math for the token layer.
 *
 * Two consumers: (1) scrims need an "r, g, b" triplet so CSS can apply a
 * partial-alpha version of a theme color via `rgb(var(--color-fg-rgb) / 0.7)`
 * while the renderer keeps the "no raw color outside :root" discipline;
 * (2) the contrast-safe override feature needs to pick a readable text color
 * for whatever accent/primary a theme default or user override resolves to.
 *
 * No CSS or token knowledge lives here — just parsing and WCAG arithmetic.
 */

/** Parse a `#rgb` or `#rrggbb` hex string to an `"r, g, b"` triplet, or undefined. */
export function hexToRgbTriplet(hex: string): string | undefined {
  const value = hex.trim();
  const six = /^#([0-9a-fA-F]{6})$/.exec(value);
  const three = /^#([0-9a-fA-F]{3})$/.exec(value);
  let r: number;
  let g: number;
  let b: number;
  if (six !== null) {
    r = parseInt(six[1]!.slice(0, 2), 16);
    g = parseInt(six[1]!.slice(2, 4), 16);
    b = parseInt(six[1]!.slice(4, 6), 16);
  } else if (three !== null) {
    const c = three[1]!;
    r = parseInt(c[0]! + c[0]!, 16);
    g = parseInt(c[1]! + c[1]!, 16);
    b = parseInt(c[2]! + c[2]!, 16);
  } else {
    return undefined;
  }
  return `${r}, ${g}, ${b}`;
}

/** WCAG 2.x relative luminance (0..1) of a hex color, or undefined if unparseable. */
export function relativeLuminance(hex: string): number | undefined {
  const triplet = hexToRgbTriplet(hex);
  if (triplet === undefined) return undefined;
  const [r, g, b] = triplet.split(", ").map((n) => Number(n) / 255) as [number, number, number];
  const channel = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21), or undefined if either is unparseable. */
export function contrastRatio(a: string, b: string): number | undefined {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === undefined || lb === undefined) return undefined;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the more readable of white vs. a dark ink for text placed on `hex`,
 * by comparing actual WCAG contrast ratios (not a luminance threshold —
 * thresholding mis-handles mid-luminance colors like gold). Ties and
 * unparseable inputs fall back to white.
 */
export function onColorFor(hex: string, darkInk = "#16181c"): string {
  const onWhite = contrastRatio(hex, "#ffffff");
  const onDark = contrastRatio(hex, darkInk);
  if (onWhite === undefined || onDark === undefined) return "#ffffff";
  return onDark > onWhite ? darkInk : "#ffffff";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/renderer/test/color-math.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sosb/renderer run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/renderer/src/color-math.ts packages/renderer/test/color-math.test.ts
git commit -m "feat(renderer): pure color-math helpers (rgb triplet, luminance, contrast-safe on-color)"
```

---

## Task 2: Rework the token engine (`tokens.ts`)

This task reworks `BASELINE_TOKENS` and `emitTokenRoot` together because both change the `:root` output and we want a single golden regeneration (Task 5). The unit tests here assert the new token contract directly against `emitTokenRoot` output, independent of goldens.

**Files:**
- Modify: `packages/renderer/src/tokens.ts`
- Test: `packages/renderer/test/token-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/renderer/test/token-engine.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { emitTokenRoot, densityScale, radiusBase } from "../src/tokens.js";

const fixture = heroOnly as unknown as Site;

function rootOf(site: Site): string {
  return emitTokenRoot(site);
}

describe("densityScale / radiusBase mappers", () => {
  test("named density maps to a numeric multiplier", () => {
    expect(densityScale("compact")).toBe("0.85");
    expect(densityScale("normal")).toBe("1");
    expect(densityScale("comfortable")).toBe("1.15");
    expect(densityScale(undefined)).toBe("1");
    expect(densityScale("nonsense")).toBe("1");
  });

  test("named radius maps to a base length", () => {
    expect(radiusBase("sharp")).toBe("0px");
    expect(radiusBase("soft")).toBe("6px");
    expect(radiusBase("round")).toBe("14px");
    expect(radiusBase(undefined)).toBe("6px");
  });
});

describe("baseline engine tokens", () => {
  test("spacing scale is density-scaled via calc + var(--density-scale)", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--density-scale: 1;");
    expect(root).toContain("--space-md: calc(1rem * var(--density-scale));");
    expect(root).toContain("--space-xl: calc(4rem * var(--density-scale));");
  });

  test("radius scale derives from a single --radius-base", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--radius-base: 8px;");
    expect(root).toContain("--radius-md: var(--radius-base);");
    expect(root).toContain("--radius-sm: calc(var(--radius-base) * 0.5);");
  });

  test("type scale is fluid (clamp) for every step", () => {
    const root = rootOf(fixture);
    for (const step of ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"]) {
      expect(root).toMatch(new RegExp(`--type-${step}:\\s*clamp\\(`));
    }
  });

  test("emits readable measure caps and a fluid section gap", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--measure-body: 66ch;");
    expect(root).toContain("--measure-title: 20ch;");
    expect(root).toMatch(/--section-gap:\s*calc\(clamp\(/);
  });
});

describe("density + radius overrides are wired (no longer dead)", () => {
  test("user density override emits a numeric --density-scale", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { density: "compact" } };
    expect(emitTokenRoot(site)).toContain("--density-scale: 0.85;");
  });

  test("user radius override emits a --radius-base length", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { radius: "round" } };
    expect(emitTokenRoot(site)).toContain("--radius-base: 14px;");
  });
});

describe("resolution-dependent derived tokens", () => {
  test("emits rgb siblings for the resolved palette (for scrims)", () => {
    const root = rootOf(fixture);
    expect(root).toContain("--color-primary-rgb: 31, 58, 95;");
    expect(root).toContain("--color-bg-rgb: 255, 255, 255;");
    expect(root).toContain("--color-fg-rgb: 26, 26, 26;");
  });

  test("emits contrast-safe on-colors for the resolved accent/primary", () => {
    const root = rootOf(fixture);
    // baseline accent #c08a3e (gold) needs dark ink; navy primary needs white.
    expect(root).toContain("--color-on-accent: #16181c;");
    expect(root).toContain("--color-on-primary: #ffffff;");
  });

  test("on-color follows a user accent override (white accent -> dark ink)", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "stub", tokens: { colorAccent: "#ffffff" } };
    const root = emitTokenRoot(site);
    expect(root).toContain("--color-accent: #ffffff;");
    expect(root).toContain("--color-on-accent: #16181c;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/renderer/test/token-engine.test.ts`
Expected: FAIL — `densityScale`/`radiusBase` are not exported, and the new token assertions don't match.

- [ ] **Step 3: Implement the reworked `tokens.ts`**

Replace the entire contents of `packages/renderer/src/tokens.ts` with:

```ts
import type { Site } from "@sosb/schema";
import { hexToRgbTriplet, onColorFor } from "./color-math.js";

/**
 * Tokens-as-CSS-custom-properties.
 *
 * The renderer emits one `:root {}` block per site. It always emits a
 * universal baseline (spacing, radius, fluid type scale, measure caps,
 * fallback palette/fonts), then layers theme defaults, theme baseline, and
 * user overrides on top — later wins, standard CSS. Two override axes that
 * used to be inert (`density`, `radius`) are now translated into numeric
 * engine tokens (`--density-scale`, `--radius-base`) that the scale tokens
 * consume. Finally the renderer emits resolution-dependent derived tokens:
 * `--color-*-rgb` siblings (so scrims can use partial-alpha theme colors
 * without raw color literals) and contrast-safe `--color-on-*` text colors.
 */

/** Map the color/font schema token keys to their CSS custom properties. */
const COLOR_FONT_MAP: Readonly<Record<string, string>> = {
  colorPrimary: "--color-primary",
  colorAccent: "--color-accent",
  fontHeadline: "--font-headline",
  fontBody: "--font-body",
};

/** Map a named density to a spacing multiplier. Unknown/absent → "1". */
export function densityScale(name: string | undefined): string {
  switch (name) {
    case "compact":
      return "0.85";
    case "comfortable":
      return "1.15";
    case "normal":
      return "1";
    default:
      return "1";
  }
}

/** Map a named corner radius to a base length. Unknown/absent → "6px". */
export function radiusBase(name: string | undefined): string {
  switch (name) {
    case "sharp":
      return "0px";
    case "soft":
      return "6px";
    case "round":
      return "14px";
    default:
      return "6px";
  }
}

/**
 * Universal baseline tokens, always emitted first so block CSS always has
 * something to consume (ADR 0003). Spacing is density-scaled; radius derives
 * from a single base; type is a fluid clamp() scale.
 */
const BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["--density-scale", "1"],
  ["--space-xs", "calc(0.25rem * var(--density-scale))"],
  ["--space-sm", "calc(0.5rem * var(--density-scale))"],
  ["--space-md", "calc(1rem * var(--density-scale))"],
  ["--space-lg", "calc(2rem * var(--density-scale))"],
  ["--space-xl", "calc(4rem * var(--density-scale))"],
  ["--section-gap", "calc(clamp(2.5rem, 1.5rem + 4vw, 5rem) * var(--density-scale))"],
  ["--radius-base", "8px"],
  ["--radius-sm", "calc(var(--radius-base) * 0.5)"],
  ["--radius-md", "var(--radius-base)"],
  ["--radius-lg", "calc(var(--radius-base) * 1.75)"],
  ["--type-xs", "clamp(0.78rem, 0.75rem + 0.15vw, 0.85rem)"],
  ["--type-sm", "clamp(0.88rem, 0.84rem + 0.2vw, 1rem)"],
  ["--type-base", "clamp(1rem, 0.96rem + 0.3vw, 1.125rem)"],
  ["--type-lg", "clamp(1.2rem, 1.1rem + 0.5vw, 1.5rem)"],
  ["--type-xl", "clamp(1.5rem, 1.3rem + 1vw, 2.05rem)"],
  ["--type-2xl", "clamp(1.85rem, 1.45rem + 1.9vw, 2.75rem)"],
  ["--type-3xl", "clamp(2.25rem, 1.6rem + 3.1vw, 3.75rem)"],
  ["--measure-body", "66ch"],
  ["--measure-title", "20ch"],
  ["--font-headline", "Georgia, serif"],
  ["--font-body", "system-ui, sans-serif"],
  ["--color-primary", "#1f3a5f"],
  ["--color-accent", "#c08a3e"],
  ["--color-fg", "#1a1a1a"],
  ["--color-bg", "#ffffff"],
  ["--color-muted", "#5c5c5c"],
];

/** The palette props whose resolved values drive derived rgb/on-color tokens. */
const RESOLVED_COLOR_DEFAULTS: Readonly<Record<string, string>> = {
  "--color-primary": "#1f3a5f",
  "--color-accent": "#c08a3e",
  "--color-fg": "#1a1a1a",
  "--color-bg": "#ffffff",
};

/**
 * Push the color/font/density/radius declarations from one token source
 * (theme defaults or user overrides) and track the resolved palette so the
 * derived tokens at the end of `emitTokenRoot` reflect the final values.
 */
function pushScalarTokens(
  source: Record<string, unknown>,
  declarations: string[],
  resolved: Record<string, string>,
): void {
  for (const [schemaKey, cssProp] of Object.entries(COLOR_FONT_MAP)) {
    const raw = source[schemaKey];
    if (typeof raw === "string" && raw.length > 0) {
      declarations.push(`  ${cssProp}: ${raw};`);
      if (cssProp in resolved) resolved[cssProp] = raw;
    }
  }
  const density = source.density;
  if (typeof density === "string" && density.length > 0) {
    declarations.push(`  --density-scale: ${densityScale(density)};`);
  }
  const radius = source.radius;
  if (typeof radius === "string" && radius.length > 0) {
    declarations.push(`  --radius-base: ${radiusBase(radius)};`);
  }
}

/**
 * Compose the `:root { ... }` CSS rule for a site. Order is deterministic
 * (later wins): baseline → schema-keyed theme defaults → CSS-prop-keyed theme
 * baseline → user overrides. Resolution-dependent derived tokens
 * (`--color-*-rgb`, `--color-on-*`) are emitted last so they reflect the
 * final resolved palette regardless of which layer won.
 */
export function emitTokenRoot(
  site: Site,
  themeDefaults?: Readonly<Record<string, string>>,
  themeBaseline: ReadonlyArray<readonly [string, string]> = [],
): string {
  const declarations: string[] = [];
  const resolved: Record<string, string> = { ...RESOLVED_COLOR_DEFAULTS };

  for (const [name, value] of BASELINE_TOKENS) {
    declarations.push(`  ${name}: ${value};`);
  }

  if (themeDefaults !== undefined) {
    pushScalarTokens(themeDefaults as Record<string, unknown>, declarations, resolved);
  }

  for (const [name, value] of themeBaseline) {
    declarations.push(`  ${name}: ${value};`);
    if (name in resolved) resolved[name] = value;
  }

  const userTokens = (site.theme.tokens ?? {}) as Record<string, unknown>;
  pushScalarTokens(userTokens, declarations, resolved);

  for (const prop of ["--color-primary", "--color-accent", "--color-fg", "--color-bg"]) {
    const triplet = hexToRgbTriplet(resolved[prop]!);
    if (triplet !== undefined) {
      declarations.push(`  ${prop}-rgb: ${triplet};`);
    }
  }
  declarations.push(`  --color-on-primary: ${onColorFor(resolved["--color-primary"]!)};`);
  declarations.push(`  --color-on-accent: ${onColorFor(resolved["--color-accent"]!)};`);

  return `:root {\n${declarations.join("\n")}\n}`;
}
```

- [ ] **Step 4: Run the token-engine test to verify it passes**

Run: `pnpm vitest run packages/renderer/test/token-engine.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sosb/renderer run typecheck`
Expected: no errors. (If the `for...of` over the literal array trips `noUncheckedIndexedAccess`, the `!` assertions on `resolved[prop]!` already cover it.)

- [ ] **Step 6: Commit (goldens regenerated later in Task 5)**

Do NOT run the full suite yet — golden snapshots are intentionally stale until Task 5. Commit only the source + unit test:

```bash
git add packages/renderer/src/tokens.ts packages/renderer/test/token-engine.test.ts
git commit -m "feat(renderer): wire density/radius, fluid type scale, scrim rgb + contrast-safe on-colors"
```

---

## Task 3: Content-overflow & image-aspect guards (`production-base.ts`)

Purely additive, alignment-neutral safety rules: long words can never cause horizontal scroll, and any image upload renders at a sane aspect ratio. (Measure-cap *application*, section-rhythm, and fluid-title sizing are deliberately deferred to the per-theme plans, where per-theme alignment is known.)

**Files:**
- Modify: `packages/renderer/src/themes/production-base.ts`
- Test: `packages/renderer/test/token-engine.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

First add this import to the **top** import group of `packages/renderer/test/token-engine.test.ts` (alongside the existing imports — ESM/eslint `import/first` requires all imports at the top):

```ts
import { PRODUCTION_SITE_BASE_CSS } from "../src/themes/production-base.js";
```

Then append this describe block to the **end** of the same file:

```ts
describe("production base — overflow & aspect guards", () => {
  test("titles and prose wrap long words (no horizontal scroll)", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/overflow-wrap:\s*anywhere/);
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero__title");
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/hyphens:\s*auto/);
  });

  test("content images are aspect-normalized with object-fit cover", () => {
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/aspect-ratio:\s*16 \/ 9/);
    expect(PRODUCTION_SITE_BASE_CSS).toMatch(/object-fit:\s*cover/);
    expect(PRODUCTION_SITE_BASE_CSS).toContain(".hero__media img");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/renderer/test/token-engine.test.ts -t "overflow & aspect"`
Expected: FAIL — the new rules are not yet in `PRODUCTION_SITE_BASE_CSS`.

- [ ] **Step 3: Add the rules**

In `packages/renderer/src/themes/production-base.ts`, insert the following CSS **immediately before** the closing backtick template's final `@media (max-width: 640px) {` block (i.e. after the `[data-block="partnerLogos"] .partner-logos__item { ... }` rule and before `@media (max-width: 640px)`):

```css
[data-block="hero"] .hero__title,
[data-block] :is(
  .value-list__title,
  .activities-list__title,
  .team-grid__title,
  .faq__title,
  .document-downloads__title,
  .event-list__title,
  .image-gallery__title,
  .partner-logos__title,
  .ctaBanner__title
) {
  overflow-wrap: anywhere;
  hyphens: auto;
}
[data-block] :is(.hero__subtitle, .rich-text, .quote) {
  overflow-wrap: anywhere;
}
[data-block="hero"] .hero__media img,
[data-block="imageGallery"] .image-gallery__figure > img,
[data-block="imageGallery"] .image-gallery__trigger img,
[data-block="activitiesList"] .activities-list__media img,
[data-block="event-list"] .event-list__item-media img {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  width: 100%;
  height: auto;
}
```

Note: these rules add no color literals, so the per-theme "no raw color outside `:root`" hygiene assertions are unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/renderer/test/token-engine.test.ts -t "overflow & aspect"`
Expected: PASS.

- [ ] **Step 5: Commit (goldens still regenerated in Task 5)**

```bash
git add packages/renderer/src/themes/production-base.ts packages/renderer/test/token-engine.test.ts
git commit -m "feat(renderer): overflow-wrap/hyphens + image aspect normalization in production base"
```

---

## Task 4: Add an explicit "controls are no longer dead" regression test

The audit's headline foolproofing bug was that `density`/`radius` overrides changed `:root` but were consumed by nothing. Task 2 fixed the emission; this task pins the *consumption* end-to-end through `renderSite` so a future refactor can't silently re-break it.

**Files:**
- Test: `packages/renderer/test/token-engine.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

First add this import to the **top** import group of `packages/renderer/test/token-engine.test.ts`:

```ts
import { renderSite } from "../src/index.js";
```

Then append this describe block to the **end** of the same file:

```ts
describe("density/radius reach rendered CSS through renderSite (regression)", () => {
  test("a density override changes the emitted --density-scale that --space-* consume", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "minimal", tokens: { density: "comfortable" } };
    const html = renderSite(site, "minimal");
    expect(html).toContain("--density-scale: 1.15;");
    expect(html).toContain("--space-md: calc(1rem * var(--density-scale));");
  });

  test("a radius override changes the emitted --radius-base that --radius-* consume", () => {
    const site = structuredClone(fixture) as Site;
    site.theme = { id: "minimal", tokens: { radius: "sharp" } };
    const html = renderSite(site, "minimal");
    expect(html).toContain("--radius-base: 0px;");
    expect(html).toContain("--radius-md: var(--radius-base);");
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm vitest run packages/renderer/test/token-engine.test.ts -t "regression"`
Expected: PASS already (Task 2 implemented the behavior). If it FAILS, the engine wiring regressed — fix `tokens.ts` before continuing. This test exists to lock the behavior, so a green result here is the goal.

- [ ] **Step 3: Commit**

```bash
git add packages/renderer/test/token-engine.test.ts
git commit -m "test(renderer): regression-lock density/radius reaching rendered CSS"
```

---

## Task 5: Regenerate goldens, review the diff, full green

Every golden's `:root` now carries the new tokens, and production-theme goldens carry the new safety rules. Regenerate, then **manually review the diff** to confirm only expected changes landed (new `:root` tokens + the overflow/aspect rules) — never blind-accept a golden regen.

**Files:**
- Regenerate: `packages/renderer/test/__golden__/*.html`

- [ ] **Step 1: Run the full renderer suite to see what drifted**

Run: `pnpm vitest run packages/renderer`
Expected: golden tests FAIL with snapshot mismatches (the `:root` token additions). Non-golden unit tests should PASS. If any *non-golden* test fails (e.g. a test asserting a literal `--space-md: 1rem`), note it — that assertion needs updating to the new calc() form. Update such assertions to match the new engine output before regenerating.

- [ ] **Step 2: Regenerate the golden snapshots**

Run: `pnpm vitest run -u packages/renderer`
Expected: PASS — vitest rewrites every `__golden__/*.html` to the new output.

- [ ] **Step 3: Review the diff**

Run: `git --no-pager diff --stat packages/renderer/test/__golden__/`
Then spot-check one stub and one themed golden:
Run: `git --no-pager diff packages/renderer/test/__golden__/stub-theme-hero.html packages/renderer/test/__golden__/civic-theme-hero.html`
Expected: changes are limited to (a) new `:root` token lines (`--density-scale`, `--space-*` calc, `--radius-base`, `--radius-*` derived, `--type-*`, `--section-gap`, `--measure-*`, `--color-*-rgb`, `--color-on-*`) and (b) the new overflow/aspect rules in production-theme goldens. There must be NO changes to block markup, attributes, or text content. If anything structural changed, stop and investigate — the engine change should be purely additive in `:root` plus the two new rule groups.

- [ ] **Step 4: Full suite green (renderer)**

Run: `pnpm vitest run packages/renderer`
Expected: PASS (all tests, including regenerated goldens).

- [ ] **Step 5: Typecheck + whole-repo test (catch cross-package golden consumers)**

Run: `pnpm --filter @sosb/renderer run typecheck`
Then: `pnpm test`
Expected: PASS. The `@sosb/build` package renders sites too — if any build golden (`packages/build/test/__golden__/*.html`) drifts on the new `:root` tokens, regenerate it the same way: `pnpm vitest run -u packages/build`, review the diff (again: only `:root` token additions), and re-run.

- [ ] **Step 6: Commit**

```bash
git add packages/renderer/test/__golden__ packages/build/test/__golden__
git commit -m "test(renderer): regenerate goldens for engine token additions"
```

---

## Self-Review

**1. Spec coverage** (against `2026-06-14-themes-identity-refresh-design.md` → "The bulletproof engine"):

| Spec requirement | Task |
| --- | --- |
| Fluid `clamp()` type scale (`--type-*`) | Task 2 (defined/emitted); applied per-theme in a later plan |
| Owned `--section-gap` rhythm | Task 2 (token defined); applied per-theme in a later plan |
| Coordinated breakpoints | Deferred to per-theme plans (production-base keeps its single 640px breakpoint here) |
| Measure caps (`--measure-body/-title`) | Task 2 (defined/emitted); applied per-theme in a later plan |
| Overflow `overflow-wrap`/`hyphens` guards | Task 3 (live) |
| Image `aspect-ratio` + `object-fit: cover` | Task 3 (live) |
| `--color-*-rgb` siblings for scrims | Task 2 (live); consumed by the scrim in the hero plan |
| Wire dead density/radius controls | Task 2 + Task 4 (live + regression-locked) |
| Contrast-safe `--color-on-*` derivation | Task 1 + Task 2 (live) |

Engine pieces intentionally **out of this plan** (carried by the companion hero plan or the per-theme plans, and stated as such above): hero overlay markup + legible scrim, the `eyebrow` schema removal, the hygiene-assertion loosening for `rgb(var())`, section-rhythm application, fluid-title application, and per-theme measure-cap application.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" — every step has exact code or an exact command with expected output.

**3. Type consistency:** `hexToRgbTriplet`, `relativeLuminance`, `contrastRatio`, `onColorFor` (Task 1) are the exact names imported in Task 2's `tokens.ts` and tested in Task 1. `densityScale`, `radiusBase`, `emitTokenRoot` (Task 2) match their imports in `token-engine.test.ts`. `PRODUCTION_SITE_BASE_CSS` (Task 3) matches the existing export consumed by `index.tsx`. No signature drift.
