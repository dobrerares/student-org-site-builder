import createDOMPurify from "dompurify";
import type { DOMPurify, WindowLike } from "dompurify";
import { JSDOM } from "jsdom";
import { SANITIZE_CONFIG } from "./sanitize-config.js";

/**
 * Node-side sanitizer entry. Constructs a JSDOM window on demand and uses
 * it as the DOM host for DOMPurify. JSDOM is already a renderer
 * devDependency (used by the axe-core accessibility test).
 *
 * Resolution: `package.json` exports map `./internal/sanitize` to this
 * file for the `node` condition. Browser bundles (esbuild
 * `platform: "browser"`) pick `sanitize.ts` instead and never resolve
 * jsdom — guaranteeing the renderer keeps the build pipeline (#5)'s
 * browser-runnability AC.
 *
 * The JSDOM window is cached so repeated calls do not pay the
 * jsdom-construction cost. A dedicated window per call is unnecessary —
 * DOMPurify is stateless across calls, and the window itself does not
 * accumulate state from sanitization.
 */
let cachedPurifier: DOMPurify | null = null;

function getPurifier(): DOMPurify {
  if (cachedPurifier !== null) return cachedPurifier;
  // The browser path (sanitize.ts) is preferred when `globalThis.window` is
  // present — which the renderer's parity-jsdom test pre-installs. We only
  // resolve JSDOM when neither the `browser` export condition nor a global
  // window is available.
  if (typeof globalThis !== "undefined") {
    const candidate = (globalThis as { window?: unknown }).window;
    if (candidate !== undefined && candidate !== null) {
      cachedPurifier = createDOMPurify(candidate as WindowLike);
      return cachedPurifier;
    }
  }
  const { window } = new JSDOM("");
  cachedPurifier = createDOMPurify(window as unknown as WindowLike);
  return cachedPurifier;
}

/** See `sanitize.ts` (browser entry) for the contract. */
export function sanitizeCustomHtml(html: string): string {
  const purify = getPurifier();
  const result = purify.sanitize(html, SANITIZE_CONFIG);
  return typeof result === "string" ? result : String(result);
}
