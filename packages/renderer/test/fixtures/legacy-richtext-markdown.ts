/**
 * Legacy Rich-text Markdown corpus.
 *
 * Every `richText` Markdown string that was committed in this repository
 * before the ADR 0048 migration, plus the whitelist and XSS vectors that
 * `@sosb/markdown`'s own suites exercise.
 *
 * It exists so the migration's central promise can be *proved* rather than
 * asserted on a couple of happy paths:
 *
 *   > Legacy conversion preserves the current Markdown renderer's displayed
 *   > meaning, including unsupported syntax rendered as literal text.
 *
 * `markdown-migration-golden.test.ts` runs every entry through
 * `markdownToRichTextDoc` → `renderRichTextDocToHtml` and requires the result
 * to equal `markdownToHtml` byte for byte. Keeping the pathological inputs
 * (unclosed emphasis, raw HTML, entity-encoded schemes) in the same corpus is
 * the point: those are exactly where two parallel parsers drift.
 *
 * The HISTORIPOL and template entries are the real fixture content, captured
 * verbatim from the commit before the migration.
 */

export interface LegacyMarkdownSample {
  readonly name: string;
  readonly markdown: string;
}

/** Content that was really committed as `richText` Markdown. */
export const LEGACY_FIXTURE_MARKDOWN: readonly LegacyMarkdownSample[] = [
  {
    name: "renderer fixture: richtext-only (HISTORIPOL-style prose)",
    markdown:
      "## Despre noi\n\nSuntem o asociație **studențească** fondată în *2024*.\n\n" +
      "Valorile noastre:\n\n- Cercetare\n- Comunitate\n- Implicare\n\n" +
      "> Calitatea nu este opțională.\n\n" +
      "Vizitați [site-ul nostru](https://anosr.ro) pentru detalii.",
  },
  {
    name: "template asociatia-studenteasca-demo: intro paragraph",
    markdown:
      "Suntem o asociație studențească dedicată sprijinirii colegilor noștri pe parcursul " +
      "anilor universitari. Organizăm conferințe, ateliere practice, vizite de studiu și " +
      "activități de voluntariat. Toate proiectele noastre pornesc de la o singură întrebare: " +
      "ce ne-ar fi fost de folos nouă, în primul an? Răspunsurile devin programe concrete " +
      "pentru fiecare nouă generație.",
  },
  {
    name: "template asociatia-studenteasca-demo: mission and vision",
    markdown:
      "## Misiunea noastră\n\nSă oferim fiecărui student din comunitatea noastră un cadru în " +
      "care poate să își dezvolte gândirea critică, abilitățile de comunicare și încrederea " +
      "în propria voce.\n\n## Viziunea noastră\n\nO universitate în care studenții nu sunt " +
      "doar destinatari ai educației, ci coautori activi ai vieții academice — prin proiecte, " +
      "evenimente și inițiative pe care le construiesc împreună.",
  },
];

/** The ADR 0034 whitelist, one construct at a time and in combination. */
export const WHITELIST_MARKDOWN: readonly LegacyMarkdownSample[] = [
  { name: "plain paragraph", markdown: "Just some prose." },
  { name: "two paragraphs", markdown: "First para.\n\nSecond para." },
  { name: "soft-wrapped paragraph", markdown: "Line one\nline two\nline three" },
  { name: "h2", markdown: "## Heading two" },
  { name: "h3", markdown: "### Heading three" },
  { name: "h4", markdown: "#### Heading four" },
  { name: "h1 is not in the whitelist", markdown: "# Heading one" },
  { name: "h5 is not in the whitelist", markdown: "##### Heading five" },
  { name: "h6 is not in the whitelist", markdown: "###### Heading six" },
  { name: "bold", markdown: "a **bold** word" },
  { name: "italic with asterisks", markdown: "a *slanted* word" },
  { name: "italic with underscores", markdown: "a _slanted_ word" },
  { name: "inline code", markdown: "run `pnpm test` first" },
  { name: "bold containing italic", markdown: "**outer *inner* tail**" },
  { name: "italic containing bold", markdown: "*outer **inner** tail*" },
  { name: "bold inside a link", markdown: "[**bold label**](https://example.com)" },
  { name: "link inside bold", markdown: "**[bold label](https://example.com)**" },
  { name: "code containing markdown markers", markdown: "`**not bold**`" },
  { name: "unclosed bold", markdown: "a **dangling marker" },
  { name: "unclosed italic", markdown: "a *dangling marker" },
  { name: "unmatched backtick", markdown: "a ` dangling backtick" },
  { name: "empty bold", markdown: "****" },
  { name: "empty italic", markdown: "**" },
  { name: "empty link text", markdown: "[](https://example.com)" },
  { name: "bullet list with dashes", markdown: "- one\n- two\n- three" },
  { name: "bullet list with asterisks", markdown: "* one\n* two" },
  { name: "ordered list", markdown: "1. one\n2. two\n3. three" },
  { name: "ordered list not starting at one", markdown: "4. four\n5. five" },
  { name: "list item with inline marks", markdown: "- **bold** and *italic* and `code`" },
  { name: "blockquote", markdown: "> quoted words" },
  { name: "multi-line blockquote", markdown: "> first line\n> second line" },
  { name: "blockquote with marks", markdown: "> a **bold** quote" },
  { name: "mailto link", markdown: "[write](mailto:hello@example.com)" },
  { name: "tel link", markdown: "[call](tel:+40123456789)" },
  { name: "root-relative link", markdown: "[about](/despre/)" },
  { name: "relative link", markdown: "[about](despre/)" },
  { name: "fragment link", markdown: "[top](#top)" },
  { name: "link with nested brackets", markdown: "[text [nested]](http://example.com)" },
  { name: "image syntax is not in the whitelist", markdown: "![alt](/assets/x.png)" },
  { name: "code fence is not in the whitelist", markdown: "```\ncode\n```" },
  { name: "table is not in the whitelist", markdown: "| a | b |\n| - | - |\n| 1 | 2 |" },
  { name: "horizontal rule is not in the whitelist", markdown: "---" },
  { name: "footnote is not in the whitelist", markdown: "text[^1]\n\n[^1]: note" },
  { name: "windows newlines", markdown: "one\r\n\r\ntwo" },
  { name: "trailing newlines", markdown: "one\n\n\n" },
  { name: "whitespace only", markdown: "   \n  \n" },
  { name: "empty string", markdown: "" },
  { name: "ampersand and angle brackets in text", markdown: "a < b && c > d" },
  { name: "quotes and apostrophes", markdown: `she said "hi" — it's fine` },
  { name: "mixed document", markdown: "## Title\n\nIntro.\n\n- a\n- b\n\n> quote\n\nOutro." },
];

/**
 * The XSS vectors from `packages/markdown/test/xss-corpus.test.ts`.
 *
 * Parity here is load-bearing twice over: it proves the migration does not
 * change what a visitor sees, *and* it proves the new serialiser is exactly
 * as conservative as the one whose safety the corpus already certifies.
 */
export const XSS_MARKDOWN: readonly LegacyMarkdownSample[] = [
  { name: "raw script tag", markdown: "<script>x()</script>" },
  { name: "raw script with attribute", markdown: '<script src="evil.js"></script>' },
  { name: "img onerror", markdown: '<img src="x" onerror="x()">' },
  { name: "svg onload", markdown: '<svg/onload="x()">' },
  { name: "iframe injection", markdown: '<iframe src="javascript:x()"></iframe>' },
  { name: "javascript link", markdown: "[click me](javascript:x())" },
  { name: "data link with HTML payload", markdown: "[click](data:text/html,<script>x()</script>)" },
  { name: "vbscript link", markdown: "[click](vbscript:msgbox(1))" },
  { name: "link with mixed-case JS scheme", markdown: "[click](JaVaScRiPt:x())" },
  { name: "link with whitespace before scheme", markdown: "[click](   javascript:x())" },
  { name: "html entity-encoded js scheme", markdown: "[click](&#106;&#97;vascript:x())" },
  { name: "link with newline in URL", markdown: "[click](java\nscript:x())" },
  { name: "object tag", markdown: '<object data="evil.swf"></object>' },
  { name: "embed tag", markdown: '<embed src="evil.swf">' },
  { name: "style tag", markdown: '<style>body{background:url("javascript:x()")}</style>' },
  {
    name: "meta refresh redirect",
    markdown: '<meta http-equiv="refresh" content="0;url=javascript:x()">',
  },
  { name: "form injection", markdown: '<form action="evil.com"><input name="x"></form>' },
  { name: "anchor with onclick handler", markdown: '<a href="#" onclick="x()">click</a>' },
  { name: "double-encoded js link", markdown: "[click](&amp;javascript:x())" },
  {
    name: "html comment with conditional script",
    markdown: "<!--[if IE]><script>x()</script><![endif]-->",
  },
  { name: "img tag injection", markdown: '<img src="x" alt="y">' },
  { name: "br tag injection", markdown: "<br>" },
  { name: "hr tag injection", markdown: "<hr>" },
  {
    name: "div with style attribute",
    markdown: '<div style="background:url(javascript:x())"></div>',
  },
  { name: "link tag", markdown: '<link rel="stylesheet" href="evil.css">' },
  { name: "base tag", markdown: '<base href="https://evil.com/">' },
  { name: "input autofocus onfocus", markdown: '<input autofocus onfocus="x()">' },
  { name: "details ontoggle", markdown: '<details ontoggle="x()" open>x</details>' },
  { name: "math href", markdown: '<math href="javascript:x()"><mtext>X</mtext></math>' },
  { name: "literal less-than in text", markdown: "a < b > c" },
  { name: "broken closing tag", markdown: "</script>" },
  { name: "html entity encoding for tag bracket", markdown: "&lt;script&gt;x()&lt;/script&gt;" },
  {
    name: "raw script with markdown link inside",
    markdown: "<script>[click](http://example.com)</script>",
  },
  { name: "url-encoded javascript scheme", markdown: "[click](%6A%61vascript:x())" },
];

export const ALL_LEGACY_MARKDOWN: readonly LegacyMarkdownSample[] = [
  ...LEGACY_FIXTURE_MARKDOWN,
  ...WHITELIST_MARKDOWN,
  ...XSS_MARKDOWN,
];
