/**
 * Pure helpers for the editor's pages-list mutations.
 *
 * Kept framework-free so unit tests can drive them without rendering Preact,
 * and so the same operations are reusable from a future block-list or
 * keyboard-shortcut surface.
 */
import type { BlockEnvelope, Page, Site } from "@sosb/schema";

/**
 * Add a brand-new page in the site's default language. The new page lands
 * at the end of `pages[]` with `navOrder` one greater than the current
 * maximum for that language. A starter hero block is included so the user
 * has something to render.
 */
export function addPage(site: Site, slug: string): Site {
  const lang = site.defaultLanguage;
  const langPages = site.pages.filter((p) => p.lang === lang);
  const maxOrder = langPages.reduce((max, p) => (p.navOrder > max ? p.navOrder : max), -1);
  const heroBlock: BlockEnvelope = {
    id: `blk_${slug.replace(/-/g, "_")}_hero`,
    type: "hero",
    version: 1,
    data: {
      title: slug,
    },
  };
  const newPage: Page = {
    slug,
    lang,
    navLabel: slug,
    navOrder: maxOrder + 1,
    showInNav: true,
    blocks: [heroBlock],
  };
  return {
    ...site,
    pages: [...site.pages, newPage],
  };
}

/**
 * Clone an existing page, giving it a new slug and a fresh block-id suffix
 * so id collisions don't leak between the source and the clone. The clone
 * lands immediately after the source page in `pages[]` with the next
 * navOrder for its language.
 */
export function clonePage(site: Site, sourceIndex: number, newSlug: string): Site {
  const source = site.pages[sourceIndex];
  if (source === undefined) {
    throw new Error(`clonePage: index ${sourceIndex} is out of range`);
  }
  const langPages = site.pages.filter((p) => p.lang === source.lang);
  const maxOrder = langPages.reduce((max, p) => (p.navOrder > max ? p.navOrder : max), -1);
  // Re-id every block in the clone so ARIA `aria-labelledby` references
  // stay unique across the site.
  const blockSuffix = newSlug.replace(/-/g, "_");
  const clonedBlocks: BlockEnvelope[] = source.blocks.map((b, i) => ({
    ...b,
    id: `${b.id}_${blockSuffix}_${i}`,
  }));
  const clone: Page = {
    ...source,
    slug: newSlug,
    navLabel: `${source.navLabel} (copy)`,
    navOrder: maxOrder + 1,
    blocks: clonedBlocks,
  };
  const next = [...site.pages];
  next.splice(sourceIndex + 1, 0, clone);
  return { ...site, pages: next };
}

/**
 * Delete a page by index. Refuses to delete the last page (a site must
 * always have at least one page per the schema).
 */
export function deletePage(site: Site, index: number): Site {
  if (site.pages.length <= 1) return site;
  if (index < 0 || index >= site.pages.length) return site;
  const next = site.pages.slice();
  next.splice(index, 1);
  return { ...site, pages: next };
}

/**
 * Move a page up or down in `pages[]` and re-number the affected language's
 * `navOrder` so the new order matches `pages[]` order.
 *
 * navOrder re-numbering is per-language: the home/order=0 contract for the
 * *default* language stays intact unless the editor explicitly moves the
 * default-language home page. (The editor's UI can guard that as a separate
 * affordance later — out of scope here.)
 */
export function movePage(site: Site, index: number, direction: "up" | "down"): Site {
  if (index < 0 || index >= site.pages.length) return site;
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= site.pages.length) return site;
  const reordered = site.pages.slice();
  const [a, b] = [reordered[index]!, reordered[swap]!];
  reordered[swap] = a;
  reordered[index] = b;
  // Renumber navOrder per-language to match the new pages[] order.
  const seen = new Map<string, number>();
  const renumbered: Page[] = reordered.map((page) => {
    const next = seen.get(page.lang) ?? 0;
    seen.set(page.lang, next + 1);
    return { ...page, navOrder: next };
  });
  return { ...site, pages: renumbered };
}
