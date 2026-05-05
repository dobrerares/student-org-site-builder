import type { Page, Site } from "@sosb/schema";

/**
 * Multi-page URL/slug strategy.
 *
 * Per the PRD (§ 195) and ADR 0007, slugs are flat — no nested hierarchy in
 * v1. The page at `navOrder: 0` in the site's `defaultLanguage` is the home
 * page; it is mapped to `/` rather than `/<slug>/`. Every other page is
 * mapped to `/<slug>/`.
 *
 * Within each language, slugs are unique (the schema validator enforces
 * this). Two pages from different languages may share a slug. v1 accepts the
 * resulting path collision because i18n URL trees are #24's territory; the
 * fixtures and demos use language-distinct slugs (`acasa` / `home`,
 * `despre` / `about`) to side-step the collision in practice.
 *
 * The renderer and the build pipeline both consume these helpers so the
 * "nav links here" and "emit file at this path" decisions stay in sync.
 */

/**
 * Pick the home page index — the first page in the site's default language
 * with `navOrder: 0`. If no `navOrder: 0` page exists in the default
 * language, fall back to the first page declared. The schema does not
 * enforce a specific home discipline; the editor's add-page flow is what
 * keeps the navOrder:0 invariant in practice.
 */
export function homePageIndex(site: Site): number {
  const candidate = site.pages.findIndex(
    (p) => p.lang === site.defaultLanguage && p.navOrder === 0,
  );
  if (candidate !== -1) return candidate;
  return 0;
}

/**
 * Map a `Page` to its URL path (always starts with `/`, always ends with `/`).
 *
 * The home page (default-language, navOrder:0) maps to `/`. Every other page
 * maps to `/<slug>/`. The trailing slash makes the relationship between
 * `dist/<slug>/index.html` and the URL one-to-one — no special-casing in
 * `<a href>` resolution.
 */
export function pagePath(site: Site, page: Page): string {
  const homeIdx = homePageIndex(site);
  const home = site.pages[homeIdx];
  if (home !== undefined && page.slug === home.slug && page.lang === home.lang) {
    return "/";
  }
  return `/${page.slug}/`;
}

/**
 * The dist-folder relative path where a page is emitted.
 *
 * Home → `index.html`. Every other page → `<slug>/index.html`. Always
 * POSIX-style and always relative (no leading `/`), to match the
 * `Map<string, string>` keys the build pipeline already uses.
 */
export function pageDistPath(site: Site, page: Page): string {
  const homeIdx = homePageIndex(site);
  const home = site.pages[homeIdx];
  if (home !== undefined && page.slug === home.slug && page.lang === home.lang) {
    return "index.html";
  }
  return `${page.slug}/index.html`;
}

/**
 * Pages that belong in the navigation for the given page's language.
 *
 * Filtering rules (per PRD § 64-67 and AC):
 *   - Same `lang` as the active page (cross-language nav is the language
 *     switcher's job, owned by #24).
 *   - `showInNav: true` (utility pages opt out of the menu — PRD § 65).
 *   - Sorted by `navOrder` ascending; ties broken by `pages[]` order, so
 *     repeated builds stay deterministic.
 *
 * If the result has fewer than 2 pages, the renderer hides the nav entirely
 * (single-page UX preserved).
 */
export function navPagesFor(site: Site, activePage: Page): Page[] {
  return site.pages
    .map((page, idx) => ({ page, idx }))
    .filter(({ page }) => page.lang === activePage.lang && page.showInNav === true)
    .sort((a, b) => {
      if (a.page.navOrder !== b.page.navOrder) {
        return a.page.navOrder - b.page.navOrder;
      }
      return a.idx - b.idx;
    })
    .map(({ page }) => page);
}
