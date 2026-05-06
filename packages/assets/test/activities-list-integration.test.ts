/**
 * Integration test: the AssetRef returned by `uploadAsset` plugs directly
 * into the `activitiesList` block schema.
 *
 * The AC for issue #11 ("Image upload from editor stores asset and
 * references it correctly") spans two packages: `@sosb/assets` produces
 * the asset and the `AssetRef`, `@sosb/schema` validates the resulting
 * block. This test runs both ends together against a real `MemoryDriver`
 * VFS and the test-only `SharpImageProcessor`.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { MemoryDriver } from "@sosb/vfs";
import { ActivitiesListBlockSchema, validateBlock } from "@sosb/schema";

import { uploadAsset } from "../src/pipeline.js";
import { createSharpProcessor, makePngWithAlpha } from "./sharp-processor.js";

let processor: Awaited<ReturnType<typeof createSharpProcessor>>;

beforeAll(async () => {
  processor = await createSharpProcessor();
});

afterAll(() => {
  // No teardown needed.
});

describe("activitiesList × asset pipeline integration", () => {
  test("an uploaded image AssetRef plugs into an activitiesList item and the block is schema-valid", async () => {
    const vfs = new MemoryDriver();
    const fixture = await makePngWithAlpha(800, 600);
    const ref = await uploadAsset(
      { kind: "bytes", bytes: fixture.bytes, name: "team.png", alt: "The 2026 board" },
      vfs,
      { processor },
    );

    const block = {
      id: "blk_act_int_01",
      type: "activitiesList" as const,
      version: 1 as const,
      data: {
        title: "Activitățile noastre",
        layout: "cards" as const,
        items: [
          {
            title: "Conferința de toamnă",
            description: "Eveniment anual",
            image: ref,
            badge: "Anual",
          },
        ],
      },
    };

    const parsed = ActivitiesListBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);

    const validation = validateBlock(block);
    expect(validation.ok).toBe(true);

    // The block stores the VFS-relative path produced by the upload.
    expect(block.data.items[0]!.image.path.startsWith("assets/")).toBe(true);
    // The alt is preserved through the boundary.
    expect(block.data.items[0]!.image.alt).toBe("The 2026 board");
  }, 60_000);

  test("alt enforcement at the upload entrypoint matches the schema-layer rule", async () => {
    const vfs = new MemoryDriver();
    const fixture = await makePngWithAlpha(400, 300);
    // uploadAsset rejects empty alt.
    await expect(
      uploadAsset({ kind: "bytes", bytes: fixture.bytes, name: "team.png", alt: "" }, vfs, {
        processor,
      }),
    ).rejects.toMatchObject({ code: "asset.alt.missing" });

    // And the schema rejects an empty alt on the AssetRef shape too — the
    // two enforcements coexist by design (see ADR-0004).
    const block = {
      id: "blk_act_int_02",
      type: "activitiesList" as const,
      version: 1 as const,
      data: {
        title: "x",
        layout: "cards" as const,
        items: [
          {
            title: "Item",
            image: {
              hash: "deadbeefdeadbeef",
              path: "assets/deadbeefdeadbeef.png",
              metadataPath: "assets/deadbeefdeadbeef.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              alt: "",
            },
          },
        ],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  }, 60_000);
});
