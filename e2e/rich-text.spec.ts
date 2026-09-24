import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { openFirstPage, openSection } from "./builder-helpers.js";

/**
 * Rich-text editing — end-to-end through the real editor (issue #100).
 *
 * Covers the interactions the contract names as the ones that detect stale
 * content and history-synchronisation errors: typing, formatting, inserting
 * an internal link and an image, local undo, and the content reaching the
 * preview immediately.
 *
 * Served over `http://127.0.0.1:<port>` rather than `page.setContent`,
 * because the image half calls `crypto.subtle.digest` for content-addressed
 * hashing and that needs a secure context. Same reason as
 * `asset-picker-upload.spec.ts`; loopback counts as secure in Chromium.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ONE_BY_ONE_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const FIXTURE = {
  schemaVersion: 1,
  org: { name: "Rich Text Org", tagline: "Structured prose", email: "contact@example.org" },
  theme: { id: "stub", tokens: { colorPrimary: "#1f3a5f", colorAccent: "#c08a3e" } },
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
          id: "blk_prose",
          type: "richText",
          version: 2,
          data: {
            doc: {
              version: 1,
              content: [{ type: "paragraph", content: [{ type: "text", text: "Început. " }] }],
            },
          },
        },
      ],
    },
    // A second Page, so the link picker has a target that is not the language
    // home — a home page's path is "/" whatever its slug, which would make the
    // assertion vacuous.
    {
      slug: "contact",
      lang: "ro",
      navLabel: "Contact",
      navOrder: 1,
      showInNav: true,
      blocks: [],
    },
  ],
};

async function bundleEditor(): Promise<string> {
  const result = await esbuild({
    entryPoints: [path.join(__dirname, "editor-app.entry.tsx")],
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
  const wrappedBundle = `${editorBundle}
;window.__sosbEditor.mount(${JSON.stringify(FIXTURE)}, document.getElementById("root"));`;
  const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Rich text test</title></head>
<body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;

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
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("type, format, link, insert an image, undo — and the preview keeps up", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const server = await startServer();
  try {
    await page.goto(`${server.url}/`);
    // The builder opens on the content Overview (issue #102); the Block list
    // lives in the page workspace.
    await expect(page.getByTestId("overview")).toBeVisible({ timeout: 15_000 });
    await openFirstPage(page);
    await expect(page.getByTestId("editor-pane")).toBeVisible();

    // Drill into the Rich-text Block.
    const row = page.locator('[data-testid="block-row"][data-block-id="blk_prose"]');
    await expect(row).toBeVisible();
    await row.locator('[data-testid="block-row-select"]').click();
    await expect(
      page.locator('[data-testid="inspector"][data-inspector-mode="block"]'),
    ).toBeVisible();

    const surface = page.getByTestId("rich-text-surface");
    await expect(surface).toBeVisible();
    const preview = page.frameLocator('[data-testid="preview-pane"] iframe');

    // --- Typing reaches the preview -------------------------------------
    await surface.click();
    await page.keyboard.press("End");
    await page.keyboard.type("Text nou");
    await expect(preview.locator('[data-block="richText"]')).toContainText("Text nou");

    // --- Bold via the toolbar, on a real selection ----------------------
    // Select the word just typed. The toolbar must not steal focus doing it:
    // if it did, the selection would collapse and Bold would bold nothing.
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Shift+ArrowLeft");
    await page.getByTestId("rich-text-bold").click();
    await expect(surface.locator("strong")).toHaveText("nou");
    await expect(preview.locator('[data-block="richText"] strong')).toHaveText("nou");

    // --- Local undo is Tiptap's, not the Site's -------------------------
    // Ctrl+Z inside the surface removes the bold, and must NOT roll back the
    // whole editing visit — the typed text stays.
    await surface.click();
    await page.keyboard.press("Control+z");
    await expect(surface.locator("strong")).toHaveCount(0);
    await expect(surface).toContainText("Text nou");

    // --- Internal link, by identity -------------------------------------
    await surface.click();
    await page.keyboard.press("End");
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Shift+ArrowLeft");
    await page.getByTestId("rich-text-link").click();
    await expect(page.getByTestId("rich-text-link-dialog")).toBeVisible();
    await page.getByTestId("rich-text-link-option-page:1").click();
    await page.getByTestId("rich-text-link-apply-internal").click();
    await expect(page.getByTestId("rich-text-link-dialog")).toHaveCount(0);

    // Stored as a Page target; resolved to the Page's path only on render.
    await expect(surface.locator('a[data-link-kind="page"]')).toHaveCount(1);
    await expect(preview.locator('[data-block="richText"] a')).toHaveAttribute("href", "/contact/");

    // --- Image, through the existing asset pipeline ---------------------
    await surface.click();
    await page.keyboard.press("End");
    await page.getByTestId("rich-text-image").click();
    await expect(page.getByTestId("rich-text-image-dialog")).toBeVisible();
    await page.getByTestId("asset-picker-add").click();
    await page.locator('[data-testid="asset-picker-file-input"]').setInputFiles({
      name: "poza.png",
      mimeType: "image/png",
      buffer: ONE_BY_ONE_PNG_BUFFER,
    });
    await expect(page.getByTestId("asset-picker-thumbnail")).toBeVisible();
    await page.getByTestId("rich-text-image-alt").fill("Membrii asociației");
    await page.getByTestId("rich-text-image-caption").fill("Conferința anuală");
    await page.getByTestId("rich-text-image-insert").click();
    await expect(page.getByTestId("rich-text-image-dialog")).toHaveCount(0);

    // The editing surface shows the bytes too — through the same display URL
    // the picker used, not the archive path the editor page cannot fetch.
    const surfaceImage = surface.locator("figure img");
    await expect(surfaceImage).toBeVisible();
    await expect
      .poll(
        async () => await surfaceImage.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);

    // The bytes actually load in the preview — the same assertion the asset
    // picker spec leans on, and for the same reason: an unresolved src stays
    // in the DOM with naturalWidth 0.
    const previewImage = preview.locator('[data-block="richText"] figure img');
    await expect(previewImage).toBeVisible();
    await expect(previewImage).toHaveAttribute("alt", "Membrii asociației");
    await expect(preview.locator('[data-block="richText"] figcaption')).toHaveText(
      "Conferința anuală",
    );
    await expect
      .poll(
        async () => await previewImage.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);

    // --- Everything survives the end of the editing visit ---------------
    // Drilling back out is what ends the visit and pushes the single
    // Site-history entry. The content must already be in Site data — issue
    // #100 is explicit that history grouping does not buffer saved content —
    // so the preview is unchanged by leaving.
    await page.getByTestId("drill-back").click();
    const previewBlock = preview.locator('[data-block="richText"]');
    await expect(previewBlock).toContainText("Text nou");
    await expect(previewBlock.locator("a")).toHaveAttribute("href", "/contact/");
    await expect(previewBlock.locator("figure img")).toBeVisible();

    // And Site Health reports nothing blocking: the content is all supported
    // and the image bytes are present, so neither ADR 0048 blocker fires.
    // The redesigned builder lists findings on the Overview (issue #102).
    await openSection(page, "overview");
    const health = page.getByTestId("overview-health");
    await expect(health).toBeVisible();
    await expect(health.locator('[data-blocking="true"]')).toHaveCount(0);
    await expect(health.locator('[data-code="block.richText.content.unsupported"]')).toHaveCount(0);
    await expect(health.locator('[data-code="block.richText.image.bytes.missing"]')).toHaveCount(0);
  } finally {
    await server.close();
  }
});
