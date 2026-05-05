import { describe, expect, test } from "vitest";
import { transformSync } from "esbuild";
import { FAQ_ACCORDION_SCRIPT_SOURCE } from "../src/index.js";

/**
 * AC #5 — accordion JS under 2 kb minified (issue #18).
 *
 * The minifier runs in a Node-only environment (no jsdom) because esbuild's
 * `TextEncoder` invariant check fails under jsdom. The DOM-side script tests
 * live in `faq-script-dom.test.ts`.
 */

function minifiedSize(source: string): number {
  const result = transformSync(source, {
    loader: "js",
    minify: true,
    target: "es2018",
  });
  return new TextEncoder().encode(result.code).length;
}

describe("FAQ accordion script — size budget", () => {
  test("is under 2 kb minified", () => {
    const size = minifiedSize(FAQ_ACCORDION_SCRIPT_SOURCE);
    // Generous budget per AC; the actual implementation is well under.
    expect(size).toBeLessThan(2048);
  });

  test("self-runs as an IIFE (no exports / globals leaked)", () => {
    expect(FAQ_ACCORDION_SCRIPT_SOURCE.startsWith("(function(){")).toBe(true);
    expect(FAQ_ACCORDION_SCRIPT_SOURCE.endsWith("})();")).toBe(true);
  });
});
