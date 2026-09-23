/**
 * Golden files for the example Theme's executable design (ADR 0054).
 *
 * The renderer's own golden matrix (ADR 0032) covers the built-in Themes and
 * must not move when a Theme package renders differently. A package that
 * ships a `render.js` needs its own regression net, for a reason the
 * built-ins do not have: its markup is produced by code running in a
 * sandbox, and a change to the sandbox bootstrap, the tree validator or the
 * helper marshalling can alter the output while every unit test still
 * passes. These two files pin the whole path — package load, QuickJS,
 * helpers, tree validation, Preact — to bytes.
 *
 * Regenerate deliberately with `vitest -u` after a change to the example, and
 * read the diff.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import type { Site } from "@sosb/schema";
import { loadThemePackageFromDirectoryAsync } from "../src/node.js";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../examples/themes/practice", import.meta.url));
const HISTORIPOL_DATA = fileURLToPath(
  new URL("../../themes/src/templates/asociatia-studenteasca-demo/data.json", import.meta.url),
);

const { bundle } = await loadThemePackageFromDirectoryAsync(EXAMPLE_DIR);
afterAll(() => bundle.render?.dispose());

function practiceSite(shellVariant: string, heroVariant?: string): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: bundle.id, version: bundle.version, shellVariant };
  const hero = site.pages[0]?.blocks[0];
  if (heroVariant !== undefined && hero !== undefined && hero.type === "hero") {
    (hero as { variant?: string }).variant = heroVariant;
  }
  return site;
}

describe("examples/themes/practice — golden output", () => {
  test("home page, standard shell, spotlight hero, public script on (a build)", async () => {
    const html = renderSite(practiceSite("standard", "spotlight"), bundle.id, {
      pageIndex: 0,
      theme: bundle,
      includePublicScript: true,
    });
    await expect(html).toMatchFileSnapshot("__golden__/practice-home-standard-spotlight.html");
  });

  test("about page, compact shell, public script off (a static preview render)", async () => {
    const html = renderSite(practiceSite("compact"), bundle.id, {
      pageIndex: 1,
      theme: bundle,
    });
    await expect(html).toMatchFileSnapshot("__golden__/practice-about-compact.html");
  });
});
