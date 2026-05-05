import type { Config } from "dompurify";

/**
 * Strict-policy DOMPurify configuration shared by browser and Node sanitizers.
 *
 * Rationale (see ADR 0006): DOMPurify is the established, audited XSS
 * sanitizer used by ProseMirror, Quill, MDX, and dozens of other major
 * projects. It is regularly fuzz-tested by Cure53 and ships with a
 * conservative default allow-list that we tighten further here.
 *
 * Policy choices:
 *  - `USE_PROFILES: { html: true }` — start from DOMPurify's curated HTML
 *    safe-list (paragraphs, headings, lists, links, basic inline tags,
 *    images, tables) and exclude SVG / MathML by default.
 *  - `FORBID_TAGS`: explicitly remove tags that DOMPurify might otherwise
 *    keep but which our policy disallows for an escape-hatch block —
 *    `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<button>`,
 *    `<style>`, `<svg>` (defensive), `<math>` (defensive). Embeds and forms
 *    are out of scope for v1's customHTML; the curated `embed` block (#16)
 *    handles trusted iframe providers via a separate whitelist.
 *  - `FORBID_ATTR`: strip every `on*` event handler attribute. DOMPurify
 *    does this by default; we restate it here for explicitness.
 *  - `ALLOW_DATA_ATTR: false` — power users do not need data-* on raw HTML.
 *  - `KEEP_CONTENT: true` — preserve text content of stripped tags so the
 *    user's prose is not silently dropped.
 *  - `RETURN_TRUSTED_TYPE: false` — return a string, not a TrustedHTML.
 */
export const SANITIZE_CONFIG: Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["iframe", "object", "embed", "form", "input", "button", "style", "svg", "math"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};
