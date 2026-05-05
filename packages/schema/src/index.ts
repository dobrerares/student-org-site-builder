/**
 * `@sosb/schema` — block + site schemas, severity-tiered validation,
 * migration scaffold, and preserve-unknown-keys for forward compatibility.
 *
 * Tracking issue: #3.
 *
 * The runtime schemas are the single source of truth: TypeScript types are
 * derived via `z.infer`, and there are no hand-maintained type aliases that
 * could drift from the schema definitions.
 */

// Site spine
export { PageSchema, SITE_SCHEMA_VERSION, SiteSchema, parseSite } from "./site.js";
export type { Org, Page, Site, Theme } from "./site.js";

// Page slug rules (multi-page support)
export { SLUG_PATTERN, checkSlug, isValidSlug } from "./slug.js";
export type { SlugValidationFailure } from "./slug.js";

// Blocks
export {
  BlockEnvelopeSchema,
  CONTACT_CARD_BLOCK_VERSION,
  CTA_BANNER_BLOCK_VERSION,
  CUSTOM_HTML_BLOCK_VERSION,
  ContactCardBlockSchema,
  ContactCardDataSchema,
  CtaBannerAssetRefSchema,
  CtaBannerBlockSchema,
  CtaBannerDataSchema,
  CtaButtonSchema,
  CtaButtonStyleSchema,
  CustomHtmlBlockSchema,
  CustomHtmlDataSchema,
  EMBED_BLOCK_VERSION,
  EMBED_PROVIDERS,
  EMBED_URL_PATTERNS,
  EmbedBlockSchema,
  EmbedDataSchema,
  FAQ_BLOCK_VERSION,
  FaqBlockSchema,
  FaqDataSchema,
  FaqItemSchema,
  HERO_BLOCK_VERSION,
  HeroBlockSchema,
  HeroDataSchema,
  KnownBlockSchemas,
  QUOTE_BLOCK_VERSION,
  QuoteBlockSchema,
  QuoteDataSchema,
  RICH_TEXT_BLOCK_VERSION,
  RichTextBlockSchema,
  RichTextDataSchema,
  TEAM_GRID_BLOCK_VERSION,
  TeamGridBlockSchema,
  TeamGridDataSchema,
  VALUE_LIST_BLOCK_VERSION,
  VALUE_LIST_COLUMNS,
  VALUE_LIST_ICON_NAMES,
  VALUE_LIST_LAYOUTS,
  ValueListBlockSchema,
  ValueListDataSchema,
  ValueListItemSchema,
  isKnownBlockType,
  isValidEmbedUrl,
  ACTIVITIES_LIST_BLOCK_VERSION,
  ActivitiesListBlockSchema,
  ActivitiesListDataSchema,
  ActivitiesListLayoutSchema,
  ActivityImageRefSchema,
  ActivityItemSchema,
  ActivityLinkSchema,
} from "./blocks/index.js";
export type {
  BlockEnvelope,
  ContactCardBlock,
  ContactCardData,
  ContactCardMapEmbed,
  CtaBannerAssetRef,
  CtaBannerBlock,
  CtaBannerData,
  CtaButton,
  CtaButtonStyle,
  CustomHtmlBlock,
  CustomHtmlData,
  EmbedBlock,
  EmbedData,
  EmbedProvider,
  FaqBlock,
  FaqData,
  FaqItem,
  HeroBlock,
  HeroData,
  KnownBlockType,
  QuoteBlock,
  QuoteData,
  TeamGridBlock,
  TeamGridData,
  TeamGridPerson,
  TeamGridPersonPhoto,
  TeamGridSocialLink,
  ValueListBlock,
  ValueListColumns,
  ValueListData,
  ValueListIconName,
  ValueListItem,
  ValueListLayout,
  ActivitiesListBlock,
  ActivitiesListData,
  ActivitiesListLayout,
  ActivityImageRef,
  ActivityItem,
  ActivityLink,
  RichTextBlock,
  RichTextData,
} from "./blocks/index.js";

// Validation
export { validate, validateBlock } from "./validate.js";
export type { Severity, ValidationIssue, ValidationResult } from "./validate.js";

// Migration
export { BLOCK_MIGRATIONS, SITE_MIGRATIONS, migrateBlock, migrateSite } from "./migrate.js";
export type {
  BlockMigration,
  BlockMigrationResult,
  SiteMigration,
  SiteMigrationResult,
} from "./migrate.js";
