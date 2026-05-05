/**
 * `@sosb/markdown` — strict-whitelist sanitised markdown.
 *
 * Used by richText (#9), faq (#16), and quote (#13) blocks. Tracking issue: #9.
 *
 * The PRD pins this module to a fixed subset of CommonMark:
 *
 *   bold (`**text**`), italic (`*text*` / `_text_`), inline code (`` `code` ``),
 *   links (`[text](url)`) restricted to http(s) / mailto / tel / relative,
 *   unordered lists (`- ` or `* `), ordered lists (`1. `), headings h2-h4
 *   (`## ` / `### ` / `#### `), and blockquotes (`> `).
 *
 * Anything outside this whitelist — raw HTML, h1, h5/h6, code fences,
 * tables, images, footnotes, definition lists — is escaped or stripped.
 * The output is built tag-by-tag from a typed walker; raw HTML is never
 * round-tripped, so a `<script>` in the input becomes `&lt;script&gt;` in
 * the output regardless of context. That is the load-bearing safety
 * property: XSS-safe by construction, not by post-hoc sanitisation.
 *
 * The function returns inner HTML (a sequence of block elements). The
 * caller wraps the output in its own block-level container — `<div
 * class="rich-text">…</div>` for the richText block, etc.
 */

export { markdownToHtml } from "./md.js";
export { renderInline as markdownInlineToHtml } from "./inline.js";
export { sanitizeUrl } from "./sanitize-url.js";
export { escapeText, escapeAttr } from "./escape.js";
