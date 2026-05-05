/**
 * Block parser.
 *
 * Reads markdown line-by-line and groups runs of lines into block elements:
 * headings (h2-h4), unordered lists (- *), ordered lists (1.), blockquotes
 * (>), and paragraphs. Inline markup inside each block is delegated to
 * `renderInline`.
 *
 * The block grammar is intentionally tight; it implements only what the
 * PRD's whitelist allows. Anything else (h1, h5, h6, code fences, tables,
 * footnotes, raw HTML) falls through to paragraph text — escaped via
 * `escapeText` in the inline renderer.
 */

import { renderInline } from "./inline.js";

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const UL_RE = /^[*-]\s+(.*)$/;
const OL_RE = /^([0-9]+)\.\s+(.*)$/;
const BQ_RE = /^>\s?(.*)$/;
// h1 (single #), h5 (5x), h6 (6x) are explicitly out of the whitelist; we
// treat them as paragraph text so the output remains within the subset.
const REJECTED_HEADING_RE = /^(#|#{5,})\s+/;

export function renderBlocks(input: string): string {
  // Normalise newlines and trim trailing newline so we don't emit an empty
  // paragraph at the end.
  const normalised = input.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (normalised.trim().length === 0) return "";

  const lines = normalised.split("\n");
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Blank line: paragraph break, no output.
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // Heading h2-h4.
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch !== null) {
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!.trim();
      out.push("<h" + level + ">" + renderInline(text) + "</h" + level + ">");
      i++;
      continue;
    }

    // Rejected headings (h1, h5+) fall through to paragraph rendering so
    // they appear as literal text rather than disappearing or producing
    // out-of-whitelist markup.
    if (REJECTED_HEADING_RE.test(line)) {
      const para = collectParagraph(lines, i);
      out.push("<p>" + renderInline(para.text) + "</p>");
      i = para.next;
      continue;
    }

    // Unordered list.
    if (UL_RE.test(line)) {
      const list = collectList(lines, i, "ul");
      out.push(list.html);
      i = list.next;
      continue;
    }

    // Ordered list.
    if (OL_RE.test(line)) {
      const list = collectList(lines, i, "ol");
      out.push(list.html);
      i = list.next;
      continue;
    }

    // Blockquote.
    if (BQ_RE.test(line)) {
      const bq = collectBlockquote(lines, i);
      out.push(bq.html);
      i = bq.next;
      continue;
    }

    // Default: paragraph (consume contiguous non-blank, non-block lines).
    const para = collectParagraph(lines, i);
    out.push("<p>" + renderInline(para.text) + "</p>");
    i = para.next;
  }

  return out.join("\n");
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
): { html: string; next: number } {
  const re = kind === "ul" ? UL_RE : OL_RE;
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = re.exec(line);
    if (m === null) break;
    const itemText = (kind === "ul" ? m[1] : m[2])!.trim();
    items.push("<li>" + renderInline(itemText) + "</li>");
    i++;
  }
  const html = "<" + kind + ">" + items.join("") + "</" + kind + ">";
  return { html, next: i };
}

function collectBlockquote(lines: string[], start: number): { html: string; next: number } {
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
  return { html: "<blockquote><p>" + renderInline(inner) + "</p></blockquote>", next: i };
}
