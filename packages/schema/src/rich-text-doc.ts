import { z } from "zod";
import { sanitizeUrl } from "@sosb/markdown";

/**
 * Structured Rich-text document (ADR 0048, issue #100).
 *
 * This is the *storage* contract for Rich-text Block content. It is
 * deliberately independent of the editing library: Tiptap/ProseMirror is an
 * implementation detail of `@sosb/editor-app`, and the public Renderer never
 * loads it. The vocabulary below is the whole supported surface; anything
 * else that arrives in a project file is preserved verbatim as an *unknown
 * node* or *unknown mark* (see `RichTextUnknownNodeSchema`) rather than being
 * simplified away.
 *
 * "Unknown" means a `type` this version has no schema for. A node whose type
 * *is* known but whose shape is wrong — a heading at level 7, an image with
 * no asset, a link with an unusable address — is not unknown content; it is
 * a malformed document, and it fails to parse like any other malformed Block
 * data (ADR 0002: schema violations are errors). The fallbacks below are
 * therefore restricted to unknown types on purpose, so a hand-edited mistake
 * surfaces in Site Health instead of rendering as nothing.
 *
 * Three properties the rest of the system leans on:
 *
 * 1. **Versioned.** `version` is a document-level integer, separate from the
 *    Block envelope's `version`, so the document vocabulary can evolve
 *    without forcing a Block migration and vice versa.
 * 2. **Identity, not URLs.** Internal links store a Page id or an Article id,
 *    never a rendered path, so a slug change cannot break them. Resolution to
 *    a URL happens at render time (`@sosb/renderer`).
 * 3. **Assets by reference.** Images carry the same structural asset
 *    reference every other Block uses, so the asset pipeline, archive
 *    round-trip and oversized-image rules apply unchanged.
 *
 * Ordering is load-bearing in two places, both because HTML nesting is:
 * `content` arrays are document order, and a text node's `marks` array is
 * outermost-first. `[{bold},{link}]` serialises to
 * `<strong><a …>…</a></strong>`; the reverse array gives the reverse nesting.
 * The Markdown migration relies on this to reproduce the legacy renderer's
 * exact output.
 */

export const RICH_TEXT_DOC_VERSION = 1 as const;

export const RICH_TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type RichTextAlignment = (typeof RICH_TEXT_ALIGNMENTS)[number];
const RichTextAlignmentSchema = z.enum(RICH_TEXT_ALIGNMENTS);

/** Headings start at h2: the page shell owns the single `<h1>` (ADR 0034). */
export const RICH_TEXT_HEADING_LEVELS = [2, 3, 4] as const;
export type RichTextHeadingLevel = (typeof RICH_TEXT_HEADING_LEVELS)[number];

// ---------------------------------------------------------------------------
// Link targets
// ---------------------------------------------------------------------------

/**
 * Where a prose link points. A discriminated union rather than a bare string
 * because the whole point of issue #100's link contract is that internal
 * targets survive a slug rename: we store *who* the target is, and the
 * Renderer works out *where* it currently lives.
 *
 * A target that no longer resolves is not an error in the document — the
 * reference is retained so the author can repair it — it becomes a Site
 * Health warning and renders as unlinked text.
 */
export const RichTextExternalLinkSchema = z.looseObject({
  kind: z.literal("external"),
  /**
   * Exactly what the Renderer will put on an `href`: http(s), mailto, tel,
   * and relative paths or fragments (`/despre/`, `./x`, `#sus`). This is the
   * Renderer's own sanitiser rather than the stricter rule the link dialog
   * applies to typed input, because the schema's question is "does this
   * render as a link", and migrated Markdown such as `[x](#top)` must keep
   * rendering exactly as it did. Unsafe schemes are rejected here *and*
   * re-checked by the Renderer — structured storage does not make imported
   * content trusted.
   */
  href: z.string().refine((href) => sanitizeUrl(href) !== null, {
    message: "Link address must be a web, email or telephone address, or a path on this site.",
  }),
});

export const RichTextPageLinkSchema = z.looseObject({
  kind: z.literal("page"),
  /** `Page.id` — permanent, never derived from the slug. */
  pageId: z.string().min(1),
});

export const RichTextArticleLinkSchema = z.looseObject({
  kind: z.literal("article"),
  /** `Article.id` (issue #97). */
  articleId: z.string().min(1),
});

export const RichTextLinkTargetSchema = z.discriminatedUnion("kind", [
  RichTextExternalLinkSchema,
  RichTextPageLinkSchema,
  RichTextArticleLinkSchema,
]);

export type RichTextLinkTarget = z.infer<typeof RichTextLinkTargetSchema>;

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

export const RICH_TEXT_SIMPLE_MARKS = ["bold", "italic", "underline", "strike", "code"] as const;
export type RichTextSimpleMarkType = (typeof RICH_TEXT_SIMPLE_MARKS)[number];

const RichTextSimpleMarkSchema = z.looseObject({
  type: z.enum(RICH_TEXT_SIMPLE_MARKS),
});

export const RichTextLinkMarkSchema = z.looseObject({
  type: z.literal("link"),
  target: RichTextLinkTargetSchema,
});

/**
 * A mark whose type this version does not understand. Preserved verbatim,
 * reported by `collectUnsupportedRichText`, never simplified (ADR 0048). The
 * refinement keeps a *malformed* known mark — a link with an unusable
 * address — from slipping through as if it were unknown.
 */
export const RichTextUnknownMarkSchema = z.looseObject({
  type: z
    .string()
    .min(1)
    .refine((type) => !isKnownRichTextMarkType(type), {
      message: "A known mark type must match its own schema.",
    }),
});

export const RichTextMarkSchema = z.union([
  RichTextLinkMarkSchema,
  RichTextSimpleMarkSchema,
  RichTextUnknownMarkSchema,
]);
export type RichTextMark = z.infer<typeof RichTextMarkSchema>;

/** Every mark type this version understands, for validation and the editor. */
export const RICH_TEXT_MARK_TYPES = [...RICH_TEXT_SIMPLE_MARKS, "link"] as const;

// ---------------------------------------------------------------------------
// Inline nodes
// ---------------------------------------------------------------------------

export const RichTextTextNodeSchema = z.looseObject({
  type: z.literal("text"),
  text: z.string(),
  /** Outermost-first. See the module docblock. */
  marks: z.array(RichTextMarkSchema).optional(),
});

export const RichTextHardBreakSchema = z.looseObject({
  type: z.literal("hardBreak"),
});

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * The image node's asset reference.
 *
 * Structurally the canonical `AssetRefSchema`, with one deliberate
 * relaxation: `alt` may be empty. The canonical schema's `min(1)` would turn
 * a missing image description into a *parse error*, and issue #100 is
 * explicit that a missing description is a warning (it must not make the
 * project unopenable or unsavable). The warning is raised as a rule in
 * `validate.ts` instead. This mirrors the existing `CtaBannerAssetRefSchema`
 * precedent.
 *
 * Declared here rather than imported so its reference identity is distinct:
 * `AssetRefSchema`'s identity drives the generated form's asset-picker
 * dispatch, and rich-text images are picked inside the rich-text editor, not
 * by a generated field.
 */
export const RichTextImageAssetSchema = z.looseObject({
  hash: z.string().min(1),
  path: z.string().min(1),
  metadataPath: z.string().min(1),
  mime: z.string().min(1),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  alt: z.string(),
});

export type RichTextImageAsset = z.infer<typeof RichTextImageAssetSchema>;

export const RichTextImageNodeSchema = z.looseObject({
  type: z.literal("image"),
  asset: RichTextImageAssetSchema,
  /** Optional visible caption, rendered inside the `<figure>`. */
  caption: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Block nodes
// ---------------------------------------------------------------------------

/**
 * Anything whose `type` this version does not recognise.
 *
 * `looseObject` keeps every property, so a document written by a newer editor
 * round-trips through this one byte-for-byte. Issue #100 forbids automatic
 * simplification: we preserve, mark the Block read-only in the editor, and
 * block public export until the vocabulary catches up.
 *
 * The refinement is what makes this a fallback for *unknown* content only: a
 * known type that failed its own schema must not be accepted here, or a
 * malformed document would parse cleanly and render as nothing.
 */
export const RichTextUnknownNodeSchema = z.looseObject({
  type: z
    .string()
    .min(1)
    .refine((type) => !isKnownRichTextNodeType(type), {
      message: "A known node type must match its own schema.",
    }),
});

export type RichTextUnknownNode = z.infer<typeof RichTextUnknownNodeSchema>;

export type RichTextInlineNode =
  | z.infer<typeof RichTextTextNodeSchema>
  | z.infer<typeof RichTextHardBreakSchema>
  | RichTextUnknownNode;

export type RichTextNode =
  | { type: "paragraph"; align?: RichTextAlignment; content?: RichTextInlineNode[] }
  | {
      type: "heading";
      level: RichTextHeadingLevel;
      align?: RichTextAlignment;
      content?: RichTextInlineNode[];
    }
  | { type: "bulletList"; content?: RichTextNode[] }
  | { type: "orderedList"; start?: number; content?: RichTextNode[] }
  | { type: "listItem"; content?: RichTextNode[] }
  | { type: "blockquote"; content?: RichTextNode[] }
  | z.infer<typeof RichTextImageNodeSchema>
  | RichTextUnknownNode;

const RichTextInlineNodeSchema: z.ZodType<RichTextInlineNode> = z.union([
  RichTextTextNodeSchema,
  RichTextHardBreakSchema,
  RichTextUnknownNodeSchema,
]) as z.ZodType<RichTextInlineNode>;

const RichTextParagraphSchema = z.looseObject({
  type: z.literal("paragraph"),
  align: RichTextAlignmentSchema.optional(),
  content: z.array(RichTextInlineNodeSchema).optional(),
});

const RichTextHeadingSchema = z.looseObject({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  align: RichTextAlignmentSchema.optional(),
  content: z.array(RichTextInlineNodeSchema).optional(),
});

const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.union([
    RichTextParagraphSchema,
    RichTextHeadingSchema,
    z.looseObject({
      type: z.literal("bulletList"),
      content: z.array(RichTextNodeSchema).optional(),
    }),
    z.looseObject({
      type: z.literal("orderedList"),
      start: z.number().int().optional(),
      content: z.array(RichTextNodeSchema).optional(),
    }),
    z.looseObject({
      type: z.literal("listItem"),
      content: z.array(RichTextNodeSchema).optional(),
    }),
    z.looseObject({
      type: z.literal("blockquote"),
      content: z.array(RichTextNodeSchema).optional(),
    }),
    RichTextImageNodeSchema,
    RichTextUnknownNodeSchema,
  ]),
) as z.ZodType<RichTextNode>;

export { RichTextNodeSchema, RichTextInlineNodeSchema };

/**
 * Block node types this version renders. Anything else is an unknown node.
 * Exported so `validate.ts` and the editor agree on one list.
 */
export const RICH_TEXT_BLOCK_NODE_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "image",
] as const;

export const RICH_TEXT_INLINE_NODE_TYPES = ["text", "hardBreak"] as const;

export const RICH_TEXT_NODE_TYPES = [
  ...RICH_TEXT_BLOCK_NODE_TYPES,
  ...RICH_TEXT_INLINE_NODE_TYPES,
] as const;

export function isKnownRichTextNodeType(type: string): boolean {
  return (RICH_TEXT_NODE_TYPES as readonly string[]).includes(type);
}

export function isKnownRichTextMarkType(type: string): boolean {
  return (RICH_TEXT_MARK_TYPES as readonly string[]).includes(type);
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const RichTextDocumentSchema = z.looseObject({
  version: z.literal(RICH_TEXT_DOC_VERSION),
  content: z.array(RichTextNodeSchema),
});

export type RichTextDocument = z.infer<typeof RichTextDocumentSchema>;

/** The document an empty Rich-text Block carries. */
export function emptyRichTextDocument(): RichTextDocument {
  return { version: RICH_TEXT_DOC_VERSION, content: [] };
}

/**
 * True when the document contains no rendered prose — no text, no image, no
 * preserved unknown node. Whitespace-only text counts as empty, matching the
 * legacy `markdown.trim()` emptiness check so the empty-state suppression in
 * the Renderer behaves identically before and after migration.
 */
export function isEmptyRichTextDocument(doc: RichTextDocument | undefined): boolean {
  if (doc === undefined) return true;
  return !hasVisibleContent(doc.content);
}

function hasVisibleContent(nodes: readonly RichTextNode[] | undefined): boolean {
  if (nodes === undefined) return false;
  for (const node of nodes) {
    if (node.type === "image") return true;
    if (node.type === "hardBreak") continue;
    if (node.type === "text") {
      if (typeof node.text === "string" && node.text.trim().length > 0) return true;
      continue;
    }
    if (!isKnownRichTextNodeType(node.type)) return true;
    const content = (node as { content?: readonly RichTextNode[] }).content;
    if (hasVisibleContent(content)) return true;
  }
  return false;
}

/**
 * Depth-first walk over every node in a document, yielding each node with the
 * `(string | number)[]` path from the document root. Used by validation and
 * by the editor's unsupported-content notice so both report the same
 * coordinates.
 */
export function* walkRichTextNodes(
  doc: RichTextDocument,
): Generator<{ node: RichTextNode; path: (string | number)[] }> {
  yield* walkNodes(doc.content, ["content"]);
}

function* walkNodes(
  nodes: readonly RichTextNode[] | undefined,
  base: (string | number)[],
): Generator<{ node: RichTextNode; path: (string | number)[] }> {
  if (nodes === undefined) return;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const path = [...base, i];
    yield { node, path };
    const content = (node as { content?: readonly RichTextNode[] }).content;
    yield* walkNodes(content, [...path, "content"]);
  }
}

/**
 * Every link target referenced by the document, with its path. Order is
 * document order so Site Health findings list in reading order.
 */
export function collectRichTextLinkTargets(
  doc: RichTextDocument,
): { target: RichTextLinkTarget; path: (string | number)[] }[] {
  const out: { target: RichTextLinkTarget; path: (string | number)[] }[] = [];
  for (const { node, path } of walkRichTextNodes(doc)) {
    if (node.type !== "text") continue;
    const marks = (node as { marks?: readonly RichTextMark[] }).marks;
    if (marks === undefined) continue;
    for (let m = 0; m < marks.length; m += 1) {
      const mark = marks[m]!;
      if (mark.type !== "link") continue;
      const target = (mark as { target?: unknown }).target;
      if (target === undefined || target === null) continue;
      out.push({
        target: target as RichTextLinkTarget,
        path: [...path, "marks", m, "target"],
      });
    }
  }
  return out;
}

/** Every image node in the document, with its path. */
export function collectRichTextImages(
  doc: RichTextDocument,
): { asset: RichTextImageAsset; path: (string | number)[] }[] {
  const out: { asset: RichTextImageAsset; path: (string | number)[] }[] = [];
  for (const { node, path } of walkRichTextNodes(doc)) {
    if (node.type !== "image") continue;
    const asset = (node as { asset?: unknown }).asset;
    if (typeof asset !== "object" || asset === null) continue;
    out.push({ asset: asset as RichTextImageAsset, path: [...path, "asset"] });
  }
  return out;
}

/**
 * Every node or mark whose type this version does not understand, with its
 * path and a human-facing label. Drives both the editor's read-only notice
 * and the non-overridable public-export blocker.
 */
export function collectUnsupportedRichText(
  doc: RichTextDocument,
): { type: string; path: (string | number)[] }[] {
  const out: { type: string; path: (string | number)[] }[] = [];
  for (const { node, path } of walkRichTextNodes(doc)) {
    if (!isKnownRichTextNodeType(node.type)) {
      out.push({ type: node.type, path });
      continue;
    }
    const marks = (node as { marks?: readonly RichTextMark[] }).marks;
    if (marks === undefined) continue;
    for (let m = 0; m < marks.length; m += 1) {
      const mark = marks[m]!;
      if (!isKnownRichTextMarkType(mark.type)) {
        out.push({ type: mark.type, path: [...path, "marks", m] });
      }
    }
  }
  return out;
}
