/**
 * Exporting a standalone Theme package.
 *
 * Issue #107 asks "exactly what a standalone export includes so user Site
 * content is excluded". The answer here is structural rather than a filter:
 * the export writes back the files the *package* was loaded from, and a
 * package's file map never contained Site content in the first place. There is
 * no code path that could accidentally sweep `data.json` or an author's
 * uploads into a Theme export, because nothing in this module can see them.
 *
 * The bytes are deterministic — `ZipDriver` pins entry mtimes and sorts paths
 * — so exporting the same Theme twice produces identical archives and two
 * developers can diff a package meaningfully.
 */

import { ZipDriver } from "@sosb/vfs/zip-driver";
import type { Vfs } from "@sosb/vfs/vfs";
import {
  THEME_PACKAGE_EXTENSION,
  loadThemePackageFromVfs,
  type LoadedThemePackage,
} from "./load.js";

/** Suggested filename for a Theme package download. */
export function themePackageFilename(themeId: string, version: string): string {
  return `${themeId}-${version}${THEME_PACKAGE_EXTENSION}`;
}

/**
 * Serialise a loaded Theme package back to `.sosb-theme.zip` bytes.
 *
 * Round-trips byte-for-byte: `exportThemePackage(loadThemePackage(files))`
 * yields an archive that loads to an equal bundle, which is what makes
 * "import into Site A, export, import into Site B" a lossless hand-off.
 */
export function exportThemePackage(loaded: LoadedThemePackage): Uint8Array {
  const driver = new ZipDriver();
  // Writes are ordered for readability; `toZipBytes` sorts regardless.
  for (const path of [...loaded.files.keys()].sort()) {
    void driver.write(path, loaded.files.get(path)!);
  }
  return driver.toZipBytes();
}

/**
 * Export the Theme package installed at `themes/<id>/` in a Site's VFS.
 *
 * Re-loads (and therefore re-validates) before writing: a package that has
 * been on disk through an archive round trip should not be re-shared without
 * re-checking it, and an invalid one is better caught here than by the
 * recipient.
 */
export async function exportInstalledThemePackage(
  vfs: Vfs,
  themeId: string,
): Promise<{ bytes: Uint8Array; filename: string }> {
  // The VFS loader, not a private copy of it: it starts the render sandbox
  // before reading, so a package with a `render.js` re-validates here even
  // when this is the first Theme code the process has touched (ADR 0054).
  const loaded = await loadThemePackageFromVfs(vfs, themeId);
  try {
    return {
      bytes: exportThemePackage(loaded),
      filename: themePackageFilename(loaded.bundle.id, loaded.bundle.version),
    };
  } finally {
    // Re-loading compiled the package's `render.js` into its own sandbox
    // realm, which nothing will render through: release it (ADR 0054).
    loaded.bundle.render?.dispose();
  }
}
