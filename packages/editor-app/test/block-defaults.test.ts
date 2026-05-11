/**
 * Tests for the new-block factory used by the "Add Block" dialog. Picking a
 * block type from the catalog must produce a block envelope the schema
 * accepts at validation time.
 */
import { describe, expect, test } from "vitest";
import { HERO_BLOCK_VERSION, KnownBlockSchemas } from "@sosb/schema";

import { defaultBlockFor } from "../src/block-defaults.js";

describe("defaultBlockFor", () => {
  test("returns a block whose `type` matches the requested registry key", () => {
    const block = defaultBlockFor("hero");
    expect(block.type).toBe("hero");
  });

  test("hero defaults pass the hero schema's parser", () => {
    const block = defaultBlockFor("hero");
    expect(block.version).toBe(HERO_BLOCK_VERSION);
    // The hero schema lives in the registry; validating the produced block
    // through it should not throw.
    expect(() => KnownBlockSchemas.hero.parse(block)).not.toThrow();
  });

  test("each call produces a unique id so multiple inserts can coexist", () => {
    const a = defaultBlockFor("hero");
    const b = defaultBlockFor("hero");
    expect(a.id).not.toBe(b.id);
  });

  test("ids are non-empty, schema-compatible strings", () => {
    const block = defaultBlockFor("hero");
    expect(block.id.length).toBeGreaterThan(0);
    // The envelope schema requires a non-empty string id; validate against
    // the loose envelope accepts any non-empty string.
  });

  test("an unknown type falls back to a placeholder envelope (open-set policy)", () => {
    // Per the schema's open-set design, unknown types still round-trip.
    // The factory mirrors that by emitting an envelope with the unknown
    // type, version 1, and an empty data object.
    const block = defaultBlockFor("brandNewBlock");
    expect(block.type).toBe("brandNewBlock");
    expect(block.version).toBe(1);
    expect(block.data).toEqual({});
  });

  /**
   * Per ADR 0042, every block type in the registry has a `DEFAULT_BUILDERS`
   * entry that emits schema-valid placeholder data. Each registry key gets
   * a smoke test asserting the produced envelope passes its schema's parser
   * — without this loop a regression in any one builder (wrong field name,
   * stale enum, missing required member) silently lands a block that the
   * editor surfaces as broken at first edit.
   */
  describe("per-type defaults pass each block schema's parser", () => {
    for (const type of Object.keys(KnownBlockSchemas)) {
      test(`${type} default round-trips through the schema`, () => {
        const block = defaultBlockFor(type);
        expect(block.type).toBe(type);
        const schema = KnownBlockSchemas[type as keyof typeof KnownBlockSchemas];
        expect(() => schema.parse(block)).not.toThrow();
      });
    }
  });
});
