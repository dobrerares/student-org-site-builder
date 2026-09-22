/**
 * Legacy Markdown → structured Rich-text document converter (ADR 0048).
 *
 * This is the load-time migration path for version 1 Rich-text Blocks. Its
 * contract, from issue #100, is stronger than "reasonable conversion":
 *
 *   > Legacy conversion preserves the current Markdown renderer's displayed
 *   > meaning, including unsupported syntax rendered as literal text.
 *
 * The implementation therefore mirrors `block.ts` and `inline.ts` grammar
 * rule for grammar rule — same regexes, same precedence, same fall-through to
 * paragraph text for anything outside the ADR 0034 whitelist, and the same
 * `sanitizeUrl` gate on link targets. It reuses `inline.ts`'s scanning
 * helpers directly so the two paths cannot drift on delimiter matching.
 *
 * The proof that they agree is in `packages/renderer/test/markdown-migration-
 * golden.test.ts`: for every Markdown fixture in the repo *and* the whole XSS
 * corpus, `renderRichTextDocToHtml(markdownToRichTextDoc(md))` must equal
 * `markdownToHtml(md)` byte for byte.
 *
 * Two deliberate structural notes:
 *
 * - **Marks are outermost-first.** `**[a](u)**` yields marks
 *   `[{bold},{link}]` and `[**a**](u)` yields `[{link},{bold}]`. Preserving
 *   the authored nesting order is what makes byte-exact parity achievable;
 *   a canonical mark order could not reproduce both.
 * - **One known, deliberate deviation.** Two *adjacent, non-empty* Markdown
 *   constructs carrying the same mark — `**a****b**` — merge into a single
 *   element (`<strong>ab</strong>`) where the legacy renderer emitted two
 *   (`<strong>a</strong><strong>b</strong>`). The flat document format has no
 *   way to distinguish them, and the rendered result is visually identical,
 *   so this is accepted rather than worked around. Empty spans do *not*
 *   merge; see `renderRichTextDocToHtml`.
 * - **Empty emphasis yields an empty text node.** `****` renders as
 *   `<strong></strong>` today, so the converter emits a zero-length text node
 *   carrying the mark rather than dropping it. The editor discards empty text
 *   nodes when it loads a document, so this only survives in content nobody
 *   has edited since the migration.
 *
 * This module does not import `@sosb/schema` — `@sosb/schema` imports *it*,
 * for the migration table. The types below are structural mirrors of
 * `RichTextDocument` and are checked against the real schema in
 * `packages/schema/test/richtext-migration.test.ts`.
 */

import { findClosing, findClosingItalic, parseLink } from "./inline.js";
import { sanitizeUrl } from "./sanitize-url.js";

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const UL_RE = /^[*-]\s+(.*)$/;
const OL_RE = /^([0-9]+)\.\s+(.*)$/;
const BQ_RE = /^>\s?(.*)$/;
const REJECTED_HEADING_RE = /^(#|#{5,})\s+/;

export interface DocLinkTarget {
  readonly kind: "external";
  readonly href: string;
}

export type DocMark =
  | { readonly type: "bold" | "italic" | "underline" | "strike" | "code" }
  | { readonly type: "link"; readonly target: DocLinkTarget };

export interface DocTextNode {
  readonly type: "text";
  readonly text: string;
  readonly marks?: DocMark[];
}

export interface DocNode {
  readonly type: string;
  readonly level?: number;
  readonly text?: string;
  readonly marks?: DocMark[];
  readonly content?: DocNode[];
}

export interface RichTextDocumentLike {
  readonly version: 1;
  readonly content: DocNode[];
}

/**
 * Convert one legacy `markdown` string into a version 1 Rich-text document.
 * Non-string input and whitespace-only input both produce an empty document,
 * matching `markdownToHtml`'s `""` return.
 */
export function markdownToRichTextDoc(input: unknown): RichTextDocumentLike {
  if (typeof input !== "string") return { version: 1, content: [] };
  return { version: 1, content: parseBlocks(input) };
}

/** Block grammar. A structural mirror of `renderBlocks` in `block.ts`. */
export function parseBlocks(input: string): DocNode[] {
  const normalised = input.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (normalised.trim().length === 0) return [];

  const lines = normalised.split("\n");
  const out: DocNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim().length === 0) {
      i++;
      continue;
    }

    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch !== null) {
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!.trim();
      out.push({ type: "heading", level, content: parseInline(text) });
      i++;
      continue;
    }

    if (REJECTED_HEADING_RE.test(line)) {
      const para = collectParagraph(lines, i);
      out.push({ type: "paragraph", content: parseInline(para.text) });
      i = para.next;
      continue;
    }

    if (UL_RE.test(line)) {
      const list = collectList(lines, i, "ul");
      out.push(list.node);
      i = list.next;
      continue;
    }

    if (OL_RE.test(line)) {
      const list = collectList(lines, i, "ol");
      out.push(list.node);
      i = list.next;
      continue;
    }

    if (BQ_RE.test(line)) {
      const bq = collectBlockquote(lines, i);
      out.push(bq.node);
      i = bq.next;
      continue;
    }

    const para = collectParagraph(lines, i);
    out.push({ type: "paragraph", content: parseInline(para.text) });
    i = para.next;
  }

  return out;
}

function collectParagraph(lines: string[], start: number): { text: string; next: number } {
  const buf: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim().length === 0) break;
    if (HEADING_RE.test(line)) break;
    if (REJECTED_HEADING_RE.test(line) && i !== start) break;
    if (UL_RE.test(line)) break;
    if (OL_RE.test(line)) break;
    if (BQ_RE.test(line)) break;
    buf.push(line);
    i++;
  }
  return { text: buf.join(" ").trim(), next: i };
}

function collectList(
  lines: string[],
  start: number,
  kind: "ul" | "ol",
): { node: DocNode; next: number } {
  const re = kind === "ul" ? UL_RE : OL_RE;
  const items: DocNode[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = re.exec(line);
    if (m === null) break;
    const itemText = (kind === "ul" ? m[1] : m[2])!.trim();
    // A list item's content is a paragraph, matching the document vocabulary
    // (`listItem` holds Block nodes). The serialiser suppresses the wrapping
    // `<p>` for a single-paragraph item so the emitted `<li>` stays identical
    // to the legacy renderer's.
    items.push({
      type: "listItem",
      content: [{ type: "paragraph", content: parseInline(itemText) }],
    });
    i++;
  }
  return { node: { type: kind === "ul" ? "bulletList" : "orderedList", content: items }, next: i };
}

function collectBlockquote(lines: string[], start: number): { node: DocNode; next: number } {
  const buf: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = BQ_RE.exec(line);
    if (m === null) break;
    buf.push(m[1]!);
    i++;
  }
  const inner = buf.join(" ").trim();
  return {
    node: { type: "blockquote", content: [{ type: "paragraph", content: parseInline(inner) }] },
    next: i,
  };
}

/**
 * Inline grammar. A structural mirror of `renderInline` in `inline.ts`,
 * emitting text nodes with ordered mark stacks instead of an HTML string.
 */
export function parseInline(text: string): DocNode[] {
  const out: DocNode[] = [];
  emitInline(text, [], out);
  return out;
}

function emitInline(text: string, marks: readonly DocMark[], out: DocNode[]): void {
  let buffer = "";
  let i = 0;
  const n = text.length;

  const flush = (): void => {
    if (buffer.length === 0) return;
    out.push(textNode(buffer, marks));
    buffer = "";
  };

  while (i < n) {
    const ch = text[i]!;

    // ---- Inline code: `code` ------------------------------------------
    if (ch === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1) {
        flush();
        // Code content is literal — `inline.ts` escapes it without recursing.
        out.push(textNode(text.slice(i + 1, close), [...marks, { type: "code" }]));
        i = close + 1;
        continue;
      }
      buffer += ch;
      i++;
      continue;
    }

    // ---- Bold: **text** -----------------------------------------------
    if (ch === "*" && text[i + 1] === "*") {
      const close = findClosing(text, i + 2, "**");
      if (close !== -1) {
        flush();
        emitNested(text.slice(i + 2, close), [...marks, { type: "bold" }], out);
        i = close + 2;
        continue;
      }
    }

    // ---- Italic: *text* or _text_ -------------------------------------
    if (ch === "*" || ch === "_") {
      const close = findClosingItalic(text, i + 1, ch);
      if (close !== -1 && close > i + 1) {
        flush();
        emitNested(text.slice(i + 1, close), [...marks, { type: "italic" }], out);
        i = close + 1;
        continue;
      }
    }

    // ---- Link: [text](url) -------------------------------------------
    if (ch === "[") {
      const link = parseLink(text, i);
      if (link !== null) {
        flush();
        const safeUrl = sanitizeUrl(link.url);
        if (safeUrl !== null) {
          // Legacy Markdown has no way to express a Page or Article target,
          // so every migrated link is external. Root-relative hrefs that used
          // to point at a Page stay literal paths: converting them to Page
          // ids would change displayed meaning when the path does not resolve.
          emitNested(
            link.text,
            [...marks, { type: "link", target: { kind: "external", href: safeUrl } }],
            out,
          );
        } else {
          // Unsafe URL — the legacy renderer keeps the text and drops the
          // href, so the document keeps the text and carries no link mark.
          emitNested(link.text, marks, out);
        }
        i = link.end;
        continue;
      }
    }

    buffer += ch;
    i++;
  }

  flush();
}

/**
 * Recurse into an emphasis/link body. If the body produces nothing, emit a
 * zero-length text node so the mark still round-trips to `<strong></strong>`
 * / `<a href="…"></a>` exactly as the legacy renderer does.
 */
function emitNested(inner: string, marks: readonly DocMark[], out: DocNode[]): void {
  const before = out.length;
  emitInline(inner, marks, out);
  if (out.length === before) out.push(textNode("", marks));
}

function textNode(text: string, marks: readonly DocMark[]): DocTextNode {
  return marks.length === 0 ? { type: "text", text } : { type: "text", text, marks: [...marks] };
}
