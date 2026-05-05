import { SITE_SCHEMA_VERSION } from "./site.js";
import { HERO_BLOCK_VERSION } from "./blocks/hero.js";

/**
 * One site-level migration. Bumps from `from` to `from + 1`. The function is
 * pure: it returns a new object rather than mutating the input.
 */
export interface SiteMigration {
  from: number;
  apply: (data: unknown) => unknown;
}

/**
 * One block-level migration, scoped to a specific block `type`. Bumps from
 * `from` to `from + 1`. Different block types migrate independently because
 * their `version` fields are independent.
 */
export interface BlockMigration {
  type: string;
  from: number;
  apply: (block: unknown) => unknown;
}

/**
 * The site migration table. Empty in v1 — `SITE_SCHEMA_VERSION` is 1 and
 * there are no prior versions to bridge from. Real entries land in #26.
 */
export const SITE_MIGRATIONS: readonly SiteMigration[] = [];

/**
 * The block migration table. Empty in v1 — every shipped block type is at
 * version 1 with no prior versions. Real entries land in #26.
 */
export const BLOCK_MIGRATIONS: readonly BlockMigration[] = [];

export interface SiteMigrationResult {
  data: unknown;
  appliedVersions: number[];
}

export interface BlockMigrationResult {
  block: unknown;
  appliedVersions: number[];
}

/**
 * Walk the site migration table from `data.schemaVersion` up to the current
 * `SITE_SCHEMA_VERSION`. Each migration bumps the version by exactly one.
 *
 * In v1 the table is empty, so this is the identity for any input whose
 * version equals the current version. Inputs whose version is *greater*
 * than the current version are rejected: they come from a future editor
 * this version cannot understand.
 */
export function migrateSite(data: unknown): SiteMigrationResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("migrateSite: input is not an object.");
  }
  const versioned = data as { schemaVersion?: unknown };
  const current = versioned.schemaVersion;
  if (typeof current !== "number" || !Number.isInteger(current)) {
    throw new Error(`migrateSite: expected integer schemaVersion, got ${String(current)}.`);
  }
  if (current > SITE_SCHEMA_VERSION) {
    throw new Error(
      `migrateSite: input schemaVersion ${current} is newer than this editor's ${SITE_SCHEMA_VERSION}.`,
    );
  }
  const applied: number[] = [];
  let working: unknown = data;
  let version = current;
  while (version < SITE_SCHEMA_VERSION) {
    const migration = SITE_MIGRATIONS.find((m) => m.from === version);
    if (!migration) {
      throw new Error(`migrateSite: no migration registered to bump from version ${version}.`);
    }
    working = migration.apply(working);
    version += 1;
    applied.push(version);
  }
  return { data: working, appliedVersions: applied };
}

/**
 * Block-version registry. The current `version` for each known block type.
 * Unknown block types are intentionally absent — they round-trip without
 * migration in v1.
 */
const KNOWN_BLOCK_VERSIONS: Record<string, number> = {
  hero: HERO_BLOCK_VERSION,
};

/**
 * Walk the block migration table for `block.type` from `block.version` up
 * to the current version of that type. Unknown block types short-circuit
 * to identity — that's the forward-compat contract.
 */
export function migrateBlock(block: unknown): BlockMigrationResult {
  if (typeof block !== "object" || block === null) {
    throw new Error("migrateBlock: input is not an object.");
  }
  const enveloped = block as { type?: unknown; version?: unknown };
  const blockType = enveloped.type;
  const blockVersion = enveloped.version;
  if (typeof blockType !== "string" || blockType.length === 0) {
    throw new Error("migrateBlock: missing or empty block type.");
  }
  if (typeof blockVersion !== "number" || !Number.isInteger(blockVersion)) {
    throw new Error(`migrateBlock: expected integer version on block of type "${blockType}".`);
  }
  const target = KNOWN_BLOCK_VERSIONS[blockType];
  if (target === undefined) {
    // Unknown block type — preserve as-is (forward compat).
    return { block, appliedVersions: [] };
  }
  if (blockVersion > target) {
    throw new Error(
      `migrateBlock: block "${blockType}" version ${blockVersion} is newer than this editor's ${target}.`,
    );
  }
  const applied: number[] = [];
  let working: unknown = block;
  let version = blockVersion;
  while (version < target) {
    const migration = BLOCK_MIGRATIONS.find((m) => m.type === blockType && m.from === version);
    if (!migration) {
      throw new Error(
        `migrateBlock: no migration registered to bump "${blockType}" from version ${version}.`,
      );
    }
    working = migration.apply(working);
    version += 1;
    applied.push(version);
  }
  return { block: working, appliedVersions: applied };
}
