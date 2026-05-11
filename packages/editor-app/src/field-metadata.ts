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
}

export const SPINE_FIELD_METADATA: readonly FieldOverride[] = [
  // theme picker — see ADR 0043 §"Metadata renderer: slot"
  { path: "theme.id", renderer: "theme-picker" },
  // theme tokens — covered by ThemeForm (T13); not in the spine walk
  // because theme is carved out (T5)

  // Page-level advanced fields
  { path: "pages.[].slug", tier: "advanced", label: "Page address (the URL slug)" },
  { path: "pages.[].localizedAs", tier: "advanced", label: "Linked translation" },
  { path: "pages.[].seo.title", tier: "advanced", label: "Search engine title" },
  { path: "pages.[].seo.description", tier: "advanced", label: "Search engine snippet" },

  // Hidden — managed by reorder UI in pages-ops.ts
  { path: "pages.[].navOrder", tier: "hidden" },

  // Org label rewrites
  { path: "org.legalName", label: "Official organization name" },
  { path: "org.shortName", label: "Display name (used in nav)" },
];

export const BLOCK_FIELD_METADATA: Partial<
  Record<keyof typeof KnownBlockSchemas, readonly FieldOverride[]>
> = {
  // Alt text relabel applies wherever a block has a user-editable alt.
  hero: [
    { path: "backgroundAlt", label: "Image description (for screen readers)" },
  ],
  quote: [
    { path: "authorImageAlt", label: "Image description (for screen readers)" },
  ],
  imageGallery: [
    { path: "images.[].alt", label: "Image description (for screen readers)" },
  ],
  teamGrid: [
    { path: "people.[].photo.alt", label: "Image description (for screen readers)" },
  ],
  partnerLogos: [
    { path: "partners.[].logo.alt", label: "Image description (for screen readers)" },
  ],
  ctaBanner: [
    { path: "backgroundImage.alt", label: "Image description (for screen readers)" },
  ],
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
