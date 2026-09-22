import { describe, expect, test } from "vitest";
import {
  RICH_TEXT_BLOCK_VERSION,
  RichTextBlockSchema,
  emptyRichTextDocument,
  validateBlock,
} from "../src/index.js";

/**
 * richText Block schema, version 2 (ADR 0048).
 *
 * Version 1's `markdown` string is gone; the Block now carries a structured
 * document. Loading a v1 project is the migration's job, not this schema's —
 * see `richtext-migration.test.ts`.
 */

function docWith(...content: unknown[]): unknown {
  return { version: 1, content };
}

function paragraph(text: string): unknown {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

describe("richText block schema", () => {
  test("validates a well-formed richText block", () => {
    const block = {
      id: "blk_intro",
      type: "richText",
      version: 2,
      data: {
        doc: docWith(
          { type: "heading", level: 2, content: [{ type: "text", text: "Mission" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "We are " },
              { type: "text", text: "HISTORIPOL", marks: [{ type: "bold" }] },
              { type: "text", text: " — a student association." },
            ],
          },
        ),
      },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
  });

  test("accepts separate title and paragraph alignment controls", () => {
    const block = {
      id: "blk_intro_aligned",
      type: "richText",
      version: 2,
      data: {
        doc: docWith(paragraph("We are HISTORIPOL.")),
        titleAlign: "left",
        paragraphAlign: "justify",
      },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects unsupported richText alignment values", () => {
    const block = {
      id: "blk_intro_bad_align",
      type: "richText",
      version: 2,
      data: { doc: docWith(paragraph("Mission")), paragraphAlign: "diagonal" },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validates a richText block with an empty document (placeholder)", () => {
    // An empty richText is legal at the schema layer so a Block can be added
    // before the author has written anything; emptiness is a warning-tier
    // quality nudge in `validate()`, not a parse failure.
    const block = {
      id: "blk_empty",
      type: "richText",
      version: 2,
      data: { doc: emptyRichTextDocument() },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain("block.richText.doc.empty");
  });

  test("rejects a richText block missing `doc`", () => {
    const block = { id: "blk_missing", type: "richText", version: 2, data: {} };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a richText block where `doc` is not a document", () => {
    const block = { id: "blk_wrongtype", type: "richText", version: 2, data: { doc: 42 } };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a document with an unknown version", () => {
    // The document version is independent of the Block version so the
    // vocabulary can evolve without a Block migration — which only works if
    // an unknown one is refused rather than guessed at.
    const block = {
      id: "blk_futuredoc",
      type: "richText",
      version: 2,
      data: { doc: { version: 2, content: [] } },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a richText block with the wrong type literal", () => {
    const block = { id: "blk_wrongkind", type: "hero", version: 2, data: { doc: docWith() } };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a richText block still at version 1", () => {
    // v1 blocks are migrated on load. One that reaches the schema unmigrated
    // is a bug in the loader, and silently accepting it would hide it.
    const block = { id: "blk_v1", type: "richText", version: 1, data: { markdown: "## Hi" } };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(false);
    expect(RICH_TEXT_BLOCK_VERSION).toBe(2);
  });

  test("preserves unknown fields on richText data (forward compat)", () => {
    const block = {
      id: "blk_future",
      type: "richText",
      version: 2,
      data: { doc: docWith(paragraph("Hi")), futureField: "center" },
    };
    const parsed = RichTextBlockSchema.parse(block);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as typeof block;
    expect(roundTripped.data.futureField).toBe("center");
  });

  test("preserves unknown nodes and marks verbatim (forward compat)", () => {
    // ADR 0048 forbids automatic simplification: a document written by a
    // newer editor must round-trip through this one unchanged, even though
    // this one cannot render it.
    const block = {
      id: "blk_future_nodes",
      type: "richText",
      version: 2,
      data: {
        doc: docWith(
          { type: "futureCallout", tone: "warning", content: [paragraph("Careful.")] },
          {
            type: "paragraph",
            content: [{ type: "text", text: "hi", marks: [{ type: "futureHighlight", hue: 3 }] }],
          },
        ),
      },
    };
    const parsed = RichTextBlockSchema.parse(block);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(block);
  });

  test("validateBlock returns severity-tiered issues for richText", () => {
    const block = { id: "blk_invalid", type: "richText", version: 2, data: {} };
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

  test("richText accepts the canonical PRD example, now structured", () => {
    // The PRD describes the richText block as: "I want a rich-text block
    // where I can write prose with formatting (bold, italic, lists,
    // headings, links, quotes), so that I can express ideas naturally
    // without HTML." This shape exercises every element of the vocabulary,
    // including the two ADR 0048 added: an image by asset reference and a
    // link by target identity.
    const block = {
      id: "blk_about",
      type: "richText",
      version: 2,
      data: {
        doc: docWith(
          { type: "heading", level: 2, content: [{ type: "text", text: "About us" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "We are a " },
              { type: "text", text: "student", marks: [{ type: "bold" }] },
              { type: "text", text: " association founded in " },
              { type: "text", text: "2024", marks: [{ type: "italic" }] },
              { type: "text", text: "." },
            ],
          },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [paragraph("Research")] },
              { type: "listItem", content: [paragraph("Community")] },
              { type: "listItem", content: [paragraph("Outreach")] },
            ],
          },
          { type: "blockquote", content: [paragraph("Quality is not optional.")] },
          {
            type: "image",
            asset: {
              hash: "h1",
              path: "assets/h1.png",
              metadataPath: "assets/h1.json",
              mime: "image/png",
              width: 1200,
              height: 800,
              alt: "Membrii asociației la o conferință",
            },
            caption: "Conferința anuală",
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Find us on " },
              {
                type: "text",
                text: "our site",
                marks: [{ type: "link", target: { kind: "external", href: "https://anosr.ro" } }],
              },
              { type: "text", text: ", or read " },
              {
                type: "text",
                text: "the charter",
                marks: [{ type: "link", target: { kind: "page", pageId: "page_2" } }],
              },
              { type: "text", text: "." },
            ],
          },
        ),
      },
    };
    expect(RichTextBlockSchema.safeParse(block).success).toBe(true);
    expect(validateBlock(block).ok).toBe(true);
  });
});
