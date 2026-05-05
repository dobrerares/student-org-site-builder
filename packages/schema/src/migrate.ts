import { SITE_SCHEMA_VERSION } from "./site.js";
import { HERO_ALIGN_DEFAULT, HERO_BLOCK_VERSION } from "./blocks/hero.js";

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
 * there are no prior site-level versions to bridge from. Block-level
 * migrations live in `BLOCK_MIGRATIONS` below; the additive-only v1.x
 * promise from the PRD is honoured at the block-version level, not at the
 * site-version level.
 */
export const SITE_MIGRATIONS: readonly SiteMigration[] = [];

/**
 * The block migration table. One entry per `(type, from)` pair. The
 * migration framework walks this table in order, bumping each block's
 * version by exactly one on each step.
 *
 * # Adding a migration
 *
 * 1. Bump `<BLOCK>_BLOCK_VERSION` in `blocks/<block>.ts`.
 * 2. Update the block's `Schema` and `DataSchema` definitions to the new
 *    shape. Use `z.looseObject(...)` so unknown keys still round-trip.
 * 3. Append a `{ type, from, apply }` entry here that bumps `from` to
 *    `from + 1`. The `apply` function is pure: it returns a new object
 *    rather than mutating its input. Existing fields must be preserved
 *    verbatim; only the new fields are filled in with defaults.
 * 4. Update fixtures and tests for the new shape; add a regression test
 *    that loads a pre-migration block and asserts the new field gets the
 *    correct default.
 *
 * The first such migration (issue #26) is the synthetic hero v1 → v2
 * exercise below: it adds an optional `align` field that defaults to
 * `"left"`. The pattern is documented in `CONTRIBUTING.md`.
 */
export const BLOCK_MIGRATIONS: readonly BlockMigration[] = [
  {
    type: "hero",
    from: 1,
    apply: (block) => {
      // Defensive: the framework already validates the envelope before
      // dispatching, but we re-check `data` so the migration is safe to
      // call in isolation (e.g. from a unit test).
      if (typeof block !== "object" || block === null) {
        throw new Error("hero v1→v2 migration: input is not an object.");
      }
      const enveloped = block as { data?: unknown; [k: string]: unknown };
      const data =
        typeof enveloped.data === "object" && enveloped.data !== null
          ? (enveloped.data as Record<string, unknown>)
          : {};
      // Additive change: fill `align` with the default only when absent.
      // Pre-existing values (including unknown future values that survived
      // through preserve-unknown-keys) are kept verbatim.
      const newData: Record<string, unknown> = { ...data };
      if (!Object.prototype.hasOwnProperty.call(newData, "align")) {
        newData.align = HERO_ALIGN_DEFAULT;
      }
      return {
        ...enveloped,
        version: 2,
        data: newData,
      };
    },
  },
];

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
export const KNOWN_BLOCK_VERSIONS: Record<string, number> = {
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

/**
 * Combined migration result returned by {@link applyAllMigrations}.
 *
 * - `data` — the migrated site data, ready to feed into `validate()` /
 *   `parseSite()`. Always a fresh object; the input is never mutated.
 * - `migrationApplied` — `true` when at least one site-level or
 *   block-level migration ran. Editors should surface a "Site upgraded"
 *   banner toast when this is `true` (#26 AC; the toast UI itself is
 *   owned by the editor in #7).
 * - `fromVersion` / `toVersion` — human-readable schema versions in
 *   `"<site>.<aggregate-block-rev>"` form. `<aggregate-block-rev>` is the
 *   sum of `KNOWN_BLOCK_VERSIONS` minus the count of block types, so a
 *   single block type at v2 reads as `"1.1"`-no-bump-applied or `"1.2"`
 *   when the migration has run. The form is intentionally simple — see
 *   ADR-0003 for the rationale and how it scales as more block types
 *   bump their versions.
 */
export interface SiteMigrationApplyResult {
  data: unknown;
  migrationApplied: boolean;
  fromVersion: string;
  toVersion: string;
}

/**
 * The aggregate "minor" version is the sum across known block types of
 * (current version – 1). With one known block (hero) at v2 that is `1`, so
 * the current schema reads as `"1.1"`. When hero bumps to v3 (or another
 * block type bumps), this number grows. ADR-0003 documents the choice.
 */
function aggregateBlockMinor(versions: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(versions)) {
    total += v - 1;
  }
  return total;
}

function formatSchemaVersion(siteVersion: number, blockMinor: number): string {
  return `${siteVersion}.${blockMinor}`;
}

/**
 * Compute the `(site, aggregate-block-minor)` pair from the data on disk
 * — that is, the version the data is currently at, before any migration.
 */
function fromVersionFor(data: { schemaVersion: number; pages: { blocks: unknown[] }[] }): {
  site: number;
  minor: number;
} {
  const versions: Record<string, number> = {};
  for (const page of data.pages) {
    for (const block of page.blocks) {
      if (typeof block !== "object" || block === null) continue;
      const enveloped = block as { type?: unknown; version?: unknown };
      const t = enveloped.type;
      const v = enveloped.version;
      if (
        typeof t !== "string" ||
        typeof v !== "number" ||
        !Number.isInteger(v) ||
        !Object.prototype.hasOwnProperty.call(KNOWN_BLOCK_VERSIONS, t)
      ) {
        // Unknown / malformed blocks don't contribute to the aggregate.
        continue;
      }
      // Track the minimum version observed across all blocks of this type.
      // This represents the "oldest" data point on disk.
      if (versions[t] === undefined || v < versions[t]) {
        versions[t] = v;
      }
    }
  }
  // For block types not present at all, fall back to the current version
  // (no contribution to the minor) so a site without hero blocks still
  // reads as the current `1.<minor>`.
  for (const [type, current] of Object.entries(KNOWN_BLOCK_VERSIONS)) {
    if (versions[type] === undefined) {
      versions[type] = current;
    }
  }
  return { site: data.schemaVersion, minor: aggregateBlockMinor(versions) };
}

/**
 * Apply all relevant migrations — site-level and per-block — to a parsed
 * site object. The shape of the result is stable so callers can wire a
 * "Site upgraded to schema v…" banner toast without conditional logic.
 *
 * # AC mapping (issue #26)
 *
 * - Migrations run on load and old data gets correct defaults.
 * - Unknown block types pass through untouched (forward compat).
 * - Round-trip preserves unknown fields and unknown blocks (the
 *   underlying schemas use `z.looseObject`; this function does not strip
 *   keys).
 * - `migrationApplied` is the boolean that the editor (#7) reads to
 *   decide whether to show the banner toast. The toast UI itself is
 *   owned by the editor; this package exposes the API only.
 */
export function applyAllMigrations(input: unknown): SiteMigrationApplyResult {
  if (typeof input !== "object" || input === null) {
    throw new Error("applyAllMigrations: input is not an object.");
  }

  // Step 1: migrate the site spine. Today this is the identity in v1; the
  // call is preserved so #7's editor wiring survives a future site-level
  // bump without code changes.
  const siteResult = migrateSite(input);
  const siteData = siteResult.data as {
    schemaVersion: number;
    pages: { blocks: unknown[] }[];
  };

  // Snapshot the "from" version before block migrations run.
  const from = fromVersionFor(siteData);

  // Step 2: migrate each block. Walk pages in order; each block runs
  // through `migrateBlock`, which short-circuits to identity for unknown
  // types (forward compat) and bumps known types to their current version.
  let blockMigrationsApplied = 0;
  const newPages = siteData.pages.map((page) => {
    const newBlocks = page.blocks.map((block) => {
      const result = migrateBlock(block);
      blockMigrationsApplied += result.appliedVersions.length;
      return result.block;
    });
    return { ...page, blocks: newBlocks };
  });

  const migratedData = { ...siteData, pages: newPages };
  const to = {
    site: SITE_SCHEMA_VERSION,
    minor: aggregateBlockMinor(KNOWN_BLOCK_VERSIONS),
  };

  const migrationApplied = siteResult.appliedVersions.length > 0 || blockMigrationsApplied > 0;

  return {
    data: migratedData,
    migrationApplied,
    fromVersion: formatSchemaVersion(from.site, from.minor),
    toVersion: formatSchemaVersion(to.site, to.minor),
  };
}
