/** @jsxImportSource preact */
import type {
  Page,
  Site,
  BlockEnvelope,
  ContactCardBlock,
  CtaBannerBlock,
  CustomHtmlBlock,
  DocumentDownloadsBlock,
  EmbedBlock,
  EventListBlock,
  FaqBlock,
  HeroBlock,
  QuoteBlock,
  RichTextBlock,
  PartnerLogosBlock,
  ImageGalleryBlock,
  SiteFooterBlock,
  TeamGridBlock,
  ValueListBlock,
  ActivitiesListBlock,
} from "@sosb/schema";
import type { Article, ArticleListBlock, ArticleSelection } from "@sosb/schema";
import { isKnownBlockType, resolveArticleSelection } from "@sosb/schema";
import { ArticleCards, ArticleList } from "./blocks/article-list.js";
import { articleCopy, formatArticleDate } from "./article-text.js";
import { assetRefAlt, assetRefPath } from "./asset-ref-path.js";
import { CtaBanner } from "./blocks/cta-banner.js";
import { Faq } from "./blocks/faq.js";
import { Hero } from "./blocks/hero.js";
import { Quote } from "./blocks/quote.js";
import { RichText } from "./blocks/rich-text.js";
import { TeamGrid } from "./blocks/team-grid.js";
import { ValueList } from "./blocks/value-list.js";
import { ContactCard } from "./blocks/contact-card.js";
import { Embed, pageHasLazyEmbed, EMBED_LOADER_MARKER } from "./blocks/embed.js";
import { EMBED_LAZY_LOAD_SCRIPT } from "./blocks/embed-lazy-loader.js";
import { CustomHtml } from "./blocks/custom-html.js";
import { ActivitiesList } from "./blocks/activities-list.js";
import { PartnerLogos } from "./blocks/partner-logos.js";
import { ImageGallery } from "./blocks/image-gallery.js";
import { SiteFooter } from "./blocks/site-footer.js";
import { LIGHTBOX_SCRIPT } from "./lightbox-script.js";
import { DocumentDownloads } from "./blocks/document-downloads.js";
import { EventList } from "./blocks/event-list.js";
import { EVENT_LIST_PAST_FADE_SCRIPT } from "./blocks/event-list-past-fade.js";
import {
  articleHreflangEntriesFor,
  articleLanguageSwitcherEntriesFor,
  articlePath,
  homePagePathForLanguage,
  hreflangEntriesFor,
  languageHomeIndex,
  languageSwitcherEntriesFor,
  navPagesForLanguage,
  pagePath,
} from "./routing.js";
import type { HreflangEntry, LanguageSwitcherEntry } from "./routing.js";
import { PREVIEW_NAV_SCRIPT, PREVIEW_NAV_SCRIPT_MARKER } from "./preview-nav-script.js";
import { PREVIEW_MORPH_SCRIPT, PREVIEW_MORPH_SCRIPT_MARKER } from "./preview-morph-script.js";
import type { AssetUrlForPath } from "./asset-url.js";
import { resolveAssetUrl } from "./asset-url.js";
import type { ThemeBundle } from "./theme-bundle.js";
import { themeAssetPrefix } from "./theme-bundle.js";
import { activeBlockVariant } from "./theme-reference.js";
import type { DesignContext, ShellInputParts, ThemeRenderIssue } from "./theme-design.js";
import {
  articleDocumentRef,
  blockHasDesign,
  pageDocumentRef,
  pageDocumentTitle,
  renderDesignedBlock,
  renderDesignedShell,
  themeDesignsBlockType,
  themeErrorBox,
} from "./theme-design.js";

/**
 * The design variant to hand a block component, or `undefined`.
 *
 * Resolved centrally — a block component has no business knowing what a Theme
 * is — but *emitted* by the component, because the component owns its root
 * element and is the only thing that knows which element that is. When this
 * returns `undefined` Preact omits the attribute, so built-in Themes produce
 * exactly the bytes they did before variants existed.
 */
function variantFor(block: BlockEnvelope, theme: ThemeBundle | undefined): string | undefined {
  if (theme === undefined) return undefined;
  return activeBlockVariant(block, theme);
}

/**
 * The page shell.
 *
 * Renders the outer HTML scaffolding (`<head>` with SEO meta, `<body>` with a
 * `<main>` landmark and the page's blocks). The `<!doctype html>` prefix is
 * added by the top-level `renderSite` because Preact's
 * `preact-render-to-string` emits the `<html>` element only — there is no
 * built-in way to model the doctype in JSX.
 *
 * Lightbox wiring (issue #14): when at least one imageGallery on the page
 * has `lightbox: true`, the shell appends a single page-global lightbox
 * dialog scaffold and the inline vanilla-JS bootstrap. The script is
 * shipped exactly once per page, regardless of how many galleries opt in.
 *
 * SECURITY NOTE on inline HTML / script usage in this file:
 *  - The `<style>` block content is the renderer's own composed CSS string
 *    (token rule + theme CSS, both renderer-owned constants and validated
 *    schema values). It contains no user prose.
 *  - The lightbox `<script>` content is the renderer-owned `LIGHTBOX_SCRIPT`
 *    constant from `./lightbox-script.ts`. It is a pre-minified IIFE that
 *    references DOM data attributes only — it never embeds user prose,
 *    user-supplied URLs, or schema strings. The script is the same byte
 *    payload on every render.
 *  - The unknown-block HTML comment is constructed from a block `type` that
 *    has been parsed against the BlockEnvelope schema (must be a non-empty
 *    string) and then comment-escaped via `escapeHtmlComment` to remove the
 *    `--` and `>` sequences that could break out. There is no script context.
 *  - The eventList past-fade `<script>` body is
 *    `EVENT_LIST_PAST_FADE_SCRIPT`, a renderer-owned compile-time constant
 *    (no user input). It is only emitted when at least one eventList block
 *    is present on the page; pages without event lists ship zero JS.
 */

function pageTitle(site: Site, page: Page): string {
  return pageDocumentTitle(site, page);
}

function pageDescription(site: Site, page: Page): string | undefined {
  const candidate = page.seo?.description;
  if (typeof candidate === "string" && candidate.length > 0) return candidate;
  if (typeof site.org.tagline === "string" && site.org.tagline.length > 0) {
    return site.org.tagline;
  }
  return undefined;
}

/**
 * Pull the page's first hero block's `backgroundImage`, if any. Used both
 * for `og:image` parity in the build pipeline and for the Twitter Card
 * (`twitter:image`) the renderer emits. Returns `undefined` when the first
 * block is not a hero or when `backgroundImage` is absent / empty.
 */
function pageOgImage(page: Page, assetUrlForPath: AssetUrlForPath | undefined): string | undefined {
  const firstBlock = page.blocks[0];
  if (firstBlock === undefined) return undefined;
  if (firstBlock.type !== "hero") return undefined;
  const data = firstBlock.data as { backgroundImage?: unknown };
  const path =
    typeof data.backgroundImage === "object" &&
    data.backgroundImage !== null &&
    typeof (data.backgroundImage as { path?: unknown }).path === "string"
      ? (data.backgroundImage as { path: string }).path
      : typeof data.backgroundImage === "string"
        ? data.backgroundImage
        : undefined;
  if (path === undefined || path.length === 0) return undefined;
  return resolveAssetUrl(path, assetUrlForPath);
}

/**
 * What a block needs to know about its surroundings.
 *
 * Most blocks render from their own `data` alone. `articleList` cannot: it
 * resolves Articles out of the whole Site, filters by the container's
 * language, and excludes the containing Article from "By tag" results. The
 * active Theme belongs here for the same reason — `variantFor` needs it for
 * every block, and threading it as a second positional argument alongside the
 * context would give two ways to say "about the surroundings".
 *
 * Passing a context record rather than widening the parameter list keeps the
 * next site-aware block from churning every call site again.
 */
interface BlockRenderContext {
  readonly site: Site;
  readonly lang: string;
  readonly assetUrlForPath: AssetUrlForPath | undefined;
  /** Active Theme, for resolving each block's design variant. */
  readonly theme?: ThemeBundle | undefined;
  /** Set only when the blocks belong to an Article. */
  readonly containerArticleId?: string | undefined;
  /**
   * Everything an executable Theme design needs (ADR 0054). Absent for
   * built-in Themes and for declarative packages, and every path below reads
   * absence as "render the built-in component" — which is why adding this
   * changed no existing output.
   */
  readonly design?: DesignContext | undefined;
  /** Active page-shell variant, handed to designs as part of Theme settings. */
  readonly shellVariant?: string | undefined;
}

function renderBlock(block: BlockEnvelope, ctx: BlockRenderContext): preact.JSX.Element | null {
  const assetUrlForPath = ctx.assetUrlForPath;
  const pageLang = ctx.lang;
  const variant = variantFor(block, ctx.theme);
  // A Theme design wins over the built-in component. That is what "Custom
  // Themes may control Block markup" means (ADR 0046): overriding `hero` uses
  // the same mechanism as supplying a design for `org.example/partners`, not a
  // second one that could behave differently.
  if (
    ctx.design !== undefined &&
    ctx.theme !== undefined &&
    themeDesignsBlockType(ctx.theme, block.type)
  ) {
    // A design that returns null has rendered nothing on purpose. An empty
    // fragment keeps that distinct from "no component at all", which is the
    // only case the unknown-block marker below is for.
    return renderDesignedBlock(block, ctx.design, variant, ctx.shellVariant) ?? <></>;
  }
  if (!isKnownBlockType(block.type)) return null;
  if (block.type === "articleList") {
    return (
      <ArticleList
        block={block as unknown as ArticleListBlock}
        site={ctx.site}
        lang={ctx.lang}
        containerArticleId={ctx.containerArticleId}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "hero") {
    return (
      <Hero
        block={block as unknown as HeroBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "richText") {
    return <RichText block={block as unknown as RichTextBlock} variant={variant} />;
  }
  if (block.type === "quote") {
    return (
      <Quote
        block={block as unknown as QuoteBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "valueList") {
    return <ValueList block={block as unknown as ValueListBlock} variant={variant} />;
  }
  if (block.type === "contactCard") {
    return <ContactCard block={block as unknown as ContactCardBlock} variant={variant} />;
  }
  if (block.type === "embed") {
    return <Embed block={block as unknown as EmbedBlock} variant={variant} />;
  }
  if (block.type === "customHTML") {
    return <CustomHtml block={block as unknown as CustomHtmlBlock} variant={variant} />;
  }
  if (block.type === "activitiesList") {
    return (
      <ActivitiesList
        block={block as unknown as ActivitiesListBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "teamGrid") {
    return (
      <TeamGrid
        block={block as unknown as TeamGridBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "faq") {
    return <Faq block={block as unknown as FaqBlock} variant={variant} />;
  }
  if (block.type === "ctaBanner") {
    return (
      <CtaBanner
        block={block as unknown as CtaBannerBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "partnerLogos") {
    return (
      <PartnerLogos
        block={block as unknown as PartnerLogosBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "imageGallery") {
    return (
      <ImageGallery
        block={block as unknown as ImageGalleryBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "documentDownloads") {
    return (
      <DocumentDownloads
        block={block as unknown as DocumentDownloadsBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  if (block.type === "eventList") {
    return (
      <EventList
        block={block as unknown as EventListBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
        lang={pageLang}
      />
    );
  }
  if (block.type === "siteFooter") {
    return (
      <SiteFooter
        block={block as unknown as SiteFooterBlock}
        variant={variant}
        assetUrlForPath={assetUrlForPath}
      />
    );
  }
  return null;
}

/**
 * One rendered document — a Page or an Article — reduced to what the shell
 * needs. Both kinds share the entire `<head>`, the site navigation, the
 * language switcher, and the per-page script gating; only the sources of the
 * title, the alternates, and the `<main>` contents differ.
 *
 * Resolving both into this record (rather than branching inside the shell on
 * "is this an article?") keeps one implementation of the head, so an SEO tag
 * added for Pages cannot silently skip Articles.
 */
interface ShellTarget {
  readonly lang: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly ogImage: string | undefined;
  readonly ogType: "website" | "article";
  /** Unlisted Articles only. Pages are always indexable. */
  readonly noindex: boolean;
  readonly activeHref: string;
  readonly hreflangs: readonly HreflangEntry[];
  readonly switcherEntries: readonly LanguageSwitcherEntry[];
  readonly mainContent: preact.JSX.Element;
  readonly footerContent: preact.JSX.Element | null;
  readonly hasLazyEmbed: boolean;
  readonly needsLightbox: boolean;
  readonly hasEventList: boolean;
}

function renderBlocks(
  blocks: readonly BlockEnvelope[],
  ctx: BlockRenderContext,
): preact.JSX.Element {
  return (
    <>
      {blocks.map((block) => {
        const rendered = renderBlock(block, ctx);
        if (rendered !== null) return rendered;
        // No built-in component and no Theme design: the Block is *omitted*
        // (ADR 0045) and reported, so the editor can require the author to
        // acknowledge the omission before export rather than let them discover
        // it on the published Site. Only an unknown type reaches this branch —
        // a built-in component is a vnode even when it renders nothing — and
        // `blockHasDesign` is the same predicate `omittedBlocksFor` uses, so
        // the pre-flight list and the render report cannot disagree. The
        // comment below is the pre-existing marker and stays, so the built-in
        // golden files are untouched.
        if (ctx.design !== undefined && !blockHasDesign(ctx.theme, block.type)) {
          ctx.design.onIssue?.({
            kind: "omitted-block",
            omitted: {
              document: ctx.design.docRef,
              blockId: block.id,
              blockType: block.type,
            },
          });
        }
        return (
          <div
            key={block.id}
            dangerouslySetInnerHTML={{
              __html: `<!-- unknown block: ${escapeHtmlComment(block.type)} -->`,
            }}
          />
        );
      })}
    </>
  );
}

function blocksNeedLightbox(blocks: readonly BlockEnvelope[]): boolean {
  for (const block of blocks) {
    if (block.type !== "imageGallery") continue;
    const flag = (block.data as { lightbox?: unknown }).lightbox;
    if (flag === true) return true;
  }
  return false;
}

export function PageShell(props: {
  site: Site;
  page: Page;
  css: string;
  fontPreloads?: readonly string[] | undefined;
  mode?: "deploy" | "preview";
  assetUrlForPath?: AssetUrlForPath | undefined;
  /** Active theme. Only used to decide which design variants apply. */
  theme?: ThemeBundle | undefined;
  /** Page-shell variant, already gated against the active theme. */
  shellVariant?: string | undefined;
  /** Sink for omitted Blocks and Theme rendering failures (ADR 0054). */
  onIssue?: ((issue: ThemeRenderIssue) => void) | undefined;
  /** Emit the Theme's `public.js` tag. Off in preview (ADR 0046). */
  includePublicScript?: boolean | undefined;
}): preact.JSX.Element {
  const {
    site,
    page,
    css,
    fontPreloads = [],
    mode = "deploy",
    assetUrlForPath,
    theme,
    shellVariant,
    onIssue,
    includePublicScript = false,
  } = props;
  const contentBlocks = page.blocks.filter((block) => block.type !== "siteFooter");
  const footerBlocks = page.blocks.filter((block) => block.type === "siteFooter");
  const design = designContextFor(
    site,
    theme,
    pageDocumentRef(site, page),
    assetUrlForPath,
    mode,
    onIssue,
  );
  const ctx: BlockRenderContext = {
    site,
    lang: page.lang,
    assetUrlForPath,
    theme,
    design,
    shellVariant,
  };

  const target: ShellTarget = {
    lang: page.lang,
    title: pageTitle(site, page),
    description: pageDescription(site, page),
    ogImage: pageOgImage(page, assetUrlForPath),
    ogType: "website",
    noindex: false,
    activeHref: pagePath(site, page),
    hreflangs: hreflangEntriesFor(site, page),
    switcherEntries: languageSwitcherEntriesFor(site, page),
    mainContent: renderBlocks(contentBlocks, ctx),
    footerContent: footerBlocks.length === 0 ? null : renderBlocks(footerBlocks, ctx),
    hasLazyEmbed: pageHasLazyEmbed(page.blocks),
    needsLightbox: blocksNeedLightbox(page.blocks),
    hasEventList: page.blocks.some((b) => b.type === "eventList"),
  };

  return (
    <DocumentShell
      site={site}
      target={target}
      css={css}
      fontPreloads={fontPreloads}
      mode={mode}
      assetUrlForPath={assetUrlForPath}
      shellVariant={shellVariant}
      design={design}
      includePublicScript={includePublicScript}
      theme={theme}
    />
  );
}

function articleTitle(site: Site, article: Article): string {
  const candidate = article.seo?.title;
  if (typeof candidate === "string" && candidate.length > 0) return candidate;
  // Search and sharing metadata default to the Article's own title, falling
  // back to the org name only when an Article somehow has none (issue #97).
  return article.title.length > 0 ? article.title : site.org.name;
}

function articleDescription(site: Site, article: Article): string | undefined {
  const override = article.seo?.description;
  if (typeof override === "string" && override.length > 0) return override;
  if (typeof article.summary === "string" && article.summary.length > 0) return article.summary;
  if (typeof site.org.tagline === "string" && site.org.tagline.length > 0) {
    return site.org.tagline;
  }
  return undefined;
}

/**
 * The Article's own header: title, publication date, optional cover and
 * summary, rendered above the Article's Blocks.
 *
 * These are *not* Blocks. Issue #97 makes them automatic fields of every
 * Article so a card and its full Article can never disagree about the title or
 * the date, which is exactly what would happen if an author could delete the
 * heading Block out of one and not the other.
 */
function ArticleHeader(props: {
  article: Article;
  assetUrlForPath: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { article } = props;
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
    <header class="article__header">
      <h1 class="article__title">{article.title}</h1>
      <time class="article__date" datetime={article.publishedAt}>
        {formatArticleDate(article.publishedAt, article.lang)}
      </time>
      {summary !== undefined && <p class="article__summary">{summary}</p>}
      {cover !== undefined && (
        <div class="article__cover">
          <img src={resolveAssetUrl(cover, props.assetUrlForPath)} alt={coverAlt} />
        </div>
      )}
    </header>
  );
}

/**
 * Tag labels shown at the foot of an Article.
 *
 * Deliberately plain text, never links: Article tags are internal authoring
 * labels (CONTEXT.md, issue #98) and there are no tag pages to link to.
 * Rendering them as anchors would promise browsing that does not exist.
 */
function ArticleTags(props: { site: Site; article: Article }): preact.JSX.Element | null {
  const ids = props.article.tags ?? [];
  if (ids.length === 0) return null;
  const registry = new Map((props.site.tags ?? []).map((tag) => [tag.id, tag.label]));
  // Keyed by tag id, not by label: two tags can legitimately carry the same
  // visible label (the duplicate rule is a validation warning, not a
  // rejection), and a duplicate key would drop one of the list items.
  const labelled = ids
    .map((id) => ({ id, label: registry.get(id) }))
    .filter((entry): entry is { id: string; label: string } => {
      return typeof entry.label === "string" && entry.label.length > 0;
    });
  if (labelled.length === 0) return null;
  return (
    <ul class="article__tags" aria-label={articleCopy(props.article.lang, "tagsLabel")}>
      {labelled.map((entry) => (
        <li key={entry.id} class="article__tag">
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

function RelatedArticles(props: {
  site: Site;
  article: Article;
  assetUrlForPath: AssetUrlForPath | undefined;
}): preact.JSX.Element | null {
  const related = props.article.relatedArticles;
  if (related === undefined || !related.enabled) return null;
  const matches = resolveArticleSelection(props.site, related as ArticleSelection, {
    lang: props.article.lang,
    excludeArticleId: props.article.id,
  });
  const headingId = `${props.article.id}__related`;
  const title =
    typeof related.title === "string" && related.title.length > 0
      ? related.title
      : articleCopy(props.article.lang, "relatedTitle");
  return (
    <section
      data-block="articleList"
      data-article-related="true"
      data-mode={related.mode ?? "byTag"}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} class="article-list__title">
        {title}
      </h2>
      <ArticleCards
        site={props.site}
        articles={matches}
        lang={props.article.lang}
        assetUrlForPath={props.assetUrlForPath}
      />
    </section>
  );
}

/**
 * Render one Article as a full page inside the site shell.
 *
 * The Article's Blocks reuse the Page dispatch unchanged — that is the whole
 * point of storing an Article body as a Block list (ADR 0048's migration
 * note): when the Rich-text Block gains structured content later, Articles
 * inherit it with no work here.
 */
export function ArticleShell(props: {
  site: Site;
  article: Article;
  css: string;
  fontPreloads?: readonly string[] | undefined;
  mode?: "deploy" | "preview";
  assetUrlForPath?: AssetUrlForPath | undefined;
  /** Active theme. Only used to decide which design variants apply. */
  theme?: ThemeBundle | undefined;
  /** Page-shell variant, already gated against the active theme. */
  shellVariant?: string | undefined;
  /** Sink for omitted Blocks and Theme rendering failures (ADR 0054). */
  onIssue?: ((issue: ThemeRenderIssue) => void) | undefined;
  /** Emit the Theme's `public.js` tag. Off in preview (ADR 0046). */
  includePublicScript?: boolean | undefined;
}): preact.JSX.Element {
  const {
    site,
    article,
    css,
    fontPreloads = [],
    mode = "deploy",
    assetUrlForPath,
    theme,
    shellVariant,
    onIssue,
    includePublicScript = false,
  } = props;
  const contentBlocks = article.blocks.filter((block) => block.type !== "siteFooter");
  const design = designContextFor(
    site,
    theme,
    articleDocumentRef(article),
    assetUrlForPath,
    mode,
    onIssue,
  );
  // An Article's Blocks get the same variant treatment a Page's do: the
  // Theme seam knows nothing about which kind of document a Block sits in.
  const ctx: BlockRenderContext = {
    site,
    lang: article.lang,
    assetUrlForPath,
    theme,
    containerArticleId: article.id,
    design,
    shellVariant,
  };

  // Articles have no site-footer Block of their own; they inherit one from
  // their language's Pages so every URL of the Site ends the same way. The
  // language home page wins when it has a footer — that is the Page an author
  // thinks of as "the site" — and any other Page in the language is the
  // fallback for Sites that put their footer somewhere else.
  const languageHome = site.pages[languageHomeIndex(site, article.lang)];
  const hasFooter = (page: Page): boolean => page.blocks.some((b) => b.type === "siteFooter");
  const footerSource =
    languageHome !== undefined && languageHome.lang === article.lang && hasFooter(languageHome)
      ? languageHome
      : site.pages.find((page) => page.lang === article.lang && hasFooter(page));
  const footerBlocks = (footerSource?.blocks ?? []).filter((block) => block.type === "siteFooter");

  const cover = assetRefPath(article.cover);
  const mainContent = (
    <>
      <article
        class="article"
        data-article-id={article.id}
        data-article-state={article.state}
        data-article-lang={article.lang}
      >
        <ArticleHeader article={article} assetUrlForPath={assetUrlForPath} />
        <div class="article__body">{renderBlocks(contentBlocks, ctx)}</div>
        <ArticleTags site={site} article={article} />
      </article>
      <RelatedArticles site={site} article={article} assetUrlForPath={assetUrlForPath} />
    </>
  );

  const target: ShellTarget = {
    lang: article.lang,
    title: articleTitle(site, article),
    description: articleDescription(site, article),
    ogImage: cover === undefined ? undefined : resolveAssetUrl(cover, assetUrlForPath),
    ogType: "article",
    // Unlisted Articles are reachable by URL but must stay out of search
    // results (ADR 0047). They are not private — this is a discovery boundary.
    noindex: article.state === "unlisted",
    activeHref: articlePath(site, article),
    hreflangs: articleHreflangEntriesFor(site, article),
    switcherEntries: articleLanguageSwitcherEntriesFor(site, article),
    mainContent,
    footerContent: footerBlocks.length === 0 ? null : renderBlocks(footerBlocks, ctx),
    hasLazyEmbed: pageHasLazyEmbed(article.blocks),
    needsLightbox: blocksNeedLightbox(article.blocks),
    hasEventList: article.blocks.some((b) => b.type === "eventList"),
  };

  return (
    <DocumentShell
      site={site}
      target={target}
      css={css}
      fontPreloads={fontPreloads}
      mode={mode}
      assetUrlForPath={assetUrlForPath}
      shellVariant={shellVariant}
      design={design}
      includePublicScript={includePublicScript}
      theme={theme}
    />
  );
}

/**
 * Assemble the per-document state an executable Theme design needs, or
 * `undefined` when there is no design to run.
 *
 * Returning `undefined` rather than a context with a null module is what keeps
 * the "no design" path free of any Theme-render machinery at all — a built-in
 * Theme does not pay for a feature it does not use, and its bytes cannot
 * change by accident.
 */
function designContextFor(
  site: Site,
  theme: ThemeBundle | undefined,
  docRef: DesignContext["docRef"],
  assetUrlForPath: AssetUrlForPath | undefined,
  mode: "deploy" | "preview",
  onIssue: ((issue: ThemeRenderIssue) => void) | undefined,
): DesignContext | undefined {
  if (theme === undefined) return undefined;
  if (theme.render === undefined && onIssue === undefined) return undefined;
  return { site, bundle: theme, lang: docRef.lang, docRef, assetUrlForPath, mode, onIssue };
}

function DocumentShell(props: {
  site: Site;
  target: ShellTarget;
  css: string;
  fontPreloads: readonly string[];
  mode: "deploy" | "preview";
  assetUrlForPath: AssetUrlForPath | undefined;
  shellVariant: string | undefined;
  design?: DesignContext | undefined;
  theme?: ThemeBundle | undefined;
  includePublicScript?: boolean | undefined;
}): preact.JSX.Element {
  const { site, target, css, fontPreloads, mode, assetUrlForPath, shellVariant } = props;
  const { title, description, ogImage } = target;
  const twitterCardType = ogImage === undefined ? "summary" : "summary_large_image";
  const navPages = navPagesForLanguage(site, target.lang);
  const navLogo = site.org.logo;
  const faviconHref =
    navLogo !== undefined && typeof navLogo.path === "string" && navLogo.path.length > 0
      ? resolveAssetUrl(navLogo.path, assetUrlForPath)
      : undefined;
  const faviconType =
    navLogo !== undefined && typeof navLogo.mime === "string" && navLogo.mime.length > 0
      ? navLogo.mime
      : undefined;
  const navLogoAlt =
    typeof site.org.logoAlt === "string" && site.org.logoAlt.length > 0
      ? site.org.logoAlt
      : typeof navLogo?.alt === "string" && navLogo.alt.length > 0
        ? navLogo.alt
        : site.org.name;
  // Always emit the preview-mode click interceptor in preview mode. Gating it
  // on "has multi-page nav or a language switcher" missed every other link on
  // the page — hero CTAs, CTA banners, footer and rich-text links, and links
  // into Articles — so on a single-page site the first CTA click navigated the
  // preview iframe off the editor's origin.
  const isPreviewMode = mode === "preview";

  // The visible page shell, in the builder's own markup. Kept as a value
  // rather than inlined into the JSX because it is now one of two possible
  // bodies, and because it is the fallback a failed Theme shell falls back to.
  const builtInBody = (
    <>
      {/* Site-level navigation. Hidden when only one page is in-nav for this
       * language so single-page UX is preserved. The link list is ordered
       * by navOrder; the active page is marked with aria-current="page" and
       * data-active="true" so themes can style without re-ordering DOM. */}
      {navPages.length > 1 && (
        <nav data-site-nav aria-label="Site navigation">
          <div class="site-nav__inner">
            {navLogo !== undefined && (
              <a class="site-nav__brand" href="/" aria-label={site.org.name}>
                <img
                  class="site-nav__logo"
                  src={resolveAssetUrl(navLogo.path, assetUrlForPath)}
                  alt={navLogoAlt}
                  width={navLogo.width > 0 ? navLogo.width : undefined}
                  height={navLogo.height > 0 ? navLogo.height : undefined}
                />
              </a>
            )}
            <ul>
              {navPages.map((entry) => {
                const href = pagePath(site, entry);
                const isActive = href === target.activeHref;
                return (
                  <li key={`${entry.lang}:${entry.slug}`}>
                    <a
                      href={href}
                      data-active={isActive ? "true" : "false"}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {entry.navLabel}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      )}
      {/* Language switcher. Rendered when the site has 2+ declared
       * languages. Native names only (no flags — see PRD § 109). The
       * active language self-links so theme styling can rely on
       * aria-current; non-active languages link to localizedAs
       * counterparts, with a graceful fallback to the language home when
       * no counterpart exists. Articles use a stricter rule: only
       * Published counterparts, and no language-home fallback. */}
      {target.switcherEntries.length > 0 && (
        <nav data-language-switcher aria-label="Language">
          <ul>
            {target.switcherEntries.map((entry) => (
              <li key={entry.lang}>
                <a
                  href={entry.href}
                  lang={entry.lang}
                  hrefLang={entry.lang}
                  data-active={entry.isActive ? "true" : "false"}
                  aria-current={entry.isActive ? "true" : undefined}
                >
                  {entry.nativeName}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <main>{target.mainContent}</main>
      {target.footerContent}
    </>
  );

  // What the builder inserts at the Theme shell's content slot: the `<main>`
  // landmark with the page's Blocks in author order, then any site-footer
  // Block. Identical to what the built-in shell puts between its nav and its
  // scripts, so a Theme shell changes the chrome around the content and never
  // the content's own reading order (ADR 0046).
  const slotContent = (
    <>
      <main>{target.mainContent}</main>
      {target.footerContent}
    </>
  );

  const shellParts: ShellInputParts = {
    title,
    description,
    homeHref: homePagePathForLanguage(site, target.lang),
    nav: navPages.map((entry) => {
      const href = pagePath(site, entry);
      return {
        id: `${entry.lang}:${entry.slug}`,
        label: entry.navLabel,
        href,
        isActive: href === target.activeHref,
      };
    }),
    languages: target.switcherEntries.map((entry) => ({
      lang: entry.lang,
      nativeName: entry.nativeName,
      href: entry.href,
      isActive: entry.isActive,
    })),
    shellVariant,
  };

  const designedShell =
    props.design === undefined
      ? undefined
      : renderDesignedShell(props.design, shellParts, slotContent);
  const body =
    designedShell === undefined ? (
      builtInBody
    ) : designedShell.body !== undefined ? (
      designedShell.body
    ) : (
      // Preview only — deploy rethrows. A page with no header is still an
      // editable page; a blank one is not, so the content survives and the
      // box says which Theme broke.
      <>
        {themeErrorBox(designedShell.error.message, target.lang)}
        {builtInBody}
      </>
    );

  // The Theme's public-site script. Off by default and on in a build: ADR 0046
  // keeps the editor preview static so ordinary content editing never fires a
  // Theme's external calls.
  const publicScriptSrc =
    props.includePublicScript === true && props.theme?.publicScript !== undefined
      ? resolveAssetUrl(
          themeAssetPrefix(props.theme.id) + props.theme.publicScript.file,
          assetUrlForPath,
        )
      : undefined;

  return (
    <html lang={target.lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {target.noindex && <meta name="robots" content="noindex" />}
        <title>{title}</title>
        {faviconHref !== undefined && <link rel="icon" href={faviconHref} type={faviconType} />}
        {fontPreloads.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        {description !== undefined && <meta name="description" content={description} />}
        {/* Open Graph minimum so theme-agnostic shares render predictably. */}
        <meta property="og:title" content={title} />
        {description !== undefined && <meta property="og:description" content={description} />}
        <meta property="og:type" content={target.ogType} />
        {/* Twitter Card parity. Absolute URLs for og:image/twitter:image are
         * overlaid by the build pipeline when a `siteUrl` is configured. */}
        <meta name="twitter:card" content={twitterCardType} />
        <meta name="twitter:title" content={title} />
        {description !== undefined && <meta name="twitter:description" content={description} />}
        {ogImage !== undefined && <meta name="twitter:image" content={ogImage} />}
        {/* hreflang alternates for cross-language SEO. Skipped on
         * single-language sites (no other languages to advertise). */}
        {target.hreflangs.map((entry) => (
          <link key={entry.hreflang} rel="alternate" hreflang={entry.hreflang} href={entry.href} />
        ))}
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      {/* `data-shell-variant` is the page-shell counterpart of a Block's
       * `data-variant`: a theme addresses its header/nav/footer treatments as
       * `[data-shell-variant="compact"] [data-site-nav]`. Omitted entirely
       * when the active theme offers no shell variants, so built-in output is
       * unchanged. ADR 0046 still owns the shell; a variant restyles it and
       * must not reorder content. */}
      <body data-shell-variant={shellVariant}>
        {body}
        {target.hasLazyEmbed && (
          <script
            {...{ [EMBED_LOADER_MARKER]: "" }}
            dangerouslySetInnerHTML={{ __html: EMBED_LAZY_LOAD_SCRIPT }}
          />
        )}
        {target.needsLightbox && <LightboxScaffold />}
        {target.needsLightbox && (
          <script data-sosb-lightbox-script dangerouslySetInnerHTML={{ __html: LIGHTBOX_SCRIPT }} />
        )}
        {target.hasEventList && (
          <script
            data-sosb="event-list-past-fade"
            dangerouslySetInnerHTML={{ __html: EVENT_LIST_PAST_FADE_SCRIPT }}
          />
        )}
        {/* The Theme's own public-site script. `defer` rather than inline:
         * ADR 0046 requires core content and Page navigation to work before
         * JavaScript runs, and a deferred external file cannot block the
         * parse. It is emitted after the builder's own enhancements so a
         * Theme script observes the finished markup. */}
        {publicScriptSrc !== undefined && (
          <script defer src={publicScriptSrc} {...{ "data-sosb-theme-script": "" }} />
        )}
        {isPreviewMode && (
          <script
            {...{ [PREVIEW_NAV_SCRIPT_MARKER]: "" }}
            dangerouslySetInnerHTML={{ __html: PREVIEW_NAV_SCRIPT }}
          />
        )}
        {/* In-place update receiver. Emitted last so the document it morphs is
         * fully parsed, and after the nav script so a single reload installs
         * both. See `preview-morph-script.ts`. */}
        {isPreviewMode && (
          <script
            {...{ [PREVIEW_MORPH_SCRIPT_MARKER]: "" }}
            dangerouslySetInnerHTML={{ __html: PREVIEW_MORPH_SCRIPT }}
          />
        )}
      </body>
    </html>
  );
}

/**
 * Page-global lightbox dialog scaffold. One per page; the JS bootstrap
 * routes events from each gallery's triggers into this single dialog.
 *
 * The dialog uses semantic ARIA (`role="dialog"`, `aria-modal="true"`,
 * `aria-label="Image preview"`) so screen-readers announce it correctly,
 * and starts in the closed state with a `hidden` attribute. The script
 * toggles `hidden` and a `data-open` attribute the theme CSS can hook
 * into for entry transitions if it wants.
 */
function LightboxScaffold(): preact.JSX.Element {
  return (
    <div
      data-sosb-lightbox
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      hidden
      tabindex={-1}
    >
      <div class="sosb-lightbox__backdrop" />
      <div class="sosb-lightbox__panel">
        <button
          type="button"
          class="sosb-lightbox__btn sosb-lightbox__btn--prev"
          data-sosb-lightbox-prev
          aria-label="Previous image"
        >
          {"‹"}
        </button>
        <figure class="sosb-lightbox__figure">
          <img data-sosb-lightbox-img src="" alt="" />
          <figcaption data-sosb-lightbox-caption class="sosb-lightbox__caption" hidden />
        </figure>
        <button
          type="button"
          class="sosb-lightbox__btn sosb-lightbox__btn--next"
          data-sosb-lightbox-next
          aria-label="Next image"
        >
          {"›"}
        </button>
        <button
          type="button"
          class="sosb-lightbox__btn sosb-lightbox__btn--close"
          data-sosb-lightbox-close
          aria-label="Close image preview"
        >
          {"×"}
        </button>
      </div>
    </div>
  );
}

/**
 * HTML comments cannot contain "--", and a comment must not end with "->" in
 * unexpected positions. Conservative scrubbing keeps the output well-formed
 * even when an attacker-controlled block type tries to break out.
 */
function escapeHtmlComment(value: string): string {
  return value.replace(/--/g, "-_").replace(/>/g, "&gt;");
}
