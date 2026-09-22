/**
 * The renderer's theme seam (ADR 0052).
 *
 * Before this module the renderer chose a theme with a compile-time `if`
 * chain over `themeId` (`themeCssFor` / `themeBaselineTokensFor`). That made
 * a theme a *code* artefact: you could not render under a theme the renderer
 * had not been compiled with, which is precisely what developer-authored
 * Theme packages need (ADR 0050).
 *
 * A `ThemeBundle` is the data a theme reduces to: an id, CSS, baseline
 * tokens, the appearance controls it honours, the design variants it offers,
 * and (for packaged themes) its fonts and decorative assets. The built-in
 * themes are expressed as bundles too, so `renderSite` has exactly one code
 * path and there is no "custom theme" branch to drift.
 *
 * Phase two adds two optional fields — `render` and `publicScript` — exactly
 * as ADR 0050 promised: the bundle is an interface, so executable rendering is
 * an *additive* change and a declarative Theme is still a complete bundle.
 * See ADR 0053.
 */

import type { ThemePublicScript, ThemeRenderModule } from "./theme-render.js";
import { STUB_THEME_CSS, STUB_THEME_ID } from "./themes/stub.js";
import { PRODUCTION_SITE_BASE_CSS } from "./themes/production-base.js";
import {
  MINIMAL_THEME_BASELINE_TOKENS,
  MINIMAL_THEME_CSS,
  MINIMAL_THEME_ID,
} from "./themes/minimal.js";
import {
  MODERN_THEME_BASELINE_TOKENS,
  MODERN_THEME_CSS,
  MODERN_THEME_ID,
} from "./themes/modern.js";
import {
  EDITORIAL_THEME_BASELINE_TOKENS,
  EDITORIAL_THEME_CSS,
  EDITORIAL_THEME_ID,
} from "./themes/editorial.js";
import { CIVIC_THEME_BASELINE_TOKENS, CIVIC_THEME_CSS, CIVIC_THEME_ID } from "./themes/civic.js";
import { ACADEMIC_THEME_CSS, ACADEMIC_THEME_ID, ACADEMIC_THEME_TOKENS } from "./themes/academic.js";

/**
 * Which builder appearance controls a theme honours (ADR 0046: "Themes must
 * document which builder appearance controls they support"). The editor hides
 * the controls a theme does not support rather than letting an author change a
 * value that the theme's CSS overrides anyway.
 *
 * Built-in themes support all four. A packaged theme with a fixed brand
 * palette declares `colors: false` and the colour pickers disappear.
 */
export interface ThemeSupports {
  readonly colors: boolean;
  readonly fonts: boolean;
  readonly density: boolean;
  readonly radius: boolean;
}

/** Every appearance control honoured — the built-in themes' posture. */
export const ALL_THEME_SUPPORTS: ThemeSupports = {
  colors: true,
  fonts: true,
  density: true,
  radius: true,
};

/**
 * One named design variant. `id` is what lands in the Site data and in the
 * emitted `data-variant` attribute; `label` is what the author picks from.
 */
export interface ThemeVariant {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
}

/**
 * A packaged font face. `file` is the bundle-relative path (`fonts/x.woff2`);
 * the renderer emits it under `assets/theme/<theme id>/<file>` so the build
 * output, the editable archive and the preview blob resolver all agree on one
 * canonical path.
 */
export interface ThemeFontFace {
  readonly family: string;
  readonly weight: number;
  readonly style: "normal" | "italic";
  readonly file: string;
  readonly unicodeRange?: string | undefined;
}

/**
 * Where a theme's `@font-face` rules come from.
 *
 * - `registry` — the built-in behaviour: emit faces for whichever self-hosted
 *   families the *resolved* tokens actually name, from the generated
 *   compile-time registry. Which families those are depends on the site, so
 *   this cannot be a fixed list.
 * - `bundle` — a packaged theme's own woff2 files. Fixed at author time.
 *
 * A bundle theme gets *both*: its own faces plus the registry gate, so that a
 * theme declaring `supports.fonts` still works when an author picks one of the
 * builder's own families.
 */
export type ThemeFontSource =
  | { readonly kind: "registry" }
  | {
      readonly kind: "bundle";
      readonly faces: readonly ThemeFontFace[];
      readonly bytes: ReadonlyMap<string, Uint8Array>;
    };

/**
 * A fully resolved theme, ready to render. Built-in themes and imported Theme
 * packages both reduce to this; `renderSite` knows nothing else about themes.
 */
export interface ThemeBundle {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** One-line summary shown beside the theme in the picker. */
  readonly description?: string | undefined;
  // Deliberately no swatch/sample metadata. The pickers show a real miniature
  // render of the theme (`@sosb/themes`' `ThemeMiniPreview`), which is the
  // renderer's own output and therefore cannot drift from the theme. A
  // hand-written palette on the bundle would be a second copy of what the CSS
  // already says, which is exactly what #116 deleted for the built-ins.
  /** `builtin` themes ship with the builder; `package` themes were imported. */
  readonly origin: "builtin" | "package";
  /** The theme's own CSS overlay. Composed *after* the shared baselines. */
  readonly css: string;
  /** Raw `[cssProp, value]` baseline tokens, emitted into `:root`. */
  readonly baselineTokens: ReadonlyArray<readonly [string, string]>;
  /** Schema-keyed defaults (`colorPrimary` etc). Rarely used; see ADR 0032. */
  readonly defaults?: Readonly<Record<string, string>> | undefined;
  readonly supports: ThemeSupports;
  /** Block type -> the design variants this theme offers for it. */
  readonly blockVariants: Readonly<Record<string, readonly ThemeVariant[]>>;
  /** Page-shell variants (header/nav/footer treatments). */
  readonly shellVariants: readonly ThemeVariant[];
  readonly fontSource: ThemeFontSource;
  /** Decorative files the CSS references, keyed by bundle-relative path. */
  readonly assets: ReadonlyMap<string, Uint8Array>;
  /**
   * The Theme's executable design (`render.js`), already loaded into its
   * sandbox (ADR 0053). Absent for built-in Themes and for declarative
   * packages, and the renderer treats absence as "use the built-in designs" —
   * which is why phase-one packages keep rendering exactly as they did.
   */
  readonly render?: ThemeRenderModule | undefined;
  /**
   * The Theme's public-site script (`public.js`) and its declared external
   * dependencies. Emitted into the built Site; never run during a render.
   */
  readonly publicScript?: ThemePublicScript | undefined;
}

/**
 * Canonical output prefix for a packaged theme's own files. Both the build's
 * `dist/` and the editor preview's blob resolver key off this, which is what
 * makes preview/export parity mechanical rather than a thing to remember.
 */
export function themeAssetPrefix(themeId: string): string {
  return `assets/theme/${themeId}/`;
}

/**
 * Compose the CSS layers for a bundle.
 *
 * Every theme is stacked on the stub layout baseline (which covers every
 * registered block type) so a theme that curates three blocks does not leave
 * the other thirteen unstyled. Production themes additionally get
 * `PRODUCTION_SITE_BASE_CSS`. Packaged themes are treated exactly like
 * production themes — they are *site* themes, not the renderer's test
 * sentinel — so a Theme package author inherits a working baseline and only
 * writes the deltas they care about.
 */
export function composeThemeCss(bundle: ThemeBundle): string {
  if (bundle.id === STUB_THEME_ID) return STUB_THEME_CSS;
  const base = `${STUB_THEME_CSS}\n${PRODUCTION_SITE_BASE_CSS}`;
  if (bundle.css.length === 0) return base;
  return `${base}\n${bundle.css}`;
}

function builtinBundle(
  id: string,
  name: string,
  css: string,
  baselineTokens: ReadonlyArray<readonly [string, string]>,
): ThemeBundle {
  return {
    id,
    name,
    version: "1.0.0",
    origin: "builtin",
    css,
    baselineTokens,
    supports: ALL_THEME_SUPPORTS,
    blockVariants: {},
    shellVariants: [],
    fontSource: { kind: "registry" },
    assets: new Map(),
  };
}

/**
 * The built-in themes, as bundles. This table replaces the old `themeCssFor` /
 * `themeBaselineTokensFor` `if` chains; the values are the same constants in
 * the same composition order, so built-in output is byte-identical to before
 * and the golden-file matrix is untouched.
 */
const BUILTIN_BUNDLES: Readonly<Record<string, ThemeBundle>> = {
  [STUB_THEME_ID]: builtinBundle(STUB_THEME_ID, "Stub", STUB_THEME_CSS, []),
  [MINIMAL_THEME_ID]: builtinBundle(
    MINIMAL_THEME_ID,
    "Minimal",
    MINIMAL_THEME_CSS,
    MINIMAL_THEME_BASELINE_TOKENS,
  ),
  [MODERN_THEME_ID]: builtinBundle(
    MODERN_THEME_ID,
    "Modern",
    MODERN_THEME_CSS,
    MODERN_THEME_BASELINE_TOKENS,
  ),
  [EDITORIAL_THEME_ID]: builtinBundle(
    EDITORIAL_THEME_ID,
    "Editorial",
    EDITORIAL_THEME_CSS,
    EDITORIAL_THEME_BASELINE_TOKENS,
  ),
  [CIVIC_THEME_ID]: builtinBundle(
    CIVIC_THEME_ID,
    "Civic",
    CIVIC_THEME_CSS,
    CIVIC_THEME_BASELINE_TOKENS,
  ),
  [ACADEMIC_THEME_ID]: builtinBundle(
    ACADEMIC_THEME_ID,
    "Academic",
    ACADEMIC_THEME_CSS,
    ACADEMIC_THEME_TOKENS,
  ),
};

/** Is this id one of the themes compiled into the builder? */
export function isBuiltinThemeId(themeId: string): boolean {
  return Object.hasOwn(BUILTIN_BUNDLES, themeId);
}

/** The built-in bundle for `themeId`, or `undefined` if it is not built in. */
export function builtinThemeBundle(themeId: string): ThemeBundle | undefined {
  return BUILTIN_BUNDLES[themeId];
}

/**
 * Resolve the bundle to render under.
 *
 * An explicitly supplied bundle wins (that is how an imported Theme package
 * reaches the renderer). Otherwise the id is looked up among the built-ins.
 * An unknown id falls back to the stub layout baseline so that *rendering*
 * never hard-fails on a missing theme — content stays visible and legible.
 *
 * That fallback is deliberately not a silent success path for the product:
 * `themeReferenceIssue` reports the missing theme, the editor surfaces it with
 * a repair action, and `build()` refuses to export. ADR 0051 records why
 * "preserve the content, block the export" beats "swap in another theme".
 */
export function resolveThemeBundle(themeId: string, supplied?: ThemeBundle): ThemeBundle {
  if (supplied !== undefined) {
    if (supplied.id !== themeId) {
      throw new Error(
        `renderSite: theme bundle id "${supplied.id}" does not match requested theme "${themeId}"`,
      );
    }
    return supplied;
  }
  return BUILTIN_BUNDLES[themeId] ?? BUILTIN_BUNDLES[STUB_THEME_ID]!;
}

/**
 * The variants this theme offers for a block type, or an empty list. The
 * editor shows a Variant control only when this is non-empty.
 */
export function variantsForBlockType(
  bundle: ThemeBundle,
  blockType: string,
): readonly ThemeVariant[] {
  return bundle.blockVariants[blockType] ?? [];
}

/**
 * Is `variantId` actually offered by this theme for this block type?
 *
 * Switching themes does not rewrite Block data (ADR 0046 / issue-106 plan):
 * the saved choice simply stops applying when the new theme does not offer it,
 * and applies again on switching back. The renderer uses this to decide
 * whether to emit `data-variant` at all, so a stale choice cannot leak a
 * dangling attribute into the output.
 */
export function offersBlockVariant(
  bundle: ThemeBundle,
  blockType: string,
  variantId: string,
): boolean {
  return variantsForBlockType(bundle, blockType).some((v) => v.id === variantId);
}

/** As `offersBlockVariant`, for page-shell variants. */
export function offersShellVariant(bundle: ThemeBundle, variantId: string): boolean {
  return bundle.shellVariants.some((v) => v.id === variantId);
}
