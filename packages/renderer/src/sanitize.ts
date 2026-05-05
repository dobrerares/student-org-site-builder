import DOMPurify from "dompurify";
import { SANITIZE_CONFIG } from "./sanitize-config.js";

/**
 * Browser-side sanitizer entry. DOMPurify uses the page's `window` and
 * `document` automatically; no JSDOM required.
 *
 * Resolution: `package.json` exports map `./internal/sanitize` to this file
 * for the `browser` condition and to `sanitize.node.ts` for `node`. The
 * default fallback (when no condition matches) also points here so that
 * runtime environments that do not advertise either condition (vitest's
 * Node runner, for example) still get a working sanitizer — at the cost of
 * needing `globalThis.window` to be present, which the renderer's existing
 * jsdom-shim test infrastructure (parity-jsdom.test.ts) already provides.
 *
 * For Node-only build pipelines without a global window, see
 * `sanitize.node.ts` which constructs a JSDOM window on demand.
 */
export function sanitizeCustomHtml(html: string): string {
  const result = DOMPurify.sanitize(html, SANITIZE_CONFIG);
  return typeof result === "string" ? result : String(result);
}
