/**
 * Navigation helpers for tests that drive the whole `<EditorApp>`.
 *
 * The builder opens into the content Overview (issue #102), so a test that
 * wants a Block list, a preview or the site spine has to go somewhere first —
 * the same clicks an author makes. Keeping them here means a change to the
 * navigation is one edit, not forty.
 */
import { fireEvent } from "@testing-library/react";

export type NavSection = "overview" | "pages" | "articles" | "theme" | "settings";

/** Click a main-navigation entry. */
export function openSection(container: HTMLElement, section: NavSection): void {
  const item = container.querySelector<HTMLButtonElement>(`[data-testid="nav-${section}"]`);
  if (item === null) throw new Error(`main navigation has no "${section}" entry`);
  fireEvent.click(item);
}

/** Open the workspace for the page at `index` in `site.pages`. */
export function openPage(container: HTMLElement, index = 0): void {
  openSection(container, "pages");
  const select = container.querySelector<HTMLButtonElement>(
    `[data-testid="pages-list"] [data-action="select"][data-index="${index}"]`,
  );
  if (select === null) throw new Error(`the Pages list has no page at index ${index}`);
  fireEvent.click(select);
}

/** Open the workspace for an Article by id. */
export function openArticle(container: HTMLElement, articleId: string): void {
  openSection(container, "articles");
  const open = container.querySelector<HTMLButtonElement>(
    `[data-testid="article-open-${articleId}"]`,
  );
  if (open === null) throw new Error(`the Articles list has no article "${articleId}"`);
  fireEvent.click(open);
}

/** Set `window.innerWidth` and tell the shell about it. */
export function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}
