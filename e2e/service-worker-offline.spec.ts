import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildServiceWorkerScript } from "../packages/browser-shell/src/service-worker/script.js";

/**
 * AC #5 — Service worker handles offline gracefully (loads cached SPA).
 *
 * We spin up a real local HTTP server (a `http.createServer` instance bound
 * to 127.0.0.1) that serves the editor SPA + the SW script. The page
 * registers the SW, the SW caches the shell, then we go offline via
 * `context.setOffline(true)` and reload. The SW must serve the cached
 * shell from `Cache Storage`.
 *
 * Why a real server, not Playwright's `route` API: SW-driven fetches do not
 * always traverse the playwright route layer (the SW's `fetch` event runs
 * inside the worker context and may bypass the network stack the route
 * handler intercepts). A real server gives byte-equal coverage of the
 * production lifecycle and makes the offline assertion meaningful.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  repoRoot,
  "packages",
  "editor-app",
  "test",
  "fixtures",
  "minimal-site.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;

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
  const wrappedBundle = `${editorBundle}
;window.__sosbEditor.mount(${JSON.stringify(fixture)}, document.getElementById("root"));`;
  const swScript = buildServiceWorkerScript({
    version: "v1-test",
    precacheUrls: ["/", "/app.js"],
  });
  const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"/><title>SW offline test</title></head>
<body>
<div id="root"></div>
<script type="module" src="/app.js"></script>
<script>
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }
</script>
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
    if (url === "/sw.js") {
      res.writeHead(200, {
        "content-type": "text/javascript",
        // Service workers must be served with a `Service-Worker-Allowed` =
        // root scope. Default scope is fine; the header is precautionary.
        "service-worker-allowed": "/",
      });
      res.end(swScript);
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

test("the SPA still renders after going offline (the SW serves the cached shell)", async ({
  page,
  context,
}) => {
  const server = await startServer();
  try {
    // First load — registers SW and caches the shell.
    await page.goto(`${server.url}/`);
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });

    // Wait for the SW to take control of the page.
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      null,
      { timeout: 15_000 },
    );

    // Trigger a reload while the SW is active so the next reload is served
    // from the SW (and the cache is warm for the offline reload).
    await page.reload();
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });

    // Now go offline and reload — the SW must serve the cached shell.
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.setOffline(false);
    await server.close();
  }
});
