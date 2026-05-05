import { z } from "zod";

/**
 * teamGrid block — list of org members with optional grouping.
 *
 * Per the PRD (story 24 + Implementation Decisions → Block library), the
 * teamGrid lists members with name, role, optional photo, optional bio, and
 * optional social links, with optional grouping by department. The schema is
 * declared with `looseObject` so unknown fields survive a round-trip
 * read-write-read; this is the v1 forward-compatibility contract that
 * mirrors the hero block.
 *
 * Image fields use a content-addressed `AssetRef`-shaped object (mirrored
 * here as `PersonPhotoSchema`). The shape matches `@sosb/assets`'s
 * `AssetRef` interface; the schema package keeps the type local rather than
 * pulling in `@sosb/assets` as a dependency, since runtime image-processing
 * code never has to reach the schema-validation surface.
 */

const SocialLinkSchema = z.looseObject({
  platform: z.string().min(1),
  url: z.string().min(1),
});

const PersonPhotoSchema = z.looseObject({
  /** SHA-256 prefix — the content-address of the asset. */
  hash: z.string().min(1),
  /** VFS path of the asset bytes (e.g. `assets/8e3a7f9b1c0d2e4f.jpg`). */
  path: z.string().min(1),
  /** VFS path of the metadata sidecar. */
  metadataPath: z.string().min(1),
  /** Output content type. */
  mime: z.string().min(1),
  /** Pixel dimensions of the stored asset. */
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  /**
   * Alt text. The schema accepts an empty string so that a stale import does
   * not hard-error; the validation rule pass surfaces an empty alt as a
   * `warning` (mirroring the hero block's missing-alt nudge).
   */
  alt: z.string(),
});

const PersonSchema = z.looseObject({
  name: z.string().min(1),
  role: z.string().min(1),
  /**
   * Free-form key used to bucket people when `groupBy` is set on the parent
   * teamGrid. The PRD suggests "department" as the canonical example, but
   * the field is intentionally open so an org can group by anything (year,
   * faculty, ...) without a schema bump.
   */
  department: z.string().optional(),
  bio: z.string().optional(),
  photo: PersonPhotoSchema.optional(),
  socials: z.array(SocialLinkSchema).optional(),
});

export const TeamGridDataSchema = z.looseObject({
  title: z.string().optional(),
  intro: z.string().optional(),
  /**
   * Column count. The PRD pins the responsive grid at 2/3/4 columns; values
   * outside that set are rejected so the renderer's CSS Grid mapping has a
   * fixed contract.
   */
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  /**
   * Optional key on each person used to bucket the grid into headed groups
   * (e.g. department headers). When unset, the grid renders as a single
   * flat list. Per the issue's "out of scope": single-level grouping only —
   * nested groups are not supported in v1.
   */
  groupBy: z.string().optional(),
  /**
   * People list. Empty arrays are rejected: a teamGrid with no people is
   * treated as a structural error rather than a rendered placeholder, since
   * the editor's auto-form #7 always seeds at least one row.
   */
  people: z.array(PersonSchema).min(1),
});

export const TeamGridBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("teamGrid"),
  version: z.literal(1),
  data: TeamGridDataSchema,
});

export const TEAM_GRID_BLOCK_VERSION = 1 as const;

export type TeamGridBlock = z.infer<typeof TeamGridBlockSchema>;
export type TeamGridData = z.infer<typeof TeamGridDataSchema>;
export type TeamGridPerson = z.infer<typeof PersonSchema>;
export type TeamGridPersonPhoto = z.infer<typeof PersonPhotoSchema>;
export type TeamGridSocialLink = z.infer<typeof SocialLinkSchema>;
