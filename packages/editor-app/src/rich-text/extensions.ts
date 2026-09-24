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
 *   the picker, never as free-floating text inside the document. The host
 *   supplies `displayUrlFor` so the surface can show the bytes.
 * - **`richTextAlign`** carries the `align` attribute of paragraphs and
 *   headings, matching the document vocabulary.
 *
 * The `renderHTML` implementations here are *editor chrome only*. Public
 * output never goes through Tiptap — it is produced by
 * `renderRichTextDocToHtml` in `@sosb/renderer`, in Node and in the browser,
 * from the stored document. Anything Tiptap renders is what the author sees
 * while typing and nothing more.
 */

import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { isAcceptableLinkUrl, type AssetRefLike, type RichTextLinkTarget } from "@sosb/schema";
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
 *
 * External hrefs are re-checked against the schema's own rule before they
 * touch the DOM. The dialog already refuses unsafe schemes, but a project
 * file can be hand-edited, and an `<a href="javascript:…">` inside a
 * contenteditable is still an `<a href="javascript:…">`.
 */
function editorHref(target: unknown): string {
  if (typeof target === "object" && target !== null) {
    const t = target as { kind?: unknown; href?: unknown };
    if (t.kind === "external" && typeof t.href === "string" && isAcceptableLinkUrl(t.href)) {
      return t.href;
    }
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
    // Issue #100: paste retains links. A pasted `<a>` becomes an *external*
    // target when its href passes the same rule the link dialog applies;
    // anything else — `javascript:`, a bare fragment, no href at all — keeps
    // its words and loses the link. Internal targets cannot arrive this way:
    // they are identities, not addresses, and only the dialog can mint them.
    // (Copy and paste *within* the editor carries the structured attrs
    // through ProseMirror's own clipboard format, so those survive intact.)
    return [
      {
        tag: "a[href]",
        getAttrs: (element) => {
          const href = element.getAttribute("href")?.trim() ?? "";
          if (href === "" || !isAcceptableLinkUrl(href)) return false;
          return { target: { kind: "external", href } satisfies RichTextLinkTarget };
        },
      },
    ];
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
    // Both commands first widen a collapsed selection to the whole link the
    // caret sits in. Without that, "put the caret in a link, choose a new
    // target" would only set a stored mark for the *next* keystroke and leave
    // the existing link untouched, and "remove link" would do nothing
    // visible. With a real selection `extendMarkRange` is a no-op, so
    // linking a fresh selection is unaffected.
    return {
      setSosbLink:
        (target: RichTextLinkTarget) =>
        ({ chain }) =>
          chain().extendMarkRange(SOSB_LINK_MARK).setMark(SOSB_LINK_MARK, { target }).run(),
      unsetSosbLink:
        () =>
        ({ chain }) =>
          chain().extendMarkRange(SOSB_LINK_MARK).unsetMark(SOSB_LINK_MARK).run(),
    };
  },
});

export interface SosbImageOptions {
  /**
   * Resolve an asset reference to something the editing surface can show —
   * the same `blob:` URL the asset picker and the preview use. The stored
   * `path` (`assets/<hash>.<ext>`) is a project-archive path, not a URL the
   * editor page can fetch, so without this every image is a broken image.
   * Returning `undefined` means the bytes are not in the project: the node
   * renders as a labelled placeholder so the author sees that a file is
   * missing rather than a blank.
   */
  readonly displayUrlFor: ((ref: AssetRefLike) => string | undefined) | undefined;
}

export const SosbImage = Node.create<SosbImageOptions>({
  name: SOSB_IMAGE_NODE,
  group: "block",
  // Images occupy their own line; text wrapping and arbitrary positioning
  // are explicitly deferred (issue #100).
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { displayUrlFor: undefined };
  },

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
    const caption = typeof node.attrs["caption"] === "string" ? node.attrs["caption"] : "";
    const src =
      asset !== null && typeof asset.path === "string"
        ? this.options.displayUrlFor?.(asset as AssetRefLike)
        : undefined;
    const figcaption = caption === "" ? [] : [["figcaption", {}, caption]];
    if (src === undefined) {
      // Missing bytes: an editor placeholder (issue #100), never a broken
      // image icon and never the raw path. The description still shows so
      // the author knows *which* image this was.
      return [
        "figure",
        { "data-sosb-image": "", "data-missing": "", class: "rich-text-figure" },
        ["div", { class: "rich-text-figure__missing", role: "img", "aria-label": alt }, alt],
        ...figcaption,
      ];
    }
    return [
      "figure",
      { "data-sosb-image": "", class: "rich-text-figure" },
      ["img", { src, alt }],
      ...figcaption,
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

/**
 * Carries the document's per-node `align` through the editor untouched. No
 * toolbar control sets it — Block-level `titleAlign` / `paragraphAlign` are
 * the author-facing alignment — but a document that already has it (a
 * hand-edited file, a future editor) must not lose it on the round trip.
 */
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
});
