/**
 * Field-override metadata — per ADR 0043 §"Side-table metadata".
 *
 * Two tables: one for the site spine, one keyed by block type. Each
 * entry is path-keyed (dotted; "[]" is the array-element wildcard) and
 * carries optional overrides for label, visibility tier, and
 * custom-renderer name.
 *
 * The form-generator and form-renderer read these tables to decide
 * what to show, what to hide, and which custom widget to mount for a
 * given leaf field. Unknown paths get the form-generator's default —
 * same drift-resistant fallback discipline as `block-catalog.ts`.
 *
 * `readonly` modifiers on the interface and array types prevent
 * accidental mutation through the typed exports. The tables are not
 * frozen at runtime (mirroring `block-catalog.ts`'s posture); a
 * determined caller via `as any` could mutate, but doing so is a
 * convention violation, not a bug.
 */

import { KnownBlockSchemas } from "@sosb/schema";

export type FieldTier = "default" | "advanced" | "hidden";

export interface FieldOverride {
  /** Dotted path; "[]" is the array-element wildcard. */
  readonly path: string;
  readonly label?: string;
  readonly tier?: FieldTier;
  readonly renderer?: string;
  /**
   * Optional advisory helper text rendered as muted small print beneath
   * the field's input. Soft guidance only — a length nudge, a phrasing
   * tip — NOT validation. The engine already keeps over-length content
   * from breaking layout (measure caps, wrapping, fluid type); this just
   * helps authors aim for a good length. Nothing here truncates, blocks,
   * or counts characters.
   */
  readonly hint?: string;
}

export const SPINE_FIELD_METADATA: readonly FieldOverride[] = [
  // Hidden — internal file-format version, not user-editable content.
  { path: "schemaVersion", tier: "hidden" },

  // theme picker — see ADR 0043 §"Metadata renderer: slot"
  { path: "theme.id", renderer: "theme-picker" },
  // theme tokens — covered by ThemeForm (T13); not in the spine walk
  // because theme is carved out (T5)

  // Languages — never typed as raw codes (ADR 0044): a checklist for the
  // declared set and a select over that set for the main language.
  { path: "languages", renderer: "language-list", label: "Languages" },
  {
    path: "defaultLanguage",
    renderer: "language-select",
    label: "Main language",
    hint: "Visitors see this language first. It needs at least one page.",
  },

  // Pages are managed through the Pages list and the per-page settings
  // drill-in, not as an inline array in the site form.
  { path: "pages", tier: "hidden" },

  // Page-level fields (rendered by the per-page settings form, which
  // rebases `pages.[]` onto the active page index).
  { path: "pages.[].navLabel", label: "Menu label", hint: "Shown in the site menu." },
  { path: "pages.[].showInNav", label: "Show this page in the menu" },
  {
    path: "pages.[].slug",
    tier: "advanced",
    label: "Page link name",
    hint: "The last part of the page address, e.g. /about. Lowercase letters, numbers and dashes.",
  },
  { path: "pages.[].seo.title", tier: "advanced", label: "Google result title" },
  { path: "pages.[].seo.description", tier: "advanced", label: "Google result description" },
  { path: "pages.[].seo", label: "Search engines" },

  // Hidden — managed by reorder UI in pages-ops.ts, by the language
  // version flow, or fixed at page creation.
  { path: "pages.[].navOrder", tier: "hidden" },
  { path: "pages.[].lang", tier: "hidden" },
  { path: "pages.[].localizedAs", tier: "hidden" },

  // Org label rewrites
  { path: "org", label: "Organization" },
  { path: "org.name", label: "Organization name", hint: "Shown in the site header and title." },
  { path: "org.legalName", label: "Official organization name" },
  { path: "org.shortName", label: "Display name (used in nav)" },
  { path: "org.logo", label: "Logo" },
  { path: "org.logoAlt", label: "Logo description (for screen readers)" },
  { path: "org.foundedYear", label: "Founded (year)", tier: "advanced" },
  { path: "org.address", label: "Address" },
  { path: "org.email", label: "Email" },
  { path: "org.phone", label: "Phone" },
  {
    path: "org.social",
    label: "Social links",
    hint: "Add the networks where people can find you.",
  },
  { path: "org.social.[].platform", label: "Network", hint: "e.g. instagram, facebook, linkedin" },
  { path: "org.social.[].url", label: "Profile link" },

  // Advisory length nudge — the tagline reads best as a short phrase.
  // Soft guidance only; nothing here validates or truncates.
  { path: "org.tagline", label: "Tagline", hint: "A short phrase — ~60 characters reads best." },
];

export const BLOCK_FIELD_METADATA: Partial<
  Record<keyof typeof KnownBlockSchemas, readonly FieldOverride[]>
> = {
  // Alt text relabel applies wherever a block has a user-editable alt.
  // Hero title/subtitle carry advisory length nudges (soft guidance, not
  // validation): the engine already keeps over-length copy from breaking
  // layout, so these just help authors aim for punchy, scannable lengths.
  hero: [
    { path: "title", hint: "Aim for ~60 characters — short and punchy reads best." },
    { path: "subtitle", hint: "~140 characters keeps the intro scannable." },
    { path: "backgroundAlt", label: "Image description (for screen readers)" },
  ],
  quote: [{ path: "authorImageAlt", label: "Image description (for screen readers)" }],
  contactCard: [
    {
      path: "mapEmbed.coordinates",
      label: "Map coordinates",
      renderer: "lat-lng",
    },
  ],
  imageGallery: [{ path: "images.[].alt", label: "Image description (for screen readers)" }],
  teamGrid: [{ path: "people.[].photo.alt", label: "Image description (for screen readers)" }],
  partnerLogos: [{ path: "partners.[].logo.alt", label: "Image description (for screen readers)" }],
  siteFooter: [{ path: "membership.logo.alt", label: "Image description (for screen readers)" }],
  ctaBanner: [{ path: "backgroundImage.alt", label: "Image description (for screen readers)" }],
  eventList: [{ path: "events.[].imageAlt", label: "Image description (for screen readers)" }],
};

/**
 * Look up an override for a concrete runtime path. Array indices in
 * the path are normalised to the wildcard "[]" for matching.
 */
export function lookupFieldOverride(
  table: readonly FieldOverride[],
  path: readonly (string | number)[],
): FieldOverride | undefined {
  const normalised = path.map((seg) => (typeof seg === "number" ? "[]" : seg)).join(".");
  return table.find((entry) => entry.path === normalised);
}
