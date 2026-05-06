/**
 * Centralised, security-first BrowserWindow options.
 *
 * Electron's documented secure defaults:
 *
 * - `nodeIntegration: false` — the renderer cannot `require("fs")`.
 * - `contextIsolation: true` — `window.sosb` (from preload) lives in a
 *   separate context; page scripts can't tamper with it.
 * - `sandbox: true` — the renderer process runs inside the OS sandbox.
 *
 * The preload script is the ONLY way the renderer can reach native APIs,
 * and the surface it exposes is locked to `PRELOAD_API_METHODS`.
 *
 * Reference: https://www.electronjs.org/docs/latest/tutorial/security
 */

export interface BuildBrowserWindowOpts {
  readonly preloadPath: string;
  readonly width?: number;
  readonly height?: number;
}

export interface BrowserWindowOptions {
  readonly width: number;
  readonly height: number;
  readonly webPreferences: {
    readonly preload: string;
    readonly nodeIntegration: false;
    readonly contextIsolation: true;
    readonly sandbox: true;
  };
}

export function buildBrowserWindowOptions(opts: BuildBrowserWindowOpts): BrowserWindowOptions {
  return {
    width: opts.width ?? 1280,
    height: opts.height ?? 800,
    webPreferences: {
      preload: opts.preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}
