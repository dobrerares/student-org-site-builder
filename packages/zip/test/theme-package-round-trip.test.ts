/**
 * A Theme package travels inside the editable Site archive.
 *
 * The issue-106 plan makes this a hard requirement: "a recipient must be able
 * to open the archive offline without finding and installing those packages
 * separately". The consequence for the zip layer is small but load-bearing —
 * `themes/<id>/...` has to survive export and import alongside `assets/`.
 *
 * The scenario under test is the hand-off: one organisation exports, another
 * imports offline and gets both the content and the design.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs/memory";
import {
  exportThemePackage,
  installThemePackageIntoVfs,
  installedThemeIds,
  loadThemePackageFromVfs,
} from "@sosb/theme-package";
import { loadThemePackageFromDirectoryAsync } from "@sosb/theme-package/node";
import type { ThemeBundle } from "@sosb/renderer";
import type { Site } from "@sosb/schema";
import { renderSite } from "@sosb/renderer";

import { exportToZip } from "../src/export.js";
import { importFromZip } from "../src/import.js";

const EXAMPLE_DIR = fileURLToPath(new URL("../../../examples/themes/practice", import.meta.url));
const HISTORIPOL_DATA = fileURLToPath(
  new URL("../../themes/src/templates/asociatia-studenteasca-demo/data.json", import.meta.url),
);

// The example ships a `render.js`, so the sandbox engine has to be up before
// the package can be loaded (ADR 0053) — hence the asynchronous loader.
const loadedExample = await loadThemePackageFromDirectoryAsync(EXAMPLE_DIR);

/** A bundle minus its live sandbox module, for structural equality checks. */
function comparable(bundle: ThemeBundle): Omit<ThemeBundle, "render"> & {
  design: { blockTypes: readonly string[]; hasShell: boolean } | undefined;
} {
  const { render, ...rest } = bundle;
  return {
    ...rest,
    design:
      render === undefined
        ? undefined
        : { blockTypes: render.blockTypes, hasShell: render.hasShell },
  };
}

function practiceSite(): Site {
  const site = JSON.parse(readFileSync(HISTORIPOL_DATA, "utf8")) as Site;
  site.theme = { id: loadedExample.bundle.id, version: loadedExample.bundle.version };
  return site;
}

async function siteVfsWithTheme(): Promise<MemoryDriver> {
  const vfs = new MemoryDriver();
  await installThemePackageIntoVfs(vfs, loadedExample);
  return vfs;
}

describe("Theme packages in the editable archive", () => {
  test("installing writes the package under themes/<id>/", async () => {
    const vfs = await siteVfsWithTheme();
    expect(await installedThemeIds(vfs)).toEqual(["org.example.practice"]);
    expect(await vfs.has("themes/org.example.practice/theme.json")).toBe(true);
    expect(await vfs.has("themes/org.example.practice/theme.css")).toBe(true);
  });

  test("export then import preserves the Theme and its files", async () => {
    const site = practiceSite();
    const vfs = await siteVfsWithTheme();

    const imported = await importFromZip(await exportToZip(site, vfs));

    expect(await installedThemeIds(imported.vfs)).toEqual(["org.example.practice"]);
    const reloaded = await loadThemePackageFromVfs(imported.vfs, "org.example.practice");
    expect(comparable(reloaded.bundle)).toEqual(comparable(loadedExample.bundle));
    // Every file, byte for byte — the design and the public script included.
    expect([...reloaded.files.keys()].sort()).toEqual([...loadedExample.files.keys()].sort());
    for (const [path, bytes] of loadedExample.files) {
      expect(reloaded.files.get(path)).toEqual(bytes);
    }
    reloaded.bundle.render?.dispose();
  });

  test("the recipient renders the same page the sender saw", async () => {
    const site = practiceSite();
    const vfs = await siteVfsWithTheme();

    const imported = await importFromZip(await exportToZip(site, vfs));
    const reloaded = await loadThemePackageFromVfs(imported.vfs, "org.example.practice");

    expect(renderSite(imported.siteData, reloaded.bundle.id, { theme: reloaded.bundle })).toBe(
      renderSite(site, loadedExample.bundle.id, { theme: loadedExample.bundle }),
    );
  });

  test("the built dist inside the archive carries the Theme's own files", async () => {
    const site = practiceSite();
    const vfs = await siteVfsWithTheme();
    const imported = await importFromZip(await exportToZip(site, vfs));
    // `importFromZip` keeps `assets/` and `themes/`; the built `dist/` lives in
    // the archive itself, so re-export and look inside it.
    const reExported = new Uint8Array(
      await (await exportToZip(imported.siteData, imported.vfs)).arrayBuffer(),
    );
    const text = new TextDecoder().decode(reExported);
    expect(text).toContain("assets/theme/org.example.practice");
    // The editable archive carries the whole package, render.js included;
    // the built Site inside it carries the public script and never the design
    // (ADR 0053).
    expect(text).toContain("themes/org.example.practice/render.js");
    expect(text).toContain("dist/assets/theme/org.example.practice/public.js");
    expect(text).not.toContain("dist/assets/theme/org.example.practice/render.js");
  });

  test("a standalone Theme export carries no Site content", async () => {
    const vfs = await siteVfsWithTheme();
    const loaded = await loadThemePackageFromVfs(vfs, "org.example.practice");
    const bytes = exportThemePackage(loaded);
    const text = new TextDecoder().decode(bytes);
    // The org name is all over the Site data and appears in no Theme file.
    expect(text).not.toContain("Asociația Studențească Demo");
    expect([...loaded.files.keys()].some((p) => p.startsWith("data.json"))).toBe(false);
  });
});
