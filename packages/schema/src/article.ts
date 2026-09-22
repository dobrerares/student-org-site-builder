import { z } from "zod";
import { AssetRefSchema } from "./blocks/asset-ref.js";
import { ArticleSelectionSchema } from "./blocks/article-list.js";
import { BlockEnvelopeSchema } from "./blocks/index.js";

/**
 * Articles — reusable content with its own public URL, presented or linked
 * from Blocks independently of ordinary Pages (CONTEXT.md glossary).
 *
 * The lasting boundaries are recorded in
 * [ADR 0047](../../../docs/adr/0047-article-publication-and-url-identity.md):
 *
 *  - **Permanent identity.** `id` is generated once and never changes. Every
 *    reference to an Article — explicit list selections, translation links —
 *    uses `id`, never the slug, so renames and slug edits never break a
 *    reference. Deleting an Article releases its URLs but does not transfer
 *    its references to whatever is created at the same URL later.
 *  - **Publication state, not nav state.** `state` is the editorial boundary
 *    (`draft` / `published` / `unlisted`), deliberately separate from a Page's
 *    `showInNav`, which only controls menus. Drafts stay in the editable
 *    archive and never reach public export.
 *  - **Slug history.** Explicit slug edits push the old slug onto
 *    `slugHistory`, which stays reserved for as long as the Article exists
 *    (even while it is a Draft) and is emitted as a redirect once the Article
 *    is Published or Unlisted.
 *  - **Translations are separate Articles.** Counterparts share a
 *    `translationGroup` and each keeps its own `state`. A shared group id is
 *    used instead of pairwise links so the relation cannot go half-updated.
 *
 * `publishedAt` describes and sorts; it never schedules. A future-dated
 * Published Article is public immediately (ADR 0047).
 */

/** Route prefix reserved for Articles. No Page may claim this slug. */
export const ARTICLE_ROUTE_PREFIX = "articles";

export const ARTICLE_STATES = ["draft", "published", "unlisted"] as const;
export type ArticleState = (typeof ARTICLE_STATES)[number];

const ArticleStateSchema = z.enum(ARTICLE_STATES);

/**
 * Calendar date, `YYYY-MM-DD`. Deliberately date-only: publication dates
 * describe and order Articles, so a time-of-day and timezone would add
 * ambiguity (and a timezone-dependent sort) without buying anything. Contrast
 * `eventList`, whose datetimes drive past-vs-future and therefore *require* an
 * explicit offset.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ArticleDateSchema = z.string().regex(ISO_DATE_RE, {
  message: "Publication date must be a calendar date in YYYY-MM-DD form, such as 2026-09-21.",
});

/**
 * Site-wide Article tag. Tags are internal author-facing labels shared across
 * languages — not public browsing categories, and never rendered as tag pages
 * (issue #98). `id` is permanent so renaming a label preserves every Article
 * association and every configured list filter.
 */
export const ArticleTagSchema = z.looseObject({
  id: z.string().min(1),
  label: z.string().min(1),
});

/**
 * Related Articles: one optional Article list pinned to the end of an Article.
 * Disabling retains the configuration but omits the list from public output and
 * from export-blocking reference checks, so an author can switch it off without
 * losing their selection (issue #97).
 */
export const RelatedArticlesSchema = ArticleSelectionSchema.extend({
  enabled: z.boolean(),
  title: z.string().optional(),
});

const ArticleSeoSchema = z.looseObject({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const ArticleSchema = z.looseObject({
  /** Permanent identity. Never derived from, and never changed with, the slug. */
  id: z.string().min(1),
  lang: z.string().min(1),
  slug: z.string().min(1),
  /** Previously-used slugs, oldest first. Reserved while the Article exists. */
  slugHistory: z.array(z.string().min(1)).optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  cover: AssetRefSchema.optional(),
  /** Sibling alt for `cover` — the user-facing image description (CONTEXT.md). */
  coverAlt: z.string().optional(),
  publishedAt: ArticleDateSchema,
  state: ArticleStateSchema,
  /** Article-tag ids. */
  tags: z.array(z.string().min(1)).optional(),
  /** Shared id linking this Article to its counterparts in other languages. */
  translationGroup: z.string().min(1).optional(),
  seo: ArticleSeoSchema.optional(),
  relatedArticles: RelatedArticlesSchema.optional(),
  blocks: z.array(BlockEnvelopeSchema),
});

export type Article = z.infer<typeof ArticleSchema>;
export type ArticleTag = z.infer<typeof ArticleTagSchema>;
export type RelatedArticles = z.infer<typeof RelatedArticlesSchema>;

/**
 * Tags whose labels differ only in case or surrounding whitespace are
 * duplicates (issue #98). Display always preserves the author's capitalisation,
 * so this normalisation is for comparison only — never for storage.
 */
export function normalizeTagLabel(label: string): string {
  return label.trim().toLocaleLowerCase("en");
}

/** True when an Article is part of the exported public Site. */
export function isPublicArticle(article: Article): boolean {
  return article.state === "published" || article.state === "unlisted";
}

/** True when an Article is eligible for automatic discovery (lists, sitemap, hreflang). */
export function isDiscoverableArticle(article: Article): boolean {
  return article.state === "published";
}
