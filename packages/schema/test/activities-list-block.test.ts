import { describe, expect, test } from "vitest";
import { ActivitiesListBlockSchema, validateBlock } from "../src/index.js";

/**
 * Schema tests for the `activitiesList` block.
 *
 * The block carries:
 *  - `title` (required, non-empty)
 *  - `intro` (optional)
 *  - `layout` ("cards" | "list" | "alternating", required — three layouts per AC)
 *  - `items[]`, each with:
 *      - `title` (required, non-empty)
 *      - `description` (optional)
 *      - `image` (optional `AssetRef` shape — same shape as `@sosb/assets`)
 *      - `link` (optional `{ href, label? }`)
 *      - `badge` (optional non-empty string)
 *
 * The block is image-bearing: when `image` is present, `image.alt` must be
 * a non-empty string (mirrors the upload-time alt enforcement in #8 — there
 * we throw `AssetError("asset.alt.missing")`; here we surface the same rule
 * at the schema layer so loaded sites with stale data still fail validation
 * loudly).
 */
describe("activitiesList block schema", () => {
  const activitiesListWithHref = (href: string) => ({
    id: "blk_act_href",
    type: "activitiesList",
    version: 1,
    data: {
      title: "Activitățile noastre",
      layout: "cards",
      items: [{ title: "Conferință", link: { href } }],
    },
  });

  test("validates a minimal well-formed block (no items, cards layout)", () => {
    const block = {
      id: "blk_act_01",
      type: "activitiesList",
      version: 1,
      data: {
        title: "Activitățile noastre",
        layout: "cards",
        items: [],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(true);
  });

  test.each([
    ["javascript: URL", "javascript:void(0)"],
    ["data: URL", "data:text/plain,hello"],
    ["bare domain without scheme", "www.example.org"],
  ])("rejects activitiesList activity link with %s", (_caseName, href) => {
    expect(ActivitiesListBlockSchema.safeParse(activitiesListWithHref(href)).success).toBe(false);
  });

  test.each([
    ["https URL", "https://example.org"],
    ["site-relative path", "/contact"],
  ])("accepts activitiesList activity link with %s", (_caseName, href) => {
    expect(ActivitiesListBlockSchema.safeParse(activitiesListWithHref(href)).success).toBe(true);
  });

  test("validates a block in each of the three layouts", () => {
    for (const layout of ["cards", "list", "alternating"] as const) {
      const block = {
        id: `blk_act_${layout}`,
        type: "activitiesList",
        version: 1,
        data: {
          title: "Activitățile noastre",
          layout,
          items: [],
        },
      };
      const result = ActivitiesListBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    }
  });

  test("rejects an unknown layout literal", () => {
    const block = {
      id: "blk_act_02",
      type: "activitiesList",
      version: 1,
      data: {
        title: "x",
        layout: "carousel",
        items: [],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a block with empty title", () => {
    const block = {
      id: "blk_act_03",
      type: "activitiesList",
      version: 1,
      data: {
        title: "",
        layout: "cards",
        items: [],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a block with the wrong type literal", () => {
    const block = {
      id: "blk_act_04",
      type: "hero",
      version: 1,
      data: { title: "x", layout: "cards", items: [] },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validates an item with all optional fields populated", () => {
    const block = {
      id: "blk_act_05",
      type: "activitiesList",
      version: 1,
      data: {
        title: "Activitățile noastre",
        intro: "Lorem ipsum",
        layout: "list",
        items: [
          {
            title: "Conferința de toamnă",
            description: "Eveniment anual academic.",
            image: {
              hash: "8e3a7f9b1c0d2e4f",
              path: "assets/8e3a7f9b1c0d2e4f.jpg",
              metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
              mime: "image/jpeg",
              width: 2000,
              height: 1333,
              alt: "Conferință",
            },
            link: { href: "/conferinta", label: "Detalii" },
            badge: "Anual",
          },
        ],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects an item whose image has an empty alt", () => {
    const block = {
      id: "blk_act_06",
      type: "activitiesList",
      version: 1,
      data: {
        title: "x",
        layout: "cards",
        items: [
          {
            title: "Item",
            image: {
              hash: "8e3a7f9b1c0d2e4f",
              path: "assets/8e3a7f9b1c0d2e4f.jpg",
              metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
              mime: "image/jpeg",
              width: 100,
              height: 100,
              alt: "",
            },
          },
        ],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects an item with empty title", () => {
    const block = {
      id: "blk_act_07",
      type: "activitiesList",
      version: 1,
      data: {
        title: "x",
        layout: "cards",
        items: [{ title: "" }],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects an item link with empty href", () => {
    const block = {
      id: "blk_act_08",
      type: "activitiesList",
      version: 1,
      data: {
        title: "x",
        layout: "cards",
        items: [{ title: "Item", link: { href: "" } }],
      },
    };
    expect(ActivitiesListBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock returns severity-tiered issues for malformed blocks", () => {
    const block = {
      id: "blk_act_09",
      type: "activitiesList",
      version: 1,
      data: { title: "ok", layout: "carousel", items: [] },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock recognises a well-formed activitiesList as ok", () => {
    const block = {
      id: "blk_act_10",
      type: "activitiesList",
      version: 1,
      data: {
        title: "Activități",
        layout: "alternating",
        items: [{ title: "Conferință" }, { title: "Workshop", badge: "Lunar" }],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
  });

  test("preserves unknown extra fields on data (forward-compat)", () => {
    const block = {
      id: "blk_act_11",
      type: "activitiesList",
      version: 1,
      data: {
        title: "x",
        layout: "cards",
        items: [{ title: "Item", futureItemField: "preserved" }],
        futureField: "preserved-too",
      },
    };
    const parsed = ActivitiesListBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const roundTripped = JSON.parse(JSON.stringify(parsed.data));
      expect(roundTripped).toEqual(block);
    }
  });
});
