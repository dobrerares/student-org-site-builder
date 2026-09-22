/**
 * Resolving stored rich-text link targets to URLs at render time.
 *
 * Rich-text documents store *who* a link points at (a Page id, an Article
 * id), never *where* it currently lives (ADR 0048). This module is the one
 * place that turns identity back into a path, so a slug rename is invisible
 * to stored content and a deleted target degrades in exactly one way.
 *
 * Page links are root-absolute (`/despre/`), matching `pagePath` and every
 * other internal link the Renderer emits. They are deliberately *not*
 * depth-prefixed the way asset paths are — see `asset-url.ts` for why the
 * two differ.
 */

import { pageById, type RichTextLinkTarget, type Site } from "@sosb/schema";
import { pagePath } from "./routing.js";

/**
 * URL segment Articles live under. Mirrors `ARTICLE_ROUTE_PREFIX` in
 * `@sosb/schema` (issue #97).
 *
 * REBASE NOTE: once the Articles work is on `main`, delete this constant and
 * the `articleHref` helper below and call the shared `articlePath(site,
 * article)` from `./routing.js` instead. They are duplicated here only
 * because this branch cannot import a symbol that does not exist yet, and
 * they implement the same rule.
 */
const ARTICLE_ROUTE_PREFIX = "articles";

interface ArticleLike {
  readonly id?: unknown;
  readonly lang?: unknown;
  readonly slug?: unknown;
  readonly state?: unknown;
}

/**
 * Build a resolver for one Site.
 *
 * Returns `null` for any target that no longer resolves — a deleted Page, a
 * missing Article, or an Article still in Draft, which visitors cannot open.
 * The serialiser turns `null` into unlinked text; validation raises the
 * matching Site Health warning. Neither drops the author's words.
 */
export function makeRichTextLinkResolver(
  site: Site,
): (target: RichTextLinkTarget) => string | null {
  return (target: RichTextLinkTarget): string | null => {
    if (target.kind === "external") {
      return typeof target.href === "string" ? target.href : null;
    }
    if (target.kind === "page") {
      const page = pageById(site, target.pageId);
      return page === undefined ? null : pagePath(site, page);
    }
    if (target.kind === "article") {
      const article = findArticle(site, target.articleId);
      if (article === undefined) return null;
      return articleHref(site, article);
    }
    return null;
  };
}

function findArticle(site: Site, id: string): ArticleLike | undefined {
  const articles = (site as { articles?: unknown }).articles;
  if (!Array.isArray(articles)) return undefined;
  for (const entry of articles) {
    if (typeof entry !== "object" || entry === null) continue;
    const article = entry as ArticleLike;
    if (article.id === id) return article;
  }
  return undefined;
}

function articleHref(site: Site, article: ArticleLike): string | null {
  // Drafts are not emitted to the public site, so linking at one would
  // produce a 404. Unlisted Articles *are* emitted and are legitimate
  // targets (issue #100).
  if (article.state === "draft") return null;
  if (typeof article.slug !== "string" || article.slug.length === 0) return null;
  const lang = typeof article.lang === "string" ? article.lang : site.defaultLanguage;
  return lang === site.defaultLanguage
    ? `/${ARTICLE_ROUTE_PREFIX}/${article.slug}/`
    : `/${lang}/${ARTICLE_ROUTE_PREFIX}/${article.slug}/`;
}
