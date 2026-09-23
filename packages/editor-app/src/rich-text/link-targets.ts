/**
 * The catalogue the link dialog searches: every Page and Article in the
 * project that prose can point at.
 *
 * Pure functions over `Site`, deliberately separate from the dialog, because
 * the interesting behaviour here is identity assignment and it is much
 * easier to reason about — and test — without a React tree around it.
 */

import { articlesOf, type RichTextLinkTarget, type Site } from "@sosb/schema";
import { articlePath, pagePath } from "@sosb/renderer";

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

  // The secondary line is the path a visitor would see, taken from the same
  // routing the Renderer uses rather than rebuilt here: a language home is
  // `/` whatever its slug, and a secondary-language Page or Article carries
  // its language segment.
  site.pages.forEach((page, index) => {
    if (page.lang !== lang) return;
    out.push({
      key: `page:${index}`,
      kind: "page",
      label: page.navLabel,
      hint: pagePath(site, page),
      lang: page.lang,
      isDraft: false,
      index,
    });
  });

  articlesOf(site).forEach((article, index) => {
    if (article.lang !== lang) return;
    out.push({
      key: `article:${index}`,
      kind: "article",
      label: article.title,
      hint: articlePath(site, article),
      lang,
      isDraft: article.state === "draft",
      index,
    });
  });

  return out;
}

/** Case- and diacritic-insensitive contains match, for the search box. */
export function matchesQuery(option: LinkTargetOption, query: string): boolean {
  const needle = fold(query);
  if (needle === "") return true;
  return fold(option.label).includes(needle) || fold(option.hint).includes(needle);
}

function fold(value: string): string {
  // Strip combining diacritical marks (U+0300–U+036F) after NFD, so "ș"
  // and "s" compare equal.
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
    // Articles carry a permanent id from creation (issue #97), so there is
    // nothing to assign — only to read.
    const article = articlesOf(site)[option.index];
    return { site, target: { kind: "article", articleId: article?.id ?? "" } };
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
