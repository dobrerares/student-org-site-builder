/**
 * Site-aware Tiptap extensions (ADR 0049: "Site-aware adapters remain
 * editor-owned").
 *
 * Three things Tiptap's stock extensions cannot do, because each needs to
 * know about the Site rather than about HTML:
 *
 * - **`sosbLink`** stores a *target* — `{kind:"page", pageId}` — not an
 *   `href`. Tiptap's own Link mark is disabled; keeping both would give two
 *   ways to express a link and one of them would silently win.
 * - **`sosbImage`** stores an asset reference from the project's pipeline,
 *   not a URL. It is an atom: the caption and description are edited through
 *   the picker, never as free-floating text inside the document.
 * - **`richTextAlign`** adds the `align` attribute to paragraphs and
 *   headings, matching the document vocabulary.
 *
 * The `renderHTML` implementations here are *editor chrome only*. Public
 * output never goes through Tiptap — it is produced by
 * `renderRichTextDocToHtml` in `@sosb/renderer`, in Node and in the browser,
 * from the stored document. Anything Tiptap renders is what the author sees
 * while typing and nothing more.
 */

import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import type { RichTextLinkTarget } from "@sosb/schema";
import { SOSB_IMAGE_NODE, SOSB_LINK_MARK } from "./doc-prosemirror.js";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sosbLink: {
      setSosbLink: (target: RichTextLinkTarget) => ReturnType;
      unsetSosbLink: () => ReturnType;
    };
    sosbImage: {
      insertSosbImage: (attrs: { asset: unknown; caption?: string }) => ReturnType;
    };
    richTextAlign: {
      setRichTextAlign: (align: string | null) => ReturnType;
    };
  }
}

/**
 * A display-only href for the editing surface.
 *
 * Internal targets get a `#` placeholder rather than a resolved path: inside
 * the editor the link is never followed, and computing a real path here
 * would duplicate the Renderer's resolver in a second place where it could
 * drift. What the author needs to see is *that* the words are a link and
 * which thing it points at — the latter comes from the link dialog and the
 * `data-link-kind` attribute, not from the href.
 */
function editorHref(target: unknown): string {
  if (typeof target === "object" && target !== null) {
    const t = target as { kind?: unknown; href?: unknown };
    if (t.kind === "external" && typeof t.href === "string") return t.href;
  }
  return "#";
}

function linkKind(target: unknown): string {
  if (typeof target === "object" && target !== null) {
    const kind = (target as { kind?: unknown }).kind;
    if (typeof kind === "string") return kind;
  }
  return "external";
}

export const SosbLink = Mark.create({
  name: SOSB_LINK_MARK,
  // Above the text-style marks so a link wraps them, matching the outermost-
  // first mark order the document format uses.
  priority: 1000,
  inclusive: false,
  // Two links may not overlap; the later one replaces the earlier.
  excludes: SOSB_LINK_MARK,

  addAttributes() {
    return {
      target: {
        default: null,
        // The target is a structured value, not an HTML attribute. It is
        // never written to or read from the DOM: the document is the source
        // of truth and `renderHTML` below derives what the editor shows.
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    // Pasted `<a>` elements keep their words but lose their href: a pasted
    // link cannot be trusted to point anywhere in this project, and issue
    // #100 requires paste to retain supported formatting without importing
    // arbitrary layout or addresses. The author re-links deliberately.
    return [];
  },

  renderHTML({ HTMLAttributes, mark }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: editorHref(mark.attrs["target"]),
        "data-link-kind": linkKind(mark.attrs["target"]),
        rel: "noopener",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSosbLink:
        (target: RichTextLinkTarget) =>
        ({ commands }) =>
          commands.setMark(SOSB_LINK_MARK, { target }),
      unsetSosbLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(SOSB_LINK_MARK),
    };
  },
});

export const SosbImage = Node.create({
  name: SOSB_IMAGE_NODE,
  group: "block",
  // Images occupy their own line; text wrapping and arbitrary positioning
  // are explicitly deferred (issue #100).
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      asset: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
      caption: { default: "" },
    };
  },

  parseHTML() {
    // Remotely hosted images in pasted content are omitted with a notice
    // rather than imported: the asset pipeline owns every image byte in a
    // project, and silently hot-linking someone else's server is not a
    // behaviour an author asked for.
    return [];
  },

  renderHTML({ node }) {
    const asset = node.attrs["asset"] as { path?: unknown; alt?: unknown } | null;
    const alt = typeof asset?.alt === "string" ? asset.alt : "";
    const src = typeof asset?.path === "string" ? asset.path : "";
    const caption = typeof node.attrs["caption"] === "string" ? node.attrs["caption"] : "";
    return [
      "figure",
      { "data-sosb-image": "", class: "rich-text-figure" },
      ["img", { src, alt }],
      ...(caption === "" ? [] : [["figcaption", {}, caption]]),
    ];
  },

  addCommands() {
    return {
      insertSosbImage:
        (attrs: { asset: unknown; caption?: string }) =>
        ({ commands }) =>
          commands.insertContent({
            type: SOSB_IMAGE_NODE,
            attrs: { asset: attrs.asset, caption: attrs.caption ?? "" },
          }),
    };
  },
});

export const RichTextAlign = Extension.create({
  name: "richTextAlign",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          align: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("data-align"),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes["align"] === null || attributes["align"] === undefined
                ? {}
                : { "data-align": String(attributes["align"]) },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setRichTextAlign:
        (align: string | null) =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", { align }) ||
          commands.updateAttributes("heading", { align }),
    };
  },
});
