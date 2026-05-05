import { describe, expect, test } from "vitest";
import { ActivitiesListBlockSchema, validateBlock } from "@sosb/schema";

import { fieldsFromSchema, type FieldNode } from "../src/form-generator.js";

/**
 * Editor-form coverage for the activitiesList block.
 *
 * Per the issue triage decision (issue #11), block forms are
 * auto-generated from per-block schemas — adding a new block type is
 * "schema + render component + default data + editor metadata", with the
 * editor form derived. This test exercises that contract for
 * `activitiesList`:
 *
 *  1. The same schema-introspection helper that drives the spine form
 *     (#7) works on the activitiesList data schema unchanged.
 *  2. Field nodes are produced for `title`, `intro`, `layout`, and the
 *     `items[]` array (with item element fields including the nested
 *     `image`, `link`, `badge`).
 *  3. The image field (an `AssetRef` shape) shows up as a nested object
 *     with leaf string/number children — so the editor can render the
 *     asset upload control on the surface where the AssetRef metadata is
 *     captured.
 *  4. Round-tripping an AssetRef-shaped object through the schema
 *     produces a valid activitiesList block (the integration boundary
 *     between `@sosb/assets`'s `uploadAsset` return value and the block
 *     schema).
 */

function findField(fields: FieldNode[], name: string): FieldNode | undefined {
  return fields.find((f) => f.name === name);
}

describe("editor form-generator — activitiesList data schema", () => {
  test("walks the activitiesList block data schema and surfaces top-level fields", () => {
    const fields = fieldsFromSchema(ActivitiesListBlockSchema);
    // The block envelope is { id, type, version, data }; we expect to see
    // them all, with `data` being a nested object.
    expect(findField(fields, "id")?.kind).toBe("string");
    expect(findField(fields, "data")?.kind).toBe("object");
  });

  test("the data sub-tree exposes title, intro, layout, items leaves", () => {
    const fields = fieldsFromSchema(ActivitiesListBlockSchema);
    const data = findField(fields, "data");
    expect(data?.kind).toBe("object");
    if (data?.kind !== "object") return;

    const title = findField(data.fields, "title");
    expect(title?.kind).toBe("string");
    expect(title?.optional).toBe(false);

    const intro = findField(data.fields, "intro");
    expect(intro?.kind).toBe("string");
    expect(intro?.optional).toBe(true);

    const layout = findField(data.fields, "layout");
    expect(layout?.kind).toBe("enum");
    if (layout?.kind === "enum") {
      expect(layout.options.slice().sort()).toEqual(
        ["alternating", "cards", "list"].slice().sort(),
      );
    }

    const items = findField(data.fields, "items");
    expect(items?.kind).toBe("array");
  });

  test("an items[] element exposes title, image (object), link (object), badge", () => {
    const fields = fieldsFromSchema(ActivitiesListBlockSchema);
    const data = findField(fields, "data");
    if (data?.kind !== "object") throw new Error("data field missing");
    const items = findField(data.fields, "items");
    if (items?.kind !== "array") throw new Error("items field missing");
    const elem = items.element;
    expect(elem.kind).toBe("object");
    if (elem.kind !== "object") return;

    expect(findField(elem.fields, "title")?.kind).toBe("string");
    expect(findField(elem.fields, "description")?.optional).toBe(true);
    expect(findField(elem.fields, "image")?.kind).toBe("object");
    expect(findField(elem.fields, "link")?.kind).toBe("object");
    expect(findField(elem.fields, "badge")?.kind).toBe("string");
  });

  test("the image field exposes the AssetRef sub-fields the editor will bind to the upload pipeline", () => {
    const fields = fieldsFromSchema(ActivitiesListBlockSchema);
    const data = findField(fields, "data");
    if (data?.kind !== "object") throw new Error();
    const items = findField(data.fields, "items");
    if (items?.kind !== "array" || items.element.kind !== "object") throw new Error();
    const image = findField(items.element.fields, "image");
    if (image?.kind !== "object") throw new Error();

    // Every AssetRef field must be discoverable so the editor can write
    // the uploadAsset() return value back into the form state.
    expect(findField(image.fields, "hash")?.kind).toBe("string");
    expect(findField(image.fields, "path")?.kind).toBe("string");
    expect(findField(image.fields, "metadataPath")?.kind).toBe("string");
    expect(findField(image.fields, "mime")?.kind).toBe("string");
    expect(findField(image.fields, "width")?.kind).toBe("number");
    expect(findField(image.fields, "height")?.kind).toBe("number");
    expect(findField(image.fields, "alt")?.kind).toBe("string");
  });
});

describe("editor form-generator — uploadAsset return-value boundary", () => {
  test("an AssetRef-shaped value (the uploadAsset return value) plugs into the items[].image field and the block schema validates", () => {
    // This is the exact shape `@sosb/assets`'s `uploadAsset` resolves to
    // for a JPEG upload. Writing it into an activitiesList item must
    // produce a schema-valid block — the integration boundary the AC
    // calls "image upload from editor stores asset and references it
    // correctly".
    const assetRef = {
      hash: "deadbeefdeadbeef",
      path: "assets/deadbeefdeadbeef.jpg",
      metadataPath: "assets/deadbeefdeadbeef.metadata.json",
      mime: "image/jpeg" as const,
      width: 2000,
      height: 1333,
      alt: "Team photo",
    };
    const block = {
      id: "blk_act_form_01",
      type: "activitiesList" as const,
      version: 1 as const,
      data: {
        title: "Activitățile noastre",
        layout: "cards" as const,
        items: [{ title: "Conferință", image: assetRef }],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
  });

  test("an AssetRef with empty alt is rejected at the block-schema layer (mirrors uploadAsset's alt enforcement)", () => {
    const block = {
      id: "blk_act_form_02",
      type: "activitiesList" as const,
      version: 1 as const,
      data: {
        title: "Activitățile noastre",
        layout: "cards" as const,
        items: [
          {
            title: "Conferință",
            image: {
              hash: "deadbeefdeadbeef",
              path: "assets/deadbeefdeadbeef.jpg",
              metadataPath: "assets/deadbeefdeadbeef.metadata.json",
              mime: "image/jpeg",
              width: 2000,
              height: 1333,
              alt: "",
            },
          },
        ],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
  });
});
