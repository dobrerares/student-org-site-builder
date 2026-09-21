/**
 * Loading a Theme package into a renderable `ThemeBundle`.
 *
 * One function does the real work — `loadThemePackage(files)` over a flat
 * `path -> bytes` map — and the three entry points (zip bytes, a VFS subtree,
 * a directory on disk) are thin adapters onto it. That shape is deliberate:
 * a Theme imported from a `.sosb-theme.zip`, a Theme restored from a Site
 * archive's `themes/<id>/`, and a Theme read from `examples/themes/practice/`
 * during CI must all produce byte-identical bundles, or preview/export parity
 * becomes a function of how the Theme happened to arrive.
 */

import type { ThemeBundle, ThemeFontFace, ThemeVariant } from "@sosb/renderer";
import { ZipDriver } from "@sosb/vfs/zip-driver";
import type { Vfs } from "@sosb/vfs/vfs";
import { ThemePackageError } from "./errors.js";
import { assertThemeCssIsOffline, referencedLocalUrls } from "./css-safety.js";
import {
  THEME_FORMAT_VERSION,
  THEME_ID_RE,
  ThemeManifestSchema,
  type ThemeManifest,
} from "./manifest.js";

/** Manifest filename, at the package root. */
export const THEME_MANIFEST_FILE = "theme.json";

/** Conventional file extension for a standalone Theme package. */
export const THEME_PACKAGE_EXTENSION = ".sosb-theme.zip";

/** Where installed Theme packages live inside a Site's VFS (ADR 0051). */
export const THEME_VFS_PREFIX = "themes/";

/**
 * Generous ceiling on a Theme package's unpacked size. A Theme is CSS, a few
 * woff2 subsets and some decorative SVG/PNG; anything past this is either a
 * mistake (an un-subsetted font family, a raw photo library) or an attempt to
 * bloat the Site archive that carries it.
 */
export const THEME_PACKAGE_MAX_BYTES = 12 * 1024 * 1024;

const decoder = new TextDecoder("utf-8", { fatal: false });

/** A loaded package: the renderable bundle plus the manifest behind it. */
export interface LoadedThemePackage {
  readonly bundle: ThemeBundle;
  readonly manifest: ThemeManifest;
  /** Every file in the package, bundle-relative. Re-exported verbatim. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}

function readManifest(files: ReadonlyMap<string, Uint8Array>): ThemeManifest {
  const raw = files.get(THEME_MANIFEST_FILE);
  if (raw === undefined) {
    throw new ThemePackageError(
      "manifest-missing",
      `A Theme package must contain ${THEME_MANIFEST_FILE} at its root.`,
      THEME_MANIFEST_FILE,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(raw));
  } catch (cause) {
    throw new ThemePackageError(
      "manifest-missing",
      `${THEME_MANIFEST_FILE} is not valid JSON: ${(cause as Error).message}`,
      THEME_MANIFEST_FILE,
    );
  }

  // Check formatVersion *before* the full schema, so a future package gets
  // "this needs a newer builder" rather than a wall of field-level errors
  // about keys this builder has never heard of.
  const declared = (parsed as { formatVersion?: unknown } | null)?.formatVersion;
  if (typeof declared === "number" && declared !== THEME_FORMAT_VERSION) {
    throw new ThemePackageError(
      "format-version-unsupported",
      `This Theme package uses format version ${declared}, but this builder supports ` +
        `version ${THEME_FORMAT_VERSION}. Update the builder to use this Theme.`,
      "formatVersion",
    );
  }

  const result = ThemeManifestSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const at = first === undefined ? undefined : first.path.join(".");
    const detail =
      first === undefined ? "unknown validation failure" : `${at || "(root)"}: ${first.message}`;
    throw new ThemePackageError(
      "manifest-invalid",
      `${THEME_MANIFEST_FILE} is not a valid Theme manifest — ${detail}`,
      at,
    );
  }
  return result.data;
}

function toVariants(
  list: readonly { id: string; label: string; description?: string | undefined }[],
): ThemeVariant[] {
  return list.map((v) => ({ id: v.id, label: v.label, description: v.description }));
}

/**
 * Reject duplicate keys in a manifest list.
 *
 * A repeated variant id is not a harmless typo: the editor renders one option
 * per entry, so the author sees the same design twice and cannot tell which
 * one they picked, and the per-Theme variant memory (ADR 0051) keys on the id,
 * so the two entries are indistinguishable once saved. A repeated `@font-face`
 * key is the same story one layer down — the later rule silently wins and the
 * author's other file is dead weight in the package.
 */
function assertNoDuplicates(keys: readonly string[], what: string, at: string): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new ThemePackageError(
        "manifest-invalid",
        `${at} declares ${what} "${key}" more than once. Every entry must be distinct.`,
        at,
      );
    }
    seen.add(key);
  }
}

/** Every uniqueness rule the manifest schema cannot express on its own. */
function assertManifestIsConsistent(manifest: ThemeManifest): void {
  for (const [blockType, list] of Object.entries(manifest.variants)) {
    assertNoDuplicates(
      list.map((v) => v.id),
      "variant id",
      `variants.${blockType}`,
    );
  }
  assertNoDuplicates(
    manifest.shellVariants.map((v) => v.id),
    "shell variant id",
    "shellVariants",
  );
  assertNoDuplicates(
    manifest.fonts.map((f) => `${f.family} ${f.weight} ${f.style} ${f.unicodeRange ?? "*"}`),
    "font face",
    "fonts",
  );
}

/**
 * Build a `ThemeBundle` from a flat map of package files.
 *
 * Validation order matters: manifest, then referenced files, then CSS safety.
 * Each stage's errors are only meaningful once the previous stage passed, and
 * reporting the first real problem beats reporting ten downstream symptoms.
 */
export function loadThemePackage(files: ReadonlyMap<string, Uint8Array>): LoadedThemePackage {
  let total = 0;
  for (const [path, bytes] of files) {
    if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
      throw new ThemePackageError(
        "path-unsafe",
        `Package entry "${path}" escapes the package root.`,
        path,
      );
    }
    total += bytes.byteLength;
  }
  if (total > THEME_PACKAGE_MAX_BYTES) {
    throw new ThemePackageError(
      "package-too-large",
      `Theme package is ${Math.round(total / 1024)} KB unpacked, over the ` +
        `${Math.round(THEME_PACKAGE_MAX_BYTES / 1024)} KB limit. Subset the fonts and ` +
        `compress the images.`,
    );
  }

  const manifest = readManifest(files);
  assertManifestIsConsistent(manifest);

  const cssBytes = files.get(manifest.css);
  if (cssBytes === undefined) {
    throw new ThemePackageError(
      "file-missing",
      `The manifest names "${manifest.css}" as its stylesheet, but the package does not contain it.`,
      manifest.css,
    );
  }
  const css = decoder.decode(cssBytes);
  assertThemeCssIsOffline(css, manifest.css);

  // Fonts: every declared face must exist, or a weight silently falls back and
  // the design is subtly wrong in a way the author will not spot.
  const fontBytes = new Map<string, Uint8Array>();
  const faces: ThemeFontFace[] = [];
  for (const font of manifest.fonts) {
    const bytes = files.get(font.file);
    if (bytes === undefined) {
      throw new ThemePackageError(
        "file-missing",
        `Font "${font.family}" ${font.weight} names "${font.file}", which is not in the package.`,
        font.file,
      );
    }
    fontBytes.set(font.file, bytes);
    faces.push({
      family: font.family,
      weight: font.weight,
      style: font.style,
      file: font.file,
      unicodeRange: font.unicodeRange,
    });
  }

  // Decorative files the CSS references. The stylesheet itself and the font
  // files are excluded — fonts arrive through @font-face, not url() in the
  // author's own rules.
  const assets = new Map<string, Uint8Array>();
  for (const ref of referencedLocalUrls(css)) {
    const bytes = files.get(ref);
    if (bytes === undefined) {
      throw new ThemePackageError(
        "file-missing",
        `${manifest.css} references "${ref}", which is not in the package.`,
        ref,
      );
    }
    assets.set(ref, bytes);
  }
  const blockVariants: Record<string, readonly ThemeVariant[]> = {};
  for (const [blockType, list] of Object.entries(manifest.variants)) {
    blockVariants[blockType] = toVariants(list);
  }

  const bundle: ThemeBundle = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    origin: "package",
    css,
    baselineTokens: Object.entries(manifest.cssTokens).sort(([a], [b]) => a.localeCompare(b)),
    defaults: manifest.tokens as Readonly<Record<string, string>>,
    supports: {
      colors: manifest.supports.colors,
      fonts: manifest.supports.fonts,
      density: manifest.supports.density,
      radius: manifest.supports.radius,
    },
    blockVariants,
    shellVariants: toVariants(manifest.shellVariants),
    fontSource:
      faces.length === 0 ? { kind: "registry" } : { kind: "bundle", faces, bytes: fontBytes },
    assets,
  };

  return { bundle, manifest, files: new Map(files) };
}

/**
 * Load a standalone `.sosb-theme.zip`.
 *
 * Goes through `ZipDriver` rather than a raw unzip so that a Theme package
 * inherits the same entry-count, entry-size and total-size limits the Site
 * importer already applies to untrusted archives.
 */
export async function loadThemePackageFromZip(zipBytes: Uint8Array): Promise<LoadedThemePackage> {
  let driver: ZipDriver;
  try {
    driver = ZipDriver.fromZipBytes(zipBytes);
  } catch (cause) {
    throw new ThemePackageError(
      "path-unsafe",
      `Could not read the Theme package archive: ${(cause as Error).message}`,
    );
  }
  const files = new Map<string, Uint8Array>();
  for (const path of await driver.list()) {
    files.set(path, await driver.read(path));
  }
  return loadThemePackage(files);
}

/**
 * Load a Theme package that lives under `themes/<id>/` in a Site's VFS. This
 * is the path used when reopening an editable Site archive — the Theme
 * travels inside the archive (issue-106 plan), so reopening offline works
 * without the recipient installing anything.
 */
export async function loadThemePackageFromVfs(
  vfs: Vfs,
  themeId: string,
): Promise<LoadedThemePackage> {
  const prefix = `${THEME_VFS_PREFIX}${themeId}/`;
  const paths = await vfs.list(prefix);
  if (paths.length === 0) {
    throw new ThemePackageError(
      "manifest-missing",
      `No Theme package is installed at ${prefix}.`,
      prefix,
    );
  }
  const files = new Map<string, Uint8Array>();
  for (const path of paths) {
    files.set(path.slice(prefix.length), await vfs.read(path));
  }
  return loadThemePackage(files);
}

/**
 * Write a loaded package into a Site's VFS under `themes/<id>/`, so the next
 * archive export carries it. Returns the paths written.
 */
export async function installThemePackageIntoVfs(
  vfs: Vfs,
  loaded: LoadedThemePackage,
): Promise<string[]> {
  const prefix = `${THEME_VFS_PREFIX}${loaded.bundle.id}/`;
  // Remove any previous install of the same id first, so upgrading to a
  // version with fewer files cannot leave orphans behind that the next load
  // would happily pick up.
  for (const existing of await vfs.list(prefix)) {
    await vfs.delete(existing);
  }
  const written: string[] = [];
  for (const path of [...loaded.files.keys()].sort()) {
    const full = prefix + path;
    await vfs.write(full, loaded.files.get(path)!);
    written.push(full);
  }
  return written;
}

/** Remove an installed Theme package from a Site's VFS. */
export async function uninstallThemePackageFromVfs(vfs: Vfs, themeId: string): Promise<void> {
  for (const path of await vfs.list(`${THEME_VFS_PREFIX}${themeId}/`)) {
    await vfs.delete(path);
  }
}

/**
 * The ids of every Theme package installed in a Site's VFS, sorted.
 *
 * Directory names that are not well-formed Theme ids are ignored rather than
 * reported. This list is built from an untrusted archive's directory listing,
 * and it feeds straight back into path construction; requiring the same id
 * shape the manifest requires means a hand-crafted `themes/../…` entry can
 * never become a prefix we go on to read, write or delete under.
 */
export async function installedThemeIds(vfs: Vfs): Promise<string[]> {
  const ids = new Set<string>();
  for (const path of await vfs.list(THEME_VFS_PREFIX)) {
    const rest = path.slice(THEME_VFS_PREFIX.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) continue;
    const id = rest.slice(0, slash);
    if (THEME_ID_RE.test(id)) ids.add(id);
  }
  return [...ids].sort();
}
