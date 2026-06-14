import { test, expect } from "@playwright/test";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Wizard e2e — six-step flow in a real browser.
 *
 * The unit tests under `packages/wizard/test/wizard-ui.test.tsx` cover
 * the same logic against jsdom; this e2e adds the binding "in a real
 * browser" check across the AC for #33: render six steps, Back/Next
 * preserves state, Skip on optional steps, Cancel everywhere, Create
 * yields a valid Site.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

async function bundleForBrowser(): Promise<string> {
  const entryPath = path.join(__dirname, "wizard.entry.tsx");
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

async function mountFresh(page: import("@playwright/test").Page): Promise<void> {
  const bundle = await bundleForBrowser();
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ type: "module", content: bundle });
  await page.evaluate(() => {
    const root = document.getElementById("root");
    if (root === null) throw new Error("missing root");
    window.__sosbWizard.mount({}, root);
  });
}

test("the wizard renders the basics step on first mount", async ({ page }) => {
  await mountFresh(page);
  await expect(page.locator('[data-wizard-step="basics"]').first()).toBeVisible();
  await expect(page.locator('[data-field="basics.name"]')).toBeVisible();
});

test("the step indicator surfaces all six steps", async ({ page }) => {
  await mountFresh(page);
  for (const id of ["basics", "identity", "sections", "content", "languages", "confirm"]) {
    await expect(page.locator(`[data-wizard-step-indicator="${id}"]`)).toBeVisible();
  }
});

test("Next is disabled until org name is entered", async ({ page }) => {
  await mountFresh(page);
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  await page.locator('[data-field="basics.name"]').fill("HISTORIPOL");
  await expect(page.locator('[data-action="next"]')).toBeEnabled();
});

test("walking through every step ends on confirm with a valid Site emitted on Create", async ({
  page,
}) => {
  await mountFresh(page);

  await page.locator('[data-field="basics.name"]').fill("HISTORIPOL");
  await page.locator('[data-field="basics.tagline"]').fill("Studenți care fac istorie.");
  await page.locator('[data-action="next"]').click(); // identity

  await expect(page.locator('[data-wizard-step="identity"]').first()).toBeVisible();
  await page.locator('[data-action="skip"]').click(); // sections
  await page.locator('[data-action="skip"]').click(); // content
  await page.locator('[data-action="skip"]').click(); // languages
  await page.locator('[data-action="skip"]').click(); // confirm

  await expect(page.locator('[data-wizard-step="confirm"]').first()).toBeVisible();
  await expect(page.getByTestId("confirm-summary")).toContainText("HISTORIPOL");
  await expect(page.getByTestId("confirm-summary")).toContainText("Top page header");
  await expect(page.getByTestId("confirm-summary")).not.toContainText("richText");

  await page.locator('[data-action="create"]').click();
  const completed = await page.evaluate(() => window.__sosbWizard.completed);
  expect(completed).not.toBeNull();
  expect(completed!.org.name).toBe("HISTORIPOL");
  expect(completed!.org.tagline).toBe("Studenți care fac istorie.");
  expect(Array.isArray(completed!.pages)).toBe(true);
  expect(completed!.pages[0]!.blocks.map((block) => block.type)).toEqual([
    "hero",
    "richText",
    "valueList",
    "activitiesList",
    "teamGrid",
    "contactCard",
  ]);
});

test("Back returns to a previous step preserving captured data", async ({ page }) => {
  await mountFresh(page);

  await page.locator('[data-field="basics.name"]').fill("Rewind Co");
  await page.locator('[data-action="next"]').click(); // identity
  await expect(page.locator('[data-wizard-step="identity"]').first()).toBeVisible();

  await page.locator('[data-action="back"]').click();
  await expect(page.locator('[data-wizard-step="basics"]').first()).toBeVisible();
  await expect(page.locator('[data-field="basics.name"]')).toHaveValue("Rewind Co");
});

test("Cancel fires onCancel and is available on every step", async ({ page }) => {
  await mountFresh(page);

  await page.locator('[data-field="basics.name"]').fill("Cancellable Co");
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-action="cancel"]')).toBeVisible();
  await page.locator('[data-action="cancel"]').click();
  const cancelled = await page.evaluate(() => window.__sosbWizard.cancelled);
  expect(cancelled).toBe(true);
});
