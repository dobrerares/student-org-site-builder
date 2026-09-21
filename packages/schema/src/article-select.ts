import type { Article } from "./article.js";
import type { ArticleSelection } from "./blocks/article-list.js";
import { DEFAULT_ARTICLE_LIST_MODE, DEFAULT_ARTICLE_LIST_SORT } from "./blocks/article-list.js";
import type { Site } from "./site.js";

/**
 * Article-list selection semantics — which Articles a configured list resolves
 * to, in which order.
 *
 * This lives in `@sosb/schema` rather than in the renderer because three
 * separate callers need the *same* answer: the renderer (to draw the cards),
 * the validator (to report selections that would break public export), and the
 * editor's Inspector (to show the author what their configuration matches).
 * Duplicating the rules across those three would let them drift, and the drift
 * would be invisible until an export produced a list the preview never showed.
 *
 * The rules come from `docs/plans/issue-97-article-publishing.md`:
 *
 *  - **By tag** matches only Published Articles in the container's language —
 *    no language fallback — with *any*-tag semantics, and includes everything
 *    eligible when no tags are selected. A containing Article excludes itself.
 *  - **Select articles** keeps the author's explicit order, may cross languages,
 *    and may include Unlisted Articles. Drafts and dangling ids are dropped
 *    here and reported separately by `inspectArticleSelection` — public output
 *    must never contain a card for content that is not exported.
 *
 * Every function here is pure and deterministic: no clock, no locale-sensitive
 * comparison, and a total ordering (ties broken by permanent id) so the golden
 * files stay byte-stable.
 */

/** `site.articles` with the "absent means empty" convention applied. */
export function articlesOf(site: Site): readonly Article[] {
  return site.articles ?? [];
}

/** Index Articles by permanent id. Later duplicates lose; duplicates are a validation error. */
export function articlesById(site: Site): ReadonlyMap<string, Article> {
  const byId = new Map<string, Article>();
  for (const article of articlesOf(site)) {
    if (!byId.has(article.id)) byId.set(article.id, article);
  }
  return byId;
}

export interface ArticleSelectionContext {
  /** Language of the containing Page or Article. Drives "By tag" filtering. */
  readonly lang: string;
  /**
   * Id of the containing Article, when the list sits on one. "By tag" excludes
   * it so an Article never recommends itself; explicit self-selection is
   * deliberately still allowed.
   */
  readonly excludeArticleId?: string;
}

/**
 * Resolve a configured selection to the Articles a *public* render shows.
 *
 * Draft and dangling targets are omitted rather than rendered as broken cards.
 * Callers that need to tell the author *why* something vanished should pair
 * this with `inspectArticleSelection`.
 */
export function resolveArticleSelection(
  site: Site,
  selection: ArticleSelection,
  context: ArticleSelectionContext,
): readonly Article[] {
  const mode = selection.mode ?? DEFAULT_ARTICLE_LIST_MODE;
  const matches =
    mode === "selected" ? resolveExplicit(site, selection) : resolveByTag(site, selection, context);
  const limit = selection.limit;
  return limit !== undefined && limit > 0 ? matches.slice(0, limit) : matches;
}

function resolveByTag(
  site: Site,
  selection: ArticleSelection,
  context: ArticleSelectionContext,
): readonly Article[] {
  const wanted = selection.tags ?? [];
  const matched = articlesOf(site).filter((article) => {
    if (article.state !== "published") return false;
    if (article.lang !== context.lang) return false;
    if (context.excludeArticleId !== undefined && article.id === context.excludeArticleId) {
      return false;
    }
    if (wanted.length === 0) return true;
    const tags = article.tags ?? [];
    return wanted.some((tagId) => tags.includes(tagId));
  });

  const ascending = (selection.sort ?? DEFAULT_ARTICLE_LIST_SORT) === "date-asc";
  // `publishedAt` is `YYYY-MM-DD`, so plain string comparison is date order.
  // Equal dates fall back to the permanent id, giving a total order that does
  // not depend on array position and therefore survives reordering.
  return [...matched].sort((a, b) => {
    const byDate = a.publishedAt === b.publishedAt ? 0 : a.publishedAt < b.publishedAt ? -1 : 1;
    if (byDate !== 0) return ascending ? byDate : -byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function resolveExplicit(site: Site, selection: ArticleSelection): readonly Article[] {
  const byId = articlesById(site);
  const picked: Article[] = [];
  for (const id of selection.articleIds ?? []) {
    const article = byId.get(id);
    // Drafts are not exported, so a card linking to one would be a 404.
    if (article === undefined || article.state === "draft") continue;
    picked.push(article);
  }
  return picked;
}

export type ArticleSelectionProblem = "missing" | "draft";

export interface ArticleSelectionIssue {
  /** Position within `selection.articleIds`, for a precise validation path. */
  readonly index: number;
  readonly articleId: string;
  readonly reason: ArticleSelectionProblem;
}

/**
 * Report explicit selections that cannot render. Returns `[]` for "By tag"
 * lists, which have no explicit targets and therefore cannot break.
 */
export function inspectArticleSelection(
  site: Site,
  selection: ArticleSelection,
): readonly ArticleSelectionIssue[] {
  const mode = selection.mode ?? DEFAULT_ARTICLE_LIST_MODE;
  if (mode !== "selected") return [];
  const byId = articlesById(site);
  const issues: ArticleSelectionIssue[] = [];
  (selection.articleIds ?? []).forEach((articleId, index) => {
    const article = byId.get(articleId);
    if (article === undefined) {
      issues.push({ index, articleId, reason: "missing" });
    } else if (article.state === "draft") {
      issues.push({ index, articleId, reason: "draft" });
    }
  });
  return issues;
}

/**
 * Published counterparts of an Article in other languages, ordered by language
 * code for deterministic output.
 *
 * Only Published counterparts are returned: automatic translation discovery
 * must not expose Unlisted content, and there is no language-home fallback
 * (ADR 0047, deliberately unlike the Page behaviour in ADR 0015).
 */
export function publishedTranslationsOf(site: Site, article: Article): readonly Article[] {
  const group = article.translationGroup;
  if (group === undefined) return [];
  return articlesOf(site)
    .filter(
      (other) =>
        other.id !== article.id &&
        other.translationGroup === group &&
        other.state === "published" &&
        other.lang !== article.lang,
    )
    .sort((a, b) => (a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0));
}
