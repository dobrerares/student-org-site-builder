import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import quoteOnly from "./fixtures/quote-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = quoteOnly as unknown as Site;

describe("renderSite — quote block (structural)", () => {
  test("renders a <figure data-block=quote> root", () => {
    // The pull-quote uses <figure> + <blockquote> + <figcaption> semantic
    // grouping (HTML Living Standard). The block-root data attribute lands
    // on the <figure>.
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<figure[^>]*data-block="quote"/);
  });

  test("renders the data-block-id from the schema id", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/data-block-id="blk_pq_alumni"/);
  });

  test("uses semantic <blockquote> for the quote text", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("<blockquote");
  });

  test("renders the quote text with markdown emphasis (italic, bold) inline", () => {
    const html = renderSite(fixture, "stub");
    // *real* → <em>real</em>
    expect(html).toContain("<em>real</em>");
    // **transformatoare** → <strong>transformatoare</strong>
    expect(html).toContain("<strong>transformatoare</strong>");
  });

  test("renders attribution via <figcaption> with <cite> for author name", () => {
    // The pull-quote pattern is <figure><blockquote/><figcaption><cite/>…</figcaption></figure>.
    // <cite> wraps the author name; the role + image sit alongside it.
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<figure[^>]*data-block="quote"/);
    expect(html).toContain("<figcaption");
    expect(html).toMatch(/<cite[^>]*>Maria Popescu<\/cite>/);
  });

  test("renders authorRole when provided", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain("Alumni, promoția 2023");
  });

  test("renders authorImage with authorImageAlt as a semantic <img alt=...>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('alt="Maria în timpul absolvirii"');
    expect(html).toContain("assets/maria.jpg");
  });

  test("never emits non-whitelist HTML elements from quote text (XSS-safe)", () => {
    const malicious = JSON.parse(JSON.stringify(fixture)) as Site;
    malicious.pages[0]!.blocks[0]!.data = {
      text: "<script>x()</script> [click](javascript:x()) <img src=x onerror=x()>",
      author: "<script>alert(1)</script>",
    };
    const html = renderSite(malicious, "stub");
    // The renderer must escape any script or onerror content from user prose.
    expect(html).not.toMatch(/<script[^>]*>x\(\)<\/script>/i);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    // And no anchor with a javascript: href should ever appear.
    const realA = /<a\s+href="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = realA.exec(html)) !== null) {
      expect(m[1]).not.toMatch(/^\s*javascript:/i);
    }
  });

  test("renders a quote without an author (text-only)", () => {
    const minimal = JSON.parse(JSON.stringify(fixture)) as Site;
    minimal.pages[0]!.blocks[0]!.data = { text: "A standalone thought." };
    const html = renderSite(minimal, "stub");
    expect(html).toMatch(/<figure[^>]*data-block="quote"/);
    expect(html).toContain("A standalone thought.");
    // No figcaption when there is no attribution.
    expect(html).not.toContain("<figcaption");
    expect(html).not.toMatch(/<cite[^>]*>/);
  });

  test("renders a quote with author but no image", () => {
    const noImage = JSON.parse(JSON.stringify(fixture)) as Site;
    noImage.pages[0]!.blocks[0]!.data = {
      text: "Words alone.",
      author: "Anonymous",
    };
    const html = renderSite(noImage, "stub");
    expect(html).toMatch(/<cite[^>]*>Anonymous<\/cite>/);
    expect(html).not.toContain("authorImage");
    expect(html).not.toMatch(/<img[^>]*alt=/);
  });

  test("ignores unknown extra fields on quote data (forward-compat)", () => {
    const withExtra = JSON.parse(JSON.stringify(fixture)) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).decorativeMark =
      "ornament";
    const html = renderSite(withExtra, "stub");
    expect(html).toContain("Maria Popescu");
  });
});

describe("renderSite — quote golden file", () => {
  test("quote fixture under stub theme matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-quote.html");
  });
});
