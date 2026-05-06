import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";

/**
 * Per-theme axe-core regression suite (issue #40).
 *
 * The test loops over every theme registered in `@sosb/renderer`'s
 * `KNOWN_THEME_IDS`. For each one it:
 *
 *   1. Generates a deterministic fixture site (RO + EN pages, every Romanian
 *      diacritic, long Romanian copy, multi-language switcher) via
 *      `generateA11yFixture(themeId, ['hero'])`.
 *   2. Runs the production build pipeline (`@sosb/build`) to emit `index.html`
 *      and the per-language pages.
 *   3. Mounts each emitted page in headless Chromium via `page.setContent`.
 *   4. Injects axe-core (the bundled standalone build from `node_modules`)
 *      and runs `axe.run` with the WCAG 2.2 AA tag set documented in
 *      ADR 0026 / CONTRIBUTING.md.
 *   5. Asserts `violations.length === 0`. CI fails on any violation.
 *
 * The matrix is dynamic by design — `KNOWN_THEME_IDS` grows as theme PRs
 * (#28-#31, #47) merge to main, and this spec automatically exercises each
 * new theme without edits.
 *
 * Multi-page is exercised: v1's `@sosb/build` is single-page (only the home
 * page is emitted to `index.html`), so we render the EN counterpart
 * separately by calling `build()` with a copy whose `pages[0]` is the EN
 * page. That gives axe a real two-page corpus today; #23 will replace this
 * with the real multi-page emission.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

/**
 * The standalone axe-core bundle from `node_modules`. Loaded once into a
 * string at import time and injected into each page via
 * `page.addScriptTag`. Using the standalone build avoids forcing a Playwright
 * dependency on `@axe-core/playwright` — the renderer already declares
 * `axe-core` as a dev dep for jsdom-level checks.
 */
const requireFromHere = createRequire(import.meta.url);
const axeSourcePath = requireFromHere.resolve("axe-core/axe.min.js");
const axeSource = readFileSync(axeSourcePath, "utf8");

/**
 * Bundle a Node-loadable module for `@sosb/build` together with the fixture
 * generator. This lets the spec generate a fixture and call `build()` from
 * a single dynamic-imported module without depending on Playwright's TS
 * loader doing the JSX transform itself.
 *
 * `e2e/a11y.entry.ts` is the unbundled source — it re-exports the three
 * symbols we need from their workspace locations using plain relative paths
 * so esbuild can resolve them just like the renderer-parity spec does.
 */
async function loadFixtureAndBuildModule(): Promise<{
  generateA11yFixture: (themeId: string, blocks: readonly string[]) => unknown;
  build: (site: unknown, options?: { siteUrl?: string; themeId?: string }) => Map<string, string>;
  KNOWN_THEME_IDS: readonly string[];
}> {
  const entryPath = path.join(__dirname, "a11y.entry.ts");

  const result = await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no output for a11y spec");

  const tmpDir = path.join(os.tmpdir(), "sosb-a11y-spec");
  mkdirSync(tmpDir, { recursive: true });
  const outFile = path.join(tmpDir, `bundle-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(outFile, out.text);
  return (await import(pathToFileURL(outFile).href)) as Awaited<
    ReturnType<typeof loadFixtureAndBuildModule>
  >;
}

interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  helpUrl: string;
  nodes: { target: string[]; html: string; failureSummary?: string }[];
}

/**
 * The WCAG-2.2 AA axe-core rule set used as the CI gate.
 *
 *   - `wcag2a` / `wcag2aa`           — WCAG 2.0 A and AA rules
 *   - `wcag21a` / `wcag21aa`         — WCAG 2.1 A and AA additions
 *   - `wcag22aa`                     — WCAG 2.2 AA additions (target size,
 *                                      focus-not-obscured etc.)
 *   - `best-practice`                — non-WCAG rules that catch common
 *                                      semantic regressions (landmark-one-main,
 *                                      page-has-heading-one, region etc.)
 *
 * `experimental` rules are deliberately excluded — they would cause flakes
 * on a no-tolerance CI gate before they stabilise upstream. CONTRIBUTING.md
 * documents this set as the project's a11y commitment.
 */
const AXE_TAGS_WCAG_22_AA: readonly string[] = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

async function runAxe(
  page: import("@playwright/test").Page,
  html: string,
): Promise<AxeViolation[]> {
  // Load the page's full document so axe walks the same DOM the browser
  // would build for the deployed site. We use `data:` so the URL bar is
  // a stable origin that does not collide with the parent test runner's
  // origin (which Playwright reserves).
  await page.setContent(html, { waitUntil: "load" });
  await page.addScriptTag({ content: axeSource });

  return await page.evaluate(async (tags) => {
    const w = window as unknown as {
      axe: {
        run: (
          context: Document,
          options: { runOnly: { type: "tag"; values: readonly string[] } },
        ) => Promise<{ violations: AxeViolation[] }>;
      };
    };
    const results = await w.axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return results.violations;
  }, AXE_TAGS_WCAG_22_AA);
}

function formatViolations(themeId: string, lang: string, violations: AxeViolation[]): string {
  if (violations.length === 0) return "";
  const lines: string[] = [];
  lines.push(`axe-core violations on theme="${themeId}" lang="${lang}":`);
  for (const v of violations) {
    lines.push(`  - [${v.impact ?? "unknown"}] ${v.id}: ${v.description}`);
    lines.push(`    ${v.helpUrl}`);
    for (const n of v.nodes.slice(0, 3)) {
      lines.push(`      target: ${n.target.join(" / ")}`);
      if (n.failureSummary !== undefined) {
        lines.push(`      ${n.failureSummary.replace(/\n/g, " ")}`);
      }
    }
  }
  return lines.join("\n");
}

test.describe("per-theme axe-core regression matrix", () => {
  // Hard-cap one minute per theme — even the heaviest theme should axe-pass
  // in seconds; if it doesn't, it's a regression we want surfaced loudly.
  test.setTimeout(60_000);

  test("every registered theme has zero axe violations on RO + EN pages", async ({ page }) => {
    const { generateA11yFixture, build, KNOWN_THEME_IDS } = await loadFixtureAndBuildModule();

    expect(
      KNOWN_THEME_IDS.length,
      "renderer's KNOWN_THEME_IDS registry is empty — at least the stub theme must be present",
    ).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const themeId of KNOWN_THEME_IDS) {
      const site = generateA11yFixture(themeId, ["hero"]) as {
        pages: { lang: string; slug: string }[];
      };

      // RO page is `pages[0]` for the build pipeline today (single-page v1).
      const roDist = build(site as unknown, { themeId });
      const roHtml = roDist.get("index.html");
      expect(roHtml, `theme="${themeId}" produced no index.html`).toBeDefined();

      const roViolations = await runAxe(page, roHtml!);
      if (roViolations.length > 0) failures.push(formatViolations(themeId, "ro", roViolations));

      // To exercise the EN counterpart through the same single-page pipeline,
      // promote the EN page to `pages[0]` in a deep-cloned copy. The pipeline
      // emits exactly one `index.html` per call; this gives axe a real second
      // page to walk while #23 (multi-page) is still upstream.
      const enFirst = JSON.parse(JSON.stringify(site)) as {
        pages: { lang: string }[];
      };
      enFirst.pages.reverse();
      const enDist = build(enFirst as unknown, { themeId });
      const enHtml = enDist.get("index.html");
      expect(enHtml, `theme="${themeId}" produced no EN index.html`).toBeDefined();

      const enViolations = await runAxe(page, enHtml!);
      if (enViolations.length > 0) failures.push(formatViolations(themeId, "en", enViolations));
    }

    expect(
      failures.join("\n\n"),
      `axe-core regressions on ${failures.length} (theme, lang) combination(s)`,
    ).toBe("");
  });
});
