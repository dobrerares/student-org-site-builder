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
 * v1 is single-page, single-language: only the home page renders to
 * `index.html`, the sitemap lists exactly one URL, and there are no
 * `hreflang` alternates. Multi-page routing and `hreflang` annotations land
 * in #23 + #24. See ADR 0004 for the design.
 */

import type { Site } from "@sosb/schema";
import { renderSite } from "@sosb/renderer";
import {
  measureBudgets,
  formatBudgetViolations,
  type BudgetReport,
} from "./budget.js";

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
 */
export interface BuildOptions {
  readonly siteUrl?: string;
  readonly themeId?: string;
  readonly errorOnBudget?: boolean;
  readonly _testInjectExtraCss?: string;
}

/**
 * The dist folder, modelled as a `Map<string, string>`.
 *
 * Keys are POSIX-style relative paths (`index.html`, `robots.txt`,
 * `sitemap.xml`). Values are UTF-8 text contents. Binary assets (images,
 * documents) are out of scope for v1's build pipeline — the asset pipeline
 * is #8 / #21 and will introduce `Uint8Array` values then.
 */
export type DistFolder = Map<string, string>;

/**
 * Build a site to a virtual dist folder.
 *
 * Determinism contract (per AC):
 *  - Identical `(site, options)` input produces identical output, byte-for-byte.
 *  - The HTML at `dist/index.html` equals `renderSite(site, themeId)` when no
 *    `siteUrl` is provided. With a `siteUrl`, head-injection adds canonical /
 *    og:url / og:image — every other byte is preserved.
 *
 * @param site    Validated site data. Callers should run `@sosb/schema`'s
 *                `validate(site)` first; this function trusts the shape.
 * @param options Optional build options (see `BuildOptions`).
 * @returns       A `Map<string, string>` representing the dist folder.
 */
export function build(site: Site, options: BuildOptions = {}): DistFolder {
  const themeId = options.themeId ?? site.theme.id;
  const siteUrl = normaliseSiteUrl(options.siteUrl);

  const renderedHtml = renderSite(site, themeId);
  const homePage = site.pages[0];
  if (homePage === undefined) {
    throw new Error("build: site has no pages");
  }

  let html =
    siteUrl === undefined ? renderedHtml : injectSeoMeta(renderedHtml, site, siteUrl);
  if (options._testInjectExtraCss !== undefined && options._testInjectExtraCss.length > 0) {
    html = injectExtraInlineCss(html, options._testInjectExtraCss);
  }

  const dist: DistFolder = new Map();
  dist.set("index.html", html);
  dist.set("robots.txt", emitRobotsTxt(siteUrl));
  dist.set("sitemap.xml", emitSitemapXml(siteUrl));

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
 * Read the home page's first hero block's `backgroundImage`, if present.
 *
 * The block envelope is parsed loosely (`looseObject`) so `data` is typed as
 * `Record<string, unknown>` from the schema's perspective. We do a runtime
 * `typeof` check before trusting the value.
 */
function homeHeroBackgroundImage(site: Site): string | undefined {
  const homePage = site.pages[0];
  if (homePage === undefined) return undefined;
  const firstBlock = homePage.blocks[0];
  if (firstBlock === undefined) return undefined;
  if (firstBlock.type !== "hero") return undefined;
  const data = firstBlock.data as { backgroundImage?: unknown };
  if (typeof data.backgroundImage !== "string" || data.backgroundImage.length === 0) {
    return undefined;
  }
  return data.backgroundImage;
}

/**
 * Inject canonical / og:url / og:image into the renderer's emitted `<head>`.
 *
 * Strategy: locate the closing `</head>` tag and insert the additional meta
 * tags immediately before it. This keeps the renderer's existing head
 * unchanged and adds an additive overlay that the build pipeline owns.
 *
 * Emits in a deterministic order (canonical → og:url → og:image) so repeat
 * calls produce byte-identical output.
 */
function injectSeoMeta(html: string, site: Site, siteUrl: string): string {
  // v1 is single-page: the home page is at the site root.
  const homePath = "/";
  const canonical = `${siteUrl}${homePath}`;
  const heroImage = homeHeroBackgroundImage(site);
  const ogImage = heroImage === undefined ? undefined : absolutise(siteUrl, heroImage);

  const tags: string[] = [];
  tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}"/>`);
  tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}"/>`);
  if (ogImage !== undefined) {
    tags.push(`<meta property="og:image" content="${escapeAttr(ogImage)}"/>`);
  }

  const overlay = tags.join("");
  const headCloseIdx = html.indexOf("</head>");
  if (headCloseIdx === -1) {
    // The renderer always emits `<head>...</head>`. If that contract ever
    // changes, the parity tests catch it before we ship — but be defensive.
    return html;
  }
  return `${html.slice(0, headCloseIdx)}${overlay}${html.slice(headCloseIdx)}`;
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
 * v1 is single-page, single-language: exactly one `<url>` entry for the home
 * page. Multi-page entries land in #23, `xhtml:link rel="alternate"` per
 * language lands in #24. We do NOT include `<lastmod>` because the schema
 * has no `updatedAt` field today and we want the output to stay
 * deterministic across rebuilds (PRD pins same-input-same-output).
 *
 * When `siteUrl` is set, the entry uses an absolute URL (search engines
 * require this). Without a `siteUrl`, we emit a relative `<loc>/</loc>`
 * fallback — technically a partial sitemap, but a structurally-valid file
 * the user can preview before deciding where to host.
 */
function emitSitemapXml(siteUrl: string | undefined): string {
  const homeLoc = siteUrl === undefined ? "/" : `${siteUrl}/`;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  lines.push("  <url>");
  lines.push(`    <loc>${escapeXmlText(homeLoc)}</loc>`);
  lines.push("  </url>");
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
