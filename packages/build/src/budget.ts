/**
 * Per-page Lighthouse-budget verification for the build pipeline.
 *
 * The build emits an extra dist artefact, `_lighthouse-budget.json`, that
 * carries a per-page byte-budget report (HTML, CSS gzipped, JS, hero image).
 * Violations are surfaced as `console.warn` calls naming the offending file
 * and metric; an opt-in `errorOnBudget: true` build option promotes them to
 * thrown errors so CI can hard-fail.
 *
 * Budget thresholds (from PRD Quality commitments / Performance):
 *
 *  - HTML            <= 50 KB (raw bytes per `.html` artefact)
 *  - CSS             <= 15 KB gzipped (sum of all inline `<style>` blocks
 *                    plus any `.css` artefact in the dist Map for the page)
 *  - JS              <= 10 KB (sum of all inline `<script>` blocks plus any
 *                    `.js` artefact in the dist Map; NOT gzipped because v1
 *                    aims at zero JS)
 *  - Hero image      <= 200 KB (post-optimization). v1 reports "skipped"
 *                    for the hero metric because the asset pipeline (#8 /
 *                    #21) that materialises image bytes into the dist Map
 *                    hasn't landed; the metric activates automatically once
 *                    the Map starts carrying binary asset entries.
 *
 * The CSS-gzipped measurement uses fflate's `gzipSync`, a browser-pure gzip
 * implementation. This preserves the build pipeline's "no Node-only deps on
 * the runtime path" constraint pinned by ADR 0004.
 *
 * See ADR 0005 for the full design rationale.
 */

import { gzipSync } from "fflate";

/**
 * Documented byte-budget thresholds. Exposed so tests and downstream tools
 * can reference them by name rather than restating the numbers.
 */
export const BUDGET_LIMITS = {
  html: 50 * 1024,
  cssGzipped: 15 * 1024,
  js: 10 * 1024,
  hero: 200 * 1024,
} as const;

/**
 * Status for a single metric within a single page.
 *
 *  - `pass`     - measured value is at-or-under the limit.
 *  - `warn`     - measured value exceeds the limit. The build emits a
 *                 `console.warn`; with `errorOnBudget: true` it throws.
 *  - `skipped`  - the metric could not be measured (e.g. the hero image
 *                 lives outside the dist Map in v1).
 */
export type MetricStatus = "pass" | "warn" | "skipped";

/**
 * One metric's per-page result. `bytes` is omitted when the metric is
 * "skipped" because there's nothing to measure; `note` gives a one-line
 * explanation in that case.
 */
export interface MetricResult {
  readonly status: MetricStatus;
  readonly limitBytes: number;
  readonly bytes?: number;
  readonly note?: string;
}

/**
 * One page's full budget report. `status` is the worst per-metric status -
 * "warn" if any metric warns, "pass" otherwise. "skipped" metrics do not
 * downgrade the page status, since the missing measurement is by design.
 */
export interface PageBudgetReport {
  readonly status: "pass" | "warn";
  readonly metrics: {
    readonly html: MetricResult;
    readonly css: MetricResult;
    readonly js: MetricResult;
    readonly hero: MetricResult;
  };
}

/**
 * The dist-wide budget report. `pages` is keyed by the same dist path the
 * builder emits (e.g. `index.html`). `status` is "warn" if any page warns.
 */
export interface BudgetReport {
  readonly status: "pass" | "warn";
  readonly pages: Record<string, PageBudgetReport>;
}

/**
 * Compute the budget report for a dist Map.
 *
 * Pure function: same Map -> same report. The engine treats the Map as the
 * source of truth and never re-derives or re-renders. Pages are detected by
 * `.html` extension. Sibling assets (`.css`, `.js`) are attributed to a
 * page when the page's HTML contains a `<link>` or `<script src=>`
 * reference to them.
 */
export function measureBudgets(dist: ReadonlyMap<string, string>): BudgetReport {
  const pages: Record<string, PageBudgetReport> = {};
  const pagePaths: string[] = [];
  for (const path of dist.keys()) {
    if (path.endsWith(".html")) pagePaths.push(path);
  }
  pagePaths.sort();

  for (const path of pagePaths) {
    pages[path] = measurePage(dist, path);
  }

  const aggregate: "pass" | "warn" = Object.values(pages).some((p) => p.status === "warn")
    ? "warn"
    : "pass";

  return { status: aggregate, pages };
}

/**
 * Format the report for human-readable warning output. Each violation
 * becomes one line: `[budget] <path> <metric>: <bytes>B exceeds <limit>B`.
 */
export function formatBudgetViolations(report: BudgetReport): string[] {
  const lines: string[] = [];
  for (const path of Object.keys(report.pages).sort()) {
    const page = report.pages[path]!;
    for (const [metricName, metric] of Object.entries(page.metrics)) {
      if (metric.status !== "warn") continue;
      const bytes = metric.bytes ?? 0;
      const limit = metric.limitBytes;
      const overage = bytes - limit;
      lines.push(
        `[budget] ${path} ${metricName}: ${bytes}B exceeds limit of ${limit}B (over by ${overage}B)`,
      );
    }
  }
  return lines;
}

/* ------------------------- per-metric measurement ------------------------- */

function measurePage(dist: ReadonlyMap<string, string>, path: string): PageBudgetReport {
  const html = dist.get(path) ?? "";

  const htmlBytes = utf8ByteLength(html);
  const inlineCss = extractInlineCss(html);
  const linkedCss = extractLinkedAssets(
    dist,
    html,
    /<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi,
  );
  const cssTotal = inlineCss + linkedCss;
  const cssGzippedBytes = gzipByteLength(cssTotal);

  const inlineJs = extractInlineScript(html);
  const linkedJs = extractLinkedAssets(
    dist,
    html,
    /<script[^>]+src=["']([^"']+\.js)["'][^>]*>/gi,
  );
  const jsBytes = utf8ByteLength(inlineJs + linkedJs);

  const html_ = mkResult(htmlBytes, BUDGET_LIMITS.html);
  const css_ = mkResult(cssGzippedBytes, BUDGET_LIMITS.cssGzipped);
  const js_ = mkResult(jsBytes, BUDGET_LIMITS.js);
  const hero_ = measureHero(dist, html);

  const pageStatus: "pass" | "warn" =
    html_.status === "warn" ||
    css_.status === "warn" ||
    js_.status === "warn" ||
    hero_.status === "warn"
      ? "warn"
      : "pass";

  return {
    status: pageStatus,
    metrics: { html: html_, css: css_, js: js_, hero: hero_ },
  };
}

function mkResult(bytes: number, limit: number): MetricResult {
  return {
    status: bytes <= limit ? "pass" : "warn",
    limitBytes: limit,
    bytes,
  };
}

/**
 * Measure the hero image. v1: read the first `<meta property="og:image">`
 * or `<img>` reference from the HTML; if the referenced path lives in the
 * dist Map, measure its UTF-8 length. If it doesn't live in the Map,
 * return "skipped" with a note pointing at #8 (the asset pipeline issue).
 */
function measureHero(dist: ReadonlyMap<string, string>, html: string): MetricResult {
  const limit = BUDGET_LIMITS.hero;
  const ref = firstHeroReference(html);
  if (ref === undefined) {
    return {
      status: "skipped",
      limitBytes: limit,
      note: "no hero image reference found in this page's HTML",
    };
  }
  if (/^https?:\/\//i.test(ref) || ref.startsWith("//")) {
    return {
      status: "skipped",
      limitBytes: limit,
      note: `hero image is hosted off-site (${ref}); cannot measure from dist`,
    };
  }
  const lookup = ref.startsWith("/") ? ref.slice(1) : ref;
  const asset = dist.get(lookup);
  if (asset === undefined) {
    return {
      status: "skipped",
      limitBytes: limit,
      note: `hero image '${lookup}' not present in dist Map yet (asset pipeline lands in #8)`,
    };
  }
  const bytes = utf8ByteLength(asset);
  return mkResult(bytes, limit);
}

function firstHeroReference(html: string): string | undefined {
  const ogMatch =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (ogMatch?.[1]) return ogMatch[1];
  const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (imgMatch?.[1]) return imgMatch[1];
  return undefined;
}

/**
 * Extract every `<style>...</style>` body and concatenate. We deliberately
 * do not parse: a single regex over the well-formed renderer output is
 * enough, and the renderer's tests (ADR 0003) guarantee the shape.
 */
function extractInlineCss(html: string): string {
  const parts: string[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join("\n");
}

/**
 * Extract every inline `<script>...</script>` body. `src`-only scripts (no
 * inline body) are picked up by `extractLinkedAssets` instead.
 */
function extractInlineScript(html: string): string {
  const parts: string[] = [];
  const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join("\n");
}

/**
 * Resolve every linked asset reference in `html` against the dist Map and
 * concatenate the bodies.
 */
function extractLinkedAssets(
  dist: ReadonlyMap<string, string>,
  html: string,
  pattern: RegExp,
): string {
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(html)) !== null) {
    const ref = m[1];
    if (ref === undefined) continue;
    if (/^https?:\/\//i.test(ref) || ref.startsWith("//")) continue;
    const lookup = ref.startsWith("/") ? ref.slice(1) : ref;
    const body = dist.get(lookup);
    if (body !== undefined) parts.push(body);
  }
  return parts.join("\n");
}

/**
 * UTF-8 byte length of a string. Uses `TextEncoder`, available in browser
 * and Node >= 11. A surrogate-aware fallback exists for paranoia.
 */
function utf8ByteLength(s: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Gzip a string and return the byte length of the compressed output. Uses
 * fflate's `gzipSync`, browser-pure (zero Node imports). Empty input
 * returns 0 to keep the JSON tidy.
 */
function gzipByteLength(s: string): number {
  if (s.length === 0) return 0;
  const bytes =
    typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : encodeUtf8(s);
  return gzipSync(bytes).length;
}

function encodeUtf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(++i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (next & 0x3ff);
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(out);
}
