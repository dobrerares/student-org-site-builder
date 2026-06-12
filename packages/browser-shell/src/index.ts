/**
 * `@sosb/browser-shell` — host shell for the browser editor.
 *
 * Tracking issue: #38. ADR 0008 records the design.
 *
 * Public surface (v1):
 *
 * - `IndexedDbDriver` — a `@sosb/vfs.Vfs` driver backed by IndexedDB so the
 *   editor's auto-saved snapshot survives page reloads.
 * - `registerServiceWorker(opts)` — register the service worker that caches
 *   the SPA assets for offline use, with a "new version available" callback
 *   the host UI can hook for a reload toast.
 * - `serviceWorker` — the worker-side script (entry point) that implements
 *   the cache-then-network strategy with version-bump invalidation.
 * - `buildArchival(spa)` — the single-file archival build that inlines all
 *   JS, CSS, and assets into one HTML document runnable from `file://`.
 */

export { IndexedDbDriver, openIndexedDbDriver } from "./persistent-vfs/indexed-db-driver.js";
export { OpfsDriver, openOpfsDriver } from "./persistent-vfs/opfs-driver.js";
export {
  openPreferredPersistentVfs,
  type PreferredPersistentVfsOptions,
} from "./persistent-vfs/preferred.js";
export {
  registerServiceWorker,
  type ServiceWorkerHandle,
  type ServiceWorkerRegistrationOptions,
} from "./service-worker/register.js";
export {
  buildArchival,
  type ArchivalInput,
  type ArchivalOutput,
} from "./archival/build-archival.js";
export {
  buildServiceWorkerScript,
  type ServiceWorkerScriptOptions,
} from "./service-worker/script.js";
export { WelcomeShell, type WelcomeLoadedSite, type WelcomeShellProps } from "./welcome-shell.js";
export { WELCOME_SHELL_CSS, injectWelcomeShellCss } from "./welcome-shell-css.js";
