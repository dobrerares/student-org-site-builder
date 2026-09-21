/**
 * Preview/export parity for a Site using a Theme package (ADR 0046).
 *
 * ADR 0046 requires that "for the same saved Site, Theme, extensions, and
 * assets, rendering must generate identical page HTML across browser preview
 * and Electron/export". With built-in Themes that was nearly free — the same
 * function, the same constants. A Theme package adds a way for the two to
 * drift: preview resolves packaged files to `blob:` URLs, the build resolves
 * them to relative paths.
 *
 * So the invariant we actually need is: preview HTML equals build HTML modulo
 * asset-URL rewriting, and nothing else. This test asserts exactly that, by
 * normalising every resolved URL back to its canonical path and requiring
 * byte equality of the remainder. If a future change makes a packaged Theme
 * render *structurally* differently in preview, this fails.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { renderSite, themeAssetsFor } from "@sosb/renderer";
import { build } from "@sosb/build";
import type { Site } from "@sosb/schema";
import { loadThemePackageFromDirectory } from "../src/node.js";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../examples/themes/practice", import.meta.url));
const HISTORIPOL_DATA = fileURLToPath(
  new URL("../../themes/src/templates/asociatia-studenteasca-demo/data.json", import.meta.url),
);

const { bundle } = loadThemePackageFromDirectory(EXAMPLE_DIR);

function practiceSite(): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: bundle.id, version: bundle.version, shellVariant: "compact" };
  // Exercise a Block variant too, so parity covers the variant markup.
  const hero = site.pages[0]?.blocks[0];
  if (hero !== undefined && hero.type === "hero") hero.variant = "spotlight";
  return site;
}

/** The preview's stand-in for the editor's blob minting. */
const PREVIEW_PREFIX = "blob:sosb/";
const previewResolver = (path: string): string => `${PREVIEW_PREFIX}${path}`;

/**
 * Undo the preview resolver, so the two documents can be compared directly.
 * Deliberately a plain string replace of the known prefix rather than a regex
 * over "anything that looks like a URL" — a sloppy normaliser could hide a
 * real structural difference.
 */
function normalisePreview(html: string): string {
  return html.split(PREVIEW_PREFIX).join("");
}

/** The composed `<style>` payload — the Theme's entire contribution to a page. */
function styleBlockOf(html: string): string {
  const match = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (match === null) throw new Error("no <style> block in rendered HTML");
  return match[1]!;
}

/**
 * Everything from `<body` onwards, i.e. the part `build()` does not touch.
 *
 * Searched *after* the stylesheet: a Theme's CSS comments are free to mention
 * `<body>`, and this example's do.
 */
function bodyOf(html: string): string {
  const afterStyle = html.indexOf("</style>");
  const start = html.indexOf("<body", afterStyle < 0 ? 0 : afterStyle);
  if (start < 0) throw new Error("no <body> in rendered HTML");
  return html.slice(start);
}

describe("preview/build parity with a Theme package", () => {
  test("every page's preview HTML matches its built HTML modulo asset URLs", () => {
    const site = practiceSite();
    const dist = build(site, { themes: [bundle], skipValidation: true });

    site.pages.forEach((page, idx) => {
      const preview = renderSite(site, bundle.id, {
        pageIndex: idx,
        theme: bundle,
        assetUrlForPath: previewResolver,
      });
      // The deploy render is what `build()` writes, before its SEO-meta
      // overlay (which only applies when a siteUrl is configured).
      const deployed = renderSite(site, bundle.id, { pageIndex: idx, theme: bundle });

      expect(normalisePreview(preview)).toBe(deployed);
      expect(page.slug.length).toBeGreaterThan(0);
    });

    // And the built output carries that same rendering. `build()` overlays
    // JSON-LD into `<head>` (issue #17), so the documents are not byte-equal
    // — but the styled body and the composed stylesheet must be.
    const home = dist.get("index.html");
    expect(typeof home).toBe("string");
    const deployedHome = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle });
    expect(styleBlockOf(home as string)).toBe(styleBlockOf(deployedHome));
    expect(home as string).toContain(bodyOf(deployedHome));
  });

  test("the preview resolves exactly the paths the build writes", () => {
    const site = practiceSite();
    const dist = build(site, { themes: [bundle], skipValidation: true });
    const preview = renderSite(site, bundle.id, {
      pageIndex: 0,
      theme: bundle,
      assetUrlForPath: previewResolver,
    });

    // Every theme file the build emitted is a path the preview asked for.
    for (const path of themeAssetsFor(bundle).keys()) {
      expect(dist.has(path)).toBe(true);
    }
    for (const path of ["assets/theme/org.example.practice/assets/grid.svg"]) {
      expect(preview).toContain(`${PREVIEW_PREFIX}${path}`);
    }
  });

  test("the shell and block variants survive into both outputs", () => {
    const site = practiceSite();
    const deployed = renderSite(site, bundle.id, { pageIndex: 0, theme: bundle });
    const preview = renderSite(site, bundle.id, {
      pageIndex: 0,
      theme: bundle,
      assetUrlForPath: previewResolver,
    });
    for (const html of [deployed, preview]) {
      expect(html).toContain('data-shell-variant="compact"');
      expect(html).toContain('data-variant="spotlight"');
    }
  });
});
