import { describe, expect, test } from "vitest";
import type { RichTextDocument, Site } from "@sosb/schema";
import articles from "./fixtures/articles.json" with { type: "json" };
import { renderSite } from "../src/index.js";

/**
 * Rich text inside Articles (ADR 0047 + ADR 0048).
 *
 * Article bodies start with a Rich-text Block, so everything the Block does
 * has to work one level deeper in the URL tree and against a second kind of
 * container. Two things are easy to get wrong and invisible if untested:
 * an Article page lives at `/articles/<slug>/`, which is one directory
 * deeper than a Page, so its asset references need a different prefix; and
 * the link resolver has to be handed to the Article shell as well as the
 * Page shell, or every prose link inside an Article silently degrades to
 * plain text.
 */

const fixture = articles as unknown as Site;

function clone(): Site {
  return JSON.parse(JSON.stringify(fixture)) as Site;
}

/** Index of the first published Article in the fixture. */
function publishedIndex(site: Site): number {
  const index = (site.articles ?? []).findIndex((a) => a.state === "published");
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

function setBody(site: Site, index: number, doc: RichTextDocument): Site {
  site.articles![index]!.blocks = [
    { id: "blk_body", type: "richText", version: 2, data: { doc } },
  ] as never;
  return site;
}

function doc(...content: unknown[]): RichTextDocument {
  return { version: 1, content } as unknown as RichTextDocument;
}

describe("rich text inside an Article", () => {
  test("the fixture's Article bodies already are structured documents", () => {
    // Guards the migration of the Articles fixtures: if someone reintroduces
    // a `markdown` Block here, the deep parse would fail loudly instead.
    for (const article of fixture.articles ?? []) {
      for (const block of article.blocks) {
        if (block.type !== "richText") continue;
        expect(block.version).toBe(2);
        expect((block.data as { doc?: unknown }).doc).toBeDefined();
      }
    }
  });

  test("renders prose through the same dispatch a Page uses", () => {
    const site = clone();
    const index = publishedIndex(site);
    setBody(
      site,
      index,
      doc(
        { type: "heading", level: 2, content: [{ type: "text", text: "Subtitlu" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "accentuat", marks: [{ type: "bold" }] }],
        },
      ),
    );
    const html = renderSite(site, "stub", { articleIndex: index });
    expect(html).toMatch(/<section[^>]*data-block="richText"/);
    expect(html).toContain("<h2>Subtitlu</h2>");
    expect(html).toContain("<strong>accentuat</strong>");
  });

  test("an image in an Article body climbs two directories, not one", () => {
    // `/articles/<slug>/index.html` is two levels down, so `assets/x.png`
    // has to become `../../assets/x.png`. A Page one level down would get a
    // single `../`, which is exactly the bug this pins.
    const site = clone();
    const index = publishedIndex(site);
    setBody(
      site,
      index,
      doc({
        type: "image",
        asset: {
          hash: "abc123",
          path: "assets/abc123.png",
          metadataPath: "assets/abc123.json",
          mime: "image/png",
          width: 800,
          height: 600,
          alt: "Fotografie de la eveniment",
        },
      }),
    );
    const html = renderSite(site, "stub", { articleIndex: index });
    expect(html).toContain('src="../../assets/abc123.png"');
  });

  test("a prose link to a Page resolves from inside an Article", () => {
    const site = clone();
    const index = publishedIndex(site);
    // Appended rather than found: the fixture's language home would resolve
    // to "/" whatever its slug, which would make the assertion vacuous.
    const home = site.pages[0]!;
    site.pages.push({
      ...home,
      id: "page_target",
      slug: "contact",
      navLabel: "Contact",
      navOrder: 99,
      blocks: [],
    });
    const target = site.pages.length - 1;

    setBody(
      site,
      index,
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "vezi pagina",
            marks: [{ type: "link", target: { kind: "page", pageId: "page_target" } }],
          },
        ],
      }),
    );
    const html = renderSite(site, "stub", { articleIndex: index });
    expect(html).toContain(`<a href="/${site.pages[target]!.slug}/">vezi pagina</a>`);
  });

  test("a prose link to another Article resolves to its public URL", () => {
    const site = clone();
    const index = publishedIndex(site);
    const other = (site.articles ?? []).find(
      (a, i) => i !== index && a.state === "published" && a.lang === site.articles![index]!.lang,
    );
    expect(other).toBeDefined();

    setBody(
      site,
      index,
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "citește și",
            marks: [{ type: "link", target: { kind: "article", articleId: other!.id } }],
          },
        ],
      }),
    );
    const html = renderSite(site, "stub", { articleIndex: index });
    expect(html).toContain(`<a href="/articles/${other!.slug}/">citește și</a>`);
  });

  test("a prose link to a Draft Article renders as unlinked text", () => {
    const site = clone();
    const index = publishedIndex(site);
    const draft = (site.articles ?? []).find((a) => a.state === "draft");
    expect(draft).toBeDefined();

    setBody(
      site,
      index,
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "ciorna",
            marks: [{ type: "link", target: { kind: "article", articleId: draft!.id } }],
          },
        ],
      }),
    );
    const html = renderSite(site, "stub", { articleIndex: index });
    // The words survive; the dead link does not.
    expect(html).toContain("ciorna");
    expect(html).not.toMatch(/<a[^>]*>ciorna/);
  });
});
