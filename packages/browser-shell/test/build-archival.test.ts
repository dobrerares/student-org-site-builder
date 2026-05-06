import { describe, expect, test } from "vitest";

import { buildArchival } from "../src/archival/build-archival.js";

/**
 * AC #3 — `pnpm build:archival` produces a single `builder.html` ≤ 3MB.
 * AC #4 — archival HTML opens and runs from `file://` (with documented
 *         OPFS-persistence limitations).
 *
 * `buildArchival(input)` is the pure transformation: given an SPA's entry
 * HTML and a virtual asset map, return one self-contained HTML string with
 * every `<script src>`, `<link rel="stylesheet" href>`, and a configurable
 * subset of `<img src>` references inlined.
 *
 * The CLI script (`scripts/build-archival.mjs`) is a thin wrapper that
 * (a) bundles the editor-app for the browser via esbuild, (b) feeds the
 * bundle + a hand-written shell HTML into `buildArchival()`, (c) writes the
 * result to `dist/archival/builder.html`. The pure transformation lives
 * here so tests don't need esbuild on the hot path.
 */

describe("buildArchival", () => {
  test("returns a single HTML string with no external script references", () => {
    const out = buildArchival({
      html:
        '<!doctype html><html><head><script src="/app.js"></script></head>' +
        "<body></body></html>",
      assets: new Map<string, string | Uint8Array>([["/app.js", "console.log('hello');"]]),
    });
    expect(out.html).not.toMatch(/<script[^>]+src=/);
    expect(out.html).toContain("console.log('hello')");
  });

  test("inlines external stylesheet refs as <style> blocks", () => {
    const out = buildArchival({
      html:
        '<!doctype html><html><head><link rel="stylesheet" href="/app.css"/></head>' +
        "<body></body></html>",
      assets: new Map<string, string | Uint8Array>([["/app.css", ".body { color: red; }"]]),
    });
    expect(out.html).not.toMatch(/<link[^>]+rel=["']?stylesheet/);
    expect(out.html).toContain("<style>.body { color: red; }</style>");
  });

  test("preserves cross-origin script and stylesheet refs (cannot be inlined safely from a build)", () => {
    const out = buildArchival({
      html:
        "<!doctype html><html><head>" +
        '<script src="https://cdn.example.org/foo.js"></script>' +
        "</head><body></body></html>",
      assets: new Map<string, string | Uint8Array>(),
    });
    // Cross-origin (https://...) refs should NOT be touched — we have no
    // way to fetch them at build time and inlining a placeholder would
    // silently break the page.
    expect(out.html).toContain('src="https://cdn.example.org/foo.js"');
  });

  test("emits a bytes count matching the UTF-8 length of the html", () => {
    const out = buildArchival({
      html: "<!doctype html><html><head></head><body>hi</body></html>",
      assets: new Map<string, string | Uint8Array>(),
    });
    expect(out.bytes).toBe(new TextEncoder().encode(out.html).byteLength);
  });

  test("inlines a script that refers to a relative URL when the asset is in the map", () => {
    const out = buildArchival({
      html:
        '<!doctype html><html><head><script src="./bundle.js"></script></head>' +
        "<body></body></html>",
      assets: new Map<string, string | Uint8Array>([["./bundle.js", "var x = 1;"]]),
    });
    expect(out.html).toContain("var x = 1;");
    expect(out.html).not.toMatch(/<script[^>]+src=["']\.\/bundle\.js/);
  });

  test("preserves type=module so bundled ESM still runs", () => {
    const out = buildArchival({
      html:
        '<!doctype html><html><head><script type="module" src="/app.js"></script></head>' +
        "<body></body></html>",
      assets: new Map<string, string | Uint8Array>([["/app.js", "export const x = 1;"]]),
    });
    expect(out.html).toMatch(/<script[^>]*type=["']module["']/);
    expect(out.html).toContain("export const x = 1;");
  });

  test("escapes a literal `</script>` payload so the inlined script cannot break out", () => {
    const out = buildArchival({
      html: '<!doctype html><html><head><script src="/x.js"></script></head><body></body></html>',
      assets: new Map<string, string | Uint8Array>([
        // Real-world hazard: a string-literal containing the closing tag.
        ["/x.js", `var s = '</script><script>alert(1)</script>';`],
      ]),
    });
    // The original closer must be neutralised. A common technique is to
    // split the literal: `</scr"+"ipt>`. Whatever we do, the html must not
    // contain the un-escaped breakout.
    expect(out.html).not.toContain("'</script><script>alert(1)</script>';");
  });

  test("inlines binary assets referenced via <img src=> as base64 data URIs", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const out = buildArchival({
      html: '<!doctype html><html><body><img src="/logo.png" alt="logo"/></body></html>',
      assets: new Map<string, string | Uint8Array>([["/logo.png", png]]),
    });
    expect(out.html).toMatch(/data:image\/png;base64,/);
    // Verify we don't keep the original src=...
    expect(out.html).not.toMatch(/src=["']\/logo\.png["']/);
  });

  test("output is deterministic across calls with the same input", () => {
    const input = {
      html:
        '<!doctype html><html><head><script src="/a.js"></script></head>' +
        '<body><img src="/b.png" alt=""/></body></html>',
      assets: new Map<string, string | Uint8Array>([
        ["/a.js", "x();"],
        ["/b.png", new Uint8Array([1, 2, 3])],
      ]),
    };
    const a = buildArchival(input);
    const b = buildArchival(input);
    expect(a.html).toBe(b.html);
    expect(a.bytes).toBe(b.bytes);
  });

  test("a 1.5MB script gets inlined (well under the 3MB AC budget)", () => {
    const big = "x".repeat(1_500_000);
    const out = buildArchival({
      html: '<!doctype html><html><head><script src="/big.js"></script></head><body></body></html>',
      assets: new Map<string, string | Uint8Array>([["/big.js", big]]),
    });
    expect(out.bytes).toBeGreaterThan(1_500_000);
    expect(out.bytes).toBeLessThan(3 * 1024 * 1024);
  });
});
