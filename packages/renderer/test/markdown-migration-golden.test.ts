import { describe, expect, test } from "vitest";
import { markdownToHtml, markdownToRichTextDoc } from "@sosb/markdown";
import { RichTextDocumentSchema, migrateSite, type RichTextDocument } from "@sosb/schema";
import { renderRichTextDocToHtml } from "../src/rich-text-html.js";
import {
  ALL_LEGACY_MARKDOWN,
  LEGACY_FIXTURE_MARKDOWN,
  WHITELIST_MARKDOWN,
  XSS_MARKDOWN,
} from "./fixtures/legacy-richtext-markdown.js";

/**
 * The migration golden suite (ADR 0048, issue #100).
 *
 * The contract under test is not "the conversion looks reasonable" but the
 * much stronger claim the ADR makes:
 *
 *   > Legacy conversion preserves the current Markdown renderer's displayed
 *   > meaning, including unsupported syntax rendered as literal text.
 *
 * "Displayed meaning" is operationalised as byte-identical HTML. That is
 * deliberately stricter than necessary — two different strings could display
 * identically — but it is the only version of the claim a test can check
 * without a browser, and it forecloses the whole class of silent drift
 * between the Markdown path and the document path.
 *
 * Two parsers exist on purpose: `@sosb/markdown`'s tag-emitting walker keeps
 * serving every other Block's Markdown fields under ADR 0034, while
 * `markdownToRichTextDoc` produces documents. This suite is the contract
 * that keeps them honest, which is why the XSS corpus is included in full:
 * it certifies the new serialiser is exactly as conservative as the old one.
 */
describe("Markdown → document → HTML is byte-identical to the legacy renderer", () => {
  for (const sample of ALL_LEGACY_MARKDOWN) {
    test(sample.name, () => {
      const legacy = markdownToHtml(sample.markdown);
      const migrated = renderRichTextDocToHtml(
        markdownToRichTextDoc(sample.markdown) as unknown as RichTextDocument,
      );
      expect(migrated).toBe(legacy);
    });
  }
});

describe("converted documents are valid version 1 documents", () => {
  for (const sample of ALL_LEGACY_MARKDOWN) {
    test(sample.name, () => {
      const parsed = RichTextDocumentSchema.safeParse(markdownToRichTextDoc(sample.markdown));
      expect(parsed.success).toBe(true);
    });
  }
});

describe("the real committed fixture content", () => {
  test("every legacy fixture string round-trips through the document path", () => {
    // Called out separately from the synthetic cases so a regression here
    // reads as "we broke a real site", not "we broke an edge case".
    for (const sample of LEGACY_FIXTURE_MARKDOWN) {
      const doc = markdownToRichTextDoc(sample.markdown) as unknown as RichTextDocument;
      expect(renderRichTextDocToHtml(doc)).toBe(markdownToHtml(sample.markdown));
    }
  });

  test("the whitelist and XSS corpora are both non-trivially covered", () => {
    // Guards against someone emptying a corpus to make this file pass.
    expect(WHITELIST_MARKDOWN.length).toBeGreaterThan(40);
    expect(XSS_MARKDOWN.length).toBeGreaterThan(30);
  });
});

describe("the block migration runs on load", () => {
  const legacySite = {
    schemaVersion: 1,
    org: { name: "Fixture Org" },
    theme: { id: "stub", tokens: { colorPrimary: "#1f3a5f", colorAccent: "#c08a3e" } },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 0,
        showInNav: true,
        blocks: [
          {
            id: "blk_1",
            type: "richText",
            version: 1,
            data: {
              markdown: "## Titlu\n\nText cu **accent**.",
              titleAlign: "center",
              futureField: "kept",
            },
          },
        ],
      },
    ],
  };

  test("migrateSite converts a legacy richText block and reports it", () => {
    const result = migrateSite(structuredClone(legacySite));
    expect(result.blockMigrations).toEqual([
      { path: ["pages", 0, "blocks", 0], type: "richText", appliedVersions: [2] },
    ]);

    const block = (result.data as typeof legacySite).pages[0]!.blocks[0]! as unknown as {
      version: number;
      data: { doc: RichTextDocument; titleAlign?: string; markdown?: string; futureField?: string };
    };
    expect(block.version).toBe(2);
    expect(block.data.markdown).toBeUndefined();
    // ADR 0002: unknown sibling keys and existing presentation fields survive
    // a migration untouched.
    expect(block.data.titleAlign).toBe("center");
    expect(block.data.futureField).toBe("kept");
    expect(renderRichTextDocToHtml(block.data.doc)).toBe(
      markdownToHtml(legacySite.pages[0]!.blocks[0]!.data.markdown),
    );
  });

  test("a second migrateSite pass is a no-op", () => {
    const once = migrateSite(structuredClone(legacySite));
    const twice = migrateSite(structuredClone(once.data));
    expect(twice.blockMigrations).toEqual([]);
    expect(twice.data).toEqual(once.data);
  });

  test("structurally broken blocks do not make a project unopenable", () => {
    // Rejecting these here would convert a reportable validation error into
    // an import failure, which is the opposite of the migration's purpose.
    const broken = structuredClone(legacySite) as unknown as {
      pages: { blocks: unknown[] }[];
    };
    broken.pages[0]!.blocks.push(null, { type: "richText" }, { id: "x", version: 1 });
    expect(() => migrateSite(broken)).not.toThrow();
  });
});
