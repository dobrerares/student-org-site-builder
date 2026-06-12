import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Hero background + org.logo asset pickers (scope D).
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
  org: {
    name: "Picker Org",
    tagline: "Hero and logo picker coverage",
    email: "contact@example.org",
  },
  theme: {
    id: "stub",
    tokens: { colorPrimary: "#1f3a5f", colorAccent: "#c08a3e" },
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
          id: "blk_home_hero",
          type: "hero",
          version: 1,
          data: {
            title: "Welcome",
            backgroundImage: {
              hash: "broken",
              path: "assets/broken.png",
              metadataPath: "assets/broken.metadata.json",
              mime: "image/png",
              width: 1,
              height: 1,
              alt: "Broken hero",
            },
            backgroundAlt: "Broken hero",
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

async function startServer(fixture: unknown): Promise<{ url: string; close: () => Promise<void> }> {
  const editorBundle = await bundleEditor();
  const wrappedBundle = `${editorBundle}
;window.__sosbEditor.mount(${JSON.stringify(fixture)}, document.getElementById("root"));`;
  const server: Server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<!doctype html><html><head><meta charset="utf-8"/></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`,
      );
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

test("hero block: re-upload then Replace image loads thumbnail bytes", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const server = await startServer(FIXTURE);
  try {
    await page.goto(`${server.url}/`);
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });

    await page
      .locator('[data-testid="block-row"][data-block-id="blk_home_hero"]')
      .locator('[data-testid="block-row-select"]')
      .click();
    await expect(page.locator('[data-inspector-mode="block"]')).toBeVisible();

    await page.locator('[data-testid="asset-picker-reupload"]').click();
    await page.locator('[data-testid="asset-picker-file-input"]').setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: ONE_BY_ONE_PNG_BUFFER,
    });

    const thumbnail = page.locator('[data-testid="asset-picker-thumbnail"]');
    await expect(thumbnail).toBeVisible();
    await expect(page.locator('[data-testid="asset-picker-replace"]')).toBeVisible();

    await page.locator('[data-testid="asset-picker-replace"]').click();
    await page.locator('[data-testid="asset-picker-file-input"]').setInputFiles({
      name: "hero2.png",
      mimeType: "image/png",
      buffer: ONE_BY_ONE_PNG_BUFFER,
    });
    await expect(thumbnail).toBeVisible();
    await expect
      .poll(async () => await thumbnail.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await server.close();
  }
});

test("site settings: org.logo upload shows thumbnail", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const server = await startServer(FIXTURE);
  try {
    await page.goto(`${server.url}/`);
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("site-settings-link").click();
    await expect(page.locator('[data-inspector-mode="settings"]')).toBeVisible();

    const settingsPicker = page.locator(
      '[data-inspector-mode="settings"] [data-testid="asset-picker"]',
    );
    await settingsPicker.locator('[data-testid="asset-picker-add"]').click();
    await settingsPicker.locator('[data-testid="asset-picker-file-input"]').setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: ONE_BY_ONE_PNG_BUFFER,
    });

    const thumbnail = settingsPicker.locator('[data-testid="asset-picker-thumbnail"]');
    await expect(thumbnail).toBeVisible();
    await expect
      .poll(async () => await thumbnail.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await server.close();
  }
});
