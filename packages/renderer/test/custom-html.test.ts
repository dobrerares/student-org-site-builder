import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import customHtmlOn from "./fixtures/custom-html-on.json" with { type: "json" };
import customHtmlOff from "./fixtures/custom-html-off.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const onFixture = customHtmlOn as unknown as Site;
const offFixture = customHtmlOff as unknown as Site;

/**
 * customHTML block — renderer tests.
 *
 * Sanitization-on (default) runs the input through the project's sanitizer
 * (DOMPurify) using a strict policy. Scripts, on-* event handlers, javascript:
 * URLs, and form-only tags are stripped.
 *
 * Sanitization-off (danger mode) emits the html byte-equal — the user has
 * opted in via the editor's danger UI. The renderer does not editorialise the
 * input; the warning is surfaced editor-side, not on the published site.
 */
describe("customHTML block — sanitize-on (default)", () => {
  function renderWith(html: string): string {
    const site = structuredClone(onFixture) as Site;
    const block = site.pages[0]!.blocks.find((b) => b.type === "customHTML")!;
    (block.data as Record<string, unknown>).html = html;
    return renderSite(site, "stub");
  }

  test("strips <script> tags entirely", () => {
    const out = renderWith("<p>safe</p><script>alert(1)</script>");
    expect(out).toContain("<p>safe</p>");
    expect(out).not.toMatch(/<script\b/i);
    expect(out).not.toContain("alert(1)");
  });

  test("strips on* event-handler attributes", () => {
    const out = renderWith('<a href="/x" onclick="alert(1)">click</a>');
    expect(out).toContain('href="/x"');
    expect(out).not.toMatch(/onclick=/i);
    expect(out).not.toContain("alert(1)");
  });

  test("strips javascript: URLs from anchor href", () => {
    const out = renderWith('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/href="javascript:/i);
  });

  test("strips iframe by default in sanitize-on", () => {
    const out = renderWith('<iframe src="https://example.org/x"></iframe>');
    expect(out).not.toMatch(/<iframe\b/i);
  });

  test("strips <object> and <embed> active content", () => {
    const out = renderWith('<object data="evil.swf"></object><embed src="evil.swf" />');
    expect(out).not.toMatch(/<object\b/i);
    expect(out).not.toMatch(/<embed\b/i);
  });

  test("strips <style> tags (XSS via CSS expressions)", () => {
    const out = renderWith("<style>body { background: url(javascript:alert(1)) }</style>");
    // The page-shell always emits a renderer-owned <style> in <head>; assert
    // the user-supplied <style> contents do not survive into the customHTML
    // section body.
    expect(out).not.toContain("javascript:alert(1)");
    const sectionMatch = out.match(
      /<section[^>]*data-block="customHTML"[^>]*>([\s\S]*?)<\/section>/i,
    );
    expect(sectionMatch).not.toBeNull();
    if (sectionMatch !== null) {
      expect(sectionMatch[1]).not.toMatch(/<style\b/i);
    }
  });

  test("strips <form> elements (action XSS)", () => {
    const out = renderWith('<form action="javascript:alert(1)"><input /></form>');
    expect(out).not.toMatch(/<form\b/i);
  });

  test("preserves benign formatting tags", () => {
    const out = renderWith("<p>Hello <strong>world</strong> <em>!</em></p>");
    expect(out).toContain("<p>Hello <strong>world</strong> <em>!</em></p>");
  });

  test("svg with onload event handler is neutralised", () => {
    const out = renderWith('<svg onload="alert(1)"></svg>');
    expect(out).not.toMatch(/onload=/i);
  });

  test("does not embed the original raw script tag in the output", () => {
    const out = renderWith('<script>console.log("x")</script><p>y</p>');
    expect(out).not.toContain('console.log("x")');
    expect(out).not.toContain("<script>");
  });
});

describe("customHTML block — sanitize-off (danger mode)", () => {
  test("renders the iframe and content byte-equal (passthrough)", () => {
    const html = renderSite(offFixture, "stub");
    expect(html).toContain(
      '<iframe src="https://example.org/widget" title="trusted widget"></iframe>',
    );
  });

  test("does not strip script tags when sanitize is off (passthrough)", () => {
    const site = structuredClone(offFixture) as Site;
    const block = site.pages[0]!.blocks.find((b) => b.type === "customHTML")!;
    (block.data as Record<string, unknown>).html = "<script>x</script>";
    const out = renderSite(site, "stub");
    expect(out).toContain("<script>x</script>");
  });
});

describe("customHTML block — wrapper markup", () => {
  test('wraps customHTML in a <section data-block="customHTML">', () => {
    const html = renderSite(onFixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="customHTML"/);
  });

  test("includes data-block-id matching the block id", () => {
    const html = renderSite(onFixture, "stub");
    expect(html).toContain('data-block-id="blk_home_html"');
  });

  test("does NOT add an editor-side warning to the rendered page when sanitize is off", () => {
    // The persistent warning is editor-side (danger UI in the form list);
    // the published site is the user's intent verbatim.
    const html = renderSite(offFixture, "stub");
    // No warning text leaks into the rendered HTML.
    expect(html).not.toMatch(/sanitization is off/i);
    expect(html).not.toMatch(/danger mode/i);
  });
});

describe("customHTML block — determinism", () => {
  test("repeated calls produce byte-identical output", () => {
    const a = renderSite(onFixture, "stub");
    const b = renderSite(onFixture, "stub");
    expect(a).toBe(b);
  });

  test("structuredClone of input produces byte-identical output", () => {
    const a = renderSite(onFixture, "stub");
    const b = renderSite(structuredClone(onFixture), "stub");
    expect(a).toBe(b);
  });
});
