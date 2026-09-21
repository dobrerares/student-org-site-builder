import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Page } from "@playwright/test";

/**
 * Articles end-to-end: create → write → publish → export.
 *
 * The unit suites cover each step in isolation. This spec is the binding
 * check that they compose: that an Article created in the editor, written
 * into, and switched to Published actually lands as a file in the built
 * website at the URL ADR 0047 specifies — and that a Draft does not.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const SITE = {
  schemaVersion: 1,
  org: { name: "Asociația Studenților", email: "contact@example.org" },
  theme: { id: "academic" },
  defaultLanguage: "ro",
  languages: ["ro"],
  pages: [
    {
      slug: "acasa",
      lang: "ro",
      navLabel: "Acasă",
      navOrder: 0,
      showInNav: true,
      blocks: [{ id: "blk_home_hero", type: "hero", version: 1, data: { title: "Acasă" } }],
    },
  ],
};

async function bundleForBrowser(): Promise<string> {
  const result = await esbuild({
    entryPoints: [path.join(__dirname, "articles.entry.tsx")],
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

async function mountEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 960 });
  const bundle = await bundleForBrowser();
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((siteData) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbArticles.mount(siteData as never, root);
  }, SITE);
}

async function createArticle(page: Page, title: string): Promise<void> {
  await page.getByTestId("content-kind-articles").click();
  await page.getByTestId("articles-create").click();
  await page.getByTestId("article-create-input").fill(title);
  await page.getByTestId("article-create-submit").click();
}

async function exportSite(page: Page): Promise<void> {
  await page.locator('[data-action="export"]').click();
  // The confirmation dialog only appears when validation found something.
  const confirm = page.getByTestId("export-confirm-button");
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await expect
    .poll(async () => page.evaluate(() => window.__sosbArticles.lastExport !== null))
    .toBe(true);
}

async function readExport(page: Page) {
  return page.evaluate(() => window.__sosbArticles.lastExport);
}

test("create, write, publish, and export an article", async ({ page }) => {
  await mountEditor(page);

  // 1. Create — the new Article opens immediately as a Draft with a title
  //    and one Rich-text Block (issue #102).
  await createArticle(page, "Gala de final");
  await expect(page.getByTestId("article-settings-form")).toBeVisible();
  const stateSelect = page.locator("#article-state");
  await expect(stateSelect).toHaveValue("draft");

  // The slug is derived from the title, with diacritics folded.
  await expect(page.locator("#article-slug")).toHaveValue("gala-de-final");

  // 2. Write — drill into the seeded Rich-text Block and type.
  await page.getByTestId("block-row-select").first().click();
  const markdown = page.locator('[data-testid="inspector"] textarea').first();
  await markdown.fill("Gala a adunat peste **200 de studenți**.");
  await page.getByTestId("drill-back").click();

  // A Draft previews in the editor but must not reach the exported site.
  await exportSite(page);
  const draftExport = await readExport(page);
  expect(draftExport?.error).toBeNull();
  expect(draftExport?.paths).not.toContain("articles/gala-de-final/index.html");

  // 3. Publish.
  await stateSelect.selectOption("published");
  await expect(stateSelect).toHaveValue("published");

  // 4. Export — the Article is now a real file at the ADR 0047 URL.
  await exportSite(page);
  const published = await readExport(page);
  expect(published?.error).toBeNull();
  expect(published?.paths).toContain("articles/gala-de-final/index.html");

  const html = published?.files["articles/gala-de-final/index.html"] ?? "";
  expect(html).toContain("Gala de final");
  expect(html).toContain("<strong>200 de studenți</strong>");
  expect(html).toContain(
    '<link rel="canonical" href="https://example.org/articles/gala-de-final/"',
  );
  expect(html).toContain('"@type":"Article"');
  expect(html).not.toContain('name="robots"');

  // Published articles join the sitemap.
  expect(published?.files["sitemap.xml"]).toContain(
    "<loc>https://example.org/articles/gala-de-final/</loc>",
  );
});

test("an unlisted article exports with noindex and stays out of the sitemap", async ({ page }) => {
  await mountEditor(page);
  await createArticle(page, "Raport intern");
  await page.locator("#article-state").selectOption("unlisted");

  await exportSite(page);
  const result = await readExport(page);
  expect(result?.error).toBeNull();
  expect(result?.paths).toContain("articles/raport-intern/index.html");

  const html = result?.files["articles/raport-intern/index.html"] ?? "";
  expect(html).toContain('<meta name="robots" content="noindex"');
  expect(result?.files["sitemap.xml"]).not.toContain("raport-intern");
});

test("renaming a published article's link keeps the old URL working", async ({ page }) => {
  await mountEditor(page);
  await createArticle(page, "Gala de final");
  await page.locator("#article-state").selectOption("published");

  const slug = page.locator("#article-slug");
  await slug.fill("gala-2026");
  await slug.blur();
  await expect(slug).toHaveValue("gala-2026");

  await exportSite(page);
  const result = await readExport(page);
  expect(result?.paths).toContain("articles/gala-2026/index.html");
  // The retired URL is emitted as a redirect stub rather than disappearing.
  expect(result?.paths).toContain("articles/gala-de-final/index.html");
  const stub = result?.files["articles/gala-de-final/index.html"] ?? "";
  expect(stub).toContain('http-equiv="refresh"');
  expect(stub).toContain("/articles/gala-2026/");
});

test("an article list on a page shows published articles in the preview", async ({ page }) => {
  await mountEditor(page);
  await createArticle(page, "Gala de final");
  await page.locator("#article-state").selectOption("published");

  // Back to Pages, add an article list to the home page.
  await page.getByTestId("content-kind-pages").click();
  await page.getByTestId("block-add").click();
  await page.locator('[data-block-type="articleList"]').click();

  await page.getByTestId("block-row-select").last().click();
  await expect(page.getByTestId("article-list-inspector")).toBeVisible();
  await expect(page.getByTestId("article-list-matches")).toContainText("Gala de final");

  await exportSite(page);
  const result = await readExport(page);
  const home = result?.files["index.html"] ?? "";
  expect(home).toContain('data-block="articleList"');
  expect(home).toContain('href="/articles/gala-de-final/"');
});
