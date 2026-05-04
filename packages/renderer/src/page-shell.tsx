/** @jsxImportSource preact */
import type { Page, Site, BlockEnvelope, HeroBlock } from "@sosb/schema";
import { isKnownBlockType } from "@sosb/schema";
import { Hero } from "./blocks/hero.js";

/**
 * The page shell.
 *
 * Renders the outer HTML scaffolding (`<head>` with SEO meta, `<body>` with a
 * `<main>` landmark and the page's blocks). The `<!doctype html>` prefix is
 * added by the top-level `renderSite` because Preact's
 * `preact-render-to-string` emits the `<html>` element only — there is no
 * built-in way to model the doctype in JSX.
 *
 * SECURITY NOTE on dangerouslySetInnerHTML usage in this file:
 *  - The `<style>` block content is the renderer's own composed CSS string
 *    (token rule + theme CSS, both renderer-owned constants and validated
 *    schema values). It contains no user prose.
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
  if (block.type === "hero") {
    if (isKnownBlockType(block.type)) {
      return <Hero block={block as unknown as HeroBlock} />;
    }
  }
  return null;
}

export function PageShell(props: { site: Site; page: Page; css: string }): preact.JSX.Element {
  const { site, page, css } = props;
  const title = pageTitle(site, page);
  const description = pageDescription(site, page);

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
      </body>
    </html>
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
