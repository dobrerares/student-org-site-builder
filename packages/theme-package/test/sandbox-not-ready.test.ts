/**
 * A package with `render.js` cannot be loaded synchronously before the sandbox
 * engine is up, and the failure must be loud (ADR 0054).
 *
 * Its own file on purpose: vitest isolates module state per file, so this is
 * the one place `initThemeSandbox()` has provably not run.
 */

import { expect, test } from "vitest";
import { ThemeSandboxNotReadyError, loadThemePackage, themeSandboxReady } from "../src/index.js";

const enc = new TextEncoder();

function pkg(withRender: boolean): Map<string, Uint8Array> {
  const manifest = {
    formatVersion: 1,
    id: "org.example.notready",
    name: "Not ready",
    version: "1.0.0",
    builder: { formatVersion: 1 },
    css: "theme.css",
    ...(withRender ? { render: "render.js" } : {}),
  };
  const files = new Map<string, Uint8Array>();
  files.set("theme.json", enc.encode(JSON.stringify(manifest)));
  files.set("theme.css", enc.encode("body{}"));
  if (withRender) files.set("render.js", enc.encode("export default { blocks: {} }"));
  return files;
}

test("a synchronous load with render.js before initThemeSandbox() fails loudly", () => {
  expect(themeSandboxReady()).toBe(false);
  expect(() => loadThemePackage(pkg(true))).toThrow(ThemeSandboxNotReadyError);
  expect(() => loadThemePackage(pkg(true))).toThrow(/initThemeSandbox/);
});

test("a declarative package needs no engine and loads as before", () => {
  const { bundle } = loadThemePackage(pkg(false));
  expect(bundle.render).toBeUndefined();
  expect(bundle.publicScript).toBeUndefined();
});
