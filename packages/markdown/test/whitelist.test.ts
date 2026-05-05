import { describe, expect, test } from "vitest";
import { markdownToHtml } from "../src/index.js";

/**
 * Whitelist enforcement tests.
 *
 * The PRD-pinned subset (Implementation Decisions → Block library):
 *
 *   bold, italic, links, lists, headings (h2–h4), inline code, blockquotes.
 *   No raw HTML in markdown. XSS-safe by construction.
 *
 * "Safe by construction" means the parser never round-trips raw HTML — every
 * output tag is built by the renderer from typed AST nodes, so an attacker
 * cannot smuggle a `<script>` by writing literal HTML in the markdown source.
 */

describe("markdownToHtml — bold / italic", () => {
  test("converts **bold** to <strong>", () => {
    expect(markdownToHtml("**hello**")).toContain("<strong>hello</strong>");
  });

  test("converts *italic* to <em>", () => {
    expect(markdownToHtml("*hello*")).toContain("<em>hello</em>");
  });

  test("converts _italic_ to <em>", () => {
    expect(markdownToHtml("_hello_")).toContain("<em>hello</em>");
  });

  test("supports nested bold inside italic", () => {
    const html = markdownToHtml("*a **b** c*");
    expect(html).toContain("<em>");
    expect(html).toContain("<strong>b</strong>");
  });
});

describe("markdownToHtml — inline code", () => {
  test("converts `code` to <code>", () => {
    expect(markdownToHtml("hello `world`")).toContain("<code>world</code>");
  });

  test("escapes special characters inside inline code", () => {
    const html = markdownToHtml("`<script>alert(1)</script>`");
    // Inline code must escape: never produce a real <script> tag.
    expect(html).not.toMatch(/<script[^>]*>alert/i);
    expect(html).toContain("&lt;script&gt;");
  });

  test("does not parse markdown syntax inside inline code", () => {
    const html = markdownToHtml("`**not bold**`");
    expect(html).not.toContain("<strong>");
    expect(html).toContain("**not bold**");
  });
});

describe("markdownToHtml — links", () => {
  test("converts [text](url) to <a href=...>text</a>", () => {
    const html = markdownToHtml("[Anosr](https://anosr.ro)");
    expect(html).toMatch(/<a\s+href="https:\/\/anosr\.ro"[^>]*>Anosr<\/a>/);
  });

  test("allows http and https schemes", () => {
    expect(markdownToHtml("[a](http://example.com)")).toContain('href="http://example.com"');
    expect(markdownToHtml("[a](https://example.com)")).toContain('href="https://example.com"');
  });

  test("allows mailto: scheme", () => {
    const html = markdownToHtml("[contact](mailto:hi@anosr.ro)");
    expect(html).toContain('href="mailto:hi@anosr.ro"');
  });

  test("allows relative paths", () => {
    expect(markdownToHtml("[a](/about)")).toContain('href="/about"');
    expect(markdownToHtml("[a](./local)")).toContain('href="./local"');
    expect(markdownToHtml("[a](../up)")).toContain('href="../up"');
    expect(markdownToHtml("[a](anchor)")).toContain('href="anchor"');
  });

  test("strips javascript: scheme", () => {
    const html = markdownToHtml("[click](javascript:alert(1))");
    // The text is preserved, but the dangerous href is dropped.
    expect(html).not.toMatch(/href="javascript:/i);
  });

  test("strips data: scheme", () => {
    const html = markdownToHtml("[click](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toMatch(/href="data:/i);
  });

  test("strips vbscript: scheme", () => {
    const html = markdownToHtml("[click](vbscript:msgbox(1))");
    expect(html).not.toMatch(/href="vbscript:/i);
  });

  test("ignores case when stripping dangerous schemes", () => {
    expect(markdownToHtml("[a](JAVASCRIPT:alert(1))")).not.toMatch(/href="javascript:/i);
    expect(markdownToHtml("[a](Data:text/html,foo)")).not.toMatch(/href="data:/i);
  });
});

describe("markdownToHtml — lists", () => {
  test("converts dash-bullet list to <ul><li>", () => {
    const html = markdownToHtml("- a\n- b\n- c");
    expect(html).toContain("<ul>");
    expect(html).toMatch(/<li>a<\/li>/);
    expect(html).toMatch(/<li>b<\/li>/);
    expect(html).toMatch(/<li>c<\/li>/);
  });

  test("converts star-bullet list to <ul>", () => {
    const html = markdownToHtml("* one\n* two");
    expect(html).toContain("<ul>");
    expect(html).toMatch(/<li>one<\/li>/);
    expect(html).toMatch(/<li>two<\/li>/);
  });

  test("converts numbered list to <ol>", () => {
    const html = markdownToHtml("1. first\n2. second\n3. third");
    expect(html).toContain("<ol>");
    expect(html).toMatch(/<li>first<\/li>/);
    expect(html).toMatch(/<li>second<\/li>/);
    expect(html).toMatch(/<li>third<\/li>/);
  });

  test("renders inline emphasis inside list items", () => {
    const html = markdownToHtml("- **bold** item\n- normal item");
    expect(html).toMatch(/<li><strong>bold<\/strong>\s*item<\/li>/);
  });
});

describe("markdownToHtml — headings", () => {
  test("converts ## to <h2>", () => {
    expect(markdownToHtml("## A heading")).toContain("<h2>A heading</h2>");
  });

  test("converts ### to <h3>", () => {
    expect(markdownToHtml("### A heading")).toContain("<h3>A heading</h3>");
  });

  test("converts #### to <h4>", () => {
    expect(markdownToHtml("#### A heading")).toContain("<h4>A heading</h4>");
  });

  test("rejects # (h1) — page hierarchy reserves h1 for the page title", () => {
    const html = markdownToHtml("# Top level");
    // Per the PRD subset (h2–h4 only), h1 is NOT in the whitelist. The renderer
    // must not produce <h1>; either it strips the heading or downgrades it. We
    // assert no <h1> escapes — the test passes whether the input is stripped
    // or treated as paragraph text.
    expect(html).not.toMatch(/<h1[^>]*>/);
  });

  test("rejects ##### (h5) and ###### (h6)", () => {
    expect(markdownToHtml("##### too deep")).not.toMatch(/<h5[^>]*>/);
    expect(markdownToHtml("###### too deep")).not.toMatch(/<h6[^>]*>/);
  });

  test("renders inline emphasis inside headings", () => {
    const html = markdownToHtml("## A **bold** heading");
    expect(html).toMatch(/<h2>A <strong>bold<\/strong> heading<\/h2>/);
  });
});

describe("markdownToHtml — blockquotes", () => {
  test("converts > line to <blockquote>", () => {
    const html = markdownToHtml("> a quote");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("a quote");
    expect(html).toContain("</blockquote>");
  });

  test("groups consecutive > lines into one blockquote", () => {
    const html = markdownToHtml("> first\n> second");
    const blockquoteCount = (html.match(/<blockquote>/g) ?? []).length;
    expect(blockquoteCount).toBe(1);
    expect(html).toContain("first");
    expect(html).toContain("second");
  });

  test("renders inline emphasis inside blockquotes", () => {
    const html = markdownToHtml("> a **strong** quote");
    expect(html).toContain("<strong>strong</strong>");
  });
});

describe("markdownToHtml — paragraphs", () => {
  test("wraps plain text in <p>", () => {
    expect(markdownToHtml("hello world")).toContain("<p>hello world</p>");
  });

  test("treats blank-line-separated text as separate paragraphs", () => {
    const html = markdownToHtml("first\n\nsecond");
    expect(html).toContain("<p>first</p>");
    expect(html).toContain("<p>second</p>");
  });

  test("returns empty string for empty input", () => {
    expect(markdownToHtml("")).toBe("");
    expect(markdownToHtml("   \n   ")).toBe("");
  });
});
