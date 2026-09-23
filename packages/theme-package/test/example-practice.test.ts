/**
 * The shipped example Theme package is CI-covered (issue #111's "required
 * developer documentation/examples").
 *
 * `examples/themes/practice/` is not decoration — it is the executable proof
 * that the manifest, the loader, the sandbox, the renderer seam and the build
 * pipeline actually compose. A format change that a unit test's hand-built
 * fixture would survive will break here, which is the point.
 *
 * Since 1.1.0 the package ships a `render.js` (page shell + hero override) and
 * a `public.js`, so this file is also where phase two's promises are held to:
 * the design renders every page, the public script reaches the build and only
 * the build, and the whole thing round-trips through a zip byte for byte.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { renderSite } from "@sosb/renderer";
import type { ThemeBundle } from "@sosb/renderer";
import { build } from "@sosb/build";
import type { Site } from "@sosb/schema";
import { loadThemePackageFromDirectoryAsync } from "../src/node.js";
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

// Top-level await: the example ships a `render.js`, so the sandbox engine has
// to be up before the package can be loaded (ADR 0054).
const loaded = await loadThemePackageFromDirectoryAsync(EXAMPLE_DIR);
const { bundle } = loaded;

/** Every sandbox realm this file opens, released at the end. */
const opened: ThemeBundle[] = [bundle];
afterAll(() => {
  for (const b of opened) b.render?.dispose();
});

function practiceSite(): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: "org.example.practice", version: bundle.version };
  return site;
}

/** A bundle minus its live sandbox module, for structural equality checks. */
function comparable(b: ThemeBundle): Omit<ThemeBundle, "render"> & {
  design: { blockTypes: readonly string[]; hasShell: boolean } | undefined;
} {
  const { render, ...rest } = b;
  return {
    ...rest,
    design:
      render === undefined
        ? undefined
        : { blockTypes: render.blockTypes, hasShell: render.hasShell },
  };
}

describe("examples/themes/practice", () => {
  test("loads and validates from its directory", () => {
    expect(loaded.manifest.id).toBe("org.example.practice");
    expect(bundle.origin).toBe("package");
    expect(bundle.supports.fonts).toBe(false);
    expect(bundle.shellVariants.map((v) => v.id)).toEqual(["standard", "compact"]);
  });

  test("declares packaged fonts and the decorative asset its CSS references", () => {
    expect(bundle.fontSource.kind).toBe("bundle");
    if (bundle.fontSource.kind !== "bundle") throw new Error("expected a bundled font source");
    expect(bundle.fontSource.faces.length).toBeGreaterThan(0);
    // Romanian needs latin-ext; a Theme that only ships `latin` renders
    // "Societatea Studenţilor" with fallback glyphs for ș and ț.
    expect(bundle.fontSource.faces.some((f) => f.file.includes("latin-ext"))).toBe(true);
    expect([...bundle.assets.keys()]).toContain("assets/grid.svg");
  });

  test("compiles its render.js into a design with a shell and a hero override", () => {
    expect(bundle.render).toBeDefined();
    expect(bundle.render?.hasShell).toBe(true);
    expect(bundle.render?.blockTypes).toEqual(["hero"]);
  });

  test("declares its public script with an honest, empty network list", () => {
    expect(bundle.publicScript?.file).toBe("public.js");
    expect(bundle.publicScript?.network).toEqual([]);
    expect(bundle.publicScript?.offline).toBeUndefined();
    expect(loaded.files.has("public.js")).toBe(true);
    expect(loaded.files.has("render.js")).toBe(true);
  });

  test("renders every page of the sample site through the executable shell", () => {
    const site = practiceSite();
    expect(site.pages.length).toBeGreaterThan(1);
    site.pages.forEach((_page, idx) => {
      const html = renderSite(site, bundle.id, { pageIndex: idx, theme: bundle });
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).toContain('font-family:"Practice Display"');
      // The decorative URL was rewritten onto the canonical bundle path.
      expect(html).toContain("assets/theme/org.example.practice/assets/grid.svg");
      // The design's shell, not the builder's: wordmark, menu button, colophon.
      expect(html).toContain('class="site-nav__wordmark"');
      expect(html).toContain('class="site-nav__toggle"');
      expect(html).toContain('class="site-colophon"');
      // The builder still owns the document, the head and the Block order.
      expect(html).toContain("<main>");
      expect(html).toContain('data-block="hero"');
      expect(html).not.toContain("data-sosb-theme-error");
    });
  });

  test("the spotlight hero is the design's, every other hero the built-in shape", () => {
    const site = practiceSite();
    const hero = site.pages[0]!.blocks[0]!;
    expect(hero.type).toBe("hero");

    const plain = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle });
    expect(plain).toContain('class="hero hero--has-image"');
    // The stylesheet mentions the class; the element must not be there.
    expect(plain).not.toContain('class="hero__rings"');

    (hero as { variant?: string }).variant = "spotlight";
    const spotlight = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle });
    expect(spotlight).toContain(
      'data-block="hero" data-block-id="blk_home_hero" data-variant="spotlight"',
    );
    expect(spotlight).toContain('class="hero__rings"');
    expect(spotlight).toContain('class="hero__word"');
  });

  test("build() emits the Theme's fonts, assets and public script — never render.js", () => {
    const dist = build(practiceSite(), { themes: [bundle], skipValidation: true });
    const paths = [...dist.keys()];
    expect(paths).toContain("assets/theme/org.example.practice/assets/grid.svg");
    expect(paths.some((p) => p.startsWith("assets/theme/org.example.practice/fonts/"))).toBe(true);
    expect(paths).toContain("assets/theme/org.example.practice/public.js");
    expect(paths).not.toContain("assets/theme/org.example.practice/render.js");
    expect(dist.get("assets/theme/org.example.practice/public.js")).toEqual(
      loaded.files.get("public.js"),
    );
    // Every page loads the script, deferred, through the depth-aware URL seam.
    expect(dist.get("index.html")).toContain(
      '<script defer src="assets/theme/org.example.practice/public.js" data-sosb-theme-script>',
    );
    const nested = [...dist.entries()].find(
      ([p]) => p !== "index.html" && p.endsWith("index.html"),
    );
    expect(nested).toBeDefined();
    expect(nested![1]).toContain(
      '<script defer src="../assets/theme/org.example.practice/public.js" data-sosb-theme-script>',
    );
  });

  test("the public script does not count against the builder's script budget", () => {
    const dist = build(practiceSite(), { themes: [bundle], skipValidation: true });
    const report = JSON.parse(dist.get("_lighthouse-budget.json") as string) as {
      pages: Record<string, { metrics: { js: { status: string } } }>;
    };
    for (const page of Object.values(report.pages)) {
      expect(page.metrics.js.status).toBe("pass");
    }
  });

  test("the preview never carries the public script unless asked", () => {
    const site = practiceSite();
    const preview = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle, mode: "preview" });
    expect(preview).not.toContain("data-sosb-theme-script");
    const interactive = renderSite(site, bundle.id, {
      pageIndex: 0,
      theme: bundle,
      mode: "preview",
      includePublicScript: true,
      assetUrlForPath: (path) => `blob:sosb/${path}`,
    });
    expect(interactive).toContain(
      '<script defer src="blob:sosb/assets/theme/org.example.practice/public.js" data-sosb-theme-script>',
    );
  });

  test("round-trips through a .sosb-theme.zip without loss", async () => {
    const zipped = exportThemePackage(loaded);
    const reloaded = await loadThemePackageFromZip(zipped);
    opened.push(reloaded.bundle);
    // Every file, byte for byte — render.js and public.js included.
    expect([...reloaded.files.keys()].sort()).toEqual([...loaded.files.keys()].sort());
    for (const [path, bytes] of loaded.files) expect(reloaded.files.get(path)).toEqual(bytes);
    expect(comparable(reloaded.bundle)).toEqual(comparable(bundle));
    // Deterministic: re-exporting the reloaded package gives the same bytes.
    expect(exportThemePackage(reloaded)).toEqual(zipped);
  });

  test("a directory load, a zip load and a files load render identically", async () => {
    const fromZip = await loadThemePackageFromZip(exportThemePackage(loaded));
    const viaFiles = loadThemePackage(loaded.files);
    opened.push(fromZip.bundle, viaFiles.bundle);
    expect(comparable(fromZip.bundle)).toEqual(comparable(viaFiles.bundle));
    // Three separate sandbox realms, one output: the design is a pure
    // function of the Site (ADR 0046 / ADR 0032).
    const site = practiceSite();
    const renders = [bundle, fromZip.bundle, viaFiles.bundle].map((b) =>
      renderSite(site, b.id, { pageIndex: 0, theme: b }),
    );
    expect(new Set(renders).size).toBe(1);
  });

  test("rendering the same page twice through one realm is byte-identical", () => {
    const site = practiceSite();
    const first = renderSite(site, bundle.id, { pageIndex: 1, theme: bundle });
    const second = renderSite(site, bundle.id, { pageIndex: 1, theme: bundle });
    expect(second).toBe(first);
  });
});
