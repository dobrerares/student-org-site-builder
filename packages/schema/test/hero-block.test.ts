import { describe, expect, test } from "vitest";
import { HeroBlockSchema, validateBlock } from "../src/index.js";
import { historipolHeroBgRef } from "./fixtures/asset-refs.js";

describe("hero block schema", () => {
  test("validates a well-formed hero block", () => {
    const block = {
      id: "blk_01",
      type: "hero",
      version: 1,
      data: {
        title: "Welcome",
        subtitle: "We are HISTORIPOL",
      },
    };
    expect(HeroBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a hero block with all optional fields populated", () => {
    const block = {
      id: "blk_02",
      type: "hero",
      version: 1,
      data: {
        title: "HISTORIPOL",
        subtitle: "Comunitatea",
        backgroundImage: { ...historipolHeroBgRef, alt: "Photo of students" },
        backgroundAlt: "Photo of students",
      },
    };
    expect(HeroBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects hero blocks with no title", () => {
    const block = {
      id: "blk_03",
      type: "hero",
      version: 1,
      data: {
        subtitle: "Tagline only",
      },
    };
    expect(HeroBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects hero blocks with empty title", () => {
    const block = {
      id: "blk_04",
      type: "hero",
      version: 1,
      data: {
        title: "",
        subtitle: "Tagline",
      },
    };
    expect(HeroBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects hero blocks with the wrong type", () => {
    const block = {
      id: "blk_05",
      type: "richText",
      version: 1,
      data: { title: "Welcome" },
    };
    expect(HeroBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock returns severity-tiered issues", () => {
    const block = {
      id: "blk_06",
      type: "hero",
      version: 1,
      data: { subtitle: "missing title" },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock warns when a hero has a background image but no alt", () => {
    const block = {
      id: "blk_07",
      type: "hero",
      version: 1,
      data: {
        title: "Welcome",
        backgroundImage: {
          hash: "abc123",
          path: "assets/abc123.jpg",
          metadataPath: "assets/abc123.metadata.json",
          mime: "image/jpeg",
          width: 800,
          height: 600,
          alt: "Temporary upload alt",
        },
        // backgroundAlt intentionally missing
      },
    };
    const result = validateBlock(block);
    // This is a quality nudge, not a hard error.
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]!.severity).toBe("warning");
  });
});
