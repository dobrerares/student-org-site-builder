import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { SITE_SCHEMA_VERSION, migrateBlock, migrateSite } from "../src/index.js";

describe("migration framework scaffold", () => {
  test("migrateSite is a no-op in v1 (no version gaps to bridge)", () => {
    const result = migrateSite(historipol);
    // No migrations have been registered for v1, so nothing was applied.
    expect(result.appliedVersions).toEqual([]);
    // The data is unchanged.
    expect(result.data).toEqual(historipol);
  });

  test("migrateSite refuses to migrate unknown future versions", () => {
    const future = {
      ...structuredClone(historipol),
      schemaVersion: SITE_SCHEMA_VERSION + 1,
    };
    expect(() => migrateSite(future)).toThrowError();
  });

  test("migrateBlock is a no-op for a hero already at the current version", () => {
    const block = {
      id: "blk_01",
      type: "hero",
      version: 2,
      data: { title: "T", subtitle: "S", align: "left" as const },
    };
    const result = migrateBlock(block);
    expect(result.appliedVersions).toEqual([]);
    expect(result.block).toEqual(block);
  });

  test("migrateBlock leaves unknown block types untouched (forward compat)", () => {
    const block = {
      id: "blk_unknown",
      type: "futureBlockType",
      version: 99,
      data: { x: 1 },
    };
    // Unknown block types must round-trip; migrateBlock does not throw on
    // them — that's the forward-compat contract.
    const result = migrateBlock(block);
    expect(result.appliedVersions).toEqual([]);
    expect(result.block).toEqual(block);
  });
});
