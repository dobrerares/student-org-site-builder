import { z } from "zod";

/**
 * valueList block — the values / mission section.
 *
 * Per the PRD ("user story 22"): a list of org principles, each with a
 * mandatory `label`, an optional plain-text `description`, and an optional
 * `icon` chosen from a curated lucide subset (no SVG paste, no custom
 * uploads). The block also exposes a `layout` (grid vs list) and a
 * `columns` count for the grid layout.
 *
 * Forward-compat: like every block schema in v1, the data is a
 * `looseObject` — unknown extra fields survive a read-write-read cycle so a
 * future editor version can add fields without breaking older consumers.
 *
 * The curated icon set is intentionally narrow. Adding a new icon is a
 * one-line schema change plus a path entry in the renderer's icon table —
 * no editor-side wiring required because the editor form is auto-generated
 * from this schema.
 */

/**
 * Curated lucide icon subset for the valueList block. Picked for the kinds
 * of values student orgs typically express: community, learning, growth,
 * craft, integrity, advocacy. The set is small on purpose — issue #10's
 * out-of-scope explicitly forbids "custom icon uploads or SVG paste".
 */
export const VALUE_LIST_ICON_NAMES = [
  "users",
  "heart",
  "star",
  "shield",
  "lightbulb",
  "book",
  "compass",
  "target",
  "sparkles",
  "globe",
  "hand-heart",
  "handshake",
  "leaf",
  "scale",
  "graduation-cap",
] as const;

export type ValueListIconName = (typeof VALUE_LIST_ICON_NAMES)[number];

const ValueListIconSchema = z.enum(VALUE_LIST_ICON_NAMES);

export const VALUE_LIST_LAYOUTS = ["grid", "list"] as const;
export type ValueListLayout = (typeof VALUE_LIST_LAYOUTS)[number];

/**
 * The columns values currently surfaced by the editor's auto-generated
 * form. The schema accepts any integer in `[1, 4]`; this constant exists so
 * the editor and themes share a stable enumeration without re-deriving from
 * the schema.
 */
export const VALUE_LIST_COLUMNS = [1, 2, 3, 4] as const;
export type ValueListColumns = (typeof VALUE_LIST_COLUMNS)[number];

export const ValueListItemSchema = z.looseObject({
  icon: ValueListIconSchema.optional(),
  label: z.string().min(1),
  description: z.string().optional(),
});

export type ValueListItem = z.infer<typeof ValueListItemSchema>;

export const ValueListDataSchema = z.looseObject({
  title: z.string().optional(),
  intro: z.string().optional(),
  items: z.array(ValueListItemSchema),
  /**
   * Visual layout. `grid` distributes items in `columns`-wide cells; `list`
   * stacks them vertically with full-width rows. Themes interpret these
   * keys; the renderer just emits structural classes.
   */
  layout: z.enum(VALUE_LIST_LAYOUTS).default("grid"),
  /**
   * Number of columns when `layout === "grid"`. Ignored for `list`. The
   * renderer always falls back to a single column on narrow viewports
   * (CSS responsive grid). Range 1..4 is the curated set the themes are
   * known to lay out cleanly; values outside that range fail validation.
   */
  columns: z.number().int().min(1).max(4).default(3),
});

export const ValueListBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("valueList"),
  version: z.literal(1),
  data: ValueListDataSchema,
});

export const VALUE_LIST_BLOCK_VERSION = 1 as const;

export type ValueListBlock = z.infer<typeof ValueListBlockSchema>;
export type ValueListData = z.infer<typeof ValueListDataSchema>;
