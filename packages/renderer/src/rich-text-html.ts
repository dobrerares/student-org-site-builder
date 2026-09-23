/**
 * Rich-text document → HTML.
 *
 * The single serialiser for ADR 0048 documents. It is a plain string
 * function, not a Preact component, for three reasons: the legacy Markdown
 * renderer it must reproduce byte-for-byte is also a string function; mark
 * nesting is a stack problem that reads badly as JSX; and the `richText`
 * Block has always handed its inner HTML to `dangerouslySetInnerHTML`, so
 * there is no DOM-diffing benefit to pay for.
 *
 * Safety is by construction, exactly as in `@sosb/markdown`: output is built
 * tag by tag, every text value goes through `escapeText`, every attribute
 * through `escapeAttr`, and every link href through `sanitizeUrl`.
 * Structured storage does not make imported content trusted (issue #100).
 *
 * Determinism (ADR 0032): no clock, no randomness, no environment reads.
 * Identical `(doc, context)` produces identical bytes in Node and browser.
 */

import { escapeAttr, escapeText, sanitizeUrl } from "@sosb/markdown";
import {
  RICH_TEXT_ALIGNMENTS,
  isKnownRichTextMarkType,
  type RichTextDocument,
  type RichTextLinkTarget,
  type RichTextMark,
  type RichTextNode,
} from "@sosb/schema";

/**
 * How the host resolves a stored link target to a URL at render time.
 *
 * Returning `null` means "this target no longer resolves". Per ADR 0048 the
 * document keeps the reference for repair while the output degrades to
 * unlinked text — so a broken link never removes the author's words, and it
 * never emits a dead `href` either.
 */
export type RichTextLinkResolver = (target: RichTextLinkTarget) => string | null;

export interface RichTextRenderContext {
  /**
   * Maps a canonical `assets/…` VFS path to a URL for this page: a `blob:`
   * URL in the editor preview, a depth-prefixed relative path in a build.
   * Same resolver every other image-bearing Block receives.
   */
  readonly assetUrlForPath?: ((path: string) => string | undefined) | undefined;
  readonly resolveLink?: RichTextLinkResolver | undefined;
}

/**
 * Serialise a document to inner HTML — a sequence of block elements, with no
 * wrapping container. The caller supplies `<div class="rich-text">`, matching
 * `markdownToHtml`'s contract so the two are drop-in comparable.
 */
export function renderRichTextDocToHtml(
  doc: RichTextDocument | undefined,
  context: RichTextRenderContext = {},
): string {
  if (doc === undefined || !Array.isArray(doc.content)) return "";
  return serializeBlocks(doc.content, context, "\n");
}

function serializeBlocks(
  nodes: readonly RichTextNode[] | undefined,
  ctx: RichTextRenderContext,
  separator: string,
): string {
  if (nodes === undefined) return "";
  const parts: string[] = [];
  for (const node of nodes) {
    const html = serializeBlock(node, ctx);
    if (html !== "") parts.push(html);
  }
  return parts.join(separator);
}

function serializeBlock(node: RichTextNode, ctx: RichTextRenderContext): string {
  const anyNode = node as {
    type: string;
    level?: unknown;
    align?: unknown;
    start?: unknown;
    caption?: unknown;
    asset?: unknown;
    content?: readonly RichTextNode[];
  };

  switch (anyNode.type) {
    case "paragraph":
      return `<p${alignAttr(anyNode.align)}>${serializeInline(anyNode.content, ctx)}</p>`;

    case "heading": {
      // Levels outside h2–h4 cannot reach here through the schema, but a
      // hand-edited project file could. Clamp rather than emit an `<h1>`
      // that would compete with the page shell's heading (ADR 0034).
      const raw = typeof anyNode.level === "number" ? anyNode.level : 2;
      const level = raw < 2 ? 2 : raw > 4 ? 4 : Math.trunc(raw);
      return `<h${level}${alignAttr(anyNode.align)}>${serializeInline(anyNode.content, ctx)}</h${level}>`;
    }

    case "bulletList":
      return `<ul>${serializeBlocks(anyNode.content, ctx, "")}</ul>`;

    case "orderedList": {
      const start = typeof anyNode.start === "number" ? Math.trunc(anyNode.start) : 1;
      const startAttr = start === 1 ? "" : ` start="${escapeAttr(String(start))}"`;
      return `<ol${startAttr}>${serializeBlocks(anyNode.content, ctx, "")}</ol>`;
    }

    case "listItem": {
      // Tight lists: a list item holding exactly one plain paragraph emits
      // its inline content directly, with no wrapping `<p>`. This is what
      // the legacy Markdown renderer produced, so migrated lists stay
      // byte-identical, and it is the conventional HTML for a tight list.
      const children = anyNode.content ?? [];
      const only =
        children.length === 1
          ? (children[0] as { type: string; align?: unknown; content?: readonly RichTextNode[] })
          : undefined;
      if (only !== undefined && only.type === "paragraph" && only.align === undefined) {
        return `<li>${serializeInline(only.content, ctx)}</li>`;
      }
      return `<li>${serializeBlocks(children, ctx, "\n")}</li>`;
    }

    case "blockquote":
      return `<blockquote>${serializeBlocks(anyNode.content, ctx, "\n")}</blockquote>`;

    case "image":
      return serializeImage(anyNode.asset, anyNode.caption, ctx);

    // Inline nodes can only be reached here if a document nests them where a
    // block was expected. Serialise them inline rather than dropping words.
    case "text":
    case "hardBreak":
      return serializeInline([node], ctx);

    default:
      return serializeUnsupported(anyNode.type, "div");
  }
}

/**
 * Only the four alignments the document vocabulary defines are emitted. The
 * schema already limits the value, but a hand-edited file bypasses it, and
 * the theme CSS has rules for exactly these four — anything else would be an
 * attribute nothing reads.
 */
function alignAttr(align: unknown): string {
  return typeof align === "string" && (RICH_TEXT_ALIGNMENTS as readonly string[]).includes(align)
    ? ` data-align="${escapeAttr(align)}"`
    : "";
}

function serializeImage(asset: unknown, caption: unknown, ctx: RichTextRenderContext): string {
  if (typeof asset !== "object" || asset === null) return "";
  const ref = asset as {
    path?: unknown;
    alt?: unknown;
    width?: unknown;
    height?: unknown;
  };
  if (typeof ref.path !== "string" || ref.path.length === 0) return "";

  const src = ctx.assetUrlForPath?.(ref.path) ?? ref.path;
  const alt = typeof ref.alt === "string" ? ref.alt : "";
  const dims =
    typeof ref.width === "number" &&
    ref.width > 0 &&
    typeof ref.height === "number" &&
    ref.height > 0
      ? ` width="${escapeAttr(String(Math.trunc(ref.width)))}" height="${escapeAttr(String(Math.trunc(ref.height)))}"`
      : "";

  const img =
    `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${dims}` +
    ` loading="lazy" decoding="async" />`;

  const captionText = typeof caption === "string" ? caption.trim() : "";
  const figcaption =
    captionText === "" ? "" : `<figcaption>${escapeText(captionText)}</figcaption>`;
  return `<figure class="rich-text-figure">${img}${figcaption}</figure>`;
}

/**
 * Unsupported content never reaches public output — it is a non-overridable
 * export blocker (ADR 0048). What it does reach is the editor preview, where
 * an author needs to see *that* something is there without the Renderer
 * inventing a rendering for content it does not understand. An empty,
 * labelled placeholder is the honest answer.
 */
function serializeUnsupported(type: string, tag: "div" | "span"): string {
  return `<${tag} class="rich-text-unsupported" data-unsupported-type="${escapeAttr(type)}"></${tag}>`;
}

// ---------------------------------------------------------------------------
// Inline serialisation
// ---------------------------------------------------------------------------

/**
 * Emit inline nodes, opening and closing mark elements around runs that share
 * a mark prefix.
 *
 * Marks are stored outermost-first, so two adjacent text nodes whose mark
 * arrays share a prefix stay inside one set of elements: `[bold]` then
 * `[bold, italic]` emits `<strong>a<em>b</em></strong>`, not
 * `<strong>a</strong><strong><em>b</em></strong>`. That grouping is what
 * makes migrated Markdown reproduce the legacy renderer exactly.
 */
function serializeInline(
  nodes: readonly RichTextNode[] | undefined,
  ctx: RichTextRenderContext,
): string {
  if (nodes === undefined || nodes.length === 0) return "";

  let out = "";
  let open: ResolvedMark[] = [];

  for (const node of nodes) {
    const anyNode = node as { type: string; text?: unknown; marks?: readonly RichTextMark[] };
    if (anyNode.type !== "text" && anyNode.type !== "hardBreak") {
      // Anything that cannot be rendered inline — an unknown inline node, or
      // a block-level node the schema would refuse here (a hand-edited file
      // can put an image inside a paragraph). Either way an empty labelled
      // placeholder is emitted rather than nothing, so the omission is
      // visible in the preview instead of silent. Close everything first so
      // the placeholder is not nested inside a half-open `<strong>`, and use
      // a `<span>`: a `<div>` inside a `<p>` is not valid HTML, and the
      // browser would close the paragraph early, so the preview's DOM would
      // no longer match the string the Renderer produced.
      out += closeAll(open);
      open = [];
      out += serializeUnsupported(anyNode.type, "span");
      continue;
    }

    const marks = resolveMarks(anyNode.marks, ctx);
    const text = anyNode.type === "hardBreak" ? "" : String(anyNode.text ?? "");

    // A zero-length text node never merges with its neighbours. It exists
    // only to carry a mark whose content is empty — `****`, or the empty
    // span between two adjacent backticks — and the legacy renderer emits
    // each of those as its own element. Merging them would turn
    // `<code></code><code>x</code>` into `<code>x</code>`.
    const standalone = anyNode.type === "text" && text.length === 0;
    const shared = standalone ? 0 : commonPrefixLength(open, marks);

    for (let i = open.length - 1; i >= shared; i -= 1) out += closeTag(open[i]!);
    for (let i = shared; i < marks.length; i += 1) out += openTag(marks[i]!);

    out += anyNode.type === "hardBreak" ? "<br />" : escapeText(text);

    if (standalone) {
      for (let i = marks.length - 1; i >= 0; i -= 1) out += closeTag(marks[i]!);
      open = [];
    } else {
      open = marks;
    }
  }

  return out + closeAll(open);
}

function closeAll(open: readonly ResolvedMark[]): string {
  let out = "";
  for (let i = open.length - 1; i >= 0; i -= 1) out += closeTag(open[i]!);
  return out;
}

/** A mark that has already been resolved to the element it will emit. */
type ResolvedMark =
  | { readonly tag: "strong" | "em" | "u" | "s" | "code" }
  | { readonly tag: "a"; readonly href: string };

/**
 * Drop marks this version does not understand and link marks whose target no
 * longer resolves or whose URL fails the sanitiser. Dropping rather than
 * failing is the ADR 0048 contract: broken links render as unlinked text.
 */
function resolveMarks(
  marks: readonly RichTextMark[] | undefined,
  ctx: RichTextRenderContext,
): ResolvedMark[] {
  if (marks === undefined) return [];
  const out: ResolvedMark[] = [];
  for (const mark of marks) {
    if (!isKnownRichTextMarkType(mark.type)) continue;
    switch (mark.type) {
      case "bold":
        out.push({ tag: "strong" });
        break;
      case "italic":
        out.push({ tag: "em" });
        break;
      case "underline":
        out.push({ tag: "u" });
        break;
      case "strike":
        out.push({ tag: "s" });
        break;
      case "code":
        out.push({ tag: "code" });
        break;
      case "link": {
        const target = (mark as { target?: RichTextLinkTarget }).target;
        if (target === undefined) break;
        const href = resolveHref(target, ctx);
        if (href === null) break;
        out.push({ tag: "a", href });
        break;
      }
    }
  }
  return out;
}

function resolveHref(target: RichTextLinkTarget, ctx: RichTextRenderContext): string | null {
  const raw =
    target.kind === "external"
      ? typeof target.href === "string"
        ? target.href
        : null
      : (ctx.resolveLink?.(target) ?? null);
  if (raw === null) return null;
  // External hrefs are re-sanitised here even though the schema checked them
  // on the way in: a project file can be hand-edited, and the Renderer is the
  // last gate before bytes reach a browser.
  return sanitizeUrl(raw);
}

function markKey(mark: ResolvedMark): string {
  return mark.tag === "a" ? `a:${mark.href}` : mark.tag;
}

function commonPrefixLength(a: readonly ResolvedMark[], b: readonly ResolvedMark[]): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && markKey(a[i]!) === markKey(b[i]!)) i += 1;
  return i;
}

function openTag(mark: ResolvedMark): string {
  return mark.tag === "a" ? `<a href="${escapeAttr(mark.href)}">` : `<${mark.tag}>`;
}

function closeTag(mark: ResolvedMark): string {
  return `</${mark.tag}>`;
}
