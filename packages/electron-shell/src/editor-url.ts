/**
 * Resolve the URL the BrowserWindow loads for the editor app.
 *
 * - Packaged: a `file://` URL pointing at the bundled renderer's
 *   `index.html`. The caller (main.ts) supplies the absolute renderer
 *   root; that root is wired up by electron-builder's `extraResources` /
 *   `files` config so the renderer ends up next to the main bundle.
 * - Dev: an `http://localhost:<port>` URL served by the editor app's
 *   vite dev server. The default port is vite's default (5173); a
 *   `devServerUrl` override is honoured for CI / non-default setups.
 */

export interface ResolveEditorUrlOpts {
  readonly isPackaged: boolean;
  readonly rendererRoot?: string;
  readonly devServerUrl?: string;
}

const DEFAULT_DEV_SERVER_URL = "http://localhost:5173/";

export function resolveEditorUrl(opts: ResolveEditorUrlOpts): string {
  if (opts.isPackaged) {
    if (!opts.rendererRoot) {
      throw new Error("resolveEditorUrl: packaged build requires `rendererRoot`");
    }
    // Build a `file://` URL that's portable across platforms (Windows
    // backslashes vs. POSIX forward slashes).
    const rootUrl = pathToFileUrl(opts.rendererRoot);
    return `${rootUrl.replace(/\/$/, "")}/index.html`;
  }
  return opts.devServerUrl ?? DEFAULT_DEV_SERVER_URL;
}

function pathToFileUrl(absolutePath: string): string {
  // Replace Windows separators, ensure leading slash.
  let normalised = absolutePath.replace(/\\/g, "/");
  if (!normalised.startsWith("/")) {
    normalised = `/${normalised}`;
  }
  return `file://${normalised}`;
}
