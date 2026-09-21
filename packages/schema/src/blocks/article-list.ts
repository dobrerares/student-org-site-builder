import { z } from "zod";

/**
 * articleList block — linked Article cards, selected either automatically by
 * Article tag ("By tag") or explicitly by the author ("Select articles").
 *
 * Per the design in `docs/plans/issue-97-article-publishing.md` and
 * `docs/plans/issue-98-article-tag-filtering.md`:
 *
 *  - **By tag** includes only Published Articles whose `lang` matches the
 *    containing Page or Article. There is no language fallback. Selected tags
 *    match with *any* semantics; selecting no tags includes every eligible
 *    Article. Sort is newest publication date first.
 *  - **Select articles** lets the author pick and order Articles explicitly,
 *    including Unlisted ones and ones in other languages. A selection pointing
 *    at a Draft or deleted Article blocks public export when it is reachable
 *    from public content (ADR 0047 / ADR 0048).
 *
 * `tags` holds Article-tag ids (not labels) and `articleIds` holds permanent
 * Article ids, so renaming a tag or changing an Article's slug never breaks a
 * configured list — the identity/URL split recorded in ADR 0047.
 *
 * The same selection shape drives the Related Articles setting on an Article
 * (`RelatedArticlesSchema` in `../article.ts`), which is why it is factored out
 * as `ArticleSelectionSchema` rather than inlined into the block data.
 */

export const ARTICLE_LIST_MODES = ["byTag", "selected"] as const;
export type ArticleListMode = (typeof ARTICLE_LIST_MODES)[number];

export const ARTICLE_LIST_SORTS = ["date-desc", "date-asc"] as const;
export type ArticleListSort = (typeof ARTICLE_LIST_SORTS)[number];

const ArticleListModeSchema = z.enum(ARTICLE_LIST_MODES);
const ArticleListSortSchema = z.enum(ARTICLE_LIST_SORTS);

/**
 * The selection half of an Article list: which Articles, in which order, and
 * how many. Shared by the `articleList` block and by an Article's Related
 * Articles setting.
 */
export const ArticleSelectionSchema = z.looseObject({
  /** Omitted means `"byTag"` — the default an author lands on. */
  mode: ArticleListModeSchema.optional(),
  /** Article-tag ids. Only meaningful in `byTag` mode. Empty/omitted = all. */
  tags: z.array(z.string().min(1)).optional(),
  /** Permanent Article ids in author order. Only meaningful in `selected` mode. */
  articleIds: z.array(z.string().min(1)).optional(),
  /** Optional cap on how many cards render. Omitted means "all matches". */
  limit: z.number().int().positive().optional(),
  /** Omitted means `"date-desc"` (newest first). Only applies in `byTag` mode. */
  sort: ArticleListSortSchema.optional(),
});

export const ArticleListDataSchema = ArticleSelectionSchema.extend({
  title: z.string().optional(),
  intro: z.string().optional(),
});

export const ArticleListBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("articleList"),
  version: z.literal(1),
  data: ArticleListDataSchema,
});

export const ARTICLE_LIST_BLOCK_VERSION = 1 as const;

/** Default mode when `data.mode` is omitted. */
export const DEFAULT_ARTICLE_LIST_MODE: ArticleListMode = "byTag";

/** Default sort when `data.sort` is omitted: newest publication date first. */
export const DEFAULT_ARTICLE_LIST_SORT: ArticleListSort = "date-desc";

export type ArticleSelection = z.infer<typeof ArticleSelectionSchema>;
export type ArticleListData = z.infer<typeof ArticleListDataSchema>;
export type ArticleListBlock = z.infer<typeof ArticleListBlockSchema>;
