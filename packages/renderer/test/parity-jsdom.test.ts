import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite, type ThemeBundle } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

/**
 * A packaged theme, for the parity check below.
 *
 * Worth covering separately from the built-ins: a packaged theme exercises the
 * CSS url-rewriting and the bundle font emitter, which are the two code paths
 * added for Theme packages — and both are string manipulation that a DOM-ish
 * global could plausibly perturb.
 */
const customBundle: ThemeBundle = {
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
    bytes: new Map([["fonts/d.woff2", new TextEncoder().encode("woff2")]]),
  },
  assets: new Map([["assets/bg.svg", new TextEncoder().encode("<svg/>")]]),
};

function customSite(): Site {
  const site = structuredClone(fixture) as Site;
  site.theme = { id: customBundle.id, shellVariant: "compact" };
  site.pages[0]!.blocks[0]!.variant = "split";
  return site;
}

/** Run `fn` with browser-ish globals patched in, then restore them. */
function underJsdom<T>(fn: () => T): T {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = { window: globalThis.window, document: globalThis.document };
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: dom.window.document,
    });
    return fn();
  } finally {
    for (const key of ["window", "document"] as const) {
      const value = previous[key];
      if (value === undefined) {
        // @ts-expect-error -- restoring deleted global
        delete globalThis[key];
      } else {
        Object.defineProperty(globalThis, key, { configurable: true, value });
      }
    }
  }
}

/**
 * Node-vs-browser parity: jsdom round-trip.
 *
 * The full Node-vs-headless-Chromium parity check lives in the Playwright
 * e2e under `e2e/renderer-parity.spec.ts`. This in-package test exercises
 * the same module under a DOM-shimmed (`jsdom`) global, which is enough to
 * catch any code path that accidentally takes a hard dependency on Node
 * built-ins or browser-only APIs.
 */
describe("renderSite — Node vs jsdom parity", () => {
  test("running renderSite under a jsdom global produces the same string as native Node", () => {
    const native = renderSite(fixture, "stub");

    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
    };
    // Patch the globals to mimic a browser-ish environment. Using
    // `Object.defineProperty` because some of these are read-only on Node 20.
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: dom.window,
      });
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: dom.window.document,
      });
      const inDom = renderSite(fixture, "stub");
      expect(inDom).toBe(native);
    } finally {
      if (previous.window === undefined) {
        // @ts-expect-error -- restoring deleted global
        delete globalThis.window;
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: previous.window,
        });
      }
      if (previous.document === undefined) {
        // @ts-expect-error -- restoring deleted global
        delete globalThis.document;
      } else {
        Object.defineProperty(globalThis, "document", {
          configurable: true,
          value: previous.document,
        });
      }
    }
  });

  test("a site on a packaged theme renders identically under jsdom", () => {
    const site = customSite();
    const opts = { theme: customBundle } as const;
    const native = renderSite(site, customBundle.id, opts);
    expect(underJsdom(() => renderSite(site, customBundle.id, opts))).toBe(native);
    // Sanity: the packaged-theme code paths really did run.
    expect(native).toContain('url("assets/theme/org.example.parity/assets/bg.svg")');
    expect(native).toContain('font-family:"Parity Display"');
    expect(native).toContain('data-variant="split"');
    expect(native).toContain('data-shell-variant="compact"');
  });

  test("a packaged theme renders identically under a preview asset resolver", () => {
    const site = customSite();
    const withResolver = {
      theme: customBundle,
      assetUrlForPath: (path: string) => `blob:x/${path}`,
    } as const;
    expect(underJsdom(() => renderSite(site, customBundle.id, withResolver))).toBe(
      renderSite(site, customBundle.id, withResolver),
    );
  });
});
