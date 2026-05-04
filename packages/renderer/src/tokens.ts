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
 * Compose the `:root { ... }` CSS rule for a site. Order is deterministic:
 * baseline tokens first (in their declared order), then schema-provided
 * overrides (in the SCHEMA_TOKEN_MAP order). Later wins, so user theme
 * tokens override the baseline.
 */
export function emitTokenRoot(site: Site): string {
  const declarations: string[] = [];

  for (const [name, value] of BASELINE_TOKENS) {
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
