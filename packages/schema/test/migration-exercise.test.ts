import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import historipolLegacy from "./fixtures/historipol-legacy.json" with { type: "json" };
import {
  HERO_BLOCK_VERSION,
  HeroBlockSchema,
  applyAllMigrations,
  migrateBlock,
  parseSite,
} from "../src/index.js";

/**
 * Synthetic v1→v2 hero migration exercise (issue #26).
 *
 * The migration framework is exercised end-to-end with one additive change:
 * hero gains an optional `align` field. Old hero blocks (`version: 1`,
 * no `align`) are bumped to `version: 2` with `align: "left"` as the
 * default; new hero blocks (`version: 2`, with explicit `align`) round-trip
 * unchanged; unknown future block types are preserved as-is.
 *
 * These tests pin the contract for future migrations to follow the same
 * pattern. CONTRIBUTING.md walks through them as the reference example.
 */
describe("hero v1 → v2 synthetic migration (issue #26)", () => {
  test("HERO_BLOCK_VERSION is bumped to 2", () => {
    expect(HERO_BLOCK_VERSION).toBe(2);
  });

  test('migrateBlock fills align="left" when missing on a v1 hero', () => {
    const old = {
      id: "blk_legacy_hero",
      type: "hero",
      version: 1,
      data: {
        title: "Legacy hero",
        subtitle: "Loaded from a v1 site",
      },
    };
    const result = migrateBlock(old);
    expect(result.appliedVersions).toEqual([2]);
    const migrated = result.block as {
      version: number;
      data: { align?: string; title?: string; subtitle?: string };
    };
    expect(migrated.version).toBe(2);
    expect(migrated.data.align).toBe("left");
    // Existing fields are preserved by the migration.
    expect(migrated.data.title).toBe("Legacy hero");
    expect(migrated.data.subtitle).toBe("Loaded from a v1 site");
  });

  test("migrateBlock does not overwrite an explicit align value", () => {
    // A v1 block could carry `align` as an unknown extra field thanks to
    // preserve-unknown-keys. The migration must not clobber it; it only
    // fills the default when the field is genuinely absent.
    const old = {
      id: "blk_aligned",
      type: "hero",
      version: 1,
      data: {
        title: "Already aligned",
        align: "center",
      },
    };
    const result = migrateBlock(old);
    expect(result.appliedVersions).toEqual([2]);
    const migrated = result.block as { data: { align: string } };
    expect(migrated.data.align).toBe("center");
  });

  test("a freshly migrated hero block validates against the v2 schema", () => {
    const old = {
      id: "blk_legacy_hero_2",
      type: "hero",
      version: 1,
      data: { title: "Old" },
    };
    const result = migrateBlock(old);
    const parse = HeroBlockSchema.safeParse(result.block);
    expect(parse.success).toBe(true);
  });

  test("a v2 hero block round-trips through migrateBlock unchanged", () => {
    const fresh = {
      id: "blk_new_hero",
      type: "hero",
      version: 2,
      data: {
        title: "New hero",
        subtitle: "Fresh data",
        align: "right",
      },
    };
    const result = migrateBlock(fresh);
    expect(result.appliedVersions).toEqual([]);
    expect(result.block).toEqual(fresh);
  });

  test("unknown block types still survive migrateBlock untouched (forward compat)", () => {
    const futureBlock = {
      id: "blk_future",
      type: "partnerLogos", // not registered in this editor
      version: 17,
      data: { logos: [{ src: "a.png" }] },
    };
    const result = migrateBlock(futureBlock);
    expect(result.appliedVersions).toEqual([]);
    expect(result.block).toEqual(futureBlock);
  });

  test("migrateBlock preserves unknown fields on the data object", () => {
    // Forward-compat: a v1 block that already carried an experimental
    // future field must keep that field after migration. The migration only
    // adds known fields; unknown keys ride through.
    const old = {
      id: "blk_legacy_with_extra",
      type: "hero",
      version: 1,
      data: {
        title: "Legacy",
        experimentalAlignment: "wedge", // unknown extra field
      },
    };
    const result = migrateBlock(old);
    const migrated = result.block as {
      data: { experimentalAlignment?: string; align?: string };
    };
    expect(migrated.data.experimentalAlignment).toBe("wedge");
    expect(migrated.data.align).toBe("left");
  });
});

describe("applyAllMigrations site-wide migration API (issue #26)", () => {
  test("legacy v1.0 fixture migrates to v1.1 with migrationApplied=true", () => {
    // The legacy fixture carries hero blocks at version 1 — so a migration
    // IS applied on load. That's the whole point of the exercise: an old
    // data file gets bumped to the current schema.
    //
    // The version string format is `<site>.<aggregate-block-minor>`,
    // where the minor is the sum of `version - 1` across known block
    // types. Legacy hero v1 → 0 → "1.0"; current hero v2 → 1 → "1.1".
    const result = applyAllMigrations(historipolLegacy);
    expect(result.fromVersion).toBe("1.0");
    expect(result.toVersion).toBe("1.1");
    expect(result.migrationApplied).toBe(true);
  });

  test("migrates every hero block on every page", () => {
    const result = applyAllMigrations(historipolLegacy);
    const data = result.data as {
      pages: { blocks: { type: string; version: number; data: { align?: string } }[] }[];
    };
    for (const page of data.pages) {
      for (const block of page.blocks) {
        if (block.type === "hero") {
          expect(block.version).toBe(2);
          expect(block.data.align).toBe("left");
        }
      }
    }
  });

  test("returns migrationApplied=false when the site already has v2 hero blocks", () => {
    const upToDate = structuredClone(historipol) as unknown as {
      pages: { blocks: { version: number; data: Record<string, unknown> }[] }[];
    };
    for (const page of upToDate.pages) {
      for (const block of page.blocks) {
        block.version = 2;
        block.data.align = "left";
      }
    }
    const result = applyAllMigrations(upToDate);
    expect(result.migrationApplied).toBe(false);
    expect(result.fromVersion).toBe("1.1");
    expect(result.toVersion).toBe("1.1");
  });

  test("migrated site validates and parses cleanly", () => {
    const result = applyAllMigrations(historipolLegacy);
    // After migration the data must satisfy the current schema.
    const site = parseSite(result.data);
    expect(site.pages.length).toBe(historipol.pages.length);
  });

  test("preserves unknown blocks byte-identical through site migration", () => {
    // Forward-compat: a future block type appears alongside a legacy hero.
    // After applyAllMigrations, the hero is bumped to v2 and the unknown
    // block survives untouched.
    const input = structuredClone(historipol) as unknown as {
      pages: { blocks: unknown[] }[];
    };
    const futureBlock = {
      id: "blk_future_widget",
      type: "futureWidget",
      version: 9,
      data: { payload: "must survive", nested: { a: [1, 2, 3] } },
    };
    input.pages[0]!.blocks.push(futureBlock);

    const result = applyAllMigrations(input);
    const data = result.data as {
      pages: { blocks: { id: string; type: string; version: number; data: unknown }[] }[];
    };
    const survived = data.pages[0]!.blocks.find((b) => b.id === "blk_future_widget");
    expect(survived).toEqual(futureBlock);
  });

  test("preserves unknown top-level and per-block fields after migration", () => {
    const input = structuredClone(historipol) as unknown as {
      futureField?: unknown;
      pages: { blocks: { data: Record<string, unknown> }[] }[];
    };
    input.futureField = { kind: "experimental", value: 42 };
    input.pages[0]!.blocks[0]!.data.experimentalKey = "preserved";

    const result = applyAllMigrations(input);
    const data = result.data as {
      futureField: unknown;
      pages: { blocks: { data: Record<string, unknown> }[] }[];
    };
    expect(data.futureField).toEqual({ kind: "experimental", value: 42 });
    expect(data.pages[0]!.blocks[0]!.data.experimentalKey).toBe("preserved");
  });

  test("rejects future schemaVersion the editor cannot understand", () => {
    const futureSite = {
      ...structuredClone(historipol),
      schemaVersion: 999,
    };
    expect(() => applyAllMigrations(futureSite)).toThrowError();
  });

  test("returns a stable shape: { data, migrationApplied, fromVersion, toVersion }", () => {
    const result = applyAllMigrations(historipolLegacy);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("migrationApplied");
    expect(result).toHaveProperty("fromVersion");
    expect(result).toHaveProperty("toVersion");
    expect(typeof result.migrationApplied).toBe("boolean");
    expect(typeof result.fromVersion).toBe("string");
    expect(typeof result.toVersion).toBe("string");
  });
});
