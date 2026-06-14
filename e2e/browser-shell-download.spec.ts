import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

test.use({ acceptDownloads: true });

async function bundleShell(): Promise<string> {
  const entryPath = path.join(repoRoot, "packages", "browser-shell", "dev", "dev-entry.tsx");
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
  if (out === undefined) throw new Error("esbuild produced no browser-shell output");
  return out.text;
}

interface RunningServer {
  readonly url: string;
  readonly close: () => Promise<void>;
}

async function startServer(): Promise<RunningServer> {
  const shellBundle = await bundleShell();
  const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Browser shell download test</title></head>
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
      res.end(shellBundle);
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
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

test("Download copy writes an importable site zip from the browser shell", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const server = await startServer();
  try {
    await page.goto(`${server.url}/`);
    await expect(page.getByTestId("welcome-screen")).toBeVisible();

    await page.getByTestId("welcome-action-blank").click();
    await expect(page.getByTestId("editor-app")).toBeVisible();
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser", {
      timeout: 5_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-action="export"]').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("your-organisation.zip");
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const bytes = await readFile(downloadedPath!);
    const [{ importFromZip }, { ZipDriver }] = await Promise.all([
      import("../packages/zip/src/import.js"),
      import("../packages/vfs/src/zip-driver.js"),
    ]);
    const inspector = ZipDriver.fromZipBytes(new Uint8Array(bytes));
    const paths = await inspector.list();
    expect(paths).toContain("dist/index.html");
    expect(paths).toContain("dist/robots.txt");
    expect(paths).toContain("dist/sitemap.xml");
    expect(paths).toContain("DEPLOY.md");
    expect(paths).not.toContain("dist/.gitkeep");
    const html = new TextDecoder().decode(await inspector.read("dist/index.html"));
    expect(html).toContain("Your organisation");
    const deployMd = new TextDecoder().decode(await inspector.read("DEPLOY.md"));
    expect(deployMd).toMatch(/Cloudflare Pages/);
    expect(deployMd).not.toMatch(/placeholder/i);

    const imported = await importFromZip(
      new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
    );

    expect(imported.siteData.org.name).toBe("Your organisation");
    expect(imported.siteData.pages[0]?.blocks[0]?.type).toBe("hero");
  } finally {
    await server.close();
  }
});
