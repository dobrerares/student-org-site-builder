import { z } from "zod";
import { HeroBlockSchema } from "./hero.js";
import { ValueListBlockSchema } from "./value-list.js";
import { ContactCardBlockSchema } from "./contact-card.js";
import { EmbedBlockSchema } from "./embed.js";
import { CustomHtmlBlockSchema } from "./custom-html.js";
import { ActivitiesListBlockSchema } from "./activities-list.js";
import { TeamGridBlockSchema } from "./team-grid.js";
import { RichTextBlockSchema } from "./rich-text.js";

export { HeroBlockSchema, HeroDataSchema, HERO_BLOCK_VERSION } from "./hero.js";
export type { HeroBlock, HeroData } from "./hero.js";
export {
  VALUE_LIST_BLOCK_VERSION,
  VALUE_LIST_COLUMNS,
  VALUE_LIST_ICON_NAMES,
  VALUE_LIST_LAYOUTS,
  ValueListBlockSchema,
  ValueListDataSchema,
  ValueListItemSchema,
} from "./value-list.js";
export type {
  ValueListBlock,
  ValueListColumns,
  ValueListData,
  ValueListIconName,
  ValueListItem,
  ValueListLayout,
} from "./value-list.js";

export {
  ContactCardBlockSchema,
  ContactCardDataSchema,
  CONTACT_CARD_BLOCK_VERSION,
} from "./contact-card.js";
export type { ContactCardBlock, ContactCardData, ContactCardMapEmbed } from "./contact-card.js";
export {
  EMBED_BLOCK_VERSION,
  EMBED_PROVIDERS,
  EMBED_URL_PATTERNS,
  EmbedBlockSchema,
  EmbedDataSchema,
  isValidEmbedUrl,
} from "./embed.js";
export type { EmbedBlock, EmbedData, EmbedProvider } from "./embed.js";

export {
  CustomHtmlBlockSchema,
  CustomHtmlDataSchema,
  CUSTOM_HTML_BLOCK_VERSION,
} from "./custom-html.js";
export type { CustomHtmlBlock, CustomHtmlData } from "./custom-html.js";
export {
  ActivitiesListBlockSchema,
  ActivitiesListDataSchema,
  ActivitiesListLayoutSchema,
  ActivityImageRefSchema,
  ActivityItemSchema,
  ActivityLinkSchema,
  ACTIVITIES_LIST_BLOCK_VERSION,
} from "./activities-list.js";
export type {
  ActivitiesListBlock,
  ActivitiesListData,
  ActivitiesListLayout,
  ActivityImageRef,
  ActivityItem,
  ActivityLink,
} from "./activities-list.js";
export {
  TeamGridBlockSchema,
  TeamGridDataSchema,
  TEAM_GRID_BLOCK_VERSION,
} from "./team-grid.js";
export type {
  TeamGridBlock,
  TeamGridData,
  TeamGridPerson,
  TeamGridPersonPhoto,
  TeamGridSocialLink,
} from "./team-grid.js";
export {
  RichTextBlockSchema,
  RichTextDataSchema,
  RICH_TEXT_BLOCK_VERSION,
} from "./rich-text.js";
export type { RichTextBlock, RichTextData } from "./rich-text.js";

/**
 * The block envelope is `{ id, type, version, data }`. This generic envelope
 * accepts any string `type` and any positive `version`, so unknown block
 * types from a future editor version still parse and round-trip without
 * losing data. Known types (e.g. hero, contactCard, embed, richText) are
 * validated against their specific schemas inside `validateBlock`.
 */
export const BlockEnvelopeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().positive(),
  data: z.looseObject({}),
});

export type BlockEnvelope = z.infer<typeof BlockEnvelopeSchema>;

/**
 * Registry of known block schemas keyed by `type`. Future block types land
 * in this registry without changing the envelope or call sites. Unknown
 * types are intentionally not in this map - they fall through to envelope
 * validation only.
 */
export const KnownBlockSchemas = {
  hero: HeroBlockSchema,
  valueList: ValueListBlockSchema,
  contactCard: ContactCardBlockSchema,
  embed: EmbedBlockSchema,
  customHTML: CustomHtmlBlockSchema,
  activitiesList: ActivitiesListBlockSchema,
  teamGrid: TeamGridBlockSchema,
  richText: RichTextBlockSchema,
} as const;

export type KnownBlockType = keyof typeof KnownBlockSchemas;

export function isKnownBlockType(type: string): type is KnownBlockType {
  return Object.prototype.hasOwnProperty.call(KnownBlockSchemas, type);
}
