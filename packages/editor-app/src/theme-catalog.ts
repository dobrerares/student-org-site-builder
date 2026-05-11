/**
 * Theme catalog — drives the theme picker. Mirrors `block-catalog.ts`
 * (ADR 0019): a side metadata table that maps renderer-registered
 * theme ids to user-facing labels, descriptions, and per-theme curated
 * font lists. The `stub` theme id is deliberately omitted per
 * CONTEXT.md.
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
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
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
