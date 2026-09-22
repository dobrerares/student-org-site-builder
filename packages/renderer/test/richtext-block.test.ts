import { describe, expect, test } from "vitest";
import type { RichTextDocument, Site } from "@sosb/schema";
import richtextOnly from "./fixtures/richtext-only.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = richtextOnly as unknown as Site;

function clone(): Site {
  return JSON.parse(JSON.stringify(fixture)) as Site;
}

function withDoc(site: Site, doc: RichTextDocument, extra: Record<string, unknown> = {}): Site {
  site.pages[0]!.blocks[0]!.data = { doc, ...extra } as never;
  return site;
}

function doc(...content: unknown[]): RichTextDocument {
  return { version: 1, content } as unknown as RichTextDocument;
}

function para(...content: unknown[]): unknown {
  return { type: "paragraph", content };
}

function text(value: string, marks?: unknown[]): unknown {
  return marks === undefined ? { type: "text", text: value } : { type: "text", text: value, marks };
}

describe("renderSite — richText block (structural)", () => {
  test("renders a <section data-block=richText>", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="richText"/);
  });

  test("renders the data-block-id from the schema id", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/data-block-id="blk_about_intro"/);
  });

  test("renders the document vocabulary as the whitelist HTML elements", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<h2[^>]*>Despre noi<\/h2>/);
    expect(html).toContain("<strong>studențească</strong>");
    expect(html).toContain("<em>2024</em>");
    expect(html).toMatch(/<ul[^>]*>/);
    expect(html).toMatch(/<li[^>]*>Cercetare<\/li>/);
    expect(html).toContain("<blockquote>");
    expect(html).toMatch(/<a\s+href="https:\/\/anosr\.ro"[^>]*>site-ul nostru<\/a>/);
  });

  test("renders the marks the Markdown subset never had", () => {
    // Underline and strikethrough are new in ADR 0048 — they had no Markdown
    // spelling, which is part of why the Block needed a structured format.
    const html = renderSite(
      withDoc(
        clone(),
        doc(
          para(
            text("plain "),
            text("under", [{ type: "underline" }]),
            text(" and "),
            text("struck", [{ type: "strike" }]),
          ),
        ),
      ),
      "stub",
    );
    expect(html).toContain("<u>under</u>");
    expect(html).toContain("<s>struck</s>");
  });

  test("nests marks outermost-first, as stored", () => {
    // The mark array's order is the element nesting. Both orders are legal
    // and they are not the same document.
    const boldOutside = renderSite(
      withDoc(
        clone(),
        doc(para(text("x", [{ type: "bold" }, { type: "italic" }]))),
      ),
      "stub",
    );
    expect(boldOutside).toContain("<strong><em>x</em></strong>");

    const italicOutside = renderSite(
      withDoc(
        clone(),
        doc(para(text("x", [{ type: "italic" }, { type: "bold" }]))),
      ),
      "stub",
    );
    expect(italicOutside).toContain("<em><strong>x</strong></em>");
  });

  test("escapes text and attributes from a structured document", () => {
    // Structured storage does not make imported content trusted (issue #100):
    // a hand-edited project file can put anything in a text node.
    const html = renderSite(
      withDoc(
        clone(),
        doc(
          para(
            text("<script>x()</script>", [
              { type: "link", target: { kind: "external", href: "javascript:x()" } },
            ]),
          ),
        ),
      ),
      "stub",
    );
    expect(html).not.toMatch(/<script[^>]*>/i);
    expect(html).toContain("&lt;script&gt;");
    // The unsafe scheme is dropped, and the words survive as plain text.
    const anchors = /<a\s+href="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = anchors.exec(html)) !== null) {
      expect(m[1]).not.toMatch(/^\s*javascript:/i);
    }
  });

  test("renders multiple richText blocks on the same page independently", () => {
    const twoBlocks = clone();
    twoBlocks.pages[0]!.blocks.push({
      id: "blk_about_more",
      type: "richText",
      version: 2,
      data: {
        doc: doc(
          { type: "heading", level: 3, content: [text("A second heading")] },
          para(text("A second paragraph.")),
        ),
      },
    } as never);
    const html = renderSite(twoBlocks, "stub");
    expect(html).toMatch(/data-block-id="blk_about_intro"/);
    expect(html).toMatch(/data-block-id="blk_about_more"/);
    expect(html).toMatch(/<h3[^>]*>A second heading<\/h3>/);
  });

  test("emits richText title and paragraph alignment attributes when set", () => {
    const html = renderSite(
      withDoc(
        clone(),
        doc({ type: "heading", level: 2, content: [text("Despre noi")] }, para(text("Un paragraf."))),
        { titleAlign: "left", paragraphAlign: "justify" },
      ),
      "academic",
    );
    expect(html).toMatch(
      /<section[^>]*data-block="richText"[^>]*data-title-align="left"[^>]*data-paragraph-align="justify"/,
    );
    expect(html).toContain('[data-block="richText"][data-paragraph-align="justify"]');
    expect(html).toContain("text-align: justify;");
  });

  test("emits per-node alignment as data-align", () => {
    const html = renderSite(
      withDoc(clone(), doc({ type: "paragraph", align: "center", content: [text("Centred.")] })),
      "academic",
    );
    expect(html).toContain('<p data-align="center">Centred.</p>');
    // And the theme layer has a rule that can win over the Block default.
    expect(html).toContain('[data-align="center"]');
  });

  test("suppresses a richText with an empty document (empty-state foolproofing)", () => {
    // A richText with no meaningful content renders nothing rather than an
    // empty styled container, so a non-designer who leaves a Block blank gets
    // no empty box. See empty-states.test.ts for the cross-block contract.
    for (const empty of [doc(), doc(para()), doc(para(text("   ")))]) {
      const html = renderSite(withDoc(clone(), empty), "stub");
      expect(html).not.toMatch(/<section[^>]*data-block="richText"/);
      expect(html).not.toMatch(/<!-- unknown block/);
    }
  });

  test("ignores unknown extra fields on richText data (forward-compat)", () => {
    const withExtra = clone();
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>)["futureField"] = "kept";
    const html = renderSite(withExtra, "stub");
    expect(html).toMatch(/<h2[^>]*>Despre noi<\/h2>/);
  });
});

describe("renderSite — richText images", () => {
  const image = {
    type: "image",
    asset: {
      hash: "abc123",
      path: "assets/abc123.png",
      metadataPath: "assets/abc123.json",
      mime: "image/png",
      width: 800,
      height: 600,
      alt: "Echipa în fața sediului",
    },
    caption: "Echipa, 2026",
  };

  test("renders a figure with the asset path, description and dimensions", () => {
    const html = renderSite(withDoc(clone(), doc(image)), "stub");
    expect(html).toContain('<figure class="rich-text-figure">');
    expect(html).toContain('alt="Echipa în fața sediului"');
    expect(html).toContain('width="800" height="600"');
    expect(html).toContain("<figcaption>Echipa, 2026</figcaption>");
    expect(html).toContain('loading="lazy"');
  });

  test("routes the image through the asset resolver", () => {
    // Same resolver every other image-bearing Block gets: a blob URL in the
    // editor preview, a depth-prefixed relative path in a build.
    const html = renderSite(withDoc(clone(), doc(image)), "stub", {
      assetUrlForPath: (path) => `blob:test/${path}`,
    });
    expect(html).toContain('src="blob:test/assets/abc123.png"');
  });

  test("a page one level deep gets the depth-prefixed asset path", () => {
    // The fixture's only page is its language home, emitted at
    // `index.html`, so it needs no prefix. A second page is emitted at
    // `<slug>/index.html` and its asset references must climb out of that
    // directory — the same rule every other image-bearing Block follows.
    const site = withDoc(clone(), doc(image));
    const home = site.pages[0]!;
    site.pages.push({ ...home, slug: "contact", navLabel: "Contact", navOrder: 1 });

    expect(renderSite(site, "stub")).toContain('src="assets/abc123.png"');
    expect(renderSite(site, "stub", { pageIndex: 1 })).toContain('src="../assets/abc123.png"');
  });

  test("omits the caption element when there is no caption", () => {
    const { caption: _caption, ...noCaption } = image;
    const html = renderSite(withDoc(clone(), doc(noCaption)), "stub");
    expect(html).toContain("<figure");
    expect(html).not.toContain("<figcaption>");
  });
});

describe("renderSite — richText internal links", () => {
  /**
   * The fixture's single page is its language home, whose path is `/`
   * whatever its slug — which would make a slug-rename assertion
   * meaningless. So these cases add a second page and link at that one.
   */
  function siteWithLink(target: unknown, pageId?: string): Site {
    const site = clone();
    const home = site.pages[0]!;
    site.pages.push({
      ...home,
      // A slug distinct from the home page's: `isLanguageHome` compares
      // slugs, so reusing "despre" would make this second page look like the
      // home page and resolve to "/".
      slug: "contact",
      navLabel: "Contact",
      navOrder: 1,
      blocks: [],
      ...(pageId === undefined ? {} : { id: pageId }),
    });
    return withDoc(site, doc(para(text("vezi pagina", [{ type: "link", target }]))));
  }

  test("resolves a Page target to the Page's current path", () => {
    const html = renderSite(siteWithLink({ kind: "page", pageId: "page_1" }, "page_1"), "stub");
    expect(html).toContain('<a href="/contact/">vezi pagina</a>');
  });

  test("a renamed slug moves the link with it", () => {
    // The whole point of storing identity rather than a URL.
    const site = siteWithLink({ kind: "page", pageId: "page_1" }, "page_1");
    site.pages[1]!.slug = "despre-noi";
    const html = renderSite(site, "stub");
    expect(html).toContain('<a href="/despre-noi/">vezi pagina</a>');
  });

  test("a broken Page target renders as unlinked text, keeping the words", () => {
    // ADR 0048 revises issue #97's blanket blocking rule for prose links:
    // warn, render unlinked, never drop the author's words.
    const html = renderSite(siteWithLink({ kind: "page", pageId: "page_gone" }), "stub");
    expect(html).toContain("vezi pagina");
    expect(html).not.toMatch(/<a[^>]*>vezi pagina/);
  });

  test("resolves an Article target, and drops the link for a Draft", () => {
    const published = siteWithLink({ kind: "article", articleId: "art_1" });
    (published as unknown as { articles: unknown[] }).articles = [
      { id: "art_1", lang: "ro", slug: "prima-stire", state: "published" },
    ];
    expect(renderSite(published, "stub")).toContain('<a href="/articles/prima-stire/">');

    const draft = siteWithLink({ kind: "article", articleId: "art_1" });
    (draft as unknown as { articles: unknown[] }).articles = [
      { id: "art_1", lang: "ro", slug: "prima-stire", state: "draft" },
    ];
    const draftHtml = renderSite(draft, "stub");
    expect(draftHtml).toContain("vezi pagina");
    expect(draftHtml).not.toMatch(/<a[^>]*>vezi pagina/);
  });

  test("an Unlisted Article is a legitimate link target", () => {
    const site = siteWithLink({ kind: "article", articleId: "art_1" });
    (site as unknown as { articles: unknown[] }).articles = [
      { id: "art_1", lang: "ro", slug: "ascuns", state: "unlisted" },
    ];
    expect(renderSite(site, "stub")).toContain('<a href="/articles/ascuns/">');
  });
});

describe("renderSite — unsupported rich-text content", () => {
  test("renders an empty labelled placeholder rather than inventing markup", () => {
    const html = renderSite(
      withDoc(clone(), doc({ type: "futureCallout", content: [para(text("hi"))] })),
      "stub",
    );
    expect(html).toContain('data-unsupported-type="futureCallout"');
    // Nothing is guessed at: no text from inside the unknown node leaks out
    // in a shape this version made up.
    expect(html).not.toContain(">hi<");
  });

  test("an unknown mark degrades to plain text without losing the words", () => {
    const html = renderSite(
      withDoc(clone(), doc(para(text("marked", [{ type: "futureHighlight" }])))),
      "stub",
    );
    expect(html).toContain("marked");
    expect(html).not.toContain("futureHighlight");
  });
});

describe("renderSite — richText golden file", () => {
  test("richText fixture under stub theme matches its golden file", async () => {
    const html = renderSite(fixture, "stub");
    await expect(html).toMatchFileSnapshot("__golden__/stub-theme-richtext.html");
  });
});
