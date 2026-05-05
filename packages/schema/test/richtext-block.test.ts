import { describe, expect, test } from "vitest";
import { RichTextBlockSchema, validateBlock } from "../src/index.js";

describe("richText block schema", () => {
  test("validates a well-formed richText block", () => {
    const block = {
      id: "blk_intro",
      type: "richText",
      version: 1,
      data: {
        markdown: "## Mission\n\nWe are **HISTORIPOL** — a student association.",
      },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a richText block with empty markdown (placeholder)", () => {
    // An empty richText is allowed at the schema layer; quality-nudge
    // warnings live in `validate()` if we ever add them. The PRD has empty
    // org name as a hard error but does not list empty richText prose.
    const block = {
      id: "blk_empty",
      type: "richText",
      version: 1,
      data: { markdown: "" },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects a richText block missing `markdown`", () => {
    const block = {
      id: "blk_missing",
      type: "richText",
      version: 1,
      data: {},
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a richText block where `markdown` is not a string", () => {
    const block = {
      id: "blk_wrongtype",
      type: "richText",
      version: 1,
      data: { markdown: 42 },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a richText block with the wrong type literal", () => {
    const block = {
      id: "blk_wrongkind",
      type: "hero",
      version: 1,
      data: { markdown: "## Hi" },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a richText block with the wrong version literal", () => {
    const block = {
      id: "blk_wrongversion",
      type: "richText",
      version: 2,
      data: { markdown: "## Hi" },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown fields on richText data (forward compat)", () => {
    const block = {
      id: "blk_future",
      type: "richText",
      version: 1,
      data: {
        markdown: "## Hi",
        // Hypothetical future field — must round-trip via looseObject.
        align: "center",
      },
    };
    const parsed = RichTextBlockSchema.parse(block);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as typeof block;
    expect(roundTripped.data.align).toBe("center");
  });

  test("validateBlock returns severity-tiered issues for richText", () => {
    const block = {
      id: "blk_invalid",
      type: "richText",
      version: 1,
      data: {},
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("richText is registered in KnownBlockSchemas", async () => {
    const mod = await import("../src/index.js");
    const known = mod.KnownBlockSchemas as Record<string, unknown>;
    expect("richText" in known).toBe(true);
  });

  test("richText accepts the canonical PRD example", () => {
    // The PRD describes the richText block as: "I want a rich-text block
    // where I can write prose with markdown formatting (bold, italic, lists,
    // headings, links, quotes), so that I can express ideas naturally
    // without HTML." This shape exercises every whitelist element.
    const markdown =
      "## About us\n\n" +
      "We are a **student** association founded in *2024*.\n\n" +
      "Our pillars:\n\n" +
      "- Research\n" +
      "- Community\n" +
      "- Outreach\n\n" +
      "> Quality is not optional.\n\n" +
      "Find us on [our site](https://anosr.ro).";
    const block = {
      id: "blk_about",
      type: "richText",
      version: 1,
      data: { markdown },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
    expect(validateBlock(block).ok).toBe(true);
  });
});
