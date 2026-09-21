/**
 * The shipped example Theme package is CI-covered (issue #111's "required
 * developer documentation/examples").
 *
 * `examples/themes/practice/` is not decoration — it is the executable proof
 * that the manifest, the loader, the renderer seam and the build pipeline
 * actually compose. A format change that a unit test's hand-built fixture
 * would survive will break here, which is the point.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import { build } from "@sosb/build";
import type { Site } from "@sosb/schema";
import { loadThemePackageFromDirectory } from "../src/node.js";
import { exportThemePackage, loadThemePackage } from "../src/index.js";
import { loadThemePackageFromZip } from "../src/load.js";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../examples/themes/practice", import.meta.url));

/**
 * The HISTORIPOL sample site, restyled onto the example Theme. Read from disk
 * rather than imported so this test does not need a subpath export from
 * `@sosb/themes` that exists only for its benefit.
 */
const HISTORIPOL_DATA = fileURLToPath(
  new URL("../../themes/src/templates/asociatia-studenteasca-demo/data.json", import.meta.url),
);

function practiceSite(): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: "org.example.practice", version: "1.0.0" };
  return site;
}

describe("examples/themes/practice", () => {
  test("loads and validates from its directory", () => {
    const loaded = loadThemePackageFromDirectory(EXAMPLE_DIR);
    expect(loaded.manifest.id).toBe("org.example.practice");
    expect(loaded.bundle.origin).toBe("package");
    expect(loaded.bundle.supports.fonts).toBe(false);
    expect(loaded.bundle.shellVariants.map((v) => v.id)).toEqual(["standard", "compact"]);
  });

  test("declares packaged fonts and the decorative asset its CSS references", () => {
    const { bundle } = loadThemePackageFromDirectory(EXAMPLE_DIR);
    expect(bundle.fontSource.kind).toBe("bundle");
    if (bundle.fontSource.kind !== "bundle") throw new Error("expected a bundled font source");
    expect(bundle.fontSource.faces.length).toBeGreaterThan(0);
    // Romanian needs latin-ext; a Theme that only ships `latin` renders
    // "Societatea Studenţilor" with fallback glyphs for ș and ț.
    expect(bundle.fontSource.faces.some((f) => f.file.includes("latin-ext"))).toBe(true);
    expect([...bundle.assets.keys()]).toContain("assets/grid.svg");
  });

  test("renders every page of the sample site", () => {
    const site = practiceSite();
    const { bundle } = loadThemePackageFromDirectory(EXAMPLE_DIR);
    expect(site.pages.length).toBeGreaterThan(1);
    site.pages.forEach((_page, idx) => {
      const html = renderSite(site, bundle.id, { pageIndex: idx, theme: bundle });
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).toContain('font-family:"Practice Display"');
      // The decorative URL was rewritten onto the canonical bundle path.
      expect(html).toContain("assets/theme/org.example.practice/assets/grid.svg");
    });
  });

  test("build() emits the Theme's fonts and assets into dist", () => {
    const { bundle } = loadThemePackageFromDirectory(EXAMPLE_DIR);
    const dist = build(practiceSite(), { themes: [bundle], skipValidation: true });
    const paths = [...dist.keys()];
    expect(paths).toContain("assets/theme/org.example.practice/assets/grid.svg");
    expect(paths.some((p) => p.startsWith("assets/theme/org.example.practice/fonts/"))).toBe(true);
  });

  test("round-trips through a .sosb-theme.zip without loss", async () => {
    const loaded = loadThemePackageFromDirectory(EXAMPLE_DIR);
    const zipped = exportThemePackage(loaded);
    const reloaded = await loadThemePackageFromZip(zipped);
    expect(reloaded.bundle).toEqual(loaded.bundle);
    // Deterministic: re-exporting the reloaded package gives the same bytes.
    expect(exportThemePackage(reloaded)).toEqual(zipped);
  });

  test("a directory load and a zip load produce the same bundle", async () => {
    const fromDir = loadThemePackageFromDirectory(EXAMPLE_DIR);
    const fromZip = await loadThemePackageFromZip(exportThemePackage(fromDir));
    const viaFiles = loadThemePackage(fromDir.files);
    expect(fromZip.bundle).toEqual(viaFiles.bundle);
  });
});
