/**
 * Accessibility gate for the example Theme package.
 *
 * The built-in Themes are covered by the dynamic a11y matrix (ADR 0026), which
 * iterates `KNOWN_THEME_IDS`. An imported Theme cannot join that list — it is
 * not compiled in — so a Theme package that ships in this repo gets its own
 * axe run here.
 *
 * This matters more for a packaged Theme than for a built-in one. ADR 0046
 * gives Theme authors arbitrary CSS, and the two easiest ways to hurt a user
 * with CSS are contrast and focus visibility. A dark Theme with a pale gold
 * accent — this one — is exactly where that goes wrong. Running axe over
 * every page of the sample site keeps the example honest, and gives Theme
 * authors a pattern to copy.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import type { Site } from "@sosb/schema";
import { loadThemePackageFromDirectory } from "../src/node.js";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../examples/themes/practice", import.meta.url));
const HISTORIPOL_DATA = fileURLToPath(
  new URL("../../themes/src/templates/asociatia-studenteasca-demo/data.json", import.meta.url),
);

const { bundle } = loadThemePackageFromDirectory(EXAMPLE_DIR);

function practiceSite(): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: bundle.id, version: bundle.version };
  return site;
}

async function violationsFor(html: string): Promise<axe.Result[]> {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const { window } = dom;
  const results = await (axe as unknown as { run: typeof axe.run }).run(
    window.document.documentElement,
    {
      // Same rule posture as the renderer's own axe suites: colour-contrast
      // needs real layout, which jsdom does not do, so it is exercised by the
      // Playwright a11y gate rather than here.
      rules: { "color-contrast": { enabled: false } },
    },
  );
  window.close();
  return results.violations;
}

function ids(violations: readonly axe.Result[]): string[] {
  return [...new Set(violations.map((v) => v.id))].sort();
}

/**
 * An axe run over a jsdom document costs tens of seconds on a small machine,
 * and the built-in-Theme baseline for a given page is the same every time it
 * is needed. Computing it once per page keeps the number of runs linear in
 * the number of assertions instead of quadratic, which is the difference
 * between this suite finishing inside its budget and flaking on CI.
 */
const baselineCache = new Map<number, Promise<string[]>>();

function baselineIds(site: Site, pageIndex: number): Promise<string[]> {
  const cached = baselineCache.get(pageIndex);
  if (cached !== undefined) return cached;
  const computed = (async () => {
    const baselineSite: Site = { ...site, theme: { id: "modern" } };
    return ids(await violationsFor(renderSite(baselineSite, "modern", { pageIndex })));
  })();
  baselineCache.set(pageIndex, computed);
  return computed;
}

/**
 * Generous per-test budget. Each test is one or two axe runs, and a single run
 * takes ~20s on the slowest machine we support; the default 30s left no
 * headroom and made the suite flaky rather than slow.
 */
const AXE_TIMEOUT_MS = 120_000;

describe("examples/themes/practice — accessibility", () => {
  const site = practiceSite();

  for (const [index, page] of site.pages.entries()) {
    test(
      `page "${page.slug}" (${page.lang}) is no worse than a built-in Theme`,
      async () => {
        // The comparison is against a built-in Theme on the same page rather
        // than against zero, because the sample Site's own content carries a
        // couple of landmark findings (a customHTML `<aside>`, a repeated
        // section landmark) that belong to the fixture, not to any Theme.
        // Asserting "the Theme adds nothing" is the claim that is actually
        // about the Theme — and it fails loudly if this Theme's CSS or variant
        // markup ever introduces a new problem.
        const themed = renderSite(site, bundle.id, { pageIndex: index, theme: bundle });

        expect(ids(await violationsFor(themed))).toEqual(await baselineIds(site, index));
      },
      AXE_TIMEOUT_MS,
    );
  }

  // One test per shell variant rather than a loop inside one test: a loop
  // shares a single timeout across every variant, so adding a variant to the
  // manifest silently pushed the suite over its budget, and a failure named
  // the whole set rather than the variant that broke.
  for (const variant of bundle.shellVariants) {
    test(
      `shell variant "${variant.id}" is no worse than a built-in Theme`,
      async () => {
        const themed: Site = {
          ...site,
          theme: { ...site.theme, shellVariant: variant.id },
        };
        const html = renderSite(themed, bundle.id, { pageIndex: 0, theme: bundle });
        expect(html).toContain(`data-shell-variant="${variant.id}"`);
        expect(ids(await violationsFor(html))).toEqual(await baselineIds(site, 0));
      },
      AXE_TIMEOUT_MS,
    );
  }
});
