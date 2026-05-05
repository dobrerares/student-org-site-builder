import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import richtextOnly from "./fixtures/richtext-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = richtextOnly as unknown as Site;

describe("renderSite — richText block (structural)", () => {
  test("renders a <section data-block=richText>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="richText"/);
  });

  test("renders the data-block-id from the schema id", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/data-block-id="blk_about_intro"/);
  });

  test("renders the markdown subset as the whitelist HTML elements", () => {
    const html = renderSite(fixture, "stub");
    // h2 from `## Despre noi`
    expect(html).toMatch(/<h2[^>]*>Despre noi<\/h2>/);
    // strong from **studențească**
    expect(html).toContain("<strong>studențească</strong>");
    // em from *2024*
    expect(html).toContain("<em>2024</em>");
    // ul + li from `- Cercetare`
    expect(html).toMatch(/<ul[^>]*>/);
    expect(html).toMatch(/<li[^>]*>Cercetare<\/li>/);
    // blockquote
    expect(html).toContain("<blockquote>");
    // anchor
    expect(html).toMatch(/<a\s+href="https:\/\/anosr\.ro"[^>]*>site-ul nostru<\/a>/);
  });

  test("never emits non-whitelist HTML elements from richText markdown", () => {
    const malicious = JSON.parse(JSON.stringify(fixture)) as Site;
    malicious.pages[0]!.blocks[0]!.data = {
      markdown:
        "<script>x()</script>\n\n[click](javascript:x())\n\n<img src=x onerror=x()>",
    };
    const html = renderSite(malicious, "stub");
    expect(html).not.toMatch(/<script[^>]*>/i);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    const realA = /<a\s+href="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = realA.exec(html)) !== null) {
      expect(m[1]).not.toMatch(/^\s*javascript:/i);
    }
  });

  test("renders multiple richText blocks on the same page independently", () => {
    const twoBlocks = JSON.parse(JSON.stringify(fixture)) as Site;
    twoBlocks.pages[0]!.blocks.push({
      id: "blk_about_more",
      type: "richText",
      version: 1,
      data: { markdown: "### A second heading\n\nA second paragraph." },
    });
    const html = renderSite(twoBlocks, "stub");
    expect(html).toMatch(/data-block-id="blk_about_intro"/);
    expect(html).toMatch(/data-block-id="blk_about_more"/);
    expect(html).toMatch(/<h3[^>]*>A second heading<\/h3>/);
  });

  test("tolerates a richText with empty markdown (forward-compat / placeholder)", () => {
    const empty = JSON.parse(JSON.stringify(fixture)) as Site;
    empty.pages[0]!.blocks[0]!.data = { markdown: "" };
    const html = renderSite(empty, "stub");
    expect(html).toMatch(/<section[^>]*data-block="richText"/);
    // No paragraph content from empty markdown — the rich-text container is
    // empty (modulo whitespace inside the section).
    expect(html).not.toMatch(/<p>(?!<\/p>)[\s\S]+?<\/p>/);
  });

  test("ignores unknown extra fields on richText data (forward-compat)", () => {
    const withExtra = JSON.parse(JSON.stringify(fixture)) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).align = "center";
    const html = renderSite(withExtra, "stub");
    expect(html).toMatch(/<h2[^>]*>Despre noi<\/h2>/);
  });
});

describe("renderSite — richText golden file", () => {
  test("richText fixture under stub theme matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-richtext.html");
  });
});
