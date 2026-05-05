/** @jsxImportSource preact */
import type {
  Page,
  Site,
  BlockEnvelope,
  ContactCardBlock,
  CtaBannerBlock,
  CustomHtmlBlock,
  EmbedBlock,
  FaqBlock,
  HeroBlock,
  QuoteBlock,
  RichTextBlock,
  PartnerLogosBlock,
  ImageGalleryBlock,
  TeamGridBlock,
  ValueListBlock,
  ActivitiesListBlock,
} from "@sosb/schema";
import { isKnownBlockType } from "@sosb/schema";
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
import { LIGHTBOX_SCRIPT } from "./lightbox-script.js";
import { navPagesFor, pagePath } from "./routing.js";

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
 * SECURITY NOTE on dangerouslySetInnerHTML usage in this file:
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
 */

function pageTitle(site: Site, page: Page): string {
  const candidate = page.seo?.title;
  if (typeof candidate === "string" && candidate.length > 0) return candidate;
  return site.org.name;
}

function pageDescription(site: Site, page: Page): string | undefined {
  const candidate = page.seo?.description;
  if (typeof candidate === "string" && candidate.length > 0) return candidate;
  if (typeof site.org.tagline === "string" && site.org.tagline.length > 0) {
    return site.org.tagline;
  }
  return undefined;
}

function renderBlock(block: BlockEnvelope): preact.JSX.Element | null {
  if (!isKnownBlockType(block.type)) return null;
  if (block.type === "hero") {
    return <Hero block={block as unknown as HeroBlock} />;
  }
  if (block.type === "richText") {
    return <RichText block={block as unknown as RichTextBlock} />;
  }
  if (block.type === "quote") {
    return <Quote block={block as unknown as QuoteBlock} />;
  }
  if (block.type === "valueList") {
    return <ValueList block={block as unknown as ValueListBlock} />;
  }
  if (block.type === "contactCard") {
    return <ContactCard block={block as unknown as ContactCardBlock} />;
  }
  if (block.type === "embed") {
    return <Embed block={block as unknown as EmbedBlock} />;
  }
  if (block.type === "customHTML") {
    return <CustomHtml block={block as unknown as CustomHtmlBlock} />;
  }
  if (block.type === "activitiesList") {
    return <ActivitiesList block={block as unknown as ActivitiesListBlock} />;
  }
  if (block.type === "teamGrid") {
    return <TeamGrid block={block as unknown as TeamGridBlock} />;
  }
  if (block.type === "faq") {
    return <Faq block={block as unknown as FaqBlock} />;
  }
  if (block.type === "ctaBanner") {
    return <CtaBanner block={block as unknown as CtaBannerBlock} />;
  }
  if (block.type === "partnerLogos") {
    return <PartnerLogos block={block as unknown as PartnerLogosBlock} />;
  }
  if (block.type === "imageGallery") {
    return <ImageGallery block={block as unknown as ImageGalleryBlock} />;
  }
  return null;
}

/**
 * Does the page contain at least one imageGallery whose lightbox is on?
 *
 * The lightbox dialog scaffold and the inline JS are page-global; we want
 * them only when at least one block opted in. The check is intentionally
 * tolerant — `block.data` is `looseObject`-typed, so we read `lightbox`
 * via a typeof check.
 */
function pageNeedsLightbox(page: Page): boolean {
  for (const block of page.blocks) {
    if (block.type !== "imageGallery") continue;
    const flag = (block.data as { lightbox?: unknown }).lightbox;
    if (flag === true) return true;
  }
  return false;
}

export function PageShell(props: { site: Site; page: Page; css: string }): preact.JSX.Element {
  const { site, page, css } = props;
  const title = pageTitle(site, page);
  const description = pageDescription(site, page);
  const navPages = navPagesFor(site, page);
  const activeHref = pagePath(site, page);
  const hasLazyEmbed = pageHasLazyEmbed(page.blocks);
  const needsLightbox = pageNeedsLightbox(page);

  return (
    <html lang={page.lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description !== undefined && <meta name="description" content={description} />}
        {/* Open Graph minimum so theme-agnostic shares render predictably. */}
        <meta property="og:title" content={title} />
        {description !== undefined && <meta property="og:description" content={description} />}
        <meta property="og:type" content="website" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        {/* Site-level navigation. Hidden when only one page is in-nav for this
         * language so single-page UX is preserved. The link list is ordered
         * by navOrder; the active page is marked with aria-current="page" and
         * data-active="true" so themes can style without re-ordering DOM. */}
        {navPages.length > 1 && (
          <nav data-site-nav aria-label="Site navigation">
            <ul>
              {navPages.map((entry) => {
                const href = pagePath(site, entry);
                const isActive = href === activeHref;
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
          </nav>
        )}
        <main>
          {page.blocks.map((block) => {
            const rendered = renderBlock(block);
            if (rendered !== null) return rendered;
            return (
              <div
                key={block.id}
                dangerouslySetInnerHTML={{
                  __html: `<!-- unknown block: ${escapeHtmlComment(block.type)} -->`,
                }}
              />
            );
          })}
        </main>
        {hasLazyEmbed && (
          <script
            {...{ [EMBED_LOADER_MARKER]: "" }}
            dangerouslySetInnerHTML={{ __html: EMBED_LAZY_LOAD_SCRIPT }}
          />
        )}
        {needsLightbox && <LightboxScaffold />}
        {needsLightbox && (
          <script
            data-sosb-lightbox-script
            dangerouslySetInnerHTML={{ __html: LIGHTBOX_SCRIPT }}
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
          <figcaption
            data-sosb-lightbox-caption
            class="sosb-lightbox__caption"
            hidden
          />
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
