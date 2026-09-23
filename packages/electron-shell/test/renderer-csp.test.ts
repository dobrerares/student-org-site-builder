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
    // `'wasm-unsafe-eval'` (below) is a different, narrower permission: it
    // allows WebAssembly compilation and nothing about JavaScript `eval`.
    expect(csp).not.toMatch(/(?<!wasm-)unsafe-eval/);
  });

  test("allows WebAssembly compilation — the Theme sandbox is QuickJS in wasm", () => {
    // A Theme package's `render.js` runs inside QuickJS compiled to
    // WebAssembly (ADR 0053), instantiated from bytes embedded in the bundle.
    // Chromium refuses `WebAssembly.instantiate` under a bare `script-src
    // 'self'`; `'wasm-unsafe-eval'` is the keyword that permits exactly that
    // and leaves JavaScript `eval` forbidden. Without it every Theme with a
    // `render.js` failed to import in the packaged app while working in the
    // browser build — the kind of environment split ADR 0046 rules out.
    expect(cspContent()).toMatch(/script-src [^;]*'wasm-unsafe-eval'/);
  });

  test("allows the data:/blob: image sources the builder uses offline", () => {
    // Uploaded images are held in memory and shown through `blob:` object
    // URLs; `data:` covers inline SVG and tiny placeholders.
    const csp = cspContent();
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  test("allows blob: fonts — the preview mints object URLs for self-hosted woff2", () => {
    // The renderer emits `@font-face { src: url(assets/fonts/<f>.woff2) }`.
    // A deployed site serves those as real files, but the editor preview has
    // no server, so `font-blobs.ts` mints a `blob:` URL per face from the
    // bundled base64 (see `getFontBlobUrls`). An imported Theme package's
    // packaged woff2 files take the same route through `theme-blobs.ts`.
    // Without `blob:` here the
    // packaged app silently fell back to a system font, so the preview
    // misrepresented every theme's typography — the exact kind of
    // preview/export divergence this policy is supposed to permit.
    const csp = cspContent();
    expect(csp).toMatch(/font-src [^;]*\bblob:/);
    expect(csp).toMatch(/font-src [^;]*'self'/);
    expect(csp).toMatch(/font-src [^;]*\bdata:/);
  });

  test("asset blob: URLs are permitted wherever the preview can mint them", () => {
    // Every directive the editor resolves an in-memory asset through must
    // accept blob:. If a future theme asset lands in a new directive (audio,
    // video, …) it needs the same treatment — this test is the checklist.
    const csp = cspContent();
    for (const directive of ["img-src", "font-src"]) {
      expect(csp).toMatch(new RegExp(`${directive} [^;]*\\bblob:`));
    }
  });

  test("declares no remote origin — the packaged app runs entirely offline", () => {
    expect(cspContent()).not.toMatch(/https?:/i);
  });
});
