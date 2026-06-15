import type { Site } from "@sosb/schema";
import { contrastRatio, hexToRgbTriplet, mixHex, onColorFor } from "./color-math.js";

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
 * without raw color literals), contrast-safe `--color-on-*` text colors, and a
 * contrast-safe `--color-link` (accent where it clears WCAG AA on the bg, else
 * the dark primary) that the universal body-link rule consumes.
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
  ["--measure-title", "28ch"],
  ["--font-headline", "Georgia, serif"],
  ["--font-body", "system-ui, sans-serif"],
  ["--color-primary", "#1f3a5f"],
  ["--color-accent", "#c08a3e"],
  ["--color-fg", "#1a1a1a"],
  ["--color-bg", "#ffffff"],
  ["--color-muted", "#5c5c5c"],
  ["--color-on-image", "#ffffff"],
];

/** The palette props whose resolved values drive derived rgb/on-color tokens. */
const RESOLVED_COLOR_DEFAULTS: Readonly<Record<string, string>> = {
  "--color-primary": "#1f3a5f",
  "--color-accent": "#c08a3e",
  "--color-fg": "#1a1a1a",
  "--color-bg": "#ffffff",
};

/**
 * Resolve a single CSS custom property to its final value under the same
 * precedence `emitTokenRoot` uses (baseline → themeDefaults via COLOR_FONT_MAP
 * → themeBaseline raw pairs → user `site.theme.tokens`, last wins). Returns the
 * baseline default when no layer overrides it, or `undefined` if the prop has no
 * baseline and no override. Shared by `emitTokenRoot` and `resolveFontFamilies`
 * so the two never drift.
 */
function resolveTokenValue(
  cssProp: string,
  site: Site,
  themeDefaults: Readonly<Record<string, string>> | undefined,
  themeBaseline: ReadonlyArray<readonly [string, string]>,
): string | undefined {
  // Schema key (e.g. `fontHeadline`) for this CSS prop, if any.
  let schemaKey: string | undefined;
  for (const [key, prop] of Object.entries(COLOR_FONT_MAP)) {
    if (prop === cssProp) {
      schemaKey = key;
      break;
    }
  }

  let value: string | undefined;
  for (const [name, baselineValue] of BASELINE_TOKENS) {
    if (name === cssProp) {
      value = baselineValue;
      break;
    }
  }

  const apply = (raw: unknown): void => {
    if (typeof raw === "string" && raw.length > 0) value = raw;
  };

  if (schemaKey !== undefined && themeDefaults !== undefined) {
    apply((themeDefaults as Record<string, unknown>)[schemaKey]);
  }
  for (const [name, raw] of themeBaseline) {
    if (name === cssProp) apply(raw);
  }
  if (schemaKey !== undefined) {
    apply((site.theme.tokens as Record<string, unknown> | undefined)?.[schemaKey]);
  }
  return value;
}

/**
 * Extract the first (primary) family name from a CSS `font-family` stack. The
 * leading token is either `"Quoted Name"` or a bare `comma,separated` token; we
 * return the unquoted name, or `undefined` for an empty/whitespace stack.
 */
function firstFamilyOf(stack: string | undefined): string | undefined {
  if (stack === undefined) return undefined;
  const trimmed = stack.trim();
  if (trimmed.length === 0) return undefined;
  const quoted = /^\s*"([^"]*)"/.exec(trimmed);
  if (quoted !== null) return quoted[1];
  const firstToken = trimmed.split(",")[0]!.trim();
  return firstToken.length === 0 ? undefined : firstToken;
}

/**
 * Resolve the active headline/body font families for a site under the exact
 * precedence `emitTokenRoot` uses, returning each slot's primary (first) family
 * name — i.e. the leading quoted (or first comma-token) family of the resolved
 * `--font-headline` / `--font-body` stack. Returns `undefined` for a slot with
 * no resolved stack. Pure; the @font-face emission gate (index.tsx) consumes it.
 */
export function resolveFontFamilies(
  site: Site,
  themeDefaults?: Readonly<Record<string, string>>,
  themeBaseline: ReadonlyArray<readonly [string, string]> = [],
): { headline: string | undefined; body: string | undefined } {
  return {
    headline: firstFamilyOf(
      resolveTokenValue("--font-headline", site, themeDefaults, themeBaseline),
    ),
    body: firstFamilyOf(resolveTokenValue("--font-body", site, themeDefaults, themeBaseline)),
  };
}

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
 * (`--color-*-rgb`, `--color-on-*`, `--color-link`) are emitted last so they
 * reflect the final resolved palette regardless of which layer won.
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

  // Contrast-safe body-link text color. Links keep the accent where it clears
  // WCAG AA (4.5:1) against the page background (civic/modern/minimal); where the
  // accent is too light against the bg (academic gold-on-cream, editorial
  // terracotta-on-cream) they fall back to the dark brand primary, which is AA on
  // the light ground. The accent still shows as the link underline (set in the
  // universal link rule), so theme identity is preserved while the text stays
  // legible. This is also override-proof: a user who picks a pale accent gets the
  // primary fallback automatically. Unparseable colors (contrastRatio undefined)
  // are treated as not-ok → primary. The emitted value is a `var()` ref (no raw
  // hex), keeping the "no raw color outside :root" discipline intact.
  const linkOk = (contrastRatio(resolved["--color-accent"]!, resolved["--color-bg"]!) ?? 0) >= 4.5;
  declarations.push(`  --color-link: ${linkOk ? "var(--color-accent)" : "var(--color-primary)"};`);

  // Subtle card surface: a faint tint of the background toward the foreground.
  // Theme-aware (darkens a light bg, lightens a dark bg), so cards get quiet
  // definition without a hard slate border. Computed once here; the block CSS
  // consumes var(--color-surface).
  const surface = mixHex(resolved["--color-bg"]!, resolved["--color-fg"]!, 0.05);
  declarations.push(`  --color-surface: ${surface ?? resolved["--color-bg"]!};`);

  return `:root {\n${declarations.join("\n")}\n}`;
}
