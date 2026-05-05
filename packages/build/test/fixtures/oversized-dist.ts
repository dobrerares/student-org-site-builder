/**
 * Synthetic dist Maps used by the budget tests to exercise the per-metric
 * "warn" code path. Each builder returns a `Map<string, string>` shaped like
 * the real `build()` output but with one metric intentionally inflated past
 * its budget threshold.
 *
 * These are NOT loaded from disk because:
 *  - The over-CSS fixture wants ~240KB of unique-tokens CSS to defeat gzip;
 *    that's a noisy thing to keep in version control.
 *  - The shape we want to test is the budget engine's response to a dist
 *    Map. Generating the Map in code is the most direct way to express that
 *    intent without building a sprawl of golden HTML files.
 *
 * The over-CSS fixture also doubles as the "Sample failing fixture" called
 * for in AC #4: a fixture that intentionally inlines a too-large stylesheet
 * and trips the warning path.
 */

export type DistMap = Map<string, string>;

/**
 * Wrap an inline `<style>` block in a minimally-valid HTML document. The
 * `<head>` shape mirrors the renderer's so the budget engine's HTML parser
 * (a substring scan, not a real DOM) sees a recognisable structure.
 */
function wrapHtml(headExtras: string, body = "<main></main>"): string {
  return [
    "<!doctype html>",
    '<html lang="en"><head>',
    '<meta charset="utf-8"/>',
    "<title>Oversized fixture</title>",
    headExtras,
    "</head><body>",
    body,
    "</body></html>",
  ].join("");
}

/**
 * Build a dist Map whose `index.html` carries a `<style>` block large enough
 * to exceed 15KB after gzip. Uses high-entropy unique selectors + unique
 * declarations to defeat the LZ77 window.
 */
export function buildOversizedCssDist(): DistMap {
  const cssLines: string[] = [];
  for (let i = 0; i < 4000; i++) {
    cssLines.push(
      `.bloat-${i.toString(36)}-q${(i * 31).toString(36)} { color: #${(i * 7919).toString(16).padStart(6, "0").slice(-6)}; padding: ${i % 97}px; margin: ${i % 53}px; }`,
    );
  }
  const html = wrapHtml(`<style>${cssLines.join("\n")}</style>`);
  const dist: DistMap = new Map();
  dist.set("index.html", html);
  return dist;
}

/**
 * Build a dist Map whose `index.html` body is large enough to exceed the
 * 50KB HTML budget on its own. Empty inline CSS keeps the CSS metric
 * within budget so the test can isolate the HTML failure.
 */
export function buildOversizedHtmlDist(): DistMap {
  const filler: string[] = [];
  for (let i = 0; i < 8000; i++) {
    filler.push(`<p data-row="${i}">Lorem ipsum dolor sit amet ${i}.</p>`);
  }
  const html = wrapHtml("", `<main>${filler.join("")}</main>`);
  const dist: DistMap = new Map();
  dist.set("index.html", html);
  return dist;
}

/**
 * Build a dist Map whose `index.html` carries a `<script>` block large
 * enough to exceed the 10KB JS budget. Empty inline CSS and a small body
 * keep the other metrics within budget so the test can isolate the JS
 * failure.
 */
export function buildOversizedJsDist(): DistMap {
  const jsLines: string[] = [];
  for (let i = 0; i < 600; i++) {
    jsLines.push(
      `console.log("oversized-js-fixture-line-${i.toString(36)}-token-${(i * 31).toString(36)}");`,
    );
  }
  const html = wrapHtml(`<script>${jsLines.join("\n")}</script>`);
  const dist: DistMap = new Map();
  dist.set("index.html", html);
  return dist;
}
