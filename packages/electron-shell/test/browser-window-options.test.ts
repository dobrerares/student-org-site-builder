import { describe, expect, test } from "vitest";
import {
  buildBrowserWindowOptions,
  type BrowserWindowOptions,
} from "../src/browser-window-options.js";

/**
 * AC (security): the BrowserWindow follows Electron's documented secure
 * defaults so the editor renderer cannot reach Node APIs except via the
 * preload's `contextBridge` surface.
 *
 * - `nodeIntegration` MUST be false.
 * - `contextIsolation` MUST be true.
 * - `sandbox` MUST be true.
 * - The preload script MUST be set to a path the caller provides.
 */
describe("buildBrowserWindowOptions", () => {
  const opts: BrowserWindowOptions = buildBrowserWindowOptions({
    preloadPath: "/abs/path/to/preload.js",
  });

  test("nodeIntegration is disabled", () => {
    expect(opts.webPreferences.nodeIntegration).toBe(false);
  });

  test("contextIsolation is enabled", () => {
    expect(opts.webPreferences.contextIsolation).toBe(true);
  });

  test("sandbox is enabled", () => {
    expect(opts.webPreferences.sandbox).toBe(true);
  });

  test("the preload path is wired through", () => {
    expect(opts.webPreferences.preload).toBe("/abs/path/to/preload.js");
  });

  test("a sensible default size is provided", () => {
    expect(opts.width).toBeGreaterThanOrEqual(1024);
    expect(opts.height).toBeGreaterThanOrEqual(600);
  });
});
