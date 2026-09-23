import { MemoryDriver } from "@sosb/vfs/memory";
import { ZipDriver } from "@sosb/vfs/zip-driver";
import type { Vfs } from "@sosb/vfs/vfs";
import { build } from "@sosb/build";
import type { Site } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import { installedThemeIds, loadThemePackageFromVfs } from "@sosb/theme-package";

import { generateDeployMd, type DeployLanguage } from "./deploy-md.js";
import { draftOnlyAssetPaths } from "./draft-assets.js";

const enc = new TextEncoder();

/**
 * `data.json` is serialised with 2-space indent and trailing newline. The
 * formatting is part of the deterministic-export contract: change it and
 * the byte-identical round-trip test breaks until everyone re-exports.
 */
export const DATA_JSON_INDENT = 2;

/**
 * Serialise a site to JSON the way the export expects. Exposed for the
 * import path's symmetry check too.
 */
export function serializeSiteData(siteData: unknown): Uint8Array {
  const json = JSON.stringify(siteData, null, DATA_JSON_INDENT) + "\n";
  return enc.encode(json);
}

/**
 * Export a site to a zip `Blob`.
 *
 * The zip layout is the v1 PRD layout:
 *
 * ```
 * data.json              # canonical site data
 * assets/<hash>.<ext>    # content-addressed assets, copied from `vfs`
 * assets/...metadata     # whatever the asset VFS holds — copied verbatim
 * dist/                  # built static site ready for Cloudflare Pages
 * dist/assets/<hash>...  # deployable copies of referenced user assets
 *                        # (minus files only Draft articles use)
 * DEPLOY.md              # generated Cloudflare Pages guide
 * ```
 *
 * Only `assets/...` paths are copied from `vfs`. Anything else in the
 * input VFS (debugging scratch files, editor state) is intentionally
 * dropped — the exported zip is for end users, not editor internals.
 *
 * The export is deterministic: same `siteData` + same `vfs` contents →
 * byte-identical zip. This is the contract the round-trip identity
 * test depends on.
 *
 * `siteData` is serialised exactly as passed; the schema is not
 * re-parsed first. This preserves any unknown keys the caller's
 * runtime had already preserved (per ADR-0002 / ADR-0003).
 */
export async function exportToZip(siteData: unknown, vfs: Vfs): Promise<Blob> {
  const driver = new ZipDriver();

  // 1. Canonical site data.
  await driver.write("data.json", serializeSiteData(siteData));

  // 2. Assets — copied verbatim from the input VFS.
  const assetPaths = await vfs.list("assets/");
  const assetBytes = new Map<string, Uint8Array>();
  for (const path of assetPaths) {
    const bytes = await vfs.read(path);
    assetBytes.set(path, bytes);
    await driver.write(path, bytes);
  }

  // 2b. Installed Theme packages, under `themes/<id>/...`.
  //
  // These travel inside the editable archive on purpose (issue-106 plan): a
  // recipient must be able to open the archive offline and see the intended
  // design without hunting down the Theme package separately. That is also
  // what makes an archive a complete hand-off rather than a reference to
  // things the sender happens to have installed.
  //
  // They are *not* mirrored into `dist/`: the build already emits whatever
  // the Theme actually contributes at `assets/theme/<id>/...`, and copying
  // the raw package in as well would ship the manifest and READMEs to the
  // public site for no reason.
  for (const path of await vfs.list("themes/")) {
    await driver.write(path, await vfs.read(path));
  }

  // 3. Built static site. The editor's export-confirm flow already showed
  // validation issues; `skipValidation` lets the user's explicit download
  // choice still produce a self-contained zip.
  //
  // Theme packages are resolved from the VFS we were handed, not from editor
  // state: the archive and the built site must agree about which Theme this
  // is, and the VFS is the thing being archived.
  const themes = await installedThemeBundles(vfs);
  let dist: ReturnType<typeof build>;
  try {
    dist = build(siteData as Site, { skipValidation: true, themes });
  } finally {
    // Each loaded package compiled its `render.js` into a sandbox realm of
    // its own; the export is the only thing that will ever render through
    // these bundles, so release them here (ADR 0053).
    for (const bundle of themes) bundle.render?.dispose();
  }
  for (const [path, value] of dist) {
    // The dist Map carries text artefacts (HTML/XML/JSON) as `string` and
    // binary artefacts (self-hosted woff2 fonts at `dist/assets/fonts/...`) as
    // `Uint8Array`. Write bytes through verbatim; encode strings as UTF-8.
    await driver.write(`dist/${path}`, typeof value === "string" ? enc.encode(value) : value);
  }

  // Cloudflare Pages serves the uploaded `dist/` folder as the web root, so
  // user-uploaded assets must exist inside `dist/` as well as at the archive's
  // top level. ONE copy is enough: the renderer emits every asset reference
  // relative to the emitting page's own depth (`../assets/...` on
  // `activitati/index.html`, `../../assets/...` on an Article), so a nested
  // page resolves back to this single `dist/assets/...` copy.
  //
  // Files used only by Draft Articles stop here: they stay in `assets/` above
  // (the editable archive keeps everything) but never reach `dist/`, because
  // Drafts are not part of the public Site (ADR 0047).
  const draftOnly = draftOnlyAssetPaths(siteData);
  for (const [assetPath, bytes] of assetBytes) {
    if (draftOnly.has(assetPath)) continue;
    await driver.write(`dist/${assetPath}`, bytes);
  }

  // 4. Deployment guide.
  await driver.write(
    "DEPLOY.md",
    enc.encode(
      generateDeployMd({
        language: deployLanguageFor(siteData),
        org: { name: orgNameForDeployGuide(siteData) },
      }),
    ),
  );

  const zipBytes = driver.toZipBytes();
  return new Blob([zipBytes], { type: "application/zip" });
}

/**
 * Load every Theme package installed in this VFS into a renderable bundle.
 *
 * A package that fails to load is skipped rather than aborting the export: if
 * the Site does not use it, its damage is irrelevant to this download, and if
 * the Site *does* use it, `build()` raises `BuildThemeMissingError` with a
 * message naming the Theme — which is the more useful error of the two.
 */
async function installedThemeBundles(vfs: Vfs): Promise<ThemeBundle[]> {
  const bundles: ThemeBundle[] = [];
  for (const id of await installedThemeIds(vfs)) {
    try {
      bundles.push((await loadThemePackageFromVfs(vfs, id)).bundle);
    } catch {
      continue;
    }
  }
  return bundles;
}

function deployLanguageFor(siteData: unknown): DeployLanguage {
  if (siteData !== null && typeof siteData === "object") {
    const defaultLanguage = (siteData as { defaultLanguage?: unknown }).defaultLanguage;
    if (defaultLanguage === "en") return "en";
  }
  return "ro";
}

function orgNameForDeployGuide(siteData: unknown): string {
  if (siteData !== null && typeof siteData === "object") {
    const org = (siteData as { org?: unknown }).org;
    if (org !== null && typeof org === "object") {
      const name = (org as { name?: unknown }).name;
      if (typeof name === "string" && name.trim().length > 0) return name.trim();
    }
  }
  return "your organisation";
}

/**
 * Pull every `assets/...` path out of an arbitrary VFS into a fresh
 * `MemoryDriver`. Used by tests and by anyone who wants to clone the
 * asset half of an exported zip.
 */
export async function copyAssets(source: Vfs): Promise<MemoryDriver> {
  const dst = new MemoryDriver();
  for (const path of await source.list("assets/")) {
    await dst.write(path, await source.read(path));
  }
  return dst;
}
