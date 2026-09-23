import { SITE_SCHEMA_VERSION } from "./site.js";
import { HERO_BLOCK_VERSION } from "./blocks/hero.js";
import { EMBED_BLOCK_VERSION } from "./blocks/embed.js";
import { CTA_BANNER_BLOCK_VERSION } from "./blocks/cta-banner.js";
import { PARTNER_LOGOS_BLOCK_VERSION } from "./blocks/partner-logos.js";
import { IMAGE_GALLERY_BLOCK_VERSION } from "./blocks/image-gallery.js";
import { EVENT_LIST_BLOCK_VERSION } from "./blocks/event-list.js";
import { RICH_TEXT_BLOCK_VERSION } from "./blocks/rich-text.js";
import { markdownToRichTextDoc } from "@sosb/markdown";

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
 * The block migration table.
 *
 * Entries are keyed by `(type, from)` and each bumps exactly one version.
 * They run on load, inside `migrateSite`, so nothing downstream of an import
 * ever sees a stale Block shape.
 */
export const BLOCK_MIGRATIONS: readonly BlockMigration[] = [
  {
    // richText v1 → v2: the Markdown string becomes a structured Rich-text
    // document (ADR 0048, issue #100).
    //
    // The conversion is meaning-preserving by construction:
    // `markdownToRichTextDoc` mirrors `@sosb/markdown`'s block and inline
    // grammar rule for rule, and `@sosb/renderer`'s document serialiser
    // reproduces the legacy HTML byte for byte — asserted over every
    // Markdown fixture in the repo and the whole XSS corpus. Markdown
    // outside ADR 0034's whitelist stays literal text, exactly as it
    // rendered before.
    //
    // `titleAlign`, `paragraphAlign` and any unknown sibling keys carry
    // across untouched: ADR 0002's preserve-unknown contract does not pause
    // for a migration. Only `markdown` is consumed.
    type: "richText",
    from: 1,
    apply: (block: unknown): unknown => {
      if (typeof block !== "object" || block === null) return block;
      const source = block as { data?: unknown };
      const data =
        typeof source.data === "object" && source.data !== null
          ? (source.data as Record<string, unknown>)
          : {};
      const rest: Record<string, unknown> = { ...data };
      const markdown = rest["markdown"];
      delete rest["markdown"];
      return {
        ...(block as Record<string, unknown>),
        version: 2,
        data: { ...rest, doc: markdownToRichTextDoc(markdown) },
      };
    },
  },
];

export interface SiteMigrationResult {
  data: unknown;
  appliedVersions: number[];
  /**
   * One entry per Block that `migrateSite` actually bumped, in document
   * order. The editor surfaces a "this project was converted" notice from
   * this; tests assert on it directly.
   */
  blockMigrations: AppliedBlockMigration[];
}

export interface AppliedBlockMigration {
  /** Path from the site root, e.g. `["pages", 0, "blocks", 2]`. */
  path: (string | number)[];
  type: string;
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

  // Block migrations run after the site-level ladder, because a site
  // migration may add or move Block containers and the block pass should see
  // the final layout. Every Block in the project is visited — Pages and
  // Articles (issue #97) — which is why the container list is data-driven
  // rather than a hard-coded `pages` walk.
  const blockMigrations: AppliedBlockMigration[] = [];
  working = migrateAllBlocks(working, blockMigrations);

  return { data: working, appliedVersions: applied, blockMigrations };
}

/**
 * Whether the load-time pass should hand a Block to `migrateBlock` at all.
 *
 * Two kinds of Block are deliberately left untouched rather than rejected:
 *
 * - **Structurally broken** ones (no type, no integer version). Rejecting
 *   them here would turn a reportable validation error into an unopenable
 *   project, the opposite of what the migration is for.
 * - **Newer than this editor** ones, and ones with no registered path up to
 *   the current version. ADR 0002's forward-compatibility contract is that
 *   content from a newer editor survives a read-write-read cycle
 *   byte-identically, and ADR 0048 adds that it is shown read-only and never
 *   simplified. `migrateBlock` itself throws in both cases — that is the
 *   right answer for a caller asking to bump one Block — but at load time
 *   the project must still open (the autosave restore would otherwise
 *   discard the draft), with the mismatch reported by validation as an
 *   ordinary schema error on that Block.
 */
function isMigratableBlock(block: unknown): boolean {
  if (typeof block !== "object" || block === null) return false;
  const enveloped = block as { type?: unknown; version?: unknown };
  const { type, version } = enveloped;
  if (typeof type !== "string" || type.length === 0) return false;
  if (typeof version !== "number" || !Number.isInteger(version)) return false;
  const target = KNOWN_BLOCK_VERSIONS[type];
  if (target === undefined) return true;
  if (version > target) return false;
  for (let from = version; from < target; from += 1) {
    if (!BLOCK_MIGRATIONS.some((m) => m.type === type && m.from === from)) return false;
  }
  return true;
}

/** Containers on the Site whose members each carry a `blocks` array. */
const BLOCK_CONTAINER_KEYS = ["pages", "articles"] as const;

function migrateAllBlocks(data: unknown, log: AppliedBlockMigration[]): unknown {
  if (typeof data !== "object" || data === null) return data;
  const site = data as Record<string, unknown>;
  let next: Record<string, unknown> | undefined;

  for (const key of BLOCK_CONTAINER_KEYS) {
    const container = site[key];
    if (!Array.isArray(container)) continue;

    let containerChanged = false;
    const migratedContainer = container.map((entry, entryIndex) => {
      if (typeof entry !== "object" || entry === null) return entry;
      const owner = entry as Record<string, unknown>;
      const blocks = owner["blocks"];
      if (!Array.isArray(blocks)) return entry;

      let blocksChanged = false;
      const migratedBlocks = blocks.map((block, blockIndex) => {
        if (!isMigratableBlock(block)) return block;
        const result = migrateBlock(block);
        if (result.appliedVersions.length === 0) return block;
        blocksChanged = true;
        log.push({
          path: [key, entryIndex, "blocks", blockIndex],
          type: String((block as { type?: unknown }).type),
          appliedVersions: result.appliedVersions,
        });
        return result.block;
      });

      if (!blocksChanged) return entry;
      containerChanged = true;
      return { ...owner, blocks: migratedBlocks };
    });

    if (!containerChanged) continue;
    next ??= { ...site };
    next[key] = migratedContainer;
  }

  return next ?? data;
}

/**
 * Block-version registry. The current `version` for each known block type.
 * Unknown block types are intentionally absent — they round-trip without
 * migration in v1.
 */
const KNOWN_BLOCK_VERSIONS: Record<string, number> = {
  hero: HERO_BLOCK_VERSION,
  embed: EMBED_BLOCK_VERSION,
  ctaBanner: CTA_BANNER_BLOCK_VERSION,
  partnerLogos: PARTNER_LOGOS_BLOCK_VERSION,
  imageGallery: IMAGE_GALLERY_BLOCK_VERSION,
  eventList: EVENT_LIST_BLOCK_VERSION,
  richText: RICH_TEXT_BLOCK_VERSION,
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
