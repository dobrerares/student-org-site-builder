import { describe, expect, test } from "vitest";
import { markdownToHtml } from "../src/index.js";

/**
 * HTML-escape behaviour.
 *
 * Plain text is always emitted via the parser's text node, never via raw
 * HTML pass-through. The renderer escapes <, >, &, ", ' to entities so
 * that arbitrary user prose is rendered verbatim instead of as markup.
 */

describe("markdownToHtml — text escaping", () => {
  test("ampersands are encoded", () => {
    expect(markdownToHtml("a & b")).toContain("a &amp; b");
  });

  test("less-than is encoded outside tags", () => {
    expect(markdownToHtml("3 < 4")).toContain("3 &lt; 4");
  });

  test("greater-than is encoded outside tags", () => {
    expect(markdownToHtml("4 > 3")).toContain("4 &gt; 3");
  });

  test("double quotes inside text are preserved in some safe form", () => {
    const html = markdownToHtml('she said "hi"');
    // Either bare " in body text or &quot; — both are safe because text is
    // rendered between tags, not inside attributes.
    expect(html).toMatch(/she said (".+"|&quot;.+&quot;)/);
  });
});
