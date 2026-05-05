import { describe, expect, test } from "vitest";
import { FaqBlockSchema, validateBlock } from "../src/index.js";

describe("faq block schema", () => {
  test("validates a well-formed faq block", () => {
    const block = {
      id: "blk_faq",
      type: "faq",
      version: 1,
      data: {
        items: [
          {
            question: "Cum mă pot înscrie?",
            answer: "Trimite un email la **contact@example.org**.",
          },
        ],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a faq block with optional title and multiple items", () => {
    const block = {
      id: "blk_faq_full",
      type: "faq",
      version: 1,
      data: {
        title: "Întrebări frecvente",
        items: [
          { question: "Q1?", answer: "A1." },
          { question: "Q2?", answer: "A2 with [a link](https://anosr.ro)." },
          { question: "Q3?", answer: "- list\n- of\n- bullets" },
        ],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a faq block with firstOpen=true", () => {
    const block = {
      id: "blk_faq_first_open",
      type: "faq",
      version: 1,
      data: {
        firstOpen: true,
        items: [{ question: "Q1?", answer: "A1." }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a faq block with firstOpen=false (all-closed default)", () => {
    const block = {
      id: "blk_faq_all_closed",
      type: "faq",
      version: 1,
      data: {
        firstOpen: false,
        items: [{ question: "Q1?", answer: "A1." }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a faq block with no firstOpen (defaults to all-closed)", () => {
    const block = {
      id: "blk_faq_default",
      type: "faq",
      version: 1,
      data: {
        items: [{ question: "Q1?", answer: "A1." }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects a faq block with no items field", () => {
    const block = {
      id: "blk_no_items",
      type: "faq",
      version: 1,
      data: {},
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a faq item missing the question", () => {
    const block = {
      id: "blk_no_q",
      type: "faq",
      version: 1,
      data: {
        items: [{ answer: "A1." }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a faq item missing the answer", () => {
    const block = {
      id: "blk_no_a",
      type: "faq",
      version: 1,
      data: {
        items: [{ question: "Q1?" }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a faq item with empty question", () => {
    const block = {
      id: "blk_empty_q",
      type: "faq",
      version: 1,
      data: {
        items: [{ question: "", answer: "A." }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a faq item where answer is not a string", () => {
    const block = {
      id: "blk_bad_a",
      type: "faq",
      version: 1,
      data: {
        items: [{ question: "Q?", answer: 42 }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("accepts an empty answer string at the schema layer (placeholder)", () => {
    // Mirrors richText: empty content is a quality nudge, not a hard error.
    const block = {
      id: "blk_empty_a",
      type: "faq",
      version: 1,
      data: {
        items: [{ question: "Q?", answer: "" }],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects a faq block with the wrong type literal", () => {
    const block = {
      id: "blk_wrongkind",
      type: "hero",
      version: 1,
      data: { items: [{ question: "Q?", answer: "A." }] },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a faq block with the wrong version literal", () => {
    const block = {
      id: "blk_wrongversion",
      type: "faq",
      version: 2,
      data: { items: [{ question: "Q?", answer: "A." }] },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown fields on faq data and items (forward compat)", () => {
    const block = {
      id: "blk_future",
      type: "faq",
      version: 1,
      data: {
        items: [
          {
            question: "Q?",
            answer: "A.",
            // Hypothetical future field — must round-trip via looseObject.
            anchor: "join",
          },
        ],
        // Hypothetical future field on data root.
        layout: "two-column",
      },
    };
    const parsed = FaqBlockSchema.parse(block);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as typeof block;
    expect(roundTripped.data.layout).toBe("two-column");
    expect(roundTripped.data.items[0]!.anchor).toBe("join");
  });

  test("validateBlock returns severity-tiered issues for an invalid faq", () => {
    const block = {
      id: "blk_invalid",
      type: "faq",
      version: 1,
      data: {},
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock warns when a faq has no items (empty list, quality nudge)", () => {
    const block = {
      id: "blk_empty_list",
      type: "faq",
      version: 1,
      data: { items: [] },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]!.severity).toBe("warning");
    expect(result.warnings[0]!.code).toBe("block.faq.items.empty");
  });

  test("validateBlock warns when a faq item has empty answer (quality nudge)", () => {
    const block = {
      id: "blk_empty_answer",
      type: "faq",
      version: 1,
      data: {
        items: [{ question: "Q?", answer: "" }],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.code === "block.faq.item.answer.empty")).toBe(true);
  });

  test("faq is registered in KnownBlockSchemas", async () => {
    const mod = await import("../src/index.js");
    const known = mod.KnownBlockSchemas as Record<string, unknown>;
    expect("faq" in known).toBe(true);
  });

  test("faq accepts the canonical PRD example with markdown answers", () => {
    // Per PRD user story #31: "I want an FAQ block with collapsible accordions,
    // so that visitors can self-serve common questions." Answers may use the
    // markdown subset from #9 (bold, italic, links, lists).
    const block = {
      id: "blk_about_faq",
      type: "faq",
      version: 1,
      data: {
        title: "Întrebări frecvente",
        firstOpen: true,
        items: [
          {
            question: "Cine poate să se înscrie?",
            answer:
              "Orice **student** al universității. Vezi [regulamentul](https://anosr.ro/reg).",
          },
          {
            question: "Care sunt etapele?",
            answer: "1. Trimite email\n2. Așteaptă răspuns\n3. Vino la întâlnire",
          },
          {
            question: "Există costuri?",
            answer: "Nu, *participarea* este gratuită.",
          },
        ],
      },
    };
    expect(FaqBlockSchema.safeParse(block).success).toBe(true);
    expect(validateBlock(block).ok).toBe(true);
  });
});
