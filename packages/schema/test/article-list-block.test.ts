import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import {
  ARTICLE_LIST_BLOCK_VERSION,
  ArticleListBlockSchema,
  inspectArticleSelection,
  publishedTranslationsOf,
  resolveArticleSelection,
  validateBlock,
} from "../src/index.js";
import type { Article, Site } from "../src/index.js";

function block(data: unknown): unknown {
  return { id: "list1", type: "articleList", version: ARTICLE_LIST_BLOCK_VERSION, data };
}

function article(overrides: Partial<Article> & Pick<Article, "id">): Article {
  return {
    lang: "ro",
    slug: `a-${overrides.id}`,
    title: `Articol ${overrides.id}`,
    publishedAt: "2026-09-01",
    state: "published",
    blocks: [],
    ...overrides,
  } as Article;
}

function siteWith(articles: Article[]): Site {
  const site = structuredClone(historipol) as unknown as Site;
  site.articles = articles;
  return site;
}

describe("articleList block schema", () => {
  test("parses a by-tag list", () => {
    expect(
      ArticleListBlockSchema.safeParse(
        block({ title: "Noutăți", mode: "byTag", tags: ["t1", "t2"], sort: "date-desc" }),
      ).success,
    ).toBe(true);
  });

  test("parses an explicit selection", () => {
    expect(
      ArticleListBlockSchema.safeParse(
        block({ mode: "selected", articleIds: ["a1", "a2"], limit: 3 }),
      ).success,
    ).toBe(true);
  });

  test("parses an empty data object — every field is optional", () => {
    expect(ArticleListBlockSchema.safeParse(block({})).success).toBe(true);
  });

  test("rejects an unknown mode", () => {
    expect(ArticleListBlockSchema.safeParse(block({ mode: "random" })).success).toBe(false);
  });

  test("rejects an unknown sort", () => {
    expect(ArticleListBlockSchema.safeParse(block({ sort: "title-asc" })).success).toBe(false);
  });

  test("rejects a non-positive limit", () => {
    expect(ArticleListBlockSchema.safeParse(block({ limit: 0 })).success).toBe(false);
  });

  test("rejects the wrong type literal", () => {
    expect(
      ArticleListBlockSchema.safeParse({ ...(block({}) as object), type: "eventList" }).success,
    ).toBe(false);
  });

  test("preserves unknown keys", () => {
    const parsed = ArticleListBlockSchema.parse(block({ mode: "byTag", futureField: 1 }));
    expect(parsed.data).toMatchObject({ futureField: 1 });
  });

  test("validateBlock warns when an explicit selection is empty", () => {
    const result = validateBlock(block({ mode: "selected", articleIds: [] }));
    expect(result.warnings.map((w) => w.code)).toContain("block.articleList.articleIds.empty");
    expect(result.ok).toBe(true);
  });

  test("validateBlock does not warn about a by-tag list with no tags", () => {
    const result = validateBlock(block({ mode: "byTag" }));
    expect(result.warnings).toEqual([]);
  });
});

describe("resolveArticleSelection — By tag", () => {
  const site = siteWith([
    article({ id: "a1", publishedAt: "2026-01-01", tags: ["news"] }),
    article({ id: "a2", publishedAt: "2026-03-01", tags: ["events"] }),
    article({ id: "a3", publishedAt: "2026-02-01", tags: ["news", "events"] }),
    article({ id: "a4", publishedAt: "2026-04-01", state: "draft", tags: ["news"] }),
    article({ id: "a5", publishedAt: "2026-05-01", state: "unlisted", tags: ["news"] }),
    article({ id: "a6", publishedAt: "2026-06-01", lang: "en", slug: "en-6", tags: ["news"] }),
  ]);

  test("includes only published articles in the container's language", () => {
    const ids = resolveArticleSelection(site, { mode: "byTag" }, { lang: "ro" }).map((a) => a.id);
    expect(ids).toEqual(["a2", "a3", "a1"]);
  });

  test("no tags selected means every eligible article", () => {
    const ids = resolveArticleSelection(site, { mode: "byTag", tags: [] }, { lang: "ro" }).map(
      (a) => a.id,
    );
    expect(ids).toEqual(["a2", "a3", "a1"]);
  });

  test("matches any selected tag, newest first", () => {
    const ids = resolveArticleSelection(
      site,
      { mode: "byTag", tags: ["news"] },
      { lang: "ro" },
    ).map((a) => a.id);
    expect(ids).toEqual(["a3", "a1"]);
  });

  test("there is no language fallback", () => {
    const ids = resolveArticleSelection(site, { mode: "byTag" }, { lang: "en" }).map((a) => a.id);
    expect(ids).toEqual(["a6"]);
  });

  test("date-asc reverses the order", () => {
    const ids = resolveArticleSelection(
      site,
      { mode: "byTag", sort: "date-asc" },
      { lang: "ro" },
    ).map((a) => a.id);
    expect(ids).toEqual(["a1", "a3", "a2"]);
  });

  test("a containing article excludes itself", () => {
    const ids = resolveArticleSelection(
      site,
      { mode: "byTag" },
      { lang: "ro", excludeArticleId: "a2" },
    ).map((a) => a.id);
    expect(ids).toEqual(["a3", "a1"]);
  });

  test("limit caps the result", () => {
    const ids = resolveArticleSelection(site, { mode: "byTag", limit: 2 }, { lang: "ro" }).map(
      (a) => a.id,
    );
    expect(ids).toEqual(["a2", "a3"]);
  });

  test("byTag is the default mode", () => {
    const ids = resolveArticleSelection(site, {}, { lang: "ro" }).map((a) => a.id);
    expect(ids).toEqual(["a2", "a3", "a1"]);
  });

  test("equal dates break ties by permanent id, so the order is total", () => {
    const tied = siteWith([
      article({ id: "b", publishedAt: "2026-01-01" }),
      article({ id: "a", publishedAt: "2026-01-01" }),
    ]);
    const ids = resolveArticleSelection(tied, { mode: "byTag" }, { lang: "ro" }).map((a) => a.id);
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("resolveArticleSelection — Select articles", () => {
  const site = siteWith([
    article({ id: "a1" }),
    article({ id: "a2", state: "unlisted" }),
    article({ id: "a3", state: "draft" }),
    article({ id: "a4", lang: "en", slug: "en-4" }),
  ]);

  test("keeps the author's explicit order", () => {
    const ids = resolveArticleSelection(
      site,
      { mode: "selected", articleIds: ["a2", "a1"] },
      { lang: "ro" },
    ).map((a) => a.id);
    expect(ids).toEqual(["a2", "a1"]);
  });

  test("crosses languages", () => {
    const ids = resolveArticleSelection(
      site,
      { mode: "selected", articleIds: ["a4"] },
      { lang: "ro" },
    ).map((a) => a.id);
    expect(ids).toEqual(["a4"]);
  });

  test("drops drafts and dangling ids rather than rendering broken cards", () => {
    const ids = resolveArticleSelection(
      site,
      { mode: "selected", articleIds: ["a1", "a3", "ghost"] },
      { lang: "ro" },
    ).map((a) => a.id);
    expect(ids).toEqual(["a1"]);
  });

  test("inspectArticleSelection reports why each target was dropped", () => {
    expect(
      inspectArticleSelection(site, { mode: "selected", articleIds: ["a1", "a3", "ghost"] }),
    ).toEqual([
      { index: 1, articleId: "a3", reason: "draft" },
      { index: 2, articleId: "ghost", reason: "missing" },
    ]);
  });

  test("inspectArticleSelection ignores by-tag lists", () => {
    expect(inspectArticleSelection(site, { mode: "byTag", tags: ["x"] })).toEqual([]);
  });
});

describe("publishedTranslationsOf", () => {
  const ro = article({ id: "ro1", lang: "ro", slug: "ro-1", translationGroup: "g" });
  const en = article({ id: "en1", lang: "en", slug: "en-1", translationGroup: "g" });
  const enDraft = article({
    id: "en2",
    lang: "en",
    slug: "en-2",
    state: "draft",
    translationGroup: "g2",
  });
  const roDraftGroup = article({ id: "ro2", lang: "ro", slug: "ro-2", translationGroup: "g2" });
  const unlisted = article({
    id: "en3",
    lang: "en",
    slug: "en-3",
    state: "unlisted",
    translationGroup: "g3",
  });
  const roUnlistedGroup = article({ id: "ro3", lang: "ro", slug: "ro-3", translationGroup: "g3" });

  const site = siteWith([ro, en, enDraft, roDraftGroup, unlisted, roUnlistedGroup]);

  test("returns published counterparts", () => {
    expect(publishedTranslationsOf(site, ro).map((a) => a.id)).toEqual(["en1"]);
  });

  test("omits draft counterparts", () => {
    expect(publishedTranslationsOf(site, roDraftGroup)).toEqual([]);
  });

  test("omits unlisted counterparts from automatic discovery", () => {
    expect(publishedTranslationsOf(site, roUnlistedGroup)).toEqual([]);
  });

  test("an article with no translation group has no counterparts", () => {
    expect(publishedTranslationsOf(site, article({ id: "lonely" }))).toEqual([]);
  });
});
