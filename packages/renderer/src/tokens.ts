import type { Site } from "@sosb/schema";

/**
 * Tokens-as-CSS-custom-properties.
 *
 * The schema (`@sosb/schema`) defines a small, stable set of theme tokens
 * (`colorPrimary`, `colorAccent`, `fontHeadline`, `fontBody`, `density`,
 * `radius`). Each maps to a kebab-cased CSS custom property on `:root`. The
 * mapping is intentionally narrow and deterministic — additional tokens land
 * by extending the schema, not by ad-hoc renderer logic.
 *
 * Per ADR 0003, the renderer also contributes a small set of *baseline*
 * tokens (spacing scale, default radius) so that block-level CSS has tokens
 * to consume even when the user has not customised every theme value. These
 * baseline values come from the stub theme (or, eventually, from each shipped
 * theme's defaults registered via `registerTheme`).
 */

/** Map a schema theme-token key to its CSS custom property name. */
const SCHEMA_TOKEN_MAP: Readonly<Record<string, string>> = {
  colorPrimary: "--color-primary",
  colorAccent: "--color-accent",
  fontHeadline: "--font-headline",
  fontBody: "--font-body",
  density: "--density",
  radius: "--radius",
};

/**
 * Minimal "baseline" token set the renderer always emits so block-level CSS
 * has something to consume. The stub theme adds nothing on top; richer themes
 * (#28-#31, #47) override these via the schema or contribute their own.
 */
const BASELINE_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["--space-xs", "0.25rem"],
  ["--space-sm", "0.5rem"],
  ["--space-md", "1rem"],
  ["--space-lg", "2rem"],
  ["--space-xl", "4rem"],
  ["--radius-sm", "4px"],
  ["--radius-md", "8px"],
  ["--radius-lg", "16px"],
  ["--font-headline", "Georgia, serif"],
  ["--font-body", "system-ui, sans-serif"],
  ["--color-primary", "#1f3a5f"],
  ["--color-accent", "#c08a3e"],
  ["--color-fg", "#1a1a1a"],
  ["--color-bg", "#ffffff"],
  ["--color-muted", "#5c5c5c"],
];

/**
 * Compose the `:root { ... }` CSS rule for a site. Order is deterministic
 * (later wins, standard CSS):
 *
 *   1. Baseline tokens (spacing scale, radius, fallback palette/fonts).
 *   2. Schema-keyed theme defaults (`themeDefaults`) — palette + fonts
 *      curated by the active theme, looked up via `SCHEMA_TOKEN_MAP` so the
 *      keys stay aligned with `site.theme.tokens`.
 *   3. CSS-prop-keyed theme baseline (`themeBaseline`) — raw
 *      `[--css-prop, value]` pairs for themes that ship palettes outside
 *      the schema-token surface.
 *   4. Schema-provided user overrides from `site.theme.tokens` (in
 *      SCHEMA_TOKEN_MAP order).
 *
 * The duplicates between baseline and overrides are by design and cost a
 * few bytes; the alternative — filtering — would couple the baseline list
 * to the schema's token list at the wrong layer, per ADR 0003.
 */
export function emitTokenRoot(
  site: Site,
  themeDefaults?: Readonly<Record<string, string>>,
  themeBaseline: ReadonlyArray<readonly [string, string]> = [],
): string {
  const declarations: string[] = [];

  for (const [name, value] of BASELINE_TOKENS) {
    declarations.push(`  ${name}: ${value};`);
  }

  if (themeDefaults !== undefined) {
    for (const [schemaKey, cssProp] of Object.entries(SCHEMA_TOKEN_MAP)) {
      const raw = themeDefaults[schemaKey];
      if (typeof raw === "string" && raw.length > 0) {
        declarations.push(`  ${cssProp}: ${raw};`);
      }
    }
  }

  for (const [name, value] of themeBaseline) {
    declarations.push(`  ${name}: ${value};`);
  }

  const userTokens = site.theme.tokens ?? {};
  for (const [schemaKey, cssProp] of Object.entries(SCHEMA_TOKEN_MAP)) {
    const raw = (userTokens as Record<string, unknown>)[schemaKey];
    if (typeof raw === "string" && raw.length > 0) {
      declarations.push(`  ${cssProp}: ${raw};`);
    }
  }

  return `:root {\n${declarations.join("\n")}\n}`;
}
