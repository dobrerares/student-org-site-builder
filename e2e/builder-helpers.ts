import { expect, type Page } from "@playwright/test";

/**
 * Shared steps for specs that drive the redesigned builder (issue #102).
 *
 * The builder opens into the content Overview, so a spec that wants a Block
 * list or a preview has to go somewhere first — the same clicks an author
 * makes. Keeping them here means a navigation change is one edit.
 */

export type BuilderSection = "overview" | "pages" | "articles" | "theme" | "settings";

/** Click a main-navigation entry, opening the phone drawer first if needed. */
export async function openSection(page: Page, section: BuilderSection): Promise<void> {
  const item = page.getByTestId(`nav-${section}`);
  if (!(await item.isVisible())) {
    await page.getByTestId("nav-drawer-open").click();
    await expect(item).toBeVisible();
  }
  await item.click();
}

/** Open the workspace of the first page in the Pages list. */
export async function openFirstPage(page: Page): Promise<void> {
  await openSection(page, "pages");
  await page.locator('[data-testid="pages-list"] [data-action="select"]').first().click();
  await expect(page.getByTestId("workspace")).toBeVisible();
}

/**
 * Export website: the readiness panel always opens; an ordinary error asks
 * for the typed phrase (ADR 0016), a clean site exports in one click.
 */
export async function exportWebsite(page: Page): Promise<void> {
  await page.locator('[data-action="export"]').click();
  const confirm = page.getByTestId("export-confirm-button");
  await expect(confirm).toBeVisible();
  const phrase = page.getByTestId("export-confirm-input");
  if (await phrase.isVisible().catch(() => false)) {
    await phrase.fill("DOWNLOAD");
  }
  await confirm.click();
}
