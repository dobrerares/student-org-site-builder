import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Asset-picker upload — end-to-end happy path through the REAL pipeline.
 *
 * Sibling to `round-trip-zero-reuploads.spec.ts`: that test mounts a site
 * with an already-resolvable AssetRef (data URL) and asserts the picker
 * lands in THUMBNAIL state. This test exercises the opposite half — a
 * fresh upload through the production wiring:
 *
 *   user clicks "Re-upload" (the picker is in MISSING state because the
 *   fixture's `asset.path` points at a VFS entry the browser cannot
 *   resolve)
 *   → file chooser
 *   → CanvasImageProcessor decodes + re-encodes
 *   → MemoryDriver vfs.write("assets/<hash>.<ext>")
 *   → uploadAsset returns AssetRef
 *   → BlockForm patches it into the snapshot
 *   → AssetPicker re-renders with the new value
 *   → display-URL resolver returns a `blob:` URL for `<img src>`
 *   → image actually loads
 *
 * The load-bearing assertion is `naturalWidth > 0`: an `<img>` whose
 * `src` cannot be resolved by the browser stays in the DOM (the picker
 * only hides it once `onError` fires) but its `naturalWidth` is 0. If
 * the picker uses the raw VFS path (`assets/<hash>.png`) for `<img src>`
 * instead of going through the display-URL resolver, this assertion is
 * what catches it.
 *
 * Why an HTTP server (not `page.setContent`): the asset pipeline calls
 * `crypto.subtle.digest` for content-addressed hashing, which requires
 * a SECURE context. `about:blank` (what `setContent` uses) is not a
 * secure context, so `crypto.subtle` is undefined there and the upload
 * crashes before any meaningful behaviour can be exercised. Loading
 * the page from `http://127.0.0.1:<port>` (loopback is treated as
 * secure by Chromium) makes `crypto.subtle` available — same pattern
 * the service-worker-offline spec uses for the same reason.
 *
 * Mirror tests for documents / other asset-bearing blocks land in
 * follow-ups; the display-URL bridge is shared, so this test stands
 * in as the canonical happy-path coverage for the bridge itself.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// 1x1 transparent PNG. Smallest valid PNG payload the asset pipeline
// will accept; keeps the canvas decode/re-encode step within tens of
// milliseconds and avoids any flake from large-image processing.
const ONE_BY_ONE_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const FIXTURE = {
  schemaVersion: 1,
  org: {
    name: "Upload Test Org",
    tagline: "A gallery whose existing AssetRef cannot resolve",
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
            // One image entry whose `asset.path` points to a VFS path the
            // browser cannot resolve. On mount, the picker's `<img>` tries
            // to fetch this path, fails, fires `onError`, and the picker
            // lands in MISSING state with a "Re-upload" button — which is
            // exactly the affordance the test drives next. The AssetRef
            // is structurally valid (all fields present) so the renderer
            // doesn't crash; only the browser fetch fails.
            images: [
              {
                asset: {
                  hash: "unresolvable",
                  path: "assets/unresolvable.png",
                  metadataPath: "assets/unresolvable.metadata.json",
                  mime: "image/png",
                  width: 1,
                  height: 1,
                  alt: "Initial broken image",
                },
                alt: "Initial broken image",
              },
            ],
          },
        },
      ],
    },
  ],
};

async function bundleEditor(): Promise<string> {
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
  if (out === undefined) throw new Error("editor bundle build failed");
  return out.text;
}

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

async function startServer(): Promise<RunningServer> {
  const editorBundle = await bundleEditor();
  // Append the mount call so the editor boots automatically on script
  // load. Keeping it inline (rather than driving via page.evaluate
  // post-navigation) means the test doesn't have to race the bundle.
  const wrappedBundle = `${editorBundle}
;window.__sosbEditor.mount(${JSON.stringify(FIXTURE)}, document.getElementById("root"));`;
  const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Asset picker upload test</title></head>
<body>
<div id="root"></div>
<script type="module" src="/app.js"></script>
</body></html>`;

  const server: Server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(indexHtml);
      return;
    }
    if (url === "/app.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(wrappedBundle);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  const port: number = await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("server.address() did not return AddressInfo"));
        return;
      }
      resolve(addr.port);
    });
    server.on("error", reject);
  });

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

test("uploading an image into the picker renders an <img> whose bytes actually load (naturalWidth > 0)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const server = await startServer();
  try {
    await page.goto(`${server.url}/`);
    // Confirm the editor mounted before driving any interactions.
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });

    // Drill into the gallery so the BlockForm mounts.
    const galleryRow = page.locator('[data-testid="block-row"][data-block-id="blk_home_gallery"]');
    await expect(galleryRow).toBeVisible();
    await galleryRow.locator('[data-testid="block-row-select"]').click();
    await expect(
      page.locator('[data-testid="inspector"][data-inspector-mode="block"]'),
    ).toBeVisible();

    // The fixture pre-populates one image entry whose `asset.path` cannot
    // be fetched by the browser, so the picker enters MISSING state on
    // mount. We drive the "Re-upload" affordance the picker surfaces
    // there to trigger a fresh upload.
    const reuploadButton = page.locator('[data-testid="asset-picker-reupload"]');
    await expect(reuploadButton).toBeVisible();
    await reuploadButton.click();

    // Drive a real PNG into the hidden file input. From here on everything
    // runs through the production wiring: CanvasImageProcessor →
    // uploadAsset → MemoryDriver → AssetRef → BlockForm patch.
    await page.locator('[data-testid="asset-picker-file-input"]').setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: ONE_BY_ONE_PNG_BUFFER,
    });

    // Post-upload, the picker should land in THUMBNAIL state.
    const thumbnail = page.locator('[data-testid="asset-picker-thumbnail"]');
    await expect(thumbnail).toBeVisible();

    // No missing-asset / re-upload affordance — if `<img src>` failed to
    // resolve, the picker's `onError` handler switches to the missing
    // state and surfaces a re-upload button.
    await expect(page.locator('[data-testid="asset-picker-missing"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="asset-picker-reupload"]')).toHaveCount(0);

    // The load-bearing assertion: the browser actually fetched and decoded
    // the bytes. Without a display-URL bridge between the VFS path that
    // `uploadAsset` writes ("assets/<hash>.png") and a URL the browser can
    // fetch, the <img> is in the DOM but its naturalWidth is 0.
    await expect
      .poll(async () => await thumbnail.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
        timeout: 5_000,
      })
      .toBeGreaterThan(0);

    const previewImage = page
      .frameLocator('[data-testid="preview-pane"] iframe')
      .locator('[data-block="imageGallery"] img');
    await expect(previewImage).toBeVisible();
    await expect
      .poll(
        async () => await previewImage.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);
    await expect(previewImage).toHaveAttribute("src", /^blob:/);
  } finally {
    await server.close();
  }
});
