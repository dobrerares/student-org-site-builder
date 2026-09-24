/**
 * `@sosb/theme-package` — the Theme package contract (ADR 0050).
 *
 * A Theme package is a `.sosb-theme.zip` (or an equivalent directory) holding
 * a `theme.json` manifest, a stylesheet, packaged fonts and decorative assets.
 * This package parses and validates one, turns it into the `ThemeBundle` the
 * renderer consumes, installs it into a Site's VFS so the editable archive
 * carries it, and exports it back out again without any Site content.
 *
 * Phase one is declarative — no executable code in a package. See
 * `docs/how-to-author-a-theme.md` for the authoring guide and the manifest
 * reference, and ADR 0050 for what phase two adds without a format break.
 *
 * The Node-only directory loader lives at `@sosb/theme-package/node`.
 */

export { ThemePackageError, isThemePackageError } from "./errors.js";
export type { ThemePackageErrorCode } from "./errors.js";

export {
  THEME_FORMAT_VERSION,
  THEME_ID_RE,
  THEME_NETWORK_HOST_RE,
  THEME_PATH_RE,
  THEME_VERSION_RE,
  ThemeManifestSchema,
} from "./manifest.js";
export type {
  ThemeManifest,
  ThemeManifestFont,
  ThemeManifestPublicScript,
  ThemeManifestVariant,
} from "./manifest.js";

export {
  RENDER_MODULE_MAX_BYTES,
  ThemeSandboxNotReadyError,
  compileThemeRenderModule,
  initThemeSandbox,
  themeSandboxReady,
} from "./sandbox.js";

export { assertThemeCssIsOffline, referencedLocalUrls } from "./css-safety.js";

export {
  THEME_MANIFEST_FILE,
  THEME_PACKAGE_EXTENSION,
  THEME_PACKAGE_MAX_BYTES,
  THEME_VFS_PREFIX,
  installThemePackageIntoVfs,
  installedThemeIds,
  loadInstalledThemePackages,
  loadThemePackage,
  loadThemePackageFromVfs,
  loadThemePackageFromZip,
  uninstallThemePackageFromVfs,
} from "./load.js";
export type { InstalledThemePackageReport, LoadedThemePackage } from "./load.js";

export { declaredCustomBlockTypes, loadCustomBlockDeclarations } from "./blocks.js";

export {
  THEME_RECOVERY_VFS_PREFIX,
  discardThemeRecoveryCopy,
  readThemeRecoveryCopy,
  restoreRecoveredBlocks,
  saveThemeRecoveryCopy,
  themeRecoveryIds,
} from "./recovery.js";
export type { ThemeRecoveryCopy } from "./recovery.js";

export { exportInstalledThemePackage, exportThemePackage, themePackageFilename } from "./export.js";
