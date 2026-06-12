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
 * Copy every `assets/...` entry from `source` into `target`, overwriting paths
 * that already exist in `target`.
 */
export async function mergeAssetVfs(source: Vfs, target: Vfs): Promise<void> {
  for (const path of await source.list("assets/")) {
    await target.write(path, await source.read(path));
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
