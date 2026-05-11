/**
 * Theme catalog — drives the theme picker. Side metadata table mapping
 * renderer-registered theme ids to user-facing labels, descriptions,
 * and per-theme curated font lists.
 *
 * Mirrors `block-catalog.ts` (ADR 0019) for the catalog shape. Exists
 * because of ADR 0043 (form-override architecture): the theme picker
 * is the canonical structural override that replaces what would
 * otherwise be a raw `theme.id` text input — see also ADR 0044 (no
 * technical field escape hatches).
 *
 * The `stub` theme id is deliberately omitted per CONTEXT.md's "Theme
 * catalog" entry: stub is a renderer-test fixture, not a user-facing
 * theme. Unknown ids fall back to a humanised label + empty font lists
 * so a theme that lands in the renderer before its catalog entry
 * still renders.
 *
 * Lives in `@sosb/themes` (T17 follow-up to ADR 0043) so that both
 * `@sosb/editor-app` and `@sosb/wizard` can consume it without
 * inverting the dependency graph. The editor-app keeps a back-compat
 * re-export at `editor-app/src/theme-catalog.ts`; new code should
 * import directly from `@sosb/themes`.
 */

export interface ThemeFonts {
  readonly headline: readonly string[];
  readonly body: readonly string[];
}

export interface ThemeCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly fonts: ThemeFonts;
}

export interface ThemeCatalog {
  readonly entries: readonly ThemeCatalogEntry[];
  entryFor(id: string): ThemeCatalogEntry;
}

const THEME_METADATA: Record<string, Omit<ThemeCatalogEntry, "id">> = {
  academic: {
    label: "Academic",
    description: "Serious, scholarly look — think research society or honors program.",
    fonts: {
      headline: ["Source Serif Pro", "Lora", "Crimson Pro"],
      body: ["Source Sans Pro", "Inter", "Lato"],
    },
  },
  civic: {
    label: "Civic",
    description: "Civically engaged feel — campaigns, advocacy, community.",
    fonts: {
      headline: ["Public Sans", "IBM Plex Sans", "Inter"],
      body: ["Public Sans", "Inter", "Roboto"],
    },
  },
  editorial: {
    label: "Editorial",
    description: "Magazine-style typography for storytelling-heavy orgs.",
    fonts: {
      headline: ["Playfair Display", "Source Serif Pro", "Bodoni Moda"],
      body: ["Source Serif Pro", "Lora", "Inter"],
    },
  },
  minimal: {
    label: "Minimal",
    description: "Quiet, neutral, gets out of your content's way.",
    fonts: {
      headline: ["Inter", "Helvetica Neue", "Arial"],
      body: ["Inter", "Helvetica Neue", "Arial"],
    },
  },
  modern: {
    label: "Modern",
    description: "Clean, bright, contemporary — fits youth-focused programs.",
    fonts: {
      headline: ["Outfit", "Manrope", "Inter"],
      body: ["Inter", "Manrope", "Roboto"],
    },
  },
};

function humanise(id: string): string {
  if (id.length === 0) return id;
  const spaced = id
    // insert a space between a lowercase/digit and an uppercase letter
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // collapse runs of uppercase preserved as e.g. "HTML" into "Html"
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function entryForId(id: string): ThemeCatalogEntry {
  const meta = THEME_METADATA[id];
  if (meta !== undefined) {
    return { id, ...meta };
  }
  return {
    id,
    label: humanise(id),
    description: `Theme "${id}".`,
    fonts: { headline: [], body: [] },
  };
}

export function buildThemeCatalog(): ThemeCatalog {
  const entries = Object.keys(THEME_METADATA)
    .sort()
    .map(entryForId);
  return { entries, entryFor: entryForId };
}
