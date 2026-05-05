/**
 * Top-level markdown-to-HTML entry point.
 *
 * The renderer is a thin wrapper over `renderBlocks`: split the input into
 * blocks, apply inline parsing per block, return the concatenated HTML.
 *
 * The function returns inner HTML — a sequence of `<p>`, `<h2>`, `<ul>`,
 * `<ol>`, `<blockquote>` elements. The caller wraps the output in its own
 * container element (e.g. `<div class="rich-text">…</div>` for the
 * richText block). The output never contains `<script>`, `<iframe>`, or
 * any element outside the whitelist; raw HTML in the input is escaped via
 * `escapeText`.
 */

import { renderBlocks } from "./block.js";

export function markdownToHtml(input: string): string {
  if (typeof input !== "string") return "";
  return renderBlocks(input);
}
