/**
 * The packaged renderer's CSP must keep working with the React builder UI
 * and the shared `@sosb/ui` stylesheet.
 *
 * The builder delivers its compiled CSS two ways: a bundler `import` of
 * `@sosb/ui/styles.css` (which lands as a same-origin `<link>`/inline
 * `<style>` in the renderer bundle) and, for hosts without a CSS pipeline,
 * a JS-injected `<style>` element. Both need `style-src 'self'
 * 'unsafe-inline'`. React itself needs nothing beyond `script-src 'self'` —
 * it does not eval, so the CSP stays free of `unsafe-eval`.
 *
 * Asserting on the shipped HTML rather than a constant keeps this honest:
 * if someone relaxes the policy, this test notices.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(path.resolve(here, "..", "renderer", "index.html"), "utf8");

function cspContent(): string {
  const match = indexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/i,
  );
  if (match === null) throw new Error("renderer/index.html has no CSP meta tag");
  return match[1]!;
}

describe("renderer CSP", () => {
  test("permits the builder stylesheet: same-origin plus inline styles", () => {
    const csp = cspContent();
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  test("keeps scripts same-origin and never allows eval", () => {
    const csp = cspContent();
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  test("allows the data:/blob: image and data: font sources the builder uses offline", () => {
    const csp = cspContent();
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self' data:");
  });

  test("declares no remote origin — the packaged app runs entirely offline", () => {
    expect(cspContent()).not.toMatch(/https?:/i);
  });
});
