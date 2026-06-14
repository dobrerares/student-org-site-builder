import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const PDF_BUFFER = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

const FIXTURE = {
  schemaVersion: 1,
  org: {
    name: "Document Upload Org",
    tagline: "A site with downloadable files",
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
          id: "blk_home_documents",
          type: "documentDownloads",
          version: 1,
          data: {
            title: "Documents",
            intro: "Files people can download.",
            layout: "list",
            files: [],
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
  const wrappedBundle = `${editorBundle}
;window.__sosbEditor.mount(${JSON.stringify(FIXTURE)}, document.getElementById("root"));`;
  const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Document picker upload test</title></head>
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

test("uploading the first document shows the original filename and updates the preview link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const server = await startServer();
  try {
    await page.goto(`${server.url}/`);
    await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });

    const documentRow = page.locator(
      '[data-testid="block-row"][data-block-id="blk_home_documents"]',
    );
    await expect(documentRow).toBeVisible();
    await documentRow.locator('[data-testid="block-row-select"]').click();
    await expect(
      page.locator('[data-testid="inspector"][data-inspector-mode="block"]'),
    ).toBeVisible();

    await page
      .locator('[data-field="files"][data-kind="array"]')
      .locator('button[data-action="add"]')
      .click();
    await page.locator('[data-testid="document-picker-add"]').click();
    await page.locator('[data-testid="document-picker-file-input"]').setInputFiles({
      name: "uploaded-report.pdf",
      mimeType: "application/pdf",
      buffer: PDF_BUFFER,
    });

    await expect(page.locator('[data-testid="document-picker-error"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="document-picker-filename"]')).toHaveText(
      "uploaded-report.pdf",
    );
    await expect(page.locator('[data-field="files.0.label"]')).toHaveValue("uploaded-report.pdf");
    await expect(page.locator('[data-testid="document-picker-type"]')).toHaveText("PDF");
    await expect(page.locator('[data-testid="document-picker-size"]')).toHaveText(/\d+ B/);

    const previewLink = page
      .frameLocator('[data-testid="preview-pane"] iframe')
      .locator('[data-block="documentDownloads"] a.document-downloads__link');
    await expect(previewLink).toBeVisible();
    await expect(previewLink).toContainText("uploaded-report.pdf");
    await expect(previewLink).toHaveAttribute("href", /^blob:/);
    await expect(previewLink).toHaveAttribute("download", "");
  } finally {
    await server.close();
  }
});
