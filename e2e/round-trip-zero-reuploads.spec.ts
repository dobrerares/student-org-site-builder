import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Round-trip zero re-uploads — load-bearing assertion for ADR 0044 Corollary 1.
 *
 * Narrative: when a user opens a previously-exported / freshly-imported site
 * that already has its image-gallery populated, the editor MUST render the
 * existing image's thumbnail. It MUST NOT surface an "Add image" CTA, a
 * "Re-upload" button, or any other affordance that suggests the user has
 * to re-upload bytes that already live in the VFS. The export → import
 * round-trip is zero re-upload (ADR 0044 Corollary 1).
 *
 * Strategy A (chosen): load a fixture Site directly into the editor via the
 * existing `__sosbEditor.mount()` test hook. The round-trip itself —
 * serializing to a zip and re-importing — is exercised by other tests; the
 * assertion that *matters* here is at the picker level: given an AssetRef
 * in state, the picker is in THUMBNAIL state, not in ADD-IMAGE state, and
 * not in RE-UPLOAD state. That assertion is independent of how the
 * AssetRef arrived in state.
 *
 * The picker's hidden `<input type="file">` is always in the DOM (it backs
 * uploads from any state via the menu); its presence is part of the
 * picker, NOT an "upload affordance" that signals "you must re-upload".
 * This test specifically watches the visible affordances:
 *   - `asset-picker-thumbnail` visible
 *   - `asset-picker-add` count 0
 *   - `asset-picker-reupload` count 0
 *
 * If this ever fails, a power-user fallback has been introduced and should
 * be reverted per ADR 0044.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// 1x1 transparent PNG as a data URL. The AssetPicker reads `value.path` into
// an `<img src>`; a data URL renders without a server round-trip, which keeps
// this test free of any webserver dependency.
const ONE_BY_ONE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const FIXTURE = {
  schemaVersion: 1,
  org: {
    name: "Imported Org",
    tagline: "A round-tripped site with a populated image gallery",
    email: "contact@example.org",
  },
  theme: {
    id: "stub",
    tokens: {
      colorPrimary: "#1f3a5f",
      colorAccent: "#c08a3e",
    },
  },
  defaultLanguage: "ro",
  languages: ["ro"],
  pages: [
    {
      slug: "acasa",
      lang: "ro",
      navLabel: "Acasă",
      navOrder: 0,
      showInNav: true,
      blocks: [
        {
          id: "blk_home_gallery",
          type: "imageGallery",
          version: 1,
          data: {
            title: "Photos",
            layout: "grid",
            columns: 3,
            lightbox: true,
            images: [
              {
                asset: {
                  hash: "imported-hash",
                  // Data URL so the `<img>` resolves without a webserver —
                  // the picker treats successful load as THUMBNAIL state.
                  path: ONE_BY_ONE_PNG_DATA_URL,
                  metadataPath: "assets/imported.metadata.json",
                  mime: "image/png",
                  width: 1,
                  height: 1,
                  alt: "Imported photo",
                },
                alt: "Imported photo",
              },
            ],
          },
        },
      ],
    },
  ],
};

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "editor-app.entry.tsx");
  const result = await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "preact",
    absWorkingDir: repoRoot,
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error("esbuild produced no browser output");
  return out.text;
}

test("a populated imageGallery block renders the picker as a thumbnail, never an upload CTA (ADR 0044 Corollary 1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const bundle = await bundleForBrowser();

  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbEditor.mount(siteData as never, root);
  }, FIXTURE);

  // The fixture page surfaces a single block row: the imageGallery. Drill in
  // by clicking the row's select affordance — the BlockListEditor exposes
  // `block-row-select` as the primary click target when the parent provides
  // an `onSelect` callback (the editor does).
  const galleryRow = page.locator(
    '[data-testid="block-row"][data-block-id="blk_home_gallery"]',
  );
  await expect(galleryRow).toBeVisible();
  await galleryRow.locator('[data-testid="block-row-select"]').click();

  // After drill-in the inspector mounts the BlockForm for the gallery.
  await expect(page.locator('[data-testid="inspector"][data-inspector-mode="block"]')).toBeVisible();

  // ADR 0044 Corollary 1 assertions — the load-bearing block:
  //
  // 1. The picker is in THUMBNAIL state. The image's `path` resolves (data
  //    URL), so the `<img data-testid="asset-picker-thumbnail">` is in the
  //    DOM and visible.
  const thumbnail = page.locator('[data-testid="asset-picker-thumbnail"]');
  await expect(thumbnail).toBeVisible();

  // 2. No ADD-IMAGE CTA. The picker emits `asset-picker-add` only when
  //    `value === undefined`; here the value is set, so the CTA must be
  //    absent.
  await expect(page.locator('[data-testid="asset-picker-add"]')).toHaveCount(0);

  // 3. No RE-UPLOAD button. The picker emits `asset-picker-reupload` only
  //    when the image errored (bytes failed to load). The data URL above
  //    cannot 404, so this affordance must be absent.
  await expect(page.locator('[data-testid="asset-picker-reupload"]')).toHaveCount(0);

  // Sanity: the picker wrapper itself IS present (we're not accidentally
  // asserting against an empty subtree, which would also satisfy the
  // count==0 checks above).
  await expect(page.locator('[data-testid="asset-picker"]')).toHaveCount(1);
});
