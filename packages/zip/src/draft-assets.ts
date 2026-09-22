/**
 * Draft-only asset detection for the public export.
 *
 * ADR 0047 requires that "Draft content and files used only by Draft articles
 * are excluded from the public export. The editable project archive retains
 * both." The two halves of an exported zip therefore diverge for the first
 * time: `assets/` (the editable archive) still holds everything, while `dist/`
 * (the deployable folder) must not carry bytes that only unfinished content
 * refers to.
 *
 * The rule implemented here is deliberately narrow — an asset is excluded only
 * when a Draft Article references it **and** nothing public does:
 *
 *  - An asset shared between a Draft and a published Page stays, because the
 *    published Page needs it.
 *  - An asset nothing references at all stays. Orphans are not a publication
 *    question, and silently dropping them would change long-standing export
 *    behaviour under cover of an unrelated feature.
 *
 * Detection walks the site data structurally rather than reading typed fields,
 * because `looseObject` round-trips mean an asset can hang off a key this
 * version of the code has never heard of. Anything shaped like an asset
 * reference — a string value under `path` or `metadataPath` beginning with
 * `assets/` — counts.
 */

const ASSET_PREFIX = "assets/";

/**
 * Asset paths referenced by Draft Articles and by nothing public.
 *
 * `siteData` is `unknown` for the same reason `exportToZip` takes it that way:
 * the export serialises the caller's object verbatim, without re-parsing, so
 * this must tolerate whatever shape actually arrived.
 */
export function draftOnlyAssetPaths(siteData: unknown): Set<string> {
  if (siteData === null || typeof siteData !== "object") return new Set();
  const site = siteData as Record<string, unknown>;

  const draft = new Set<string>();
  const published = new Set<string>();

  // Everything outside `articles` is public: Pages are always exported, and so
  // is the org spine (logo, etc.).
  for (const [key, value] of Object.entries(site)) {
    if (key === "articles") continue;
    collectAssetPaths(value, published);
  }

  const articles = site.articles;
  if (Array.isArray(articles)) {
    for (const entry of articles) {
      if (entry === null || typeof entry !== "object") continue;
      const state = (entry as { state?: unknown }).state;
      collectAssetPaths(entry, state === "draft" ? draft : published);
    }
  }

  const draftOnly = new Set<string>();
  for (const path of draft) {
    if (!published.has(path)) draftOnly.add(path);
  }
  return draftOnly;
}

function collectAssetPaths(value: unknown, into: Set<string>): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetPaths(item, into);
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "path" || key === "metadataPath") && typeof child === "string") {
      if (child.startsWith(ASSET_PREFIX)) into.add(child);
      continue;
    }
    collectAssetPaths(child, into);
  }
}
