/**
 * Inline parser.
 *
 * Walks one line of markdown text and produces a string of HTML-escaped
 * output with the inline whitelist applied: bold (** **), italic (* * or
 * _ _), inline code (` `), and links ([text](url)).
 *
 * The output is *constructed* — we never substring-match raw HTML out of
 * the input. Every literal character that isn't part of a recognised
 * inline marker is fed through `escapeText` before going to the output
 * buffer. That is the load-bearing safety property: a `<script>` in the
 * input becomes `&lt;script&gt;` in the output, regardless of context.
 */

import { escapeText, escapeAttr } from "./escape.js";
import { sanitizeUrl } from "./sanitize-url.js";

export function renderInline(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i]!;

    // ---- Inline code: `code` ------------------------------------------
    if (ch === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1) {
        const code = text.slice(i + 1, close);
        out += "<code>" + escapeText(code) + "</code>";
        i = close + 1;
        continue;
      }
      // Unmatched backtick: render as literal.
      out += escapeText(ch);
      i++;
      continue;
    }

    // ---- Bold: **text** -----------------------------------------------
    if (ch === "*" && text[i + 1] === "*") {
      const close = findClosing(text, i + 2, "**");
      if (close !== -1) {
        const inner = text.slice(i + 2, close);
        out += "<strong>" + renderInline(inner) + "</strong>";
        i = close + 2;
        continue;
      }
    }

    // ---- Italic: *text* or _text_ -------------------------------------
    if (ch === "*" || ch === "_") {
      // For `*`, the closing `*` is the next single-`*` that is NOT part of
      // a `**` bold marker. Skip pairs while searching.
      const close = findClosingItalic(text, i + 1, ch);
      if (close !== -1 && close > i + 1) {
        const inner = text.slice(i + 1, close);
        out += "<em>" + renderInline(inner) + "</em>";
        i = close + 1;
        continue;
      }
    }

    // ---- Link: [text](url) -------------------------------------------
    if (ch === "[") {
      const link = parseLink(text, i);
      if (link !== null) {
        const safeUrl = sanitizeUrl(link.url);
        if (safeUrl !== null) {
          out += '<a href="' + escapeAttr(safeUrl) + '">' + renderInline(link.text) + "</a>";
        } else {
          // Unsafe URL — preserve the link text but drop the href.
          out += renderInline(link.text);
        }
        i = link.end;
        continue;
      }
    }

    // ---- Default: escape the character into the output buffer. -------
    out += escapeText(ch);
    i++;
  }

  return out;
}

/**
 * Find the index of the closing marker `marker` starting from `from`,
 * skipping over inline-code spans (where markdown markers are literal).
 * Returns -1 if no closing marker is found before end-of-line.
 */
function findClosing(text: string, from: number, marker: string): number {
  let i = from;
  while (i < text.length) {
    // Skip inline-code spans entirely.
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close === -1) return -1;
      i = close + 1;
      continue;
    }
    if (text.startsWith(marker, i)) return i;
    i++;
  }
  return -1;
}

/**
 * Like findClosing, but for italic (`*` or `_`): a closing marker is a
 * SINGLE delimiter not adjacent to another of the same kind. So in
 * `*a **b** c*`, the closing `*` for the outer italic is the trailing `*`
 * after `c`, not the `**` markers around `b`.
 */
function findClosingItalic(text: string, from: number, marker: string): number {
  let i = from;
  while (i < text.length) {
    // Skip inline-code spans entirely.
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close === -1) return -1;
      i = close + 1;
      continue;
    }
    if (text[i] === marker) {
      // Skip a `**` (or `__`) bold pair entirely.
      if (text[i + 1] === marker) {
        i += 2;
        continue;
      }
      return i;
    }
    i++;
  }
  return -1;
}

/**
 * Parse a link starting at `text[start]` (which must be `[`). Returns the
 * link's text, url, and the index just past the closing `)`. Returns null
 * if the link is malformed.
 *
 * Supports balanced brackets inside the link text — `[text [nested]]`.
 */
function parseLink(text: string, start: number): { text: string; url: string; end: number } | null {
  if (text[start] !== "[") return null;

  // Find the matching `]` allowing one level of bracket nesting.
  let i = start + 1;
  let depth = 1;
  while (i < text.length && depth > 0) {
    const c = text[i]!;
    if (c === "[") depth++;
    else if (c === "]") depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) return null;
  const closeBracket = i;

  // The next char must be `(`.
  if (text[closeBracket + 1] !== "(") return null;

  // Find the matching `)`.
  const closeParen = text.indexOf(")", closeBracket + 2);
  if (closeParen === -1) return null;

  const linkText = text.slice(start + 1, closeBracket);
  const url = text.slice(closeBracket + 2, closeParen);

  return { text: linkText, url, end: closeParen + 1 };
}
