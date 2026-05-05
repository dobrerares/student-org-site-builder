import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";
import type { Site } from "@sosb/schema";
import heroOnly from "./fixtures/hero-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = heroOnly as unknown as Site;

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
});
