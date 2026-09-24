import { describe, expect, test } from "vitest";
import { EDITOR_APP_CSS } from "../src/editor-app-css.js";

/**
 * Every custom property the editor stylesheet reads must be one it defines.
 *
 * A `var()` that does not resolve makes the property unset — silently. A
 * border vanishes, a focus outline disappears (WCAG 2.4.7), and nothing in
 * the build says so. This is the drift guard: it caught a set of rich-text
 * rules written against token names from a different sheet.
 */
describe("editor stylesheet tokens", () => {
  test("every var(--x) without a fallback is declared somewhere in the sheet", () => {
    const declared = new Set<string>();
    for (const match of EDITOR_APP_CSS.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declared.add(match[1]!);
    // `var(--x, fallback)` is a deliberate soft reference and is left alone.
    const used = new Set<string>();
    for (const match of EDITOR_APP_CSS.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) {
      used.add(match[1]!);
    }
    const missing = [...used].filter((token) => !declared.has(token)).sort();
    expect(missing).toEqual([]);
  });
});
