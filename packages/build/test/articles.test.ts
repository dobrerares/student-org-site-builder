import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import fixtureJson from "./fixtures/articles.json" with { type: "json" };
import { build } from "../src/index.js";
import { textOf } from "./helpers/dist-text.js";

const fixture = fixtureJson as unknown as Site;
const SITE_URL = "https://example.org";

function paths(dist: Map<string, string | Uint8Array>): string[] {
  return [...dist.keys()];
}

describe("article routing in dist", () => {
  const dist = build(fixture, { siteUrl: SITE_URL });

  test("emits default-language articles at articles/<slug>/index.html", () => {
    expect(paths(dist)).toContain("articles/gala-de-final/index.html");
  });

  test("emits secondary-language articles under their language prefix", () => {
    expect(paths(dist)).toContain("en/articles/end-of-year-gala/index.html");
  });

  test("emits unlisted articles — they are reachable, just undiscoverable", () => {
    expect(paths(dist)).toContain("articles/raport-intern/index.html");
  });

  test("omits draft articles entirely", () => {
    expect(paths(dist)).not.toContain("articles/schita-nepublicata/index.html");
    const everything = paths(dist).join("\n");
    expect(everything).not.toContain("schita-nepublicata");
  });

  test("article pages are ordered after page output for a deterministic dist", () => {
    const keys = paths(dist);
    expect(keys.indexOf("index.html")).toBeLessThan(
      keys.indexOf("articles/gala-de-final/index.html"),
    );
  });

  test("rebuilds are byte-identical", () => {
    const again = build(fixture, { siteUrl: SITE_URL });
    for (const [key, value] of dist) {
      if (typeof value === "string") expect(textOf(again, key)).toBe(value);
    }
  });
});

describe("slug-history redirects", () => {
  const dist = build(fixture, { siteUrl: SITE_URL });
  const stub = textOf(dist, "articles/gala-2026/index.html");

  test("a retired slug gets a static redirect stub", () => {
    expect(stub).toContain('<meta http-equiv="refresh" content="0; url=/articles/gala-de-final/"');
  });

  test("the stub points crawlers at the current URL and excludes itself", () => {
    expect(stub).toContain('<link rel="canonical" href="https://example.org/articles/gala-de-final/"');
    expect(stub).toContain('<meta name="robots" content="noindex"');
  });

  test("the stub has a visible fallback link", () => {
    expect(stub).toContain('<a href="/articles/gala-de-final/">');
  });

  test("the stub speaks the article's language", () => {
    expect(stub).toContain('<html lang="ro">');
    expect(stub).toContain("Această pagină s-a mutat.");
  });

  test("a draft's retired slugs emit nothing", () => {
    const withDraftHistory = structuredClone(fixture);
    withDraftHistory.articles = (withDraftHistory.articles ?? []).map((article) =>
      article.id === "art_ro_schita" ? { ...article, slugHistory: ["ceva-vechi"] } : article,
    );
    const draftDist = build(withDraftHistory, { siteUrl: SITE_URL });
    expect(paths(draftDist)).not.toContain("articles/ceva-vechi/index.html");
  });
});

describe("article SEO overlay", () => {
  const dist = build(fixture, { siteUrl: SITE_URL });
  const gala = textOf(dist, "articles/gala-de-final/index.html");
  const unlisted = textOf(dist, "articles/raport-intern/index.html");

  test("canonical and og:url use the article URL", () => {
    expect(gala).toContain('<link rel="canonical" href="https://example.org/articles/gala-de-final/"');
    expect(gala).toContain('<meta property="og:url" content="https://example.org/articles/gala-de-final/"');
  });

  test("hreflang alternates are absolutised and relative ones removed", () => {
    expect(gala).toContain(
      '<link rel="alternate" hreflang="en" href="https://example.org/en/articles/end-of-year-gala/"/>',
    );
    expect(gala).not.toContain('href="/en/articles/end-of-year-gala/"/>');
  });

  test("unlisted articles keep noindex and advertise no alternates", () => {
    expect(unlisted).toContain('<meta name="robots" content="noindex"');
    expect(unlisted).not.toContain('rel="alternate"');
  });

  test("emits Article JSON-LD with the publication date and publisher", () => {
    expect(gala).toContain('"@type":"Article"');
    expect(gala).toContain('"headline":"Gala de final de an"');
    expect(gala).toContain('"datePublished":"2026-06-12"');
    expect(gala).toContain('"inLanguage":"ro"');
    expect(gala).toContain('"mainEntityOfPage":"https://example.org/articles/gala-de-final/"');
    expect(gala).toContain('"publisher"');
  });

  test("ordinary pages still emit no Article JSON-LD", () => {
    expect(textOf(dist, "index.html")).not.toContain('"@type":"Article"');
  });
});

describe("sitemap", () => {
  test("lists published articles and omits unlisted and draft ones", () => {
    const sitemap = textOf(build(fixture, { siteUrl: SITE_URL }), "sitemap.xml");
    expect(sitemap).toContain("<loc>https://example.org/articles/gala-de-final/</loc>");
    expect(sitemap).toContain("<loc>https://example.org/en/articles/end-of-year-gala/</loc>");
    expect(sitemap).not.toContain("raport-intern");
    expect(sitemap).not.toContain("schita-nepublicata");
  });

  test("annotates article entries with their published alternates", () => {
    const sitemap = textOf(build(fixture, { siteUrl: SITE_URL }), "sitemap.xml");
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://example.org/en/articles/end-of-year-gala/"/>',
    );
  });

  test("pages come before articles so the file order is stable", () => {
    const sitemap = textOf(build(fixture, { siteUrl: SITE_URL }), "sitemap.xml");
    expect(sitemap.indexOf("<loc>https://example.org/</loc>")).toBeLessThan(
      sitemap.indexOf("articles/gala-de-final"),
    );
  });
});

describe("sites without articles", () => {
  test("build output is unchanged when site.articles is absent", () => {
    const noArticles = structuredClone(fixture);
    delete noArticles.articles;
    delete noArticles.tags;
    noArticles.pages = [noArticles.pages[0]!];
    noArticles.pages[0]!.blocks = [];
    noArticles.languages = ["ro"];
    const dist = build(noArticles, { siteUrl: SITE_URL });
    expect(paths(dist).filter((p) => p.includes("articles/"))).toEqual([]);
    expect(textOf(dist, "sitemap.xml")).not.toContain("/articles/");
  });
});
