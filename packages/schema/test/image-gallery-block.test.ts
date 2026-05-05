import { describe, expect, test } from "vitest";
import { ImageGalleryBlockSchema, validateBlock } from "../src/index.js";

/**
 * imageGallery block schema (issue #14).
 *
 * Acceptance shape:
 *  - optional title
 *  - layout: "grid" | "masonry"
 *  - columns: integer >= 1, <= 6 (sensible bounds; the editor
 *    surfaces these as a select)
 *  - lightbox: boolean (whether click-to-enlarge is enabled)
 *  - images: array of `{ asset: AssetRef, caption?, alt }` with alt mandatory
 *
 * The schema is `looseObject`-style across the envelope and the data so
 * unknown future fields round-trip (the v1 forward-compatibility contract,
 * shared with the hero block).
 */
describe("imageGallery block schema", () => {
  const wellFormedAsset = {
    hash: "8e3a7f9b1c0d2e4f",
    path: "assets/8e3a7f9b1c0d2e4f.jpg",
    metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
    mime: "image/jpeg" as const,
    width: 1600,
    height: 1067,
    alt: "A photograph of students in a conference room.",
  };

  test("validates a well-formed grid imageGallery", () => {
    const block = {
      id: "blk_gallery_1",
      type: "imageGallery",
      version: 1,
      data: {
        title: "Galerie evenimente",
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [
          {
            asset: wellFormedAsset,
            caption: "Conferința de toamnă",
            alt: "Studenți în sala de conferințe",
          },
          {
            asset: wellFormedAsset,
            alt: "A photograph of students.",
          },
        ],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a masonry imageGallery without a title", () => {
    const block = {
      id: "blk_gallery_2",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "masonry",
        columns: 2,
        lightbox: false,
        images: [
          {
            asset: wellFormedAsset,
            alt: "A photograph.",
          },
        ],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects galleries whose layout is neither grid nor masonry", () => {
    const block = {
      id: "blk_gallery_3",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "carousel",
        columns: 3,
        lightbox: true,
        images: [{ asset: wellFormedAsset, alt: "ok" }],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects galleries with non-positive column counts", () => {
    const block = {
      id: "blk_gallery_4",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 0,
        lightbox: true,
        images: [{ asset: wellFormedAsset, alt: "ok" }],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects galleries with column counts greater than the cap", () => {
    const block = {
      id: "blk_gallery_5",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 7,
        lightbox: true,
        images: [{ asset: wellFormedAsset, alt: "ok" }],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects galleries where an image is missing alt text", () => {
    const block = {
      id: "blk_gallery_6",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [
          {
            asset: wellFormedAsset,
            // alt intentionally missing — must fail (AC: editor enforces alt
            // text on every image)
          },
        ],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects galleries where an image has empty alt text", () => {
    const block = {
      id: "blk_gallery_7",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [
          {
            asset: wellFormedAsset,
            alt: "",
          },
        ],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects galleries where an image's asset is missing required fields", () => {
    const block = {
      id: "blk_gallery_8",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [
          {
            // no asset.path / no hash → AssetRef-like object is malformed
            asset: { mime: "image/jpeg", width: 100, height: 100, alt: "x" },
            alt: "ok",
          },
        ],
      },
    };
    expect(ImageGalleryBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock surfaces severity-tiered issues for malformed galleries", () => {
    const block = {
      id: "blk_gallery_9",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [{ asset: wellFormedAsset /* alt missing */ }],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock accepts a well-formed gallery with no warnings", () => {
    const block = {
      id: "blk_gallery_10",
      type: "imageGallery",
      version: 1,
      data: {
        title: "Galerie",
        layout: "grid",
        columns: 3,
        lightbox: true,
        images: [
          {
            asset: wellFormedAsset,
            alt: "Studenți",
            caption: "Echipa noastră",
          },
        ],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test("preserves unknown fields on data and on individual images (forward-compat)", () => {
    const block = {
      id: "blk_gallery_11",
      type: "imageGallery",
      version: 1,
      data: {
        layout: "grid",
        columns: 3,
        lightbox: true,
        // future field — must round-trip
        spacing: "tight",
        images: [
          {
            asset: wellFormedAsset,
            alt: "ok",
            // future field on an image — must round-trip
            focusPoint: { x: 0.5, y: 0.5 },
          },
        ],
      },
    };
    const parsed = ImageGalleryBlockSchema.parse(block);
    const round = JSON.parse(JSON.stringify(parsed));
    expect(round).toEqual(block);
  });
});
