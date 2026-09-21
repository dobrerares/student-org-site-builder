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

describe("examples/themes/practice — accessibility", () => {
  const site = practiceSite();

  for (const [index, page] of site.pages.entries()) {
    test(`page "${page.slug}" (${page.lang}) is no worse than a built-in Theme`, async () => {
      // The comparison is against a built-in Theme on the same page rather
      // than against zero, because the sample Site's own content carries a
      // couple of landmark findings (a customHTML `<aside>`, a repeated
      // section landmark) that belong to the fixture, not to any Theme.
      // Asserting "the Theme adds nothing" is the claim that is actually
      // about the Theme — and it fails loudly if this Theme's CSS or variant
      // markup ever introduces a new problem.
      const themed = renderSite(site, bundle.id, { pageIndex: index, theme: bundle });
      const baselineSite: Site = { ...site, theme: { id: "modern" } };
      const baseline = renderSite(baselineSite, "modern", { pageIndex: index });

      expect(ids(await violationsFor(themed))).toEqual(ids(await violationsFor(baseline)));
    }, 30_000);
  }

  test("each shell variant renders without violations", async () => {
    for (const variant of bundle.shellVariants) {
      const themed: Site = {
        ...site,
        theme: { ...site.theme, shellVariant: variant.id },
      };
      const html = renderSite(themed, bundle.id, { pageIndex: 0, theme: bundle });
      expect(html).toContain(`data-shell-variant="${variant.id}"`);
      const baseline = renderSite({ ...site, theme: { id: "modern" } }, "modern");
      expect(ids(await violationsFor(html))).toEqual(ids(await violationsFor(baseline)));
    }
  }, 30_000);
});
