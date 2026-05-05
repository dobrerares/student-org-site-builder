import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Welcome screen e2e — the user-facing entry surface for #32.
 *
 * The unit tests under `packages/editor-app/test/welcome-screen.test.tsx`
 * cover the same logic against jsdom; this e2e adds the binding "in a
 * real browser" check. We bundle the welcome entry, inject it, and
 * assert each of the four paths surfaces a clickable affordance and
 * fires its corresponding callback.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "welcome-screen.entry.tsx");
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

const recentsFixture = [
  { key: "site-a", label: "Site Alpha", lastModified: 1700000000000 },
  { key: "site-b", label: "Site Beta", lastModified: 1700000010000 },
];

test("welcome screen surfaces all four primary paths as clickable buttons", async ({
  page,
}) => {
  const bundle = await bundleForBrowser();
  await page.setContent(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((recents) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbWelcome.mount(
      { recents: recents as never },
      root,
    );
  }, recentsFixture);

  for (const id of ["wizard", "template", "import", "blank"]) {
    const button = page.locator(`[data-welcome-path="${id}"]`);
    await expect(button).toBeVisible();
  }
});

test("clicking each path button signals the host with the matching id", async ({
  page,
}) => {
  const bundle = await bundleForBrowser();
  await page.setContent(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate(() => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbWelcome.mount({ recents: [] }, root);
  });

  for (const id of ["wizard", "template", "import", "blank"] as const) {
    await page.locator(`[data-welcome-path="${id}"]`).click();
    const lastPath = await page.evaluate(() => window.__sosbWelcome.lastPath);
    expect(lastPath).toBe(id);
  }
});

test("recent-sites list renders one row per entry and clicks signal the host", async ({
  page,
}) => {
  const bundle = await bundleForBrowser();
  await page.setContent(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate((recents) => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbWelcome.mount({ recents: recents as never }, root);
  }, recentsFixture);

  const rows = page.getByTestId("recent-site");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Site Alpha");
  await expect(rows.nth(1)).toContainText("Site Beta");

  await rows.nth(0).click();
  const clicked = await page.evaluate(() => window.__sosbWelcome.lastRecent);
  expect(clicked).toBe("site-a");
});

test("the welcome screen exposes a labelled drop-zone region", async ({
  page,
}) => {
  const bundle = await bundleForBrowser();
  await page.setContent(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate(() => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbWelcome.mount({ recents: [] }, root);
  });

  await expect(page.getByTestId("drop-zone")).toBeVisible();
  await expect(page.getByTestId("drop-zone-hint")).toBeVisible();
});
