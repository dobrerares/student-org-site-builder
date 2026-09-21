import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { ArticleSchema, SiteSchema, hasBlockingIssues, validate } from "../src/index.js";
import type { Article } from "../src/index.js";

/**
 * Article fixtures are built on top of the HISTORIPOL site so every test
 * exercises the real spine rules (declared languages, theme, org) rather than a
 * hand-rolled minimal object that could drift from the schema.
 */

function article(overrides: Partial<Article> & Pick<Article, "id">): Article {
  return {
    lang: "ro",
    slug: `articol-${overrides.id}`,
    title: `Articol ${overrides.id}`,
    publishedAt: "2026-09-01",
    state: "published",
    blocks: [],
    ...overrides,
  } as Article;
}

function siteWith(articles: Article[], tags?: { id: string; label: string }[]): unknown {
  const site = structuredClone(historipol) as unknown as Record<string, unknown>;
  site.articles = articles;
  if (tags !== undefined) site.tags = tags;
  return site;
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

describe("article schema", () => {
  test("parses a fully-populated article", () => {
    const parsed = ArticleSchema.safeParse({
      id: "a1",
      lang: "ro",
      slug: "primul-articol",
      slugHistory: ["articol-vechi"],
      title: "Primul articol",
      summary: "Un rezumat scurt.",
      coverAlt: "Studenți în bibliotecă",
      publishedAt: "2026-09-21",
      state: "published",
      tags: ["t1"],
      translationGroup: "g1",
      seo: { title: "Primul articol", description: "Descriere" },
      relatedArticles: { enabled: true, mode: "byTag", tags: ["t1"] },
      blocks: [{ id: "b1", type: "richText", version: 1, data: { markdown: "Salut" } }],
    });
    expect(parsed.success).toBe(true);
  });

  test("parses the minimum an article can be", () => {
    const parsed = ArticleSchema.safeParse({
      id: "a1",
      lang: "ro",
      slug: "primul-articol",
      title: "Primul articol",
      publishedAt: "2026-09-21",
      state: "draft",
      blocks: [],
    });
    expect(parsed.success).toBe(true);
  });

  test.each([
    ["id", { id: "" }],
    ["slug", { slug: "" }],
    ["title", { title: "" }],
    ["lang", { lang: "" }],
  ])("rejects an empty %s", (_name, patch) => {
    const parsed = ArticleSchema.safeParse({ ...article({ id: "a1" }), ...patch });
    expect(parsed.success).toBe(false);
  });

  test("rejects an unknown publication state", () => {
    const parsed = ArticleSchema.safeParse({ ...article({ id: "a1" }), state: "archived" });
    expect(parsed.success).toBe(false);
  });

  test.each(["2026-9-1", "2026-09-21T10:00:00Z", "tomorrow", ""])(
    "rejects publication date %j",
    (publishedAt) => {
      const parsed = ArticleSchema.safeParse({ ...article({ id: "a1" }), publishedAt });
      expect(parsed.success).toBe(false);
    },
  );

  test("preserves unknown keys for forward compatibility", () => {
    const input = { ...article({ id: "a1" }), futureField: { nested: true } };
    const parsed = ArticleSchema.parse(input);
    expect(parsed).toMatchObject({ futureField: { nested: true } });
  });
});

describe("site.articles is additive", () => {
  test("a site authored before Articles existed still validates", () => {
    const result = validate(historipol);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("parsing a site without articles does not invent the array", () => {
    const parsed = SiteSchema.parse(historipol);
    expect(parsed.articles).toBeUndefined();
    expect(parsed.tags).toBeUndefined();
  });

  test("a site with a valid article validates clean", () => {
    const result = validate(
      siteWith([article({ id: "a1", tags: ["t1"] })], [{ id: "t1", label: "Evenimente" }]),
    );
    expect(result.errors).toEqual([]);
  });
});

describe("article identity and slug rules (ADR 0047)", () => {
  test("rejects duplicate article ids", () => {
    const result = validate(
      siteWith([article({ id: "a1", slug: "unu" }), article({ id: "a1", slug: "doi" })]),
    );
    expect(codes(result.errors)).toContain("site.article.id.duplicate");
  });

  test("rejects two articles sharing a slug in one language", () => {
    const result = validate(
      siteWith([article({ id: "a1", slug: "unu" }), article({ id: "a2", slug: "unu" })]),
    );
    expect(codes(result.errors)).toContain("site.article.slug.duplicate");
  });

  test("allows the same slug in different languages", () => {
    const result = validate(
      siteWith([
        article({ id: "a1", slug: "news", lang: "ro" }),
        article({ id: "a2", slug: "news", lang: "en" }),
      ]),
    );
    expect(codes(result.errors)).not.toContain("site.article.slug.duplicate");
  });

  test("a historical slug stays reserved against another article's current slug", () => {
    const result = validate(
      siteWith([
        article({ id: "a1", slug: "nou", slugHistory: ["vechi"] }),
        article({ id: "a2", slug: "vechi" }),
      ]),
    );
    expect(codes(result.errors)).toContain("site.article.slug.conflictsWithHistory");
  });

  test("historical slugs stay reserved while the article is a draft", () => {
    const result = validate(
      siteWith([
        article({ id: "a1", slug: "nou", slugHistory: ["vechi"], state: "draft" }),
        article({ id: "a2", slug: "vechi" }),
      ]),
    );
    expect(codes(result.errors)).toContain("site.article.slug.conflictsWithHistory");
  });

  test("rejects a malformed article slug", () => {
    const result = validate(siteWith([article({ id: "a1", slug: "Nu Merge" })]));
    expect(codes(result.errors)).toContain("site.article.slug.invalidCharacters");
  });

  test("rejects an article language outside the site's list", () => {
    const result = validate(siteWith([article({ id: "a1", lang: "de" })]));
    expect(codes(result.errors)).toContain("site.article.lang.notInLanguagesList");
  });

  test("reserves the /articles/ route prefix against page slugs", () => {
    const site = structuredClone(historipol) as unknown as {
      pages: { slug: string }[];
    };
    site.pages[1]!.slug = "articles";
    const result = validate(site);
    expect(codes(result.errors)).toContain("site.page.slug.reservedPrefix");
  });
});

describe("article translation groups", () => {
  test("accepts one article per language in a group", () => {
    const result = validate(
      siteWith([
        article({ id: "a1", lang: "ro", slug: "ro-unu", translationGroup: "g1" }),
        article({ id: "a2", lang: "en", slug: "en-one", translationGroup: "g1" }),
      ]),
    );
    expect(codes(result.errors)).not.toContain("site.article.translationGroup.duplicateLanguage");
  });

  test("rejects two articles claiming the same language in one group", () => {
    const result = validate(
      siteWith([
        article({ id: "a1", lang: "ro", slug: "ro-unu", translationGroup: "g1" }),
        article({ id: "a2", lang: "ro", slug: "ro-doi", translationGroup: "g1" }),
      ]),
    );
    expect(codes(result.errors)).toContain("site.article.translationGroup.duplicateLanguage");
  });
});

describe("article quality nudges", () => {
  test("warns when a cover image has no description", () => {
    const withCover = article({
      id: "a1",
      cover: {
        hash: "abc",
        path: "assets/abc.webp",
        metadataPath: "assets/abc.json",
        mime: "image/webp",
        width: 100,
        height: 100,
        alt: "x",
      },
    } as Partial<Article> & Pick<Article, "id">);
    const result = validate(siteWith([withCover]));
    const warning = result.warnings.find((w) => w.code === "site.article.coverAlt.missing");
    expect(warning).toBeDefined();
    expect(warning?.path).toEqual(["articles", 0, "coverAlt"]);
  });

  test("warns about an unknown tag reference", () => {
    const result = validate(siteWith([article({ id: "a1", tags: ["ghost"] })], []));
    expect(codes(result.warnings)).toContain("site.article.tag.unknown");
  });

  test("warns about a published article with no content", () => {
    const result = validate(siteWith([article({ id: "a1", state: "published", blocks: [] })]));
    expect(codes(result.warnings)).toContain("site.article.blocks.empty");
  });

  test("does not warn about an empty draft", () => {
    const result = validate(siteWith([article({ id: "a1", state: "draft", blocks: [] })]));
    expect(codes(result.warnings)).not.toContain("site.article.blocks.empty");
  });

  test("warns about tag labels that differ only in case or whitespace", () => {
    const result = validate(
      siteWith(
        [],
        [
          { id: "t1", label: "Evenimente" },
          { id: "t2", label: "  evenimente " },
        ],
      ),
    );
    expect(codes(result.warnings)).toContain("site.tag.label.duplicate");
  });

  test("rejects duplicate tag ids", () => {
    const result = validate(
      siteWith(
        [],
        [
          { id: "t1", label: "Unu" },
          { id: "t1", label: "Doi" },
        ],
      ),
    );
    expect(codes(result.errors)).toContain("site.tag.id.duplicate");
  });

  test("validates blocks nested inside an article, rebasing the issue path", () => {
    const withBadBlock = article({
      id: "a1",
      blocks: [{ id: "b1", type: "hero", version: 1, data: { title: "" } }],
    } as Partial<Article> & Pick<Article, "id">);
    const result = validate(siteWith([withBadBlock]));
    const issue = result.errors.find((e) => e.path[0] === "articles");
    expect(issue?.path.slice(0, 4)).toEqual(["articles", 0, "blocks", 0]);
  });

  test("warns about an oversized cover image", () => {
    const heavy = article({
      id: "a1",
      cover: {
        hash: "abc",
        path: "assets/abc.webp",
        metadataPath: "assets/abc.json",
        mime: "image/webp",
        width: 100,
        height: 100,
        alt: "x",
        bytes: 900_000,
      },
      coverAlt: "x",
    } as Partial<Article> & Pick<Article, "id">);
    const result = validate(siteWith([heavy]));
    expect(codes(result.warnings)).toContain("site.asset.image.oversized");
  });
});

describe("article-list selection reference rules (ADR 0048 export gate)", () => {
  const listBlock = (articleIds: string[]) => ({
    id: "list1",
    type: "articleList" as const,
    version: 1 as const,
    data: { mode: "selected" as const, articleIds },
  });

  function siteWithListOnPage(articles: Article[], articleIds: string[]): unknown {
    const site = structuredClone(historipol) as unknown as {
      articles?: Article[];
      pages: { blocks: unknown[] }[];
    };
    site.articles = articles;
    site.pages[0]!.blocks.push(listBlock(articleIds));
    return site;
  }

  test("a selection pointing at a missing article blocks export un-overridably", () => {
    const result = validate(siteWithListOnPage([article({ id: "a1" })], ["ghost"]));
    const issue = result.errors.find((e) => e.code === "site.articleList.selection.missing");
    expect(issue).toBeDefined();
    expect(issue?.blocking).toBe(true);
    expect(hasBlockingIssues(result)).toBe(true);
  });

  test("a selection pointing at a draft blocks export un-overridably", () => {
    const result = validate(siteWithListOnPage([article({ id: "a1", state: "draft" })], ["a1"]));
    const issue = result.errors.find((e) => e.code === "site.articleList.selection.draft");
    expect(issue?.blocking).toBe(true);
  });

  test("selecting an unlisted article is allowed", () => {
    const result = validate(siteWithListOnPage([article({ id: "a1", state: "unlisted" })], ["a1"]));
    expect(codes(result.errors)).not.toContain("site.articleList.selection.draft");
    expect(hasBlockingIssues(result)).toBe(false);
  });

  test("the same breakage inside a draft article only warns", () => {
    const draftHost = article({
      id: "host",
      state: "draft",
      blocks: [listBlock(["ghost"])],
    } as unknown as Partial<Article> & Pick<Article, "id">);
    const result = validate(siteWith([draftHost]));
    expect(hasBlockingIssues(result)).toBe(false);
    expect(codes(result.warnings)).toContain("site.articleList.selection.missing.draftOnly");
  });

  test("a disabled Related Articles list is exempt from reference checks", () => {
    const host = article({
      id: "host",
      state: "published",
      relatedArticles: { enabled: false, mode: "selected", articleIds: ["ghost"] },
    } as unknown as Partial<Article> & Pick<Article, "id">);
    const result = validate(siteWith([host]));
    expect(hasBlockingIssues(result)).toBe(false);
  });

  test("an enabled Related Articles list is checked", () => {
    const host = article({
      id: "host",
      state: "published",
      relatedArticles: { enabled: true, mode: "selected", articleIds: ["ghost"] },
    } as unknown as Partial<Article> & Pick<Article, "id">);
    const result = validate(siteWith([host]));
    expect(hasBlockingIssues(result)).toBe(true);
  });

  test("an empty list is reported as info, never as a blocker", () => {
    const site = structuredClone(historipol) as unknown as {
      pages: { blocks: unknown[] }[];
    };
    site.pages[0]!.blocks.push({
      id: "list1",
      type: "articleList",
      version: 1,
      data: { mode: "byTag" },
    });
    const result = validate(site);
    expect(codes(result.info)).toContain("site.articleList.empty");
    expect(result.ok).toBe(true);
  });
});
