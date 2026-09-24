import { describe, expect, test } from "vitest";
import { markdownToRichTextDoc } from "@sosb/markdown";
import { RichTextDocumentSchema, type RichTextDocument } from "@sosb/schema";
import { docToProseMirror, proseMirrorToDoc } from "../src/rich-text/doc-prosemirror.js";

/**
 * The document ↔ ProseMirror adapter.
 *
 * This is the seam that keeps ADR 0048's storage format independent of the
 * editing library, so the property that matters is round-trip fidelity: a
 * document that goes into Tiptap and comes back out must be the same
 * document. Everything Tiptap adds for its own convenience — `attrs` for
 * values we store inline, a trailing paragraph to click after an image, a
 * seeded empty paragraph in a blank Block — has to be stripped on the way
 * back, or it accumulates in the project file one edit at a time.
 */

function roundTrip(doc: RichTextDocument): RichTextDocument {
  return proseMirrorToDoc(docToProseMirror(doc));
}

function doc(...content: unknown[]): RichTextDocument {
  return { version: 1, content } as unknown as RichTextDocument;
}

describe("document ↔ ProseMirror round trip", () => {
  test("preserves the whole vocabulary unchanged", () => {
    const original = doc(
      { type: "heading", level: 2, content: [{ type: "text", text: "Titlu" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "normal " },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " " },
          { type: "text", text: "code", marks: [{ type: "code" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "link",
            marks: [{ type: "link", target: { kind: "page", pageId: "page_1" } }],
          },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
          },
        ],
      },
      {
        type: "orderedList",
        start: 4,
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }],
          },
        ],
      },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "citat" }] }],
      },
      {
        type: "image",
        asset: {
          hash: "h",
          path: "assets/h.png",
          metadataPath: "assets/h.json",
          mime: "image/png",
          width: 10,
          height: 10,
          alt: "descriere",
        },
        caption: "legendă",
      },
      { type: "paragraph", align: "center", content: [{ type: "text", text: "centrat" }] },
    );

    expect(roundTrip(original)).toEqual(original);
  });

  test("preserves mark order, which is the element nesting", () => {
    const boldOutside = doc({
      type: "paragraph",
      content: [{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "italic" }] }],
    });
    const italicOutside = doc({
      type: "paragraph",
      content: [{ type: "text", text: "x", marks: [{ type: "italic" }, { type: "bold" }] }],
    });
    expect(roundTrip(boldOutside)).toEqual(boldOutside);
    expect(roundTrip(italicOutside)).toEqual(italicOutside);
    expect(roundTrip(boldOutside)).not.toEqual(roundTrip(italicOutside));
  });

  test("every migrated Markdown document survives the round trip", () => {
    // The two conversions meet here for the first time: content converted
    // from Markdown is the content most real projects will open with, and
    // it must not change shape just because someone clicked into the Block.
    const sources = [
      "## Titlu\n\nText cu **accent** și *italic*.",
      "- unu\n- doi\n- trei",
      "1. unu\n2. doi",
      "> un citat",
      "Vezi [site-ul](https://anosr.ro) pentru detalii.",
      "Text cu `cod` inline.",
    ];
    for (const source of sources) {
      const converted = markdownToRichTextDoc(source) as unknown as RichTextDocument;
      expect(RichTextDocumentSchema.safeParse(converted).success).toBe(true);
      expect(roundTrip(converted)).toEqual(converted);
    }
  });
});

describe("ProseMirror conveniences do not leak into storage", () => {
  test("an empty document is seeded with a paragraph to type into, and gives it back", () => {
    const pm = docToProseMirror(doc());
    expect(pm.content).toEqual([{ type: "paragraph" }]);
    // ...but the stored document stays empty, so the Renderer's empty-state
    // suppression still fires and no `<p></p>` reaches the built page.
    expect(proseMirrorToDoc(pm)).toEqual({ version: 1, content: [] });
  });

  test("trailing empty paragraphs are dropped, interior ones are kept", () => {
    const withTrailing = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
        { type: "paragraph" },
        { type: "paragraph" },
      ],
    };
    const result = proseMirrorToDoc(withTrailing);
    expect(result.content).toHaveLength(3);
    expect(result.content[1]).toEqual({ type: "paragraph", content: [] });
  });

  test("zero-length text nodes are dropped on the way in", () => {
    // They exist only in documents converted from degenerate Markdown
    // (`****`), where they carry a mark around nothing. ProseMirror rejects
    // them outright, and nothing an author can see is lost.
    const pm = docToProseMirror(
      doc({
        type: "paragraph",
        content: [{ type: "text", text: "", marks: [{ type: "bold" }] }],
      }),
    );
    expect(pm.content?.[0]?.content ?? []).toEqual([]);
  });

  test("an unknown mark does not survive into ProseMirror", () => {
    // The field never mounts Tiptap for a document containing one — this is
    // the belt to that braces. Silently keeping an unrenderable mark in the
    // editor's schema is how it would get dropped without anyone noticing.
    const result = proseMirrorToDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "futureHighlight" }] }],
        },
      ],
    });
    expect(result.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "x" }],
    });
  });

  test("the default ordered-list start is omitted so documents stay minimal", () => {
    const result = proseMirrorToDoc({
      type: "doc",
      content: [{ type: "orderedList", attrs: { start: 1 }, content: [] }],
    });
    expect(result.content[0]).toEqual({ type: "orderedList", content: [] });
  });
});
