/** @jsxImportSource preact */
import type { Article, ArticleListBlock, ArticleSelection, Site } from "@sosb/schema";
import { DEFAULT_ARTICLE_LIST_MODE, resolveArticleSelection } from "@sosb/schema";
import { articleCopy, formatArticleDate } from "../article-text.js";
import { assetRefAlt, assetRefPath } from "../asset-ref-path.js";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";
import { articlePath } from "../routing.js";

/**
 * articleList renderer — structural HTML for a list of linked Article cards.
 *
 *   <section data-block="articleList" data-mode="byTag|selected">
 *     [<h2 class="article-list__title">]
 *     [<p class="article-list__intro">]
 *     <ol class="article-list__items"> <li><article class="article-card"> ... </ol>
 *     | <p class="article-list__empty">No articles yet.</p>
 *   </section>
 *
 * Which Articles appear is decided by `resolveArticleSelection` in
 * `@sosb/schema`, not here — the validator and the editor Inspector call the
 * same function, so what an author previews is what exports.
 *
 * Unlike `eventList`, an empty list is **not** suppressed: issue #97 requires
 * the heading to stay and an explicit "No articles yet." to render, so a
 * visitor sees a section that is deliberately empty rather than a page that
 * silently lost a chunk of itself.
 *
 * The card is a whole-card link: the `<a>` wraps the title only, and the
 * surrounding `<article>` carries a `data-article-card-href` attribute themes
 * may use for a click target. Keeping the anchor on the title (rather than
 * wrapping cover + title + summary in one `<a>`) keeps the accessible name of
 * the link short and meaningful for screen-reader link lists.
 */

function ArticleCard(props: {
  site: Site;
  article: Article;
  lang: string;
  assetUrlForPath: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { site, article } = props;
  const href = articlePath(site, article);
  const cover = assetRefPath(article.cover);
  const coverAlt =
    typeof article.coverAlt === "string" && article.coverAlt.length > 0
      ? article.coverAlt
      : cover !== undefined
        ? assetRefAlt(article.cover)
        : "";
  const summary =
    typeof article.summary === "string" && article.summary.length > 0 ? article.summary : undefined;

  return (
    <article
      class="article-card"
      data-article-id={article.id}
      data-article-lang={article.lang}
      data-article-card-href={href}
    >
      {cover !== undefined && (
        <div class="article-card__media">
          <img src={resolveAssetUrl(cover, props.assetUrlForPath)} alt={coverAlt} loading="lazy" />
        </div>
      )}
      <div class="article-card__body">
        <h3 class="article-card__title">
          <a href={href}>{article.title}</a>
        </h3>
        <time class="article-card__date" datetime={article.publishedAt}>
          {formatArticleDate(article.publishedAt, article.lang)}
        </time>
        {summary !== undefined && <p class="article-card__summary">{summary}</p>}
      </div>
    </article>
  );
}

/**
 * The cards half of an Article list, without the block envelope. Shared by the
 * `articleList` block and by an Article's Related Articles section, so both
 * present identically.
 */
export function ArticleCards(props: {
  site: Site;
  articles: readonly Article[];
  lang: string;
  assetUrlForPath: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  if (props.articles.length === 0) {
    return <p class="article-list__empty">{articleCopy(props.lang, "emptyList")}</p>;
  }
  return (
    <ol class="article-list__items">
      {props.articles.map((article) => (
        <li key={article.id} class="article-list__item">
          <ArticleCard
            site={props.site}
            article={article}
            lang={props.lang}
            assetUrlForPath={props.assetUrlForPath}
          />
        </li>
      ))}
    </ol>
  );
}

export function ArticleList(props: {
  block: ArticleListBlock;
  site: Site;
  lang: string;
  containerArticleId?: string | undefined;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { id, data } = props.block;
  const mode = data.mode ?? DEFAULT_ARTICLE_LIST_MODE;
  const matches = resolveArticleSelection(props.site, data as ArticleSelection, {
    lang: props.lang,
    ...(props.containerArticleId === undefined
      ? {}
      : { excludeArticleId: props.containerArticleId }),
  });

  const title = typeof data.title === "string" && data.title.length > 0 ? data.title : undefined;
  const intro = typeof data.intro === "string" && data.intro.length > 0 ? data.intro : undefined;
  const headingId = title !== undefined ? `${id}__title` : undefined;

  return (
    <section
      data-block="articleList"
      data-block-id={id}
      data-mode={mode}
      aria-labelledby={headingId}
    >
      {title !== undefined && (
        <h2 id={headingId} class="article-list__title">
          {title}
        </h2>
      )}
      {intro !== undefined && <p class="article-list__intro">{intro}</p>}
      <ArticleCards
        site={props.site}
        articles={matches}
        lang={props.lang}
        assetUrlForPath={props.assetUrlForPath}
      />
    </section>
  );
}
