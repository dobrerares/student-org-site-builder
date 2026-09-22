import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { validate } from "@sosb/schema";
import {
  addArticleTranslation,
  createArticle,
  createTag,
  deleteArticle,
  deleteTag,
  filterArticles,
  findTagByLabel,
  nextArticleId,
  nextTagId,
  renameTag,
  reservedSlugsFor,
  setArticleSlug,
  slugifyTitle,
  tagUsage,
  uniqueArticleSlug,
  updateArticle,
} from "../src/articles-ops.js";

const TODAY = "2026-09-21";

function baseSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Stub Org", email: "a@b.ro" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro", "en"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [],
      },
    ],
  } as unknown as Site;
}

describe("slugifyTitle", () => {
  test.each([
    ["Gala de final", "gala-de-final"],
    ["Ședință și întâlnire", "sedinta-si-intalnire"],
    ["  Multiple   spaces  ", "multiple-spaces"],
    ["2026: raport #1", "2026-raport-1"],
  ])("%j becomes %j", (title, expected) => {
    expect(slugifyTitle(title)).toBe(expected);
  });

  test("falls back rather than producing an empty slug", () => {
    expect(slugifyTitle("!!!")).toBe("articol");
  });
});

describe("createArticle", () => {
  test("seeds a draft with a title and one rich-text block", () => {
    const { site, articleId } = createArticle(baseSite(), {
      title: "Gala de final",
      lang: "ro",
      today: TODAY,
    });
    const article = (site.articles ?? [])[0]!;
    expect(article.id).toBe(articleId);
    expect(article.state).toBe("draft");
    expect(article.slug).toBe("gala-de-final");
    expect(article.publishedAt).toBe(TODAY);
    expect(article.blocks).toHaveLength(1);
    expect(article.blocks[0]?.type).toBe("richText");
    // Seeded at the current Block version with an empty structured document
    // (ADR 0048). A `{ markdown }` payload here would never be migrated —
    // migrations key on the version, and this Block is born current.
    expect(article.blocks[0]?.version).toBe(2);
    expect(article.blocks[0]?.data).toEqual({ doc: { version: 1, content: [] } });
  });

  test("the created site still validates", () => {
    const { site } = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY });
    expect(validate(site).errors).toEqual([]);
  });

  test("disambiguates a slug already taken in the language", () => {
    let site = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site;
    site = createArticle(site, { title: "Gala", lang: "ro", today: TODAY }).site;
    expect((site.articles ?? []).map((a) => a.slug)).toEqual(["gala", "gala-2"]);
  });

  test("the same slug is free in another language", () => {
    let site = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site;
    site = createArticle(site, { title: "Gala", lang: "en", today: TODAY }).site;
    expect((site.articles ?? []).map((a) => a.slug)).toEqual(["gala", "gala"]);
  });
});

describe("nextArticleId", () => {
  test("does not reuse an id that a list still references", () => {
    const site = baseSite();
    site.pages[0]!.blocks.push({
      id: "list",
      type: "articleList",
      version: 1,
      data: { mode: "selected", articleIds: ["art_7"] },
    } as never);
    // art_7 is gone but still referenced — a new article must not inherit
    // that reference (ADR 0047).
    expect(nextArticleId(site)).toBe("art_8");
  });

  test("counts existing articles", () => {
    const { site } = createArticle(baseSite(), { title: "A", lang: "ro", today: TODAY });
    expect(nextArticleId(site)).toBe("art_2");
  });
});

describe("setArticleSlug", () => {
  function withArticle(): { site: Site } {
    return { site: createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site };
  }

  test("retires the old slug into history", () => {
    const { site } = withArticle();
    const result = setArticleSlug(site, 0, "gala-de-final");
    const article = (result.site.articles ?? [])[0]!;
    expect(article.slug).toBe("gala-de-final");
    expect(article.slugHistory).toEqual(["gala"]);
    expect(result.error).toBeUndefined();
  });

  test("a second rename keeps both historical slugs", () => {
    const { site } = withArticle();
    const once = setArticleSlug(site, 0, "gala-2026").site;
    const twice = setArticleSlug(once, 0, "gala-de-final").site;
    expect((twice.articles ?? [])[0]?.slugHistory).toEqual(["gala", "gala-2026"]);
  });

  test("a no-op change writes no history", () => {
    const { site } = withArticle();
    const result = setArticleSlug(site, 0, "gala");
    expect((result.site.articles ?? [])[0]?.slugHistory).toBeUndefined();
  });

  test("rejects an invalid slug without half-applying", () => {
    const { site } = withArticle();
    const result = setArticleSlug(site, 0, "Not A Slug");
    expect(result.error).toBe("invalid");
    expect((result.site.articles ?? [])[0]?.slug).toBe("gala");
  });

  test("rejects a slug reserved by another article's history", () => {
    let site = createArticle(baseSite(), { title: "Unu", lang: "ro", today: TODAY }).site;
    site = createArticle(site, { title: "Doi", lang: "ro", today: TODAY }).site;
    site = setArticleSlug(site, 0, "unu-nou").site;
    const result = setArticleSlug(site, 1, "unu");
    expect(result.error).toBe("taken");
  });

  test("reservedSlugsFor includes current and historical slugs", () => {
    const { site } = withArticle();
    const renamed = setArticleSlug(site, 0, "gala-noua").site;
    expect(reservedSlugsFor(renamed, "ro")).toEqual(new Set(["gala-noua", "gala"]));
  });

  test("uniqueArticleSlug skips reserved slugs", () => {
    const { site } = withArticle();
    expect(uniqueArticleSlug(site, "ro", "gala")).toBe("gala-2");
  });
});

describe("deleteArticle", () => {
  test("removes the article and leaves references for the author to resolve", () => {
    const site = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site;
    const id = (site.articles ?? [])[0]!.id;
    site.pages[0]!.blocks.push({
      id: "list",
      type: "articleList",
      version: 1,
      data: { mode: "selected", articleIds: [id] },
    } as never);
    const after = deleteArticle(site, 0);
    expect(after.articles).toEqual([]);
    const data = after.pages[0]!.blocks[0]!.data as { articleIds: string[] };
    expect(data.articleIds).toEqual([id]);
    // The dangling reference is a blocking validation error, not a silent edit.
    expect(validate(after).errors.some((e) => e.blocking === true)).toBe(true);
  });
});

describe("addArticleTranslation", () => {
  test("creates a linked draft counterpart in the target language", () => {
    const site = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site;
    const result = addArticleTranslation(site, 0, "en", TODAY);
    const articles = result.site.articles ?? [];
    expect(articles).toHaveLength(2);
    expect(articles[1]?.lang).toBe("en");
    expect(articles[1]?.state).toBe("draft");
    expect(articles[0]?.translationGroup).toBe(articles[1]?.translationGroup);
    expect(validate(result.site).errors).toEqual([]);
  });

  test("refuses a second counterpart in the same language", () => {
    const site = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site;
    const once = addArticleTranslation(site, 0, "en", TODAY).site;
    const twice = addArticleTranslation(once, 0, "en", TODAY);
    expect((twice.site.articles ?? []).length).toBe(2);
  });

  test("refuses an undeclared language", () => {
    const site = createArticle(baseSite(), { title: "Gala", lang: "ro", today: TODAY }).site;
    expect(addArticleTranslation(site, 0, "de", TODAY).site).toBe(site);
  });
});

describe("tags", () => {
  test("createTag reuses an existing tag differing only in case", () => {
    const first = createTag(baseSite(), "Evenimente");
    const second = createTag(first.site, "  evenimente ");
    expect(second.tagId).toBe(first.tagId);
    expect(second.site.tags).toHaveLength(1);
  });

  test("createTag preserves the author's capitalisation", () => {
    const { site } = createTag(baseSite(), "  Evenimente  ");
    expect(site.tags?.[0]?.label).toBe("Evenimente");
  });

  test("findTagByLabel ignores case and whitespace", () => {
    const { site } = createTag(baseSite(), "Proiecte");
    expect(findTagByLabel(site, "  PROIECTE ")?.label).toBe("Proiecte");
  });

  test("renameTag rejects a duplicate label", () => {
    let site = createTag(baseSite(), "Unu").site;
    site = createTag(site, "Doi").site;
    const result = renameTag(site, site.tags![1]!.id, "unu");
    expect(result.error).toBe("duplicate");
  });

  test("renameTag preserves associations", () => {
    const created = createTag(baseSite(), "Unu");
    let site = createArticle(created.site, { title: "Gala", lang: "ro", today: TODAY }).site;
    site = updateArticle(site, 0, { tags: [created.tagId] });
    const renamed = renameTag(site, created.tagId, "Unu renumit").site;
    expect(renamed.articles?.[0]?.tags).toEqual([created.tagId]);
    expect(renamed.tags?.[0]?.label).toBe("Unu renumit");
  });

  test("nextTagId does not reuse a referenced id", () => {
    const site = baseSite();
    site.pages[0]!.blocks.push({
      id: "list",
      type: "articleList",
      version: 1,
      data: { mode: "byTag", tags: ["tag_4"] },
    } as never);
    expect(nextTagId(site)).toBe("tag_5");
  });

  describe("deletion", () => {
    function siteWithTaggedContent(): { site: Site; tagId: string } {
      const created = createTag(baseSite(), "Evenimente");
      let site = createArticle(created.site, { title: "Gala", lang: "ro", today: TODAY }).site;
      site = updateArticle(site, 0, { tags: [created.tagId] });
      site.pages[0]!.blocks.push({
        id: "list",
        type: "articleList",
        version: 1,
        data: { title: "Noutăți", mode: "byTag", tags: [created.tagId] },
      } as never);
      return { site, tagId: created.tagId };
    }

    test("tagUsage reports tagged articles and filtering lists", () => {
      const { site, tagId } = siteWithTaggedContent();
      const usage = tagUsage(site, tagId);
      expect(usage.articleTitles).toEqual(["Gala"]);
      expect(usage.listLabels).toEqual(["Noutăți"]);
    });

    test("tagUsage flags lists that would become unfiltered", () => {
      const { site, tagId } = siteWithTaggedContent();
      expect(tagUsage(site, tagId).listsBecomingUnfiltered).toEqual(["Noutăți"]);
    });

    test("a list with another tag left is not flagged as becoming unfiltered", () => {
      const { site, tagId } = siteWithTaggedContent();
      const withSecond = createTag(site, "Proiecte");
      const data = withSecond.site.pages[0]!.blocks[0]!.data as { tags: string[] };
      data.tags = [tagId, withSecond.tagId];
      expect(tagUsage(withSecond.site, tagId).listsBecomingUnfiltered).toEqual([]);
    });

    test("deleteTag scrubs the tag from articles and list filters", () => {
      const { site, tagId } = siteWithTaggedContent();
      const after = deleteTag(site, tagId);
      expect(after.tags).toEqual([]);
      expect(after.articles?.[0]?.tags).toEqual([]);
      expect((after.pages[0]!.blocks[0]!.data as { tags: string[] }).tags).toEqual([]);
      expect(validate(after).errors).toEqual([]);
    });

    test("deleteTag also scrubs related-articles filters", () => {
      const { site, tagId } = siteWithTaggedContent();
      const withRelated = updateArticle(site, 0, {
        relatedArticles: { enabled: true, mode: "byTag", tags: [tagId] },
      });
      const after = deleteTag(withRelated, tagId);
      expect(after.articles?.[0]?.relatedArticles?.tags).toEqual([]);
    });
  });
});

describe("filterArticles", () => {
  function populated(): Site {
    let site = baseSite();
    const tag = createTag(site, "Evenimente");
    site = tag.site;
    site = createArticle(site, { title: "Gala de final", lang: "ro", today: "2026-06-12" }).site;
    site = updateArticle(site, 0, { state: "published", tags: [tag.tagId] });
    site = createArticle(site, { title: "Atelier", lang: "ro", today: "2026-04-03" }).site;
    site = createArticle(site, { title: "English post", lang: "en", today: "2026-07-01" }).site;
    site = updateArticle(site, 2, { state: "unlisted" });
    return site;
  }

  const site = populated();
  const filters = { search: "", lang: "", state: "", tagId: "" };

  test("sorts newest first", () => {
    expect(filterArticles(site, filters).map((r) => r.article.title)).toEqual([
      "English post",
      "Gala de final",
      "Atelier",
    ]);
  });

  test("filters by language", () => {
    expect(filterArticles(site, { ...filters, lang: "en" }).map((r) => r.article.title)).toEqual([
      "English post",
    ]);
  });

  test("filters by state", () => {
    expect(
      filterArticles(site, { ...filters, state: "published" }).map((r) => r.article.title),
    ).toEqual(["Gala de final"]);
  });

  test("filters by tag", () => {
    const tagId = site.tags![0]!.id;
    expect(filterArticles(site, { ...filters, tagId }).map((r) => r.article.title)).toEqual([
      "Gala de final",
    ]);
  });

  test("searches title and summary", () => {
    expect(
      filterArticles(site, { ...filters, search: "atel" }).map((r) => r.article.title),
    ).toEqual(["Atelier"]);
  });

  test("rows carry the index into site.articles", () => {
    const row = filterArticles(site, { ...filters, search: "Atelier" })[0]!;
    expect(site.articles?.[row.index]?.title).toBe("Atelier");
  });
});
