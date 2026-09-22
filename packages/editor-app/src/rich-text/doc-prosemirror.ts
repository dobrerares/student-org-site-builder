/**
 * Translation between the stored Rich-text document (ADR 0048) and the
 * ProseMirror JSON that Tiptap edits.
 *
 * This module is the entire reason the storage format can stay
 * library-independent. Tiptap's shape is close to ours but not identical —
 * it puts everything in `attrs`, names its link mark after the extension,
 * and rejects zero-length text nodes — so a "just pass the JSON through"
 * integration would quietly make ProseMirror's internals the file format.
 * Keeping the translation explicit costs one small module and buys the
 * freedom to replace the editor without a migration.
 *
 * **Unsupported content never comes through here.** If a document contains a
 * node or mark this version does not understand, the editor does not mount
 * Tiptap at all: it shows the content read-only and hands back the original
 * document untouched (see `rich-text-field.tsx`). That is a deliberate
 * simplification of ADR 0048's "preserved, read-only, no automatic
 * simplification" rule — round-tripping unknown content through a schema
 * that has no node for it is exactly how silent data loss happens, and the
 * contract explicitly forbids that outcome. So these functions may assume
 * the known vocabulary.
 */

import {
  RICH_TEXT_DOC_VERSION,
  type RichTextAlignment,
  type RichTextDocument,
  type RichTextLinkTarget,
  type RichTextMark,
  type RichTextNode,
} from "@sosb/schema";

/** Tiptap extension names for the three Site-aware nodes/marks we own. */
export const SOSB_LINK_MARK = "sosbLink";
export const SOSB_IMAGE_NODE = "sosbImage";

interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  marks?: PmMark[];
  text?: string;
}

interface PmMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export type ProseMirrorDoc = PmNode;

// ---------------------------------------------------------------------------
// Stored document → ProseMirror
// ---------------------------------------------------------------------------

export function docToProseMirror(doc: RichTextDocument | undefined): ProseMirrorDoc {
  const content = (doc?.content ?? []).map(nodeToPm).filter((node): node is PmNode => node !== null);
  // ProseMirror's `doc` node requires at least one block child under the
  // default schema. An empty stored document is a normal state (a freshly
  // added Block), so seed it with the empty paragraph the author will type
  // into.
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function nodeToPm(node: RichTextNode): PmNode | null {
  const any = node as {
    type: string;
    level?: unknown;
    align?: unknown;
    start?: unknown;
    text?: unknown;
    marks?: readonly RichTextMark[];
    asset?: unknown;
    caption?: unknown;
    content?: readonly RichTextNode[];
  };

  switch (any.type) {
    case "text": {
      const text = typeof any.text === "string" ? any.text : "";
      // ProseMirror rejects zero-length text nodes. They only exist in
      // documents converted from degenerate Markdown (`****`), where they
      // carry a mark around nothing, so dropping them on the way in loses
      // nothing an author could see.
      if (text.length === 0) return null;
      const marks = (any.marks ?? []).map(markToPm);
      return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
    }

    case "hardBreak":
      return { type: "hardBreak" };

    case "paragraph":
      return {
        type: "paragraph",
        attrs: { align: alignOrNull(any.align) },
        content: childrenToPm(any.content),
      };

    case "heading":
      return {
        type: "heading",
        attrs: { level: headingLevel(any.level), align: alignOrNull(any.align) },
        content: childrenToPm(any.content),
      };

    case "bulletList":
      return { type: "bulletList", content: childrenToPm(any.content) };

    case "orderedList":
      return {
        type: "orderedList",
        attrs: { start: typeof any.start === "number" ? Math.trunc(any.start) : 1 },
        content: childrenToPm(any.content),
      };

    case "listItem": {
      const children = childrenToPm(any.content);
      // Tiptap's listItem requires a block child.
      return {
        type: "listItem",
        content: children.length > 0 ? children : [{ type: "paragraph" }],
      };
    }

    case "blockquote": {
      const children = childrenToPm(any.content);
      return {
        type: "blockquote",
        content: children.length > 0 ? children : [{ type: "paragraph" }],
      };
    }

    case "image":
      return {
        type: SOSB_IMAGE_NODE,
        attrs: {
          asset: any.asset ?? null,
          caption: typeof any.caption === "string" ? any.caption : "",
        },
      };

    default:
      return null;
  }
}

function childrenToPm(content: readonly RichTextNode[] | undefined): PmNode[] {
  if (content === undefined) return [];
  return content.map(nodeToPm).filter((node): node is PmNode => node !== null);
}

function markToPm(mark: RichTextMark): PmMark {
  if (mark.type === "link") {
    return {
      type: SOSB_LINK_MARK,
      attrs: { target: (mark as { target?: RichTextLinkTarget }).target ?? null },
    };
  }
  return { type: mark.type };
}

// ---------------------------------------------------------------------------
// ProseMirror → stored document
// ---------------------------------------------------------------------------

export function proseMirrorToDoc(pm: ProseMirrorDoc | undefined): RichTextDocument {
  const content = (pm?.content ?? [])
    .map(nodeFromPm)
    .filter((node): node is RichTextNode => node !== null);
  return { version: RICH_TEXT_DOC_VERSION, content: dropTrailingEmptyParagraphs(content) };
}

/**
 * Tiptap's `trailingNode` extension keeps an empty paragraph at the end of
 * the document so there is always somewhere to click after a block-level
 * node like an image. That paragraph is editing affordance, not content:
 * storing it would put a stray `<p></p>` at the bottom of every published
 * section. Only *trailing* empties are dropped — a blank paragraph the
 * author deliberately left between two others is still theirs.
 */
function dropTrailingEmptyParagraphs(content: RichTextNode[]): RichTextNode[] {
  let end = content.length;
  while (end > 0) {
    const node = content[end - 1] as { type: string; content?: unknown[]; align?: unknown };
    const isEmptyParagraph =
      node.type === "paragraph" &&
      (node.content === undefined || node.content.length === 0) &&
      node.align === undefined;
    if (!isEmptyParagraph) break;
    end -= 1;
  }
  return end === content.length ? content : content.slice(0, end);
}

function nodeFromPm(node: PmNode): RichTextNode | null {
  const attrs = node.attrs ?? {};

  switch (node.type) {
    case "text": {
      const text = typeof node.text === "string" ? node.text : "";
      if (text.length === 0) return null;
      const marks = (node.marks ?? []).map(markFromPm).filter((m): m is RichTextMark => m !== null);
      return (
        marks.length > 0 ? { type: "text", text, marks } : { type: "text", text }
      ) as unknown as RichTextNode;
    }

    case "hardBreak":
      return { type: "hardBreak" } as unknown as RichTextNode;

    case "paragraph":
      return withAlign({ type: "paragraph", content: childrenFromPm(node.content) }, attrs["align"]);

    case "heading":
      return withAlign(
        {
          type: "heading",
          level: headingLevel(attrs["level"]),
          content: childrenFromPm(node.content),
        },
        attrs["align"],
      );

    case "bulletList":
      return { type: "bulletList", content: childrenFromPm(node.content) } as RichTextNode;

    case "orderedList": {
      const start = typeof attrs["start"] === "number" ? Math.trunc(attrs["start"]) : 1;
      const out: Record<string, unknown> = {
        type: "orderedList",
        content: childrenFromPm(node.content),
      };
      // Omit the default so documents stay minimal and diffable.
      if (start !== 1) out["start"] = start;
      return out as unknown as RichTextNode;
    }

    case "listItem":
      return { type: "listItem", content: childrenFromPm(node.content) } as RichTextNode;

    case "blockquote":
      return { type: "blockquote", content: childrenFromPm(node.content) } as RichTextNode;

    case SOSB_IMAGE_NODE: {
      const asset = attrs["asset"];
      if (typeof asset !== "object" || asset === null) return null;
      const caption = typeof attrs["caption"] === "string" ? attrs["caption"].trim() : "";
      const out: Record<string, unknown> = { type: "image", asset };
      if (caption !== "") out["caption"] = caption;
      return out as unknown as RichTextNode;
    }

    default:
      return null;
  }
}

function childrenFromPm(content: PmNode[] | undefined): RichTextNode[] {
  if (content === undefined) return [];
  return content.map(nodeFromPm).filter((node): node is RichTextNode => node !== null);
}

function markFromPm(mark: PmMark): RichTextMark | null {
  if (mark.type === SOSB_LINK_MARK) {
    const target = mark.attrs?.["target"];
    if (typeof target !== "object" || target === null) return null;
    return { type: "link", target: target as RichTextLinkTarget } as RichTextMark;
  }
  if (
    mark.type === "bold" ||
    mark.type === "italic" ||
    mark.type === "underline" ||
    mark.type === "strike" ||
    mark.type === "code"
  ) {
    return { type: mark.type } as RichTextMark;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function alignOrNull(value: unknown): RichTextAlignment | null {
  return value === "left" || value === "center" || value === "right" || value === "justify"
    ? value
    : null;
}

function withAlign(node: Record<string, unknown>, align: unknown): RichTextNode {
  const resolved = alignOrNull(align);
  if (resolved !== null) node["align"] = resolved;
  return node as unknown as RichTextNode;
}

function headingLevel(value: unknown): 2 | 3 | 4 {
  return value === 3 ? 3 : value === 4 ? 4 : 2;
}
