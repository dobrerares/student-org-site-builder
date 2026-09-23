// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { AssetRefLike } from "@sosb/schema";
import { RichTextAlign, SosbImage, SosbLink } from "../src/rich-text/extensions.js";
import { SOSB_IMAGE_NODE, SOSB_LINK_MARK } from "../src/rich-text/doc-prosemirror.js";

/**
 * The Site-aware Tiptap extensions, driven headlessly.
 *
 * These are the behaviours a keystroke-level e2e would be too slow to pin
 * one by one: what a pasted `<a>` becomes, what "edit link" does when the
 * caret merely sits inside a link, and what the editing surface shows for an
 * image whose bytes the project does or does not hold.
 */

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

function makeEditor(
  content: unknown,
  displayUrlFor: ((ref: AssetRefLike) => string | undefined) | undefined = undefined,
): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit.configure({ link: false, codeBlock: false, horizontalRule: false }),
      SosbLink,
      SosbImage.configure({ displayUrlFor }),
      RichTextAlign,
    ],
    content: content as never,
  });
  return editor;
}

function linkedParagraph(target: unknown): unknown {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "vezi", marks: [{ type: SOSB_LINK_MARK, attrs: { target } }] },
        ],
      },
    ],
  };
}

function firstTextNode(instance: Editor): {
  text?: string;
  marks?: { type: string; attrs?: unknown }[];
} {
  const json = instance.getJSON() as { content: { content?: unknown[] }[] };
  return json.content[0]!.content![0] as never;
}

describe("sosbLink — pasted links", () => {
  // Pasted HTML reaches the document through the schema's parse rules, the
  // same ones `setContent` runs over an HTML string; driving them that way
  // avoids `insertContent`'s text-only shortcut, which inserts the raw string
  // when the parsed result carries no marks.
  test("a pasted <a> with a usable href becomes an external target", () => {
    // Issue #100: paste retains links.
    const instance = makeEditor({ type: "doc", content: [{ type: "paragraph" }] });
    instance.commands.setContent('<p><a href="https://anosr.ro/">ANOSR</a></p>');
    const node = firstTextNode(instance);
    expect(node.text).toBe("ANOSR");
    expect(node.marks).toEqual([
      { type: SOSB_LINK_MARK, attrs: { target: { kind: "external", href: "https://anosr.ro/" } } },
    ]);
  });

  test("a pasted <a> whose href the schema refuses keeps its words and loses the link", () => {
    const instance = makeEditor({ type: "doc", content: [{ type: "paragraph" }] });
    instance.commands.setContent('<p><a href="javascript:alert(1)">click</a> <a>plain</a></p>');
    const json = JSON.stringify(instance.getJSON());
    expect(json).toContain("click");
    expect(json).toContain("plain");
    expect(json).not.toContain(SOSB_LINK_MARK);
    expect(json).not.toContain("javascript");
  });
});

describe("sosbLink — editing an existing link", () => {
  const original = { kind: "page", pageId: "page_1" };

  test("re-targeting with the caret inside the link changes the whole link", () => {
    const instance = makeEditor(linkedParagraph(original));
    // Position 3 is between "ve" and "zi": a collapsed selection inside the
    // link, which is how an author "puts the cursor in it".
    instance.commands.setTextSelection(3);
    instance.commands.setSosbLink({ kind: "external", href: "https://example.org/" });
    const node = firstTextNode(instance);
    expect(node.text).toBe("vezi");
    expect(node.marks?.[0]?.attrs).toEqual({
      target: { kind: "external", href: "https://example.org/" },
    });
    // One link, not the old one plus a stored mark for the next keystroke.
    expect(JSON.stringify(instance.getJSON())).not.toContain("page_1");
  });

  test("removing with the caret inside the link unlinks the whole link", () => {
    const instance = makeEditor(linkedParagraph(original));
    instance.commands.setTextSelection(3);
    instance.commands.unsetSosbLink();
    const node = firstTextNode(instance);
    expect(node.text).toBe("vezi");
    expect(node.marks ?? []).toEqual([]);
  });

  test("a real selection is linked as selected, not widened", () => {
    const instance = makeEditor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "unu doi trei" }] }],
    });
    instance.commands.setTextSelection({ from: 5, to: 8 });
    instance.commands.setSosbLink({ kind: "article", articleId: "art_1" });
    const json = instance.getJSON() as {
      content: { content: { text: string; marks?: unknown[] }[] }[];
    };
    const texts = json.content[0]!.content.map((n) => [n.text, n.marks === undefined ? 0 : 1]);
    expect(texts).toEqual([
      ["unu ", 0],
      ["doi", 1],
      [" trei", 0],
    ]);
  });
});

describe("sosbImage — what the editing surface shows", () => {
  const asset = {
    hash: "abc",
    path: "assets/abc.png",
    metadataPath: "assets/abc.json",
    mime: "image/png",
    width: 10,
    height: 10,
    alt: "Membrii asociației",
  };

  test("the src comes from the host's display URL, not the archive path", () => {
    // `assets/abc.png` is a project-archive path; the editor page cannot
    // fetch it. Without the resolver every inserted image is a broken image.
    const instance = makeEditor({ type: "doc", content: [{ type: "paragraph" }] }, (ref) =>
      ref.hash === "abc" ? "blob:test-abc" : undefined,
    );
    instance.commands.insertSosbImage({ asset, caption: "Legendă" });
    const html = instance.getHTML();
    expect(html).toContain('src="blob:test-abc"');
    expect(html).toContain('alt="Membrii asociației"');
    expect(html).toContain("<figcaption>Legendă</figcaption>");
    expect(html).not.toContain("assets/abc.png");
  });

  test("missing bytes render as a labelled placeholder, never a broken image", () => {
    const instance = makeEditor({ type: "doc", content: [{ type: "paragraph" }] }, () => undefined);
    instance.commands.insertSosbImage({ asset });
    const html = instance.getHTML();
    expect(html).toContain("data-missing");
    expect(html).not.toContain("<img");
    expect(html).toContain('aria-label="Membrii asociației"');
    // The stored node is untouched: the placeholder is display only.
    const json = instance.getJSON() as { content: { type: string; attrs?: { asset: unknown } }[] };
    const image = json.content.find((n) => n.type === SOSB_IMAGE_NODE);
    expect(image?.attrs?.asset).toEqual(asset);
  });
});
