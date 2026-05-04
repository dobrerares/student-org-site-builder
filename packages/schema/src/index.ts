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

// Blocks
export {
  BlockEnvelopeSchema,
  HERO_ALIGN_DEFAULT,
  HERO_ALIGN_VALUES,
  HERO_BLOCK_VERSION,
  HeroBlockSchema,
  HeroDataSchema,
  KnownBlockSchemas,
  isKnownBlockType,
} from "./blocks/index.js";
export type {
  BlockEnvelope,
  HeroAlign,
  HeroBlock,
  HeroData,
  KnownBlockType,
} from "./blocks/index.js";

// Validation
export { validate, validateBlock } from "./validate.js";
export type { Severity, ValidationIssue, ValidationResult } from "./validate.js";

// Migration
export {
  BLOCK_MIGRATIONS,
  KNOWN_BLOCK_VERSIONS,
  SITE_MIGRATIONS,
  applyAllMigrations,
  migrateBlock,
  migrateSite,
} from "./migrate.js";
export type {
  BlockMigration,
  BlockMigrationResult,
  SiteMigration,
  SiteMigrationApplyResult,
  SiteMigrationResult,
} from "./migrate.js";
