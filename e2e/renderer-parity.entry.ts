/**
 * Browser-side entry for the renderer parity e2e.
 *
 * This file is bundled by esbuild in `renderer-parity.spec.ts` (and
 * `faq-accordion.spec.ts`) and injected into the headless Chromium page.
 * Its only job is to attach the renderer to `window` under a stable global
 * so the test can call it from `page.evaluate()`.
 */
import {
  FAQ_ACCORDION_SCRIPT_SOURCE,
  renderSite,
  type ThemeBundle,
} from "../packages/renderer/src/index.js";

declare global {
  interface Window {
    __sosbRenderer: {
      renderSite: typeof renderSite;
      FAQ_ACCORDION_SCRIPT_SOURCE: typeof FAQ_ACCORDION_SCRIPT_SOURCE;
      themeBundle: ThemeBundle;
    };
  }
}

/**
 * A packaged Theme, for the custom-bundle half of the parity check.
 *
 * Built inline rather than loaded from `examples/themes/practice/`: the
 * package loader reads the filesystem, and this module runs inside a browser
 * page. A `ThemeBundle` is plain data (ADR 0052), so an inline one is a real
 * Theme — and it exercises the two code paths Theme packages added, CSS
 * `url()` rewriting and the bundle font emitter.
 */
export const PARITY_THEME_BUNDLE: ThemeBundle = {
  id: "org.example.parity",
  name: "Parity",
  version: "1.0.0",
  origin: "package",
  css: `[data-block="hero"]{background-image:url(assets/bg.svg);}`,
  baselineTokens: [["--color-primary", "#123456"]],
  supports: { colors: true, fonts: false, density: true, radius: true },
  blockVariants: { hero: [{ id: "split", label: "Split" }] },
  shellVariants: [{ id: "compact", label: "Compact" }],
  fontSource: {
    kind: "bundle",
    faces: [{ family: "Parity Display", weight: 700, style: "normal", file: "fonts/d.woff2" }],
    bytes: new Map([["fonts/d.woff2", new Uint8Array([1, 2, 3])]]),
  },
  assets: new Map([["assets/bg.svg", new Uint8Array([4, 5, 6])]]),
};

window.__sosbRenderer = {
  renderSite,
  FAQ_ACCORDION_SCRIPT_SOURCE,
  themeBundle: PARITY_THEME_BUNDLE,
};
