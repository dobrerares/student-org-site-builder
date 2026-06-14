/** @jsxImportSource preact */
import type { CustomHtmlBlock } from "@sosb/schema";
// Import via the package's own exports map so the `browser` / `node`
// conditions in `@sosb/renderer`'s `package.json` pick the right sanitizer
// implementation (browser-DOM vs JSDOM-backed). Inside-package self-imports
// like this are well-supported by Node, pnpm, and esbuild.
import { sanitizeCustomHtml } from "@sosb/renderer/internal/sanitize";

/**
 * customHTML block — power-user escape hatch.
 *
 * Per the PRD (User Stories 35-36, Implementation Decisions → Block library),
 * the customHTML block is the lone escape hatch for niche embed needs that the
 * curated block set does not cover. Security model:
 *
 *  - `sanitize: true` (default): the html string is run through DOMPurify with
 *    a strict allow-list. Scripts, on-* event handlers, javascript: URLs,
 *    `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, etc. are stripped
 *    so the rendered output is XSS-safe by construction.
 *  - `sanitize: false`: the html string is rendered byte-equal. The user has
 *    explicitly opted into "danger mode" via the editor's persistent warning
 *    UI — the renderer trusts that opt-in and does not editorialise the
 *    output. The published site is the user's intent verbatim.
 *
 * The block wrapper is structural: a `<section>` with `data-block` and
 * `data-block-id` attributes so theme CSS can target it without diluting the
 * power-user payload.
 *
 * Use of dangerouslySetInnerHTML here is intentional and audited per ADR 0006:
 *  - In sanitize-on mode, the html is the output of DOMPurify with a strict
 *    config; DOMPurify is the recommended XSS sanitizer in this codebase.
 *  - In sanitize-off mode, the user has explicitly opted in via a persistent
 *    editor warning. This is the documented escape hatch contract from the
 *    PRD's customHTML block.
 */
export function CustomHtml(props: { block: CustomHtmlBlock }): preact.JSX.Element | null {
  const { id, data } = props.block;
  const rawHtml = typeof data.html === "string" ? data.html : "";

  // Empty-state suppression: a customHTML block with no html payload renders
  // nothing rather than an empty styled container. Whitespace-only input
  // counts as empty (there is nothing meaningful to embed).
  if (rawHtml.trim().length === 0) return null;

  const sanitize = data.sanitize !== false;
  const html = sanitize ? sanitizeCustomHtml(rawHtml) : rawHtml;

  return (
    <section
      data-block="customHTML"
      data-block-id={id}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
