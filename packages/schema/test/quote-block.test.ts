import { describe, expect, test } from "vitest";
import { QuoteBlockSchema, validateBlock } from "../src/index.js";

describe("quote block schema", () => {
  test("validates a well-formed quote block (text only)", () => {
    const block = {
      id: "blk_pull_quote",
      type: "quote",
      version: 1,
      data: {
        text: "Calitatea nu este opțională.",
      },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a quote block with author and authorRole", () => {
    const block = {
      id: "blk_alumni",
      type: "quote",
      version: 1,
      data: {
        text: "We built something *real* together.",
        author: "Maria Popescu",
        authorRole: "Alumni, 2023",
      },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a quote block with authorImage and authorImageAlt", () => {
    const block = {
      id: "blk_with_photo",
      type: "quote",
      version: 1,
      data: {
        text: "A meaningful testimonial.",
        author: "Andrei Ionescu",
        authorImage: "assets/andrei.jpg",
        authorImageAlt: "Andrei zâmbind",
      },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects a quote block missing `text`", () => {
    const block = {
      id: "blk_missing",
      type: "quote",
      version: 1,
      data: {},
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a quote block where `text` is empty (hard error)", () => {
    // Unlike richText where empty markdown is an allowed placeholder, a
    // pull-quote with no quote text is structurally meaningless — there is
    // nothing to attribute to. The schema rejects it as a hard error.
    const block = {
      id: "blk_empty",
      type: "quote",
      version: 1,
      data: { text: "" },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a quote block where `text` is not a string", () => {
    const block = {
      id: "blk_wrongtype",
      type: "quote",
      version: 1,
      data: { text: 42 },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a quote block with the wrong type literal", () => {
    const block = {
      id: "blk_wrongkind",
      type: "richText",
      version: 1,
      data: { text: "Hello" },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a quote block with the wrong version literal", () => {
    const block = {
      id: "blk_wrongversion",
      type: "quote",
      version: 2,
      data: { text: "Hello" },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown fields on quote data (forward compat)", () => {
    const block = {
      id: "blk_future",
      type: "quote",
      version: 1,
      data: {
        text: "Hello",
        // Hypothetical future field — must round-trip via looseObject.
        decorativeMark: "section",
      },
    };
    const parsed = QuoteBlockSchema.parse(block);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as typeof block;
    expect(roundTripped.data.decorativeMark).toBe("section");
  });

  test("validateBlock returns error issues for an invalid quote", () => {
    const block = {
      id: "blk_invalid",
      type: "quote",
      version: 1,
      data: {},
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock warns when authorImage is set without authorImageAlt", () => {
    // Mirror the hero-block accessibility nudge: an image without alt text
    // is a quality warning, not a hard error.
    const block = {
      id: "blk_alt_missing",
      type: "quote",
      version: 1,
      data: {
        text: "Hello",
        authorImage: "assets/p.jpg",
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain("block.quote.authorImageAlt.missing");
  });

  test("validateBlock does not warn when authorImage and authorImageAlt are both set", () => {
    const block = {
      id: "blk_alt_present",
      type: "quote",
      version: 1,
      data: {
        text: "Hello",
        authorImage: "assets/p.jpg",
        authorImageAlt: "A descriptive alt",
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain("block.quote.authorImageAlt.missing");
  });

  test("quote is registered in KnownBlockSchemas", async () => {
    const mod = await import("../src/index.js");
    const known = mod.KnownBlockSchemas as Record<string, unknown>;
    expect("quote" in known).toBe(true);
  });

  test("quote accepts the canonical PRD example (alumni pull-quote)", () => {
    // The PRD describes the quote block as: "I want a pull-quote block with
    // attribution, so that I can highlight testimonials prominently." The
    // canonical case is an alumni testimonial with author + role + photo.
    const block = {
      id: "blk_pq_alumni",
      type: "quote",
      version: 1,
      data: {
        text: "Am construit ceva *real* împreună — o experiență **transformatoare**.",
        author: "Maria Popescu",
        authorRole: "Alumni, promoția 2023",
        authorImage: "assets/maria.jpg",
        authorImageAlt: "Maria în timpul absolvirii",
      },
    };
    expect(QuoteBlockSchema.safeParse(block).success).toBe(true);
    expect(validateBlock(block).ok).toBe(true);
  });
});
