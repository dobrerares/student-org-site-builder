import { z } from "zod";

/**
 * `activitiesList` block — image-bearing list of recurring projects /
 * activities the org runs.
 *
 * Per the PRD (user story #23, block library list), this is one of the six
 * mandatory blocks auto-created on a new site. Each item carries a title,
 * an optional description, an optional image, an optional link with optional
 * label, and an optional badge string (e.g. `Anual` / `Lunar` / `Sezonier`).
 *
 * Three layouts ship in v1: `cards`, `list`, `alternating`. They share a
 * single semantic structure in the renderer; layout selection is purely a
 * `data-layout` attribute that themes can target — no per-layout component
 * fork.
 *
 * Image alt enforcement: `image.alt` must be a non-empty string. This
 * mirrors the upload-time enforcement in `@sosb/assets` (#8), where empty
 * alt throws `AssetError("asset.alt.missing")`. We surface the same rule
 * at the schema layer so loaded sites with stale or imported data still
 * fail validation loudly rather than silently rendering an inaccessible
 * image.
 *
 * Forward compat: every nested object uses `z.looseObject` so unknown
 * fields survive a round-trip read-write-read.
 */

/**
 * Subset of `@sosb/assets`'s `AssetRef` we depend on at the schema layer.
 *
 * The schema package deliberately does not import `@sosb/assets`: assets is
 * a runtime / browser-side concern (Canvas APIs, sharp processor, VFS
 * integration), and the schema package needs to stay zero-runtime-dep
 * beyond Zod. We re-declare the shape here with the same field names, and
 * the schema is structurally compatible with the runtime `AssetRef` —
 * blocks carry an `AssetRef` as `image` and the schema validates it.
 */
export const ActivityImageRefSchema = z.looseObject({
  hash: z.string().min(1),
  path: z.string().min(1),
  metadataPath: z.string().min(1),
  mime: z.string().min(1),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  // Mandatory non-empty alt — mirrors the upload-time alt enforcement
  // in @sosb/assets (#8).
  alt: z.string().min(1),
});

export const ActivityLinkSchema = z.looseObject({
  href: z.string().min(1),
  label: z.string().optional(),
});

export const ActivityItemSchema = z.looseObject({
  title: z.string().min(1),
  description: z.string().optional(),
  image: ActivityImageRefSchema.optional(),
  link: ActivityLinkSchema.optional(),
  badge: z.string().min(1).optional(),
});

export const ActivitiesListLayoutSchema = z.enum(["cards", "list", "alternating"]);
export type ActivitiesListLayout = z.infer<typeof ActivitiesListLayoutSchema>;

export const ActivitiesListDataSchema = z.looseObject({
  title: z.string().min(1),
  intro: z.string().optional(),
  layout: ActivitiesListLayoutSchema,
  items: z.array(ActivityItemSchema),
});

export const ActivitiesListBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("activitiesList"),
  version: z.literal(1),
  data: ActivitiesListDataSchema,
});

export const ACTIVITIES_LIST_BLOCK_VERSION = 1 as const;

export type ActivitiesListBlock = z.infer<typeof ActivitiesListBlockSchema>;
export type ActivitiesListData = z.infer<typeof ActivitiesListDataSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type ActivityLink = z.infer<typeof ActivityLinkSchema>;
export type ActivityImageRef = z.infer<typeof ActivityImageRefSchema>;
