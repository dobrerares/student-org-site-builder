# @sosb/markdown

Strict-whitelist sanitised markdown for the Student Org Site Builder.
Used by the `richText`, `faq`, and `quote` blocks.

The module exposes a single primary entry point:

```ts
import { markdownToHtml } from "@sosb/markdown";

const html = markdownToHtml("## Mission\n\nWe are **HISTORIPOL**.");
// → "<h2>Mission</h2>\n<p>We are <strong>HISTORIPOL</strong>.</p>"
```

## The whitelist

```
bold (**text**)
italic (*text* / _text_)
inline code (`code`)
links ([text](url)) — http(s), mailto, tel, relative paths only
unordered lists (- ... / * ...)
ordered lists (1. ...)
headings h2-h4 (## , ### , #### )
blockquotes (> ...)
```

The output may contain only these elements: `<p>`, `<strong>`, `<em>`,
`<code>`, `<a href>`, `<ul>`, `<ol>`, `<li>`, `<h2>`, `<h3>`, `<h4>`,
`<blockquote>`. Everything else (raw HTML, h1, h5+, code fences, tables,
footnotes, images) is escaped or stripped.

## XSS-safe by construction

The renderer never round-trips raw HTML. Every literal `<`, `>`, `&`
in the input is entity-encoded before being written to the output buffer.
Link URLs pass through `sanitizeUrl()` which rejects `javascript:`,
`data:`, `vbscript:`, `file:` schemes (including entity-encoded and
whitespace-padded variants). The XSS corpus
(`test/xss-corpus.test.ts`) exercises ~35 representative attack vectors
from the OWASP cheatsheet against this contract.

## Module surface

```ts
import { markdownToHtml, sanitizeUrl, escapeText, escapeAttr } from "@sosb/markdown";
```

- `markdownToHtml(input)` — parse & render a markdown string to safe HTML.
- `sanitizeUrl(rawUrl)` — return the URL if its scheme is whitelisted, or
  `null` otherwise. Used internally by the link parser; exported for
  future blocks (e.g. CTA banner) that take URL fields.
- `escapeText(value)` / `escapeAttr(value)` — entity-encoding helpers.

See `docs/adr/0006-markdown-subset-and-richtext-block.md` for the
design decisions. Tracking issue: #9.
