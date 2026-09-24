/**
 * Resolving stored rich-text link targets to URLs at render time.
 *
 * Rich-text documents store *who* a link points at (a Page id, an Article
 * id), never *where* it currently lives (ADR 0048). This module is the one
 * place that turns identity back into a path, so a slug rename is invisible
 * to stored content and a deleted target degrades in exactly one way.
 *
 * Page and Article links are root-absolute (`/despre/`, `/articles/x/`),
 * matching `pagePath` / `articlePath` and every other internal link the
 * Renderer emits. They are deliberately *not* depth-prefixed the way asset
 * paths are — see `asset-url.ts` for why the two differ.
 */

import { articlesById, pageById, type RichTextLinkTarget, type Site } from "@sosb/schema";
import { articlePath, pagePath } from "./routing.js";

/**
 * Build a resolver for one Site.
 *
 * Returns `null` for any target that no longer resolves — a deleted Page, a
 * missing Article, or an Article still in Draft, which is never emitted to
 * the public Site and would therefore 404. The serialiser turns `null` into
 * unlinked text; validation raises the matching Site Health warning. Neither
 * drops the author's words.
 *
 * The Article index is built once per call, not once per link, because a
 * document can hold many links and `articlesById` walks the whole Site.
 */
export function makeRichTextLinkResolver(
  site: Site,
): (target: RichTextLinkTarget) => string | null {
  const articles = articlesById(site);

  return (target: RichTextLinkTarget): string | null => {
    if (target.kind === "external") {
      return typeof target.href === "string" ? target.href : null;
    }
    if (target.kind === "page") {
      const page = pageById(site, target.pageId);
      return page === undefined ? null : pagePath(site, page);
    }
    if (target.kind === "article") {
      const article = articles.get(target.articleId);
      if (article === undefined) return null;
      // Unlisted Articles *are* emitted and are legitimate targets
      // (issue #100); only Drafts are unreachable for visitors.
      if (article.state === "draft") return null;
      return articlePath(site, article);
    }
    return null;
  };
}
