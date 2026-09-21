import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { validate } from "@sosb/schema";
import fixtureJson from "./fixtures/articles.json" with { type: "json" };
import {
  KNOWN_THEME_IDS,
  articleDistPath,
  articleHreflangEntriesFor,
  articleLanguageSwitcherEntriesFor,
  articlePath,
  articleRedirectsFor,
  renderSite,
} from "../src/index.js";

const fixture = fixtureJson as unknown as Site;
const articles = fixture.articles ?? [];
const byId = (id: string) => {
  const found = articles.find((a) => a.id === id);
  if (found === undefined) throw new Error(`fixture has no article ${id}`);
  return found;
};
const indexOf = (id: string) => articles.findIndex((a) => a.id === id);

describe("articles fixture", () => {
  test("validates clean, so the renderer tests exercise real data", () => {
    const result = validate(fixture);
    expect(result.errors).toEqual([]);
  });
});

describe("article URLs (ADR 0047)", () => {
  test("default-language articles live under /articles/<slug>/", () => {
    expect(articlePath(fixture, byId("art_ro_gala"))).toBe("/articles/gala-de-final/");
  });

  test("secondary-language articles are language-prefixed", () => {
    expect(articlePath(fixture, byId("art_en_gala"))).toBe("/en/articles/end-of-year-gala/");
  });

  test("dist paths mirror the URL one-to-one", () => {
    expect(articleDistPath(fixture, byId("art_ro_gala"))).toBe("articles/gala-de-final/index.html");
    expect(articleDistPath(fixture, byId("art_en_gala"))).toBe(
      "en/articles/end-of-year-gala/index.html",
    );
  });

  test("retired slugs become redirects to the current URL", () => {
    expect(articleRedirectsFor(fixture, byId("art_ro_gala"))).toEqual([
      { distPath: "articles/gala-2026/index.html", to: "/articles/gala-de-final/" },
    ]);
  });

  test("a draft's history is reserved but emits no redirect", () => {
    const draft = { ...byId("art_ro_schita"), slugHistory: ["ceva-vechi"] };
    expect(articleRedirectsFor(fixture, draft)).toEqual([]);
  });
});

describe("article translation links", () => {
  test("the switcher offers only published counterparts", () => {
    const entries = articleLanguageSwitcherEntriesFor(fixture, byId("art_ro_gala"));
    expect(entries.map((e) => [e.lang, e.href, e.isActive])).toEqual([
      ["ro", "/articles/gala-de-final/", true],
      ["en", "/en/articles/end-of-year-gala/", false],
    ]);
  });

  test("an article with no counterparts gets no switcher, with no language-home fallback", () => {
    expect(articleLanguageSwitcherEntriesFor(fixture, byId("art_ro_atelier"))).toEqual([]);
  });

  test("hreflang advertises published counterparts plus x-default", () => {
    expect(articleHreflangEntriesFor(fixture, byId("art_ro_gala"))).toEqual([
      { hreflang: "ro", href: "/articles/gala-de-final/" },
      { hreflang: "en", href: "/en/articles/end-of-year-gala/" },
      { hreflang: "x-default", href: "/articles/gala-de-final/" },
    ]);
  });

  test("unlisted articles advertise no alternates at all", () => {
    expect(articleHreflangEntriesFor(fixture, byId("art_ro_nelistat"))).toEqual([]);
  });
});

describe("article page rendering", () => {
  const html = renderSite(fixture, "stub", { articleIndex: indexOf("art_ro_gala") });

  test("renders the article title, date, and summary above its blocks", () => {
    expect(html).toContain('<h1 class="article__title">Gala de final de an</h1>');
    expect(html).toContain('<time class="article__date" datetime="2026-06-12">12 iun. 2026</time>');
    expect(html).toContain("Am premiat cele mai bune proiecte studențești ale anului.");
  });

  test("renders the article's blocks through the shared page dispatch", () => {
    expect(html).toContain('data-block="richText"');
    expect(html).toContain("<strong>200 de studenți</strong>");
  });

  test("renders tag labels as plain text, never as links", () => {
    expect(html).toContain('<li class="article__tag">Evenimente</li>');
    expect(html).not.toMatch(/<a[^>]*>\s*Evenimente\s*<\/a>/);
  });

  test("sets the document language from the article", () => {
    expect(html).toMatch(/<html[^>]*lang="ro"/);
  });

  test("uses og:type=article and the summary as the description", () => {
    expect(html).toContain('<meta property="og:type" content="article"');
    expect(html).toContain(
      '<meta name="description" content="Am premiat cele mai bune proiecte studențești ale anului."',
    );
  });

  test("renders the related-articles list, excluding the article itself", () => {
    expect(html).toContain('data-article-related="true"');
    const related = html.slice(html.indexOf('data-article-related="true"'));
    expect(related).toContain("Atelier de scriere creativă");
    // "By tag" excludes the containing Article, so it never recommends itself.
    expect(related).not.toContain('data-article-id="art_ro_gala"');
  });

  test("does not emit a robots meta for a published article", () => {
    expect(html).not.toContain('name="robots"');
  });

  test("is deterministic across repeated calls", () => {
    const again = renderSite(fixture, "stub", { articleIndex: indexOf("art_ro_gala") });
    expect(html).toBe(again);
  });

  test("throws for an out-of-range article index", () => {
    expect(() => renderSite(fixture, "stub", { articleIndex: 99 })).toThrow(/out of range/);
  });
});

describe("unlisted articles", () => {
  const html = renderSite(fixture, "stub", { articleIndex: indexOf("art_ro_nelistat") });

  test("carry a noindex directive", () => {
    expect(html).toContain('<meta name="robots" content="noindex"');
  });

  test("still render their content — they are not access-controlled", () => {
    expect(html).toContain("Raport intern");
    expect(html).toContain("Detalii interne.");
  });
});

describe("articleList block", () => {
  test("by-tag lists only published articles of the page's language, newest first", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 0 });
    const order = [...html.matchAll(/data-article-id="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["art_ro_gala", "art_ro_atelier"]);
  });

  test("excludes drafts and articles from other languages", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 0 });
    expect(html).not.toContain("Schiță nepublicată");
    expect(html).not.toContain("End-of-year gala");
  });

  test("renders the list heading and intro", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 0 });
    expect(html).toContain(
      '<h2 id="blk_home_list__title" class="article-list__title">Noutăți</h2>',
    );
    expect(html).toContain("Ce s-a întâmplat recent în asociație.");
  });

  test("cards link to the article URL and show the publication date", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 0 });
    expect(html).toContain('<a href="/articles/gala-de-final/">Gala de final de an</a>');
    expect(html).toContain('<time class="article-card__date" datetime="2026-06-12">');
  });

  test("explicit selections keep author order and may cross languages", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 1 });
    const order = [...html.matchAll(/data-article-id="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["art_ro_gala", "art_en_gala"]);
    expect(html).toContain('data-mode="selected"');
  });

  test("an empty list keeps its heading and says so", () => {
    const empty = structuredClone(fixture);
    empty.articles = [];
    const html = renderSite(empty, "stub", { pageIndex: 0 });
    expect(html).toContain("Noutăți");
    expect(html).toContain("Încă nu există articole.");
  });

  test("the empty-state string follows the rendered page's language", () => {
    const empty = structuredClone(fixture);
    empty.articles = [];
    const html = renderSite(empty, "stub", { pageIndex: 1 });
    expect(html).toContain("No articles yet.");
  });
});

describe("preview mode reaches article links", () => {
  test("a single-page site with articles still gets the nav interceptor", () => {
    const single = structuredClone(fixture);
    single.languages = ["ro"];
    single.pages = [single.pages[0]!];
    single.articles = (single.articles ?? []).filter((a) => a.lang === "ro");
    const html = renderSite(single, "stub", { pageIndex: 0, mode: "preview" });
    expect(html).toContain("data-sosb-preview-nav");
  });

  test("deploy output never carries the interceptor", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 0 });
    expect(html).not.toContain("data-sosb-preview-nav");
  });
});

describe("article rendering across every registered theme", () => {
  test.each(KNOWN_THEME_IDS)("%s renders an article page with list styling", (themeId) => {
    const html = renderSite(fixture, themeId, { articleIndex: indexOf("art_ro_gala") });
    expect(html).toContain('class="article"');
    expect(html).toContain('[data-block="articleList"]');
    expect(html).toContain(".article__title");
  });

  test.each(KNOWN_THEME_IDS)("%s keeps colour discipline on article rules", (themeId) => {
    const html = renderSite(fixture, themeId, { articleIndex: indexOf("art_ro_gala") });
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
      .map((m) => m[1] ?? "")
      .join("\n")
      .replace(/:root\s*\{[^}]*\}/g, "");
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/\brgba?\(\s*[#0-9.]/);
  });
});

describe("article asset depth (#116)", () => {
  /**
   * Articles sit one or two directories deeper than any Page, so they are the
   * case most likely to regress the depth-prefix work: a Page's prefix applied
   * to an Article emits `../assets/…` from a directory that needs `../../`.
   */
  const cover = {
    hash: "cover1",
    path: "assets/cover1.webp",
    metadataPath: "assets/cover1.json",
    mime: "image/webp",
    width: 1200,
    height: 675,
    alt: "Gala",
  };

  function withCover(): Site {
    const site = structuredClone(fixture);
    const articles = site.articles ?? [];
    const gala = articles.find((a) => a.id === "art_ro_gala")!;
    gala.cover = cover as never;
    gala.coverAlt = "Gala";
    const en = articles.find((a) => a.id === "art_en_gala")!;
    en.cover = cover as never;
    en.coverAlt = "Gala";
    return site;
  }

  test("a default-language article hops up two directories", () => {
    const site = withCover();
    const html = renderSite(site, "stub", { articleIndex: indexOf("art_ro_gala") });
    expect(html).toContain('src="../../assets/cover1.webp"');
    expect(html).not.toContain('src="assets/cover1.webp"');
  });

  test("a secondary-language article hops up three", () => {
    const site = withCover();
    const html = renderSite(site, "stub", { articleIndex: indexOf("art_en_gala") });
    expect(html).toContain('src="../../../assets/cover1.webp"');
  });

  test("self-hosted theme fonts get the same prefix", () => {
    const html = renderSite(fixture, "academic", { articleIndex: indexOf("art_ro_gala") });
    expect(html).toContain("../../assets/fonts/");
    expect(html).not.toMatch(/url\(assets\/fonts\//);
  });

  test("article-list cards on a page use the page's own depth, not the article's", () => {
    const site = withCover();
    // Page 0 is the default-language home, emitted at `index.html` — depth 0.
    const html = renderSite(site, "stub", { pageIndex: 0 });
    expect(html).toContain('src="assets/cover1.webp"');
    expect(html).not.toContain('src="../assets/cover1.webp"');
  });

  test("a preview resolver still wins over the depth prefix", () => {
    const site = withCover();
    const html = renderSite(site, "stub", {
      articleIndex: indexOf("art_ro_gala"),
      assetUrlForPath: (path) => (path === "assets/cover1.webp" ? "blob:fake" : undefined),
    });
    expect(html).toContain('src="blob:fake"');
  });

  test("article links stay root-anchored, matching page links", () => {
    const html = renderSite(fixture, "stub", { pageIndex: 0 });
    expect(html).toContain('href="/articles/gala-de-final/"');
  });
});
