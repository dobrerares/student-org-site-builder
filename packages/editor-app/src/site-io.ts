/**
 * Browser-side zip import/export helpers for the editor shell.
 *
 * Host shells can still override `onImport` / `onExport` on `<EditorApp>` for
 * native dialogs (Electron). When those props are omitted, the editor uses
 * these helpers: a hidden `<input type="file">` for import and a programmatic
 * `<a download>` for export.
 */
import type { Vfs } from "@sosb/vfs/vfs";

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  avif: "image/avif",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml",
  txt: "text/plain",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

/**
 * Open the OS file picker filtered to `.zip` archives. Returns `null` when the
 * user cancels.
 */
export function pickZipBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.style.display = "none";
    const cleanup = (): void => {
      input.remove();
    };
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        cleanup();
        resolve(file ?? null);
      },
      { once: true },
    );
    input.addEventListener(
      "cancel",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}

/** Trigger a download of `blob` as `filename` in the current browser context. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Derive a filesystem-safe export basename from the org name, falling back to
 * `site` when the name is empty or only punctuation.
 */
export function exportZipBasename(orgName: string): string {
  const slug = orgName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "site";
}

/**
 * The VFS subtrees a project archive carries, and which the editor therefore
 * has to move wholesale when one Site replaces another.
 *
 * `themes/` is here for the same reason `assets/` is: an imported Theme
 * package travels *inside* the archive (ADR 0051 / the issue-106 plan), so
 * that a recipient can open the project offline and see the design it was
 * authored with. Copying only `assets/` on import silently dropped the Theme
 * and the reopened Site reported its own design as missing.
 */
export const SITE_VFS_PREFIXES: readonly string[] = ["assets/", "themes/", "themes-recovery/"];

/**
 * Copy every `assets/...`, `themes/...` and `themes-recovery/...` entry from
 * `source` into `target`, overwriting paths that already exist in `target`.
 */
export async function mergeAssetVfs(source: Vfs, target: Vfs): Promise<void> {
  for (const prefix of SITE_VFS_PREFIXES) {
    for (const path of await source.list(prefix)) {
      await target.write(path, await source.read(path));
    }
  }
}

/**
 * Clear and repopulate the editor display URL cache from asset bytes in `vfs`.
 * Keys are content hashes (`assets/<hash>.<ext>` -> `hash`).
 */
export async function populateAssetDisplayUrls(
  vfs: Vfs,
  cache: Map<string, string>,
): Promise<void> {
  for (const url of cache.values()) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
  cache.clear();

  for (const path of await vfs.list("assets/")) {
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === undefined) continue;
    const mime = MIME_BY_EXTENSION[ext];
    if (mime === undefined) continue;
    const hash = path.slice("assets/".length, path.length - ext.length - 1);
    const bytes = await vfs.read(path);
    cache.set(hash, URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime })));
  }
}

/** Back-compat alias for tests/callers that only care about image thumbnails. */
export const populateImageDisplayUrls = populateAssetDisplayUrls;

/**
 * The MIME type the display-URL cache would give a canonical `assets/...`
 * path, or `undefined` for an extension the editor does not preview. Shared
 * with the interactive preview so its `data:` URLs carry the same types as
 * the static preview's `blob:` URLs.
 */
export function assetMimeForPath(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === undefined) return undefined;
  return MIME_BY_EXTENSION[ext];
}

/**
 * The content hash embedded in a canonical `assets/<hash>.<ext>` path.
 *
 * The hash *is* the asset's identity — the display-URL cache above is keyed by
 * it, and so is the pipeline's dedupe. That makes it the synchronous answer to
 * "does this project still hold the bytes behind this reference?", which
 * validation needs for ADR 0048's missing-image-bytes blocker.
 *
 * Paths that are not asset paths come back unchanged, which is harmless: they
 * simply miss in every hash-keyed lookup.
 */
export function assetHashFromPath(path: string): string {
  const filename = path.startsWith("assets/") ? path.slice("assets/".length) : path;
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(0, dot) : filename;
}
