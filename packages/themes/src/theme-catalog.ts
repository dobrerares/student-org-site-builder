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
  readonly preview: ThemePreview;
}

export interface ThemePreview {
  readonly swatches: readonly string[];
  readonly headlineSample: string;
  readonly bodySample: string;
}

export interface ThemeCatalog {
  readonly entries: readonly ThemeCatalogEntry[];
  entryFor(id: string): ThemeCatalogEntry;
}

const THEME_METADATA: Record<string, Omit<ThemeCatalogEntry, "id">> = {
  academic: {
    label: "Scholarly",
    description:
      "Scholarly and credible — navy and gold with a Source Serif display. For research societies, honors programs and faculty bodies.",
    fonts: {
      headline: ["Source Serif 4", "Fraunces", "Inter"],
      body: ["Inter"],
    },
    preview: {
      swatches: ["#1e3a5f", "#b8893e", "#f7f3ea"],
      headlineSample: "Cercetare",
      bodySample: "Credible and scholarly.",
    },
  },
  civic: {
    label: "Activist",
    description:
      "Bold and direct — heavy Archivo display, a crimson accent, compact and sharp. For advocacy, campaigns and student-rights work.",
    fonts: {
      headline: ["Archivo", "Space Grotesk", "Inter"],
      body: ["Inter"],
    },
    preview: {
      swatches: ["#cb2b2b", "#17181c", "#ffffff"],
      headlineSample: "Acțiune",
      bodySample: "Bold and direct.",
    },
  },
  editorial: {
    label: "Editorial",
    description:
      "Type-forward and warm — a Fraunces serif display on cream paper. For student publications, cultural and debate societies.",
    fonts: {
      headline: ["Fraunces", "Source Serif 4", "Inter"],
      body: ["Inter"],
    },
    preview: {
      swatches: ["#c4622d", "#1a1714", "#fbf8f3"],
      headlineSample: "Revistă",
      bodySample: "Type-forward, story-led.",
    },
  },
  minimal: {
    label: "Calm",
    description:
      "Disciplined restraint — monochrome, airy, sharp-edged; lets your photos and writing carry the page.",
    fonts: {
      headline: ["Inter"],
      body: ["Inter"],
    },
    preview: {
      swatches: ["#1a1a1a", "#767676", "#ffffff"],
      headlineSample: "Claritate",
      bodySample: "Quiet and restrained.",
    },
  },
  modern: {
    label: "Tech",
    description:
      "Crisp and bright — geometric Space Grotesk, an electric-blue accent, generous space. For hackathons, engineering and tech clubs.",
    fonts: {
      headline: ["Space Grotesk", "Archivo", "Inter"],
      body: ["Inter"],
    },
    preview: {
      swatches: ["#2563eb", "#0f172a", "#ffffff"],
      headlineSample: "Hackathon",
      bodySample: "Crisp, bright, geometric.",
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
    preview: { swatches: [], headlineSample: "", bodySample: "" },
  };
}

export function buildThemeCatalog(): ThemeCatalog {
  const entries = Object.keys(THEME_METADATA).sort().map(entryForId);
  return { entries, entryFor: entryForId };
}
