import { describe, expect, test } from "vitest";
import { CustomHtmlBlockSchema, validateBlock } from "../src/index.js";

/**
 * customHTML block — schema tests.
 *
 * The block carries raw HTML and a `sanitize` toggle. ON by default. When
 * set to false the user has explicitly opted into "danger mode" and the
 * editor surfaces a persistent warning (covered in editor-app tests).
 */
describe("customHTML block schema", () => {
  test("validates a well-formed customHTML block with sanitize on (default)", () => {
    const block = {
      id: "blk_html_01",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>Hello</p>",
        sanitize: true,
      },
    };
    expect(CustomHtmlBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a customHTML block with sanitize off (danger mode)", () => {
    const block = {
      id: "blk_html_02",
      type: "customHTML",
      version: 1,
      data: {
        html: '<iframe src="https://example.org/widget"></iframe>',
        sanitize: false,
      },
    };
    expect(CustomHtmlBlockSchema.safeParse(block).success).toBe(true);
  });

  test("requires the sanitize field as a boolean", () => {
    const block = {
      id: "blk_html_03",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>Hi</p>",
        // sanitize missing
      },
    };
    const parsed = CustomHtmlBlockSchema.safeParse(block);
    expect(parsed.success).toBe(false);
  });

  test("rejects non-boolean sanitize values", () => {
    const block = {
      id: "blk_html_04",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>Hi</p>",
        sanitize: "yes",
      },
    };
    const parsed = CustomHtmlBlockSchema.safeParse(block);
    expect(parsed.success).toBe(false);
  });

  test("requires html to be a string", () => {
    const block = {
      id: "blk_html_05",
      type: "customHTML",
      version: 1,
      data: {
        html: 123,
        sanitize: true,
      },
    };
    expect(CustomHtmlBlockSchema.safeParse(block).success).toBe(false);
  });

  test("accepts an empty html string", () => {
    // Empty html is still a valid block; the editor may warn but the schema
    // does not block. This matches the PRD severity model: warnings vs errors.
    const block = {
      id: "blk_html_06",
      type: "customHTML",
      version: 1,
      data: {
        html: "",
        sanitize: true,
      },
    };
    expect(CustomHtmlBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects customHTML blocks with the wrong type", () => {
    const block = {
      id: "blk_html_07",
      type: "hero",
      version: 1,
      data: { html: "<p>x</p>", sanitize: true },
    };
    expect(CustomHtmlBlockSchema.safeParse(block).success).toBe(false);
  });

  test("preserves unknown fields on data (forward-compat)", () => {
    const block = {
      id: "blk_html_08",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>x</p>",
        sanitize: true,
        futureField: "ignored-but-kept",
      },
    };
    const parsed = CustomHtmlBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data.data as Record<string, unknown>).futureField).toBe("ignored-but-kept");
    }
  });

  test("validateBlock surfaces a warning when sanitize is off", () => {
    // Per the PRD, sanitize-off is a warning (not an error) — the editor
    // shows the persistent danger UI; the schema records a warning so the
    // Site Health panel and validation report can pick it up too.
    const block = {
      id: "blk_html_09",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>x</p>",
        sanitize: false,
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "block.customHTML.sanitize.off")).toBe(true);
  });

  test("validateBlock does not warn when sanitize is on", () => {
    const block = {
      id: "blk_html_10",
      type: "customHTML",
      version: 1,
      data: {
        html: "<p>x</p>",
        sanitize: true,
      },
    };
    const result = validateBlock(block);
    expect(result.warnings.some((w) => w.code === "block.customHTML.sanitize.off")).toBe(false);
  });

  test("isKnownBlockType recognises customHTML", async () => {
    const { isKnownBlockType } = await import("../src/index.js");
    expect(isKnownBlockType("customHTML")).toBe(true);
  });
});
