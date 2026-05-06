/**
 * `@sosb/build` — browser-runnable build pipeline.
 *
 * `build(siteData, options?) -> Map<string, string>`
 *
 * Pure function from a validated `Site` to a virtual dist folder. Same input
 * produces same output, byte-for-byte. No Node-only built-ins (`fs`, `path`,
 * `process`, `Buffer`) are imported on the runtime path — the same module is
 * called from the in-browser editor (#7) and the Electron build path with no
 * adapter layer.
 *
 * Multi-page output (since #23): the home page lands at `index.html`. Every
 * other page lands at `<slug>/index.html`. The sitemap lists every page. The
 * home-page convention is shared with the renderer (`pageDistPath`,
 * `pagePath`); see ADR 0007. `hreflang` annotations remain owned by #24.
 */

import type { Page, Site, ValidationIssue } from "@sosb/schema";
import { validate } from "@sosb/schema";
import { hreflangEntriesFor, pageDistPath, pagePath, renderSite } from "@sosb/renderer";
import {
  measureBudgets,
  formatBudgetViolations,
  type BudgetReport,
} from "./budget.js";
import { jsonLdBlobsForPage, renderJsonLdScripts } from "./json-ld.js";

export {
  BUDGET_LIMITS,
  measureBudgets,
  formatBudgetViolations,
  type BudgetReport,
  type PageBudgetReport,
  type MetricResult,
  type MetricStatus,
} from "./budget.js";

/**
 * Thrown by `build()` when the site has any validation errors. Carries
 * the full error list so callers can render them (the editor's pre-export
 * dialog uses the same data shape).
 *
 * Tracking issue: #25 — the build pipeline runs the same validation as
 * the editor; errors fail the build, warnings are logged.
 */
export class BuildValidationError extends Error {
  public override readonly name = "BuildValidationError";
  public readonly errors: readonly ValidationIssue[];

  constructor(errors: readonly ValidationIssue[]) {
    super(
      `build: site has ${errors.length} validation error(s); fix them before building`,
    );
    this.errors = errors;
  }
}

/**
 * Caller-supplied build options.
 *
 * `siteUrl` is the canonical site origin (`https://example.org`) used to
 * build absolute URLs in the canonical link tag, `og:url`, `og:image`, and
 * the sitemap. When omitted, the pipeline falls back to relative URLs and
 * skips the directives that require an origin (canonical, og:url, og:image,
 * `Sitemap:` in robots.txt).
 *
 * `themeId` lets callers override the renderer's theme. Defaults to
 * `site.theme.id`, matching how the editor and the demo template wire up.
 *
 * `errorOnBudget` promotes Lighthouse-budget warnings (see ADR 0005) from
 * `console.warn` calls to a thrown `Error`. Default is `false` (warn only)
 * so that the editor can build a draft site without being blocked by
 * budget overruns; CI sets this to `true` to hard-fail on regressions.
 *
 * `_testInjectExtraCss` is an undocumented test-only escape hatch used by
 * the budget-warning tests to push the rendered HTML over the CSS budget
 * without committing a 240KB synthetic theme to the repo. It is NOT part
 * of the package's public API contract; production callers should ignore
 * it. The leading underscore signals "internal" per project convention.
 *
 * `onWarning` receives every warning produced by `validate(site)`. Build
 * never blocks on warnings (per PRD severity model) but callers (the
 * editor, the Electron shell, CI) can route them to logs or the user.
 *
 * `skipValidation` is an escape hatch for callers that have already run
 * `validate(site)` themselves and don't want to pay the cost a second
 * time. Off by default — the safe path is to validate.
 */
export interface BuildOptions {
  readonly siteUrl?: string;
  readonly themeId?: string;
  readonly errorOnBudget?: boolean;
  readonly _testInjectExtraCss?: string;
  readonly onWarning?: (issue: ValidationIssue) => void;
  readonly skipValidation?: boolean;
}

/**
 * The dist folder, modelled as a `Map<string, string>`.
 *
 * Keys are POSIX-style relative paths (`index.html`, `<slug>/index.html`,
 * `robots.txt`, `sitemap.xml`). Values are UTF-8 text contents. Binary assets
 * (images, documents) are out of scope for v1's build pipeline — the asset
 * pipeline is #8 / #21 and will introduce `Uint8Array` values then.
 */
export type DistFolder = Map<string, string>;

/**
 * Build a site to a virtual dist folder.
 *
 * Determinism contract (per AC):
 *  - Identical `(site, options)` input produces identical output, byte-for-byte.
 *  - The HTML at every per-page entry equals `renderSite(site, themeId, opts)`
 *    when no `siteUrl` is provided. With a `siteUrl`, head-injection adds
 *    canonical / og:url / og:image — every other byte is preserved.
 *
 * @param site    Validated site data. Callers should run `@sosb/schema`'s
 *                `validate(site)` first; this function trusts the shape.
 * @param options Optional build options (see `BuildOptions`).
 * @returns       A `Map<string, string>` representing the dist folder.
 */
export function build(site: Site, options: BuildOptions = {}): DistFolder {
  // AC #6: errors fail the build, warnings are logged. Same `validate()`
  // the editor uses (per PRD: "build pipeline runs the same validation").
  if (options.skipValidation !== true) {
    const validation = validate(site);
    if (validation.errors.length > 0) {
      throw new BuildValidationError(validation.errors);
    }
    if (options.onWarning !== undefined) {
      for (const warning of validation.warnings) {
        options.onWarning(warning);
      }
    }
  }

  const themeId = options.themeId ?? site.theme.id;
  const siteUrl = normaliseSiteUrl(options.siteUrl);

  if (site.pages.length === 0) {
    throw new Error("build: site has no pages");
  }

  const dist: DistFolder = new Map();

  // Insert pages in `pages[]` order so the Map iteration order is
  // deterministic and the home page (when it is at index 0) is first.
  site.pages.forEach((page, idx) => {
    const renderedHtml = renderSite(site, themeId, { pageIndex: idx });
    let html = injectSeoMeta(renderedHtml, site, page, siteUrl);
    if (options._testInjectExtraCss !== undefined && options._testInjectExtraCss.length > 0) {
      html = injectExtraInlineCss(html, options._testInjectExtraCss);
    }
    dist.set(pageDistPath(site, page), html);
  });

  dist.set("robots.txt", emitRobotsTxt(siteUrl));
  dist.set("sitemap.xml", emitSitemapXml(site, siteUrl));

  // Per-page Lighthouse-budget verification (issue #41 / ADR 0005).
  // Measure, then attach the report to the dist as a stable JSON artefact.
  // Surface every violation through `console.warn` so the editor and the
  // CLI both see them; promote to a thrown Error when `errorOnBudget` is
  // set so CI can hard-fail on regressions.
  const budgetReport = measureBudgets(dist);
  dist.set("_lighthouse-budget.json", serialiseBudgetReport(budgetReport));

  if (budgetReport.status === "warn") {
    const lines = formatBudgetViolations(budgetReport);
    if (options.errorOnBudget === true) {
      throw new Error(`build: Lighthouse budget violations\n${lines.join("\n")}`);
    }
    for (const line of lines) {
      console.warn(line);
    }
  }

  return dist;
}

/**
 * Serialise a `BudgetReport` to a deterministic, pretty-printed JSON
 * string. Two-space indent matches the project's prettier config so the
 * artefact reads naturally in PR diffs and editor tabs.
 */
function serialiseBudgetReport(report: BudgetReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/**
 * Append an extra inline `<style>` block immediately before `</head>`. Used
 * exclusively by the test-only `_testInjectExtraCss` build option.
 */
function injectExtraInlineCss(html: string, css: string): string {
  const styleTag = `<style data-source="test-injected">${css}</style>`;
  const headCloseIdx = html.indexOf("</head>");
  if (headCloseIdx === -1) return html;
  return `${html.slice(0, headCloseIdx)}${styleTag}${html.slice(headCloseIdx)}`;
}

/**
 * Strip a single trailing slash from a `siteUrl` so that joins with paths
 * (`/`, `/assets/foo.jpg`) never produce double-slashes. `undefined` is
 * preserved so callers can branch on "is a siteUrl set?" without re-checking.
 */
function normaliseSiteUrl(siteUrl: string | undefined): string | undefined {
  if (siteUrl === undefined) return undefined;
  if (siteUrl.endsWith("/")) return siteUrl.slice(0, -1);
  return siteUrl;
}

/**
 * Resolve a possibly-relative reference (e.g. `assets/hero.jpg`) against the
 * site origin. Absolute URLs (`http:`, `https:`, `//`) are passed through
 * unchanged so a CDN-hosted image is not double-prefixed.
 */
function absolutise(siteUrl: string, ref: string): string {
  if (/^https?:\/\//i.test(ref) || ref.startsWith("//")) return ref;
  if (ref.startsWith("/")) return `${siteUrl}${ref}`;
  return `${siteUrl}/${ref}`;
}

/**
 * Read the page's first hero block's `backgroundImage`, if present.
 *
 * The block envelope is parsed loosely (`looseObject`) so `data` is typed as
 * `Record<string, unknown>` from the schema's perspective. We do a runtime
 * `typeof` check before trusting the value.
 */
function pageHeroBackgroundImage(page: Page): string | undefined {
  const firstBlock = page.blocks[0];
  if (firstBlock === undefined) return undefined;
  if (firstBlock.type !== "hero") return undefined;
  const data = firstBlock.data as { backgroundImage?: unknown };
  if (typeof data.backgroundImage !== "string" || data.backgroundImage.length === 0) {
    return undefined;
  }
  return data.backgroundImage;
}

/**
 * Inject the build-pipeline SEO overlay into the renderer's emitted `<head>`.
 *
 * Always emitted (even without a `siteUrl`):
 *   - JSON-LD `<script type="application/ld+json">` blobs:
 *     Organization, optional Person/Event/FAQPage per block type,
 *     BreadcrumbList on non-home pages of multi-page sites.
 *
 * Conditional on `siteUrl` being set:
 *   - `<link rel="canonical">` pointing at the page's own `pagePath`,
 *   - `<meta property="og:url">` matching canonical,
 *   - `<meta property="og:image">` (when first hero has `backgroundImage`),
 *   - `twitter:image` rewritten from relative to absolute,
 *   - hreflang `<link rel="alternate">` absolutised from the renderer's
 *     relative form.
 *
 * Strategy: locate the closing `</head>` tag and insert the additional
 * tags immediately before it; relative hreflang and relative twitter:image
 * are stripped/rewritten via regex so we don't double-emit.
 *
 * Emits in a deterministic order so repeat calls produce byte-identical
 * output: canonical → og:url → og:image → absolute hreflang alternates →
 * JSON-LD scripts.
 */
function injectSeoMeta(
  html: string,
  site: Site,
  page: Page,
  siteUrl: string | undefined,
): string {
  let working = html;
  const tags: string[] = [];

  if (siteUrl !== undefined) {
    const path = pagePath(site, page);
    const canonical = `${siteUrl}${path}`;
    const heroImage = pageHeroBackgroundImage(page);
    const ogImage = heroImage === undefined ? undefined : absolutise(siteUrl, heroImage);
    tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}"/>`);
    tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}"/>`);
    if (ogImage !== undefined) {
      tags.push(`<meta property="og:image" content="${escapeAttr(ogImage)}"/>`);
    }
    // hreflang alternates absolutised against the siteUrl. The renderer
    // already emits the relative-path version; we rewrite to absolutes by
    // re-emitting from the same data source and stripping the relative
    // ones from the renderer's HTML below.
    const hreflangs = hreflangEntriesFor(site, page);
    for (const entry of hreflangs) {
      const absoluteHref = `${siteUrl}${entry.href}`;
      tags.push(
        `<link rel="alternate" hreflang="${escapeAttr(entry.hreflang)}" href="${escapeAttr(absoluteHref)}"/>`,
      );
    }

    // Strip the renderer's relative-path hreflang alternates so the
    // absolutes we just emitted are the only ones in the document.
    const relativeHreflangPattern = /<link rel="alternate" hreflang="[^"]+" href="[^"]*"\s*\/>/g;
    working = working.replace(relativeHreflangPattern, "");

    // Rewrite the renderer's relative twitter:image to an absolute URL when
    // siteUrl is set — parity with og:image.
    if (heroImage !== undefined) {
      const twitterImagePattern = /<meta name="twitter:image" content="([^"]*)"\s*\/>/;
      working = working.replace(twitterImagePattern, (_match, value: string) => {
        return `<meta name="twitter:image" content="${escapeAttr(absolutise(siteUrl, value))}"/>`;
      });
    }
  }

  // JSON-LD applies in every build (even with no `siteUrl`, so the user
  // gets a previewable structured-data set before they pick a host).
  const jsonLd = renderJsonLdScripts(jsonLdBlobsForPage(site, page, siteUrl));

  const overlay = `${tags.join("")}${jsonLd}`;
  if (overlay.length === 0) return working;
  const headCloseIdx = working.indexOf("</head>");
  if (headCloseIdx === -1) {
    // The renderer always emits `<head>...</head>`. If that contract ever
    // changes, the parity tests catch it before we ship — but be defensive.
    return working;
  }
  return `${working.slice(0, headCloseIdx)}${overlay}${working.slice(headCloseIdx)}`;
}

/**
 * Minimal HTML-attribute escape: covers `&`, `<`, `>`, `"`. Site-supplied
 * URLs flow through this. We do NOT use the renderer's full HTML escape
 * because we are emitting attribute values exclusively.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Emit `robots.txt`.
 *
 * Sensible default: allow all crawlers, point them at `sitemap.xml` when a
 * `siteUrl` is known. Without a `siteUrl` we can't emit an absolute Sitemap
 * directive (search engines reject relative `Sitemap:` values), so we omit
 * it entirely. The user can re-run the build with `siteUrl` set when they
 * have decided where to host.
 */
function emitRobotsTxt(siteUrl: string | undefined): string {
  const lines: string[] = [];
  lines.push("User-agent: *");
  lines.push("Allow: /");
  if (siteUrl !== undefined) {
    lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Emit `sitemap.xml`.
 *
 * One `<url>` entry per page in `site.pages`, in declaration order so the
 * output stays deterministic across rebuilds. We do NOT include `<lastmod>`
 * because the schema has no `updatedAt` field today.
 *
 * When `siteUrl` is set, every entry uses an absolute URL. Without a
 * `siteUrl`, entries use a path-relative fallback so the file is
 * structurally valid the user can preview before deciding where to host.
 *
 * For multi-language sites (#24), each `<url>` carries
 * `<xhtml:link rel="alternate" hreflang="..."/>` annotations: one per
 * declared language plus an `x-default`. Missing counterparts gracefully
 * fall back to the language home page. Single-language sites omit these
 * annotations entirely (and the xhtml namespace declaration is omitted to
 * keep the output minimal — pre-#24 byte-identical).
 */
function emitSitemapXml(site: Site, siteUrl: string | undefined): string {
  const isMultiLanguage = site.languages.length >= 2;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  if (isMultiLanguage) {
    lines.push(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    );
  } else {
    lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  }
  for (const page of site.pages) {
    const path = pagePath(site, page);
    const loc = siteUrl === undefined ? path : `${siteUrl}${path}`;
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXmlText(loc)}</loc>`);
    if (isMultiLanguage) {
      const hreflangs = hreflangEntriesFor(site, page);
      for (const entry of hreflangs) {
        const altHref = siteUrl === undefined ? entry.href : `${siteUrl}${entry.href}`;
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeAttr(entry.hreflang)}" href="${escapeAttr(altHref)}"/>`,
        );
      }
    }
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

/**
 * Minimal XML text-content escape: `&`, `<`, `>`. Site-supplied URLs flow
 * through this. Apostrophes and quotes do not need escaping in element text
 * content.
 */
function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
