import { describe, expect, test } from "vitest";
import { resolveEditorUrl } from "../src/editor-url.js";

/**
 * AC: the Electron app launches the editor and runs the same code as the
 * browser version.
 *
 * The main process loads the editor via a single URL — the resolution of
 * which depends on whether the app is packaged or running in dev. We unit
 * test the resolution function so a regression in the URL choice (which
 * would silently load nothing or load the wrong window) is caught here.
 *
 * - Packaged → `file://` URL pointing at the bundled `index.html` inside
 *   the asar (or unpacked) renderer directory.
 * - Dev      → `http://localhost:<port>` from the editor-app's vite dev
 *   server, defaulting to 5173 (vite's default).
 */
describe("resolveEditorUrl", () => {
  test("packaged build resolves to a file:// URL pointing at index.html", () => {
    const url = resolveEditorUrl({
      isPackaged: true,
      rendererRoot: "/Applications/SOSB.app/Contents/Resources/renderer",
    });
    expect(url.startsWith("file://")).toBe(true);
    expect(url.endsWith("index.html")).toBe(true);
  });

  test("dev mode defaults to http://localhost:5173", () => {
    const url = resolveEditorUrl({ isPackaged: false });
    expect(url).toBe("http://localhost:5173/");
  });

  test("dev mode honours an explicit devServerUrl override", () => {
    const url = resolveEditorUrl({
      isPackaged: false,
      devServerUrl: "http://localhost:7000/",
    });
    expect(url).toBe("http://localhost:7000/");
  });

  test("packaged build URL is a valid URL the BrowserWindow can load", () => {
    const url = resolveEditorUrl({
      isPackaged: true,
      rendererRoot: "/some/abs/path/renderer",
    });
    // Spec-compliant URL parses without throwing.
    expect(() => new URL(url)).not.toThrow();
  });
});
