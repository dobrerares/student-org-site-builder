import { describe, expect, test } from "vitest";
import { markdownToHtml } from "../src/index.js";

/**
 * XSS attack-vector corpus.
 *
 * The PRD requires that "all XSS attack vectors from a known corpus (e.g.,
 * OWASP cheatsheet) are sanitized." This file exercises a representative set
 * of those vectors. The contract is:
 *
 *   For every input in the corpus, the produced HTML must contain no
 *   executable surface — no script/iframe/object/embed/style tags, no on*=
 *   attributes, no javascript:/data:/vbscript: schemes in any href, and no
 *   raw HTML element from outside the whitelist.
 *
 * The whitelist (per PRD): p, strong, em, code, a, ul, ol, li, h2, h3, h4,
 * blockquote. Any element produced by the renderer must be in this list.
 */

const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "p",
  "strong",
  "em",
  "code",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
]);

/**
 * Extract the actual real-tag opens from the produced HTML.
 *
 * The renderer's safety contract is: every literal `<` from user input is
 * escaped to `&lt;`, so the only `<…>` substrings remaining in the output
 * are the tags the renderer chose to emit. Walking those real tags is the
 * right signal for "is the output safe?" — checking the raw string against
 * forbidden-pattern regexes would falsely flag escaped attacker text like
 * `&lt;script&gt;` as dangerous, when in fact it is rendered as inert
 * literal text.
 */
function extractRealTags(html: string): { name: string; attrs: string }[] {
  const tags: { name: string; attrs: string }[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    tags.push({ name: m[1]!.toLowerCase(), attrs: m[2] ?? "" });
  }
  return tags;
}

const FORBIDDEN_HREF_SCHEME_RE = /^\s*(?:javascript|data|vbscript|file)\s*:/i;
const ON_HANDLER_RE = /\son[a-z]+\s*=/i;

function isOutputSafe(html: string): { ok: true } | { ok: false; reason: string } {
  for (const tag of extractRealTags(html)) {
    if (!ALLOWED_TAGS.has(tag.name)) {
      return { ok: false, reason: "non-whitelisted tag <" + tag.name + "> in output: " + html };
    }
    if (ON_HANDLER_RE.test(tag.attrs)) {
      return { ok: false, reason: "inline event handler in output: " + html };
    }
    const hrefMatch = /href\s*=\s*"([^"]*)"/i.exec(tag.attrs);
    if (hrefMatch !== null && FORBIDDEN_HREF_SCHEME_RE.test(hrefMatch[1] ?? "")) {
      return { ok: false, reason: "forbidden href scheme: " + html };
    }
  }
  return { ok: true };
}

interface XssVector {
  readonly name: string;
  readonly input: string;
}

const CORPUS: ReadonlyArray<XssVector> = [
  { name: "raw script tag", input: "<script>x()</script>" },
  { name: "raw script with attribute", input: '<script src="evil.js"></script>' },
  { name: "img onerror", input: '<img src="x" onerror="x()">' },
  { name: "svg onload", input: '<svg/onload="x()">' },
  { name: "iframe injection", input: '<iframe src="javascript:x()"></iframe>' },
  { name: "javascript link", input: "[click me](javascript:x())" },
  { name: "data link with HTML payload", input: "[click](data:text/html,<script>x()</script>)" },
  { name: "vbscript link", input: "[click](vbscript:msgbox(1))" },
  { name: "link with mixed-case JS scheme", input: "[click](JaVaScRiPt:x())" },
  { name: "link with whitespace before scheme", input: "[click](   javascript:x())" },
  { name: "html entity-encoded js scheme", input: "[click](&#106;&#97;vascript:x())" },
  { name: "link with newline in URL", input: "[click](java\nscript:x())" },
  { name: "object tag", input: '<object data="evil.swf"></object>' },
  { name: "embed tag", input: '<embed src="evil.swf">' },
  { name: "style tag", input: '<style>body{background:url("javascript:x()")}</style>' },
  {
    name: "meta refresh redirect",
    input: '<meta http-equiv="refresh" content="0;url=javascript:x()">',
  },
  { name: "form injection", input: '<form action="evil.com"><input name="x"></form>' },
  { name: "anchor with onclick handler", input: '<a href="#" onclick="x()">click</a>' },
  { name: "double-encoded js link", input: "[click](&amp;javascript:x())" },
  {
    name: "html comment with conditional script",
    input: "<!--[if IE]><script>x()</script><![endif]-->",
  },
  { name: "img tag injection", input: '<img src="x" alt="y">' },
  { name: "br tag injection", input: "<br>" },
  { name: "hr tag injection", input: "<hr>" },
  { name: "div with style attribute", input: '<div style="background:url(javascript:x())"></div>' },
  { name: "link tag", input: '<link rel="stylesheet" href="evil.css">' },
  { name: "base tag", input: '<base href="https://evil.com/">' },
  { name: "input autofocus onfocus", input: '<input autofocus onfocus="x()">' },
  { name: "details ontoggle", input: '<details ontoggle="x()" open>x</details>' },
  { name: "math href", input: '<math href="javascript:x()"><mtext>X</mtext></math>' },
  { name: "literal less-than in text", input: "a < b > c" },
  { name: "broken closing tag", input: "</script>" },
  { name: "html entity encoding for tag bracket", input: "&lt;script&gt;x()&lt;/script&gt;" },
  { name: "markdown link with embedded brackets", input: "[text [nested]](http://example.com)" },
  {
    name: "raw script with markdown link inside",
    input: "<script>[click](http://example.com)</script>",
  },
];

describe("markdownToHtml — XSS corpus", () => {
  for (const vector of CORPUS) {
    test("vector " + vector.name + " produces no executable surface", () => {
      const html = markdownToHtml(vector.input);
      const verdict = isOutputSafe(html);
      if (!verdict.ok) {
        throw new Error('Unsafe output for vector "' + vector.name + '": ' + verdict.reason);
      }
    });
  }

  test("a literal script tag in input never appears in output", () => {
    const html = markdownToHtml("here is <script>x()</script> embedded");
    expect(html).not.toMatch(/<script[^>]*>/i);
  });

  test("event handler attributes inside tag-shaped input are escaped, not active", () => {
    // The escaped form `&lt;div onmouseover="..."&gt;` is inert literal text.
    // The contract is that no REAL tag in the output carries the handler.
    const html = markdownToHtml('<div onmouseover="x()">hover</div>');
    const verdict = isOutputSafe(html);
    expect(verdict.ok).toBe(true);
    // Belt-and-braces: the literal `<div ...>` from the input must not survive
    // as a real tag in the output (the `<` should be escaped to `&lt;`).
    expect(html).not.toMatch(/<div[^>]*onmouseover/i);
  });

  test("URL-encoded javascript scheme is still rejected", () => {
    const html = markdownToHtml("[click](%6A%61vascript:x())");
    // No real-tag href may carry a literal `javascript:` URL.
    const realTags = /<a\s+href="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = realTags.exec(html)) !== null) {
      expect(m[1]).not.toMatch(/^\s*javascript:/i);
    }
  });
});
