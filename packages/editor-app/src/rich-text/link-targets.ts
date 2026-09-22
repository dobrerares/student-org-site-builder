/**
 * The catalogue the link dialog searches: every Page and Article in the
 * project that prose can point at.
 *
 * Pure functions over `Site`, deliberately separate from the dialog, because
 * the interesting behaviour here is identity assignment and it is much
 * easier to reason about — and test — without a React tree around it.
 */

import type { RichTextLinkTarget, Site } from "@sosb/schema";

export interface LinkTargetOption {
  /** Stable key for list rendering; not the stored identity. */
  readonly key: string;
  readonly kind: "page" | "article";
  readonly label: string;
  /** Secondary line: the URL the visitor would see. */
  readonly hint: string;
  readonly lang: string;
  /** True for Draft Articles — selectable, but warned about. */
  readonly isDraft: boolean;
  /** Index into `site.pages` / `site.articles`. */
  readonly index: number;
}

/**
 * List the link targets for a language, Pages first then Articles, each in
 * the order the author sees them elsewhere in the editor.
 *
 * Drafts are included on purpose. Issue #100: "Selecting a Draft target
 * warns the author" — it does not forbid them, because linking ahead of
 * publication is a normal way to work.
 */
export function linkTargetsFor(site: Site, lang: string): LinkTargetOption[] {
  const out: LinkTargetOption[] = [];

  site.pages.forEach((page, index) => {
    if (page.lang !== lang) return;
    out.push({
      key: `page:${index}`,
      kind: "page",
      label: page.navLabel,
      hint: page.slug === "" ? "/" : `/${page.slug}/`,
      lang: page.lang,
      isDraft: false,
      index,
    });
  });

  const articles = (site as { articles?: unknown }).articles;
  if (Array.isArray(articles)) {
    articles.forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null) return;
      const article = entry as { lang?: unknown; title?: unknown; slug?: unknown; state?: unknown };
      if (article.lang !== lang) return;
      const slug = typeof article.slug === "string" ? article.slug : "";
      out.push({
        key: `article:${index}`,
        kind: "article",
        label: typeof article.title === "string" ? article.title : slug,
        hint: `/articles/${slug}/`,
        lang,
        isDraft: article.state === "draft",
        index,
      });
    });
  }

  return out;
}

/** Case- and diacritic-insensitive contains match, for the search box. */
export function matchesQuery(option: LinkTargetOption, query: string): boolean {
  const needle = fold(query);
  if (needle === "") return true;
  return fold(option.label).includes(needle) || fold(option.hint).includes(needle);
}

function fold(value: string): string {
  return value.toLocaleLowerCase("ro").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Turn a chosen option into the target the document will store, assigning a
 * permanent Page id if that Page does not have one yet.
 *
 * Lazy assignment is what lets `Page.id` be optional. ADR 0002 forbids
 * inventing fields when a project is merely opened, so the id is stamped at
 * the first moment it actually means something: when an author links at the
 * Page. Returns the (possibly updated) Site alongside the target so the
 * caller commits both in one edit — an id that is not saved is worse than
 * no id at all.
 */
export function resolveTarget(
  site: Site,
  option: LinkTargetOption,
  nextId: () => string,
): { site: Site; target: RichTextLinkTarget } {
  if (option.kind === "article") {
    const articles = (site as { articles?: unknown[] }).articles ?? [];
    const article = articles[option.index] as { id?: unknown } | undefined;
    const id = typeof article?.id === "string" ? article.id : "";
    return { site, target: { kind: "article", articleId: id } };
  }

  const page = site.pages[option.index];
  if (page === undefined) return { site, target: { kind: "page", pageId: "" } };
  if (typeof page.id === "string" && page.id.length > 0) {
    return { site, target: { kind: "page", pageId: page.id } };
  }

  const id = nextId();
  const pages = site.pages.map((entry, index) =>
    index === option.index ? { ...entry, id } : entry,
  );
  return { site: { ...site, pages }, target: { kind: "page", pageId: id } };
}

/**
 * Mint a Page id that no Page in this project already uses.
 *
 * Deterministic and collision-checked rather than random: project files are
 * diffed and reviewed by hand, and `page_3` reads better than a UUID in a
 * document an author may one day open in a text editor.
 */
export function makePageIdFactory(site: Site): () => string {
  const used = new Set<string>();
  for (const page of site.pages) {
    if (typeof page.id === "string") used.add(page.id);
  }
  let counter = 1;
  return () => {
    let candidate = `page_${counter}`;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `page_${counter}`;
    }
    used.add(candidate);
    counter += 1;
    return candidate;
  };
}
