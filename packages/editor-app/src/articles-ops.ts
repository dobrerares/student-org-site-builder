/**
 * Pure helpers for the editor's Article and Article-tag mutations.
 *
 * Framework-free on purpose: the navigation redesign (issue #102) will re-home
 * the Articles UI, and these operations should survive that move untouched.
 * They are also the only place that knows how a new Article is seeded, how a
 * slug edit becomes redirect history, and what deleting a tag has to clean up.
 */
import type { Article, ArticleTag, BlockEnvelope, Site } from "@sosb/schema";
import {
  RICH_TEXT_BLOCK_VERSION,
  emptyRichTextDocument,
  isValidSlug,
  normalizeTagLabel,
} from "@sosb/schema";

/** Romanian diacritics folded to ASCII, matching the slug rules in `@sosb/schema`. */
const DIACRITIC_FOLD: Record<string, string> = {
  ă: "a",
  â: "a",
  î: "i",
  ș: "s",
  ş: "s",
  ț: "t",
  ţ: "t",
};

/**
 * Derive a URL slug from a title.
 *
 * Only ever called when an Article is created. ADR 0047 keeps the slug stable
 * across later title edits, because changing it silently would either break
 * shared links or quietly grow redirect history the author never asked for.
 */
export function slugifyTitle(title: string): string {
  const folded = title
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (ch) => DIACRITIC_FOLD[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const slug = folded
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "articol";
}

function highestSuffix(prefix: string, values: Iterable<string>): number {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const value of values) {
    const match = pattern.exec(value);
    if (match?.[1] === undefined) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Every Article id mentioned anywhere in the Site, including dangling references. */
function allReferencedArticleIds(site: Site): Set<string> {
  const ids = new Set<string>();
  for (const article of site.articles ?? []) {
    ids.add(article.id);
    for (const id of article.relatedArticles?.articleIds ?? []) ids.add(id);
  }
  const blockLists = [
    ...site.pages.flatMap((page) => page.blocks),
    ...(site.articles ?? []).flatMap((article) => article.blocks),
  ];
  for (const block of blockLists) {
    if (block.type !== "articleList") continue;
    const selected = (block.data as { articleIds?: unknown }).articleIds;
    if (!Array.isArray(selected)) continue;
    for (const id of selected) if (typeof id === "string") ids.add(id);
  }
  return ids;
}

/**
 * The next free permanent Article id.
 *
 * Deliberately counts ids that are *referenced* as well as ids that exist, so a
 * deleted Article's id is never handed to a new one while anything still points
 * at it. ADR 0047 is explicit that replacement content must not inherit a
 * deleted Article's references; reusing the id would do exactly that.
 */
export function nextArticleId(site: Site): string {
  return `art_${highestSuffix("art_", allReferencedArticleIds(site)) + 1}`;
}

/** The next free tag id, counting referenced ids for the same reason. */
export function nextTagId(site: Site): string {
  const ids = new Set<string>();
  for (const tag of site.tags ?? []) ids.add(tag.id);
  for (const article of site.articles ?? []) {
    for (const id of article.tags ?? []) ids.add(id);
    for (const id of article.relatedArticles?.tags ?? []) ids.add(id);
  }
  for (const block of [
    ...site.pages.flatMap((page) => page.blocks),
    ...(site.articles ?? []).flatMap((article) => article.blocks),
  ]) {
    if (block.type !== "articleList") continue;
    const tags = (block.data as { tags?: unknown }).tags;
    if (!Array.isArray(tags)) continue;
    for (const id of tags) if (typeof id === "string") ids.add(id);
  }
  return `tag_${highestSuffix("tag_", ids) + 1}`;
}

/**
 * Slugs that are unavailable in `lang`: every Article's current slug plus every
 * reserved historical slug. History stays reserved while the Article exists,
 * even as a Draft (ADR 0047).
 */
export function reservedSlugsFor(site: Site, lang: string, exceptArticleId?: string): Set<string> {
  const taken = new Set<string>();
  for (const article of site.articles ?? []) {
    if (article.lang !== lang) continue;
    if (article.id === exceptArticleId) continue;
    taken.add(article.slug);
    for (const old of article.slugHistory ?? []) taken.add(old);
  }
  return taken;
}

/** Append `-2`, `-3`, … until the slug is free in its language. */
export function uniqueArticleSlug(
  site: Site,
  lang: string,
  desired: string,
  exceptArticleId?: string,
): string {
  const taken = reservedSlugsFor(site, lang, exceptArticleId);
  const base = isValidSlug(desired) ? desired : "articol";
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export interface CreateArticleInput {
  readonly title: string;
  /** Content language. The editor passes the current content language. */
  readonly lang: string;
  /** Today's date as `YYYY-MM-DD`. Injected so these helpers stay pure. */
  readonly today: string;
}

/**
 * Create a Draft Article and return the new Site plus the new Article's id.
 *
 * Seeded exactly as issue #102 specifies: a title and one Rich-text Block, so
 * the author lands in a writable document rather than an empty shell. State is
 * always Draft — nothing reaches the public Site by accident.
 */
export function createArticle(
  site: Site,
  input: CreateArticleInput,
): { site: Site; articleId: string } {
  const id = nextArticleId(site);
  const slug = uniqueArticleSlug(site, input.lang, slugifyTitle(input.title));
  const body: BlockEnvelope = {
    id: `blk_${id}_body`,
    type: "richText",
    version: RICH_TEXT_BLOCK_VERSION,
    // An empty structured document (ADR 0048), not a Markdown string: the
    // Block is created at the current version, so no migration will ever
    // run over it to convert a legacy shape.
    data: { doc: emptyRichTextDocument() },
  };
  const article: Article = {
    id,
    lang: input.lang,
    slug,
    title: input.title,
    publishedAt: input.today,
    state: "draft",
    blocks: [body],
  };
  return { site: { ...site, articles: [...(site.articles ?? []), article] }, articleId: id };
}

/** Apply a partial update to one Article by index. */
export function updateArticle(site: Site, index: number, patch: Partial<Article>): Site {
  const articles = site.articles ?? [];
  const current = articles[index];
  if (current === undefined) return site;
  const next = articles.slice();
  next[index] = { ...current, ...patch };
  return { ...site, articles: next };
}

/**
 * Change an Article's slug, retiring the old one into `slugHistory`.
 *
 * The old URL keeps working (the build emits a redirect stub) and stays
 * reserved against other Articles for as long as this one exists. A no-op
 * change, or one colliding with a reserved slug, leaves the Site untouched so
 * the caller can surface the conflict without a half-applied edit.
 */
export function setArticleSlug(
  site: Site,
  index: number,
  desired: string,
): { site: Site; error?: "invalid" | "taken" } {
  const articles = site.articles ?? [];
  const current = articles[index];
  if (current === undefined) return { site };
  if (desired === current.slug) return { site };
  if (!isValidSlug(desired)) return { site, error: "invalid" };
  if (reservedSlugsFor(site, current.lang, current.id).has(desired)) {
    return { site, error: "taken" };
  }
  const history = current.slugHistory ?? [];
  const nextHistory = history.includes(current.slug) ? history : [...history, current.slug];
  return {
    site: updateArticle(site, index, { slug: desired, slugHistory: nextHistory }),
  };
}

/**
 * Delete an Article permanently.
 *
 * Its URLs are released for reuse and its references are NOT rewritten:
 * selections pointing at it become validation errors the author resolves
 * explicitly, which is the behaviour ADR 0047 chose over silently editing
 * lists the author configured.
 */
export function deleteArticle(site: Site, index: number): Site {
  const articles = site.articles ?? [];
  if (index < 0 || index >= articles.length) return site;
  const next = articles.slice();
  next.splice(index, 1);
  return { ...site, articles: next };
}

/**
 * Create a translation counterpart of an Article in `targetLang`.
 *
 * The counterpart starts as a Draft with the source's Blocks copied as
 * translation-ready placeholders, and both ends share a `translationGroup`. A
 * shared group id is used rather than pairwise links so the relationship cannot
 * end up half-written.
 */
export function addArticleTranslation(
  site: Site,
  index: number,
  targetLang: string,
  today: string,
): { site: Site; articleId?: string } {
  const articles = site.articles ?? [];
  const source = articles[index];
  if (source === undefined) return { site };
  if (!site.languages.includes(targetLang)) return { site };
  if (targetLang === source.lang) return { site };

  const group = source.translationGroup ?? `grp_${source.id}`;
  if (articles.some((a) => a.translationGroup === group && a.lang === targetLang)) {
    return { site };
  }

  const id = nextArticleId(site);
  const slug = uniqueArticleSlug(site, targetLang, source.slug);
  const counterpart: Article = {
    ...structuredClone(source),
    id,
    lang: targetLang,
    slug,
    state: "draft",
    publishedAt: today,
    translationGroup: group,
    blocks: structuredClone(source.blocks).map((block, i) => ({
      ...block,
      id: `blk_${id}_${i}`,
    })),
  };
  // The counterpart is a brand-new Article at a brand-new URL, so it inherits
  // no redirect history from the source. Dropped rather than set to `[]` so an
  // untouched project stays byte-identical on round-trip (ADR 0002).
  delete (counterpart as { slugHistory?: unknown }).slugHistory;

  const withGroup = articles.map((a, i) => (i === index ? { ...a, translationGroup: group } : a));
  return { site: { ...site, articles: [...withGroup, counterpart] }, articleId: id };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/**
 * Find an existing tag whose label matches, ignoring case and surrounding
 * whitespace. Issue #98 treats those as the same tag while preserving the
 * author's chosen capitalisation for display.
 */
export function findTagByLabel(site: Site, label: string): ArticleTag | undefined {
  const normalized = normalizeTagLabel(label);
  return (site.tags ?? []).find((tag) => normalizeTagLabel(tag.label) === normalized);
}

/**
 * Create a tag, or return the existing one when the label is a duplicate.
 * Inline creation from Article settings and from list configuration both land
 * here, so neither can produce a near-duplicate the other would then offer.
 */
export function createTag(site: Site, label: string): { site: Site; tagId: string } {
  const trimmed = label.trim();
  const existing = findTagByLabel(site, trimmed);
  if (existing !== undefined) return { site, tagId: existing.id };
  const id = nextTagId(site);
  return { site: { ...site, tags: [...(site.tags ?? []), { id, label: trimmed }] }, tagId: id };
}

/** Rename a tag. Associations and configured filters are untouched by design. */
export function renameTag(
  site: Site,
  tagId: string,
  label: string,
): { site: Site; error?: "duplicate" | "empty" } {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { site, error: "empty" };
  const clash = findTagByLabel(site, trimmed);
  if (clash !== undefined && clash.id !== tagId) return { site, error: "duplicate" };
  return {
    site: {
      ...site,
      tags: (site.tags ?? []).map((tag) => (tag.id === tagId ? { ...tag, label: trimmed } : tag)),
    },
  };
}

export interface TagUsage {
  /** Titles of Articles carrying the tag. */
  readonly articleTitles: readonly string[];
  /** Human labels of lists filtering on the tag. */
  readonly listLabels: readonly string[];
  /**
   * Lists where this is the only selected tag, so removing it flips them from
   * "these tags" to "every eligible article". Issue #98 requires warning about
   * this specifically — it is the one case where deleting a tag makes a list
   * show *more*, not less.
   */
  readonly listsBecomingUnfiltered: readonly string[];
}

function listLabelFor(data: Record<string, unknown>, fallback: string): string {
  const title = data.title;
  return typeof title === "string" && title.length > 0 ? title : fallback;
}

/** What a tag deletion would affect, for the confirmation dialog. */
export function tagUsage(site: Site, tagId: string): TagUsage {
  const articleTitles: string[] = [];
  const listLabels: string[] = [];
  const listsBecomingUnfiltered: string[] = [];

  for (const article of site.articles ?? []) {
    if ((article.tags ?? []).includes(tagId)) articleTitles.push(article.title);
  }

  const visit = (data: Record<string, unknown>, fallback: string): void => {
    const tags = data.tags;
    if (!Array.isArray(tags) || !tags.includes(tagId)) return;
    const label = listLabelFor(data, fallback);
    listLabels.push(label);
    if (tags.length === 1) listsBecomingUnfiltered.push(label);
  };

  for (const page of site.pages) {
    for (const block of page.blocks) {
      if (block.type !== "articleList") continue;
      visit(block.data as Record<string, unknown>, page.navLabel);
    }
  }
  for (const article of site.articles ?? []) {
    for (const block of article.blocks) {
      if (block.type !== "articleList") continue;
      visit(block.data as Record<string, unknown>, article.title);
    }
  }
  for (const article of site.articles ?? []) {
    const related = article.relatedArticles;
    if (related === undefined) continue;
    visit(related as unknown as Record<string, unknown>, article.title);
  }

  return { articleTitles, listLabels, listsBecomingUnfiltered };
}

function withoutTag(tags: readonly string[] | undefined, tagId: string): string[] | undefined {
  if (tags === undefined) return undefined;
  const next = tags.filter((id) => id !== tagId);
  return next.length === tags.length ? (tags as string[]) : next;
}

/**
 * Delete a tag and scrub every reference to it: Article associations, list
 * filters, and Related Articles filters. Issue #98 requires the cleanup so a
 * deleted tag can never linger as an invisible filter nobody can edit.
 */
export function deleteTag(site: Site, tagId: string): Site {
  const scrubBlocks = (blocks: readonly BlockEnvelope[]): BlockEnvelope[] =>
    blocks.map((block) => {
      if (block.type !== "articleList") return block;
      const data = block.data as Record<string, unknown>;
      const tags = data.tags;
      if (!Array.isArray(tags) || !tags.includes(tagId)) return block;
      return { ...block, data: { ...data, tags: tags.filter((id) => id !== tagId) } };
    });

  return {
    ...site,
    tags: (site.tags ?? []).filter((tag) => tag.id !== tagId),
    pages: site.pages.map((page) => ({ ...page, blocks: scrubBlocks(page.blocks) })),
    articles: (site.articles ?? []).map((article) => {
      const next: Article = {
        ...article,
        blocks: scrubBlocks(article.blocks),
      };
      const tags = withoutTag(article.tags, tagId);
      if (tags !== undefined) next.tags = tags;
      if (article.relatedArticles !== undefined) {
        const relatedTags = withoutTag(article.relatedArticles.tags, tagId);
        next.relatedArticles =
          relatedTags === undefined
            ? article.relatedArticles
            : { ...article.relatedArticles, tags: relatedTags };
      }
      return next;
    }),
  };
}

// ---------------------------------------------------------------------------
// List filtering for the Articles panel
// ---------------------------------------------------------------------------

export interface ArticleFilters {
  readonly search: string;
  /** `""` means "all languages". */
  readonly lang: string;
  /** `""` means "all states". */
  readonly state: string;
  /** `""` means "all tags". */
  readonly tagId: string;
}

export const EMPTY_ARTICLE_FILTERS: ArticleFilters = {
  search: "",
  lang: "",
  state: "",
  tagId: "",
};

export interface ArticleRow {
  readonly article: Article;
  /** Index into `site.articles`, so callers can mutate the right entry. */
  readonly index: number;
}

/**
 * Rows for the Articles list: filtered, then sorted newest publication date
 * first with the title as a tie-break so the order never depends on array
 * position.
 */
export function filterArticles(site: Site, filters: ArticleFilters): ArticleRow[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  const rows = (site.articles ?? [])
    .map((article, index) => ({ article, index }))
    .filter(({ article }) => {
      if (filters.lang !== "" && article.lang !== filters.lang) return false;
      if (filters.state !== "" && article.state !== filters.state) return false;
      if (filters.tagId !== "" && !(article.tags ?? []).includes(filters.tagId)) return false;
      if (needle === "") return true;
      const haystack =
        `${article.title} ${article.summary ?? ""} ${article.slug}`.toLocaleLowerCase();
      return haystack.includes(needle);
    });
  return rows.sort((a, b) => {
    if (a.article.publishedAt !== b.article.publishedAt) {
      return a.article.publishedAt < b.article.publishedAt ? 1 : -1;
    }
    return a.article.title.localeCompare(b.article.title, "ro");
  });
}
