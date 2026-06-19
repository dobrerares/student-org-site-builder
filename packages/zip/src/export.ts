import { MemoryDriver } from "@sosb/vfs/memory";
import { ZipDriver } from "@sosb/vfs/zip-driver";
import type { Vfs } from "@sosb/vfs/vfs";
import { build } from "@sosb/build";
import type { Site } from "@sosb/schema";

import { generateDeployMd, type DeployLanguage } from "./deploy-md.js";

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

  // 3. Built static site. The editor's export-confirm flow already showed
  // validation issues; `skipValidation` lets the user's explicit download
  // choice still produce a self-contained zip.
  const dist = build(siteData as Site, { skipValidation: true });
  for (const [path, value] of dist) {
    // The dist Map carries text artefacts (HTML/XML/JSON) as `string` and
    // binary artefacts (self-hosted woff2 fonts at `dist/assets/fonts/...`) as
    // `Uint8Array`. Write bytes through verbatim; encode strings as UTF-8.
    await driver.write(`dist/${path}`, typeof value === "string" ? enc.encode(value) : value);
  }

  // The renderer emits relative `assets/...` URLs. Cloudflare Pages serves the
  // uploaded `dist/` folder as the web root, so user-uploaded assets must also
  // exist inside `dist/`. Nested pages such as `activitati/index.html` resolve
  // the same relative URL against their own folder, so mirror assets there too.
  const pagePrefixes = distAssetPrefixes(dist);
  for (const [assetPath, bytes] of assetBytes) {
    for (const prefix of pagePrefixes) {
      await driver.write(`${prefix}${assetPath}`, bytes);
    }
  }

  // Build-owned assets, currently self-hosted fonts, need the same nested-page
  // mirroring for relative CSS URLs like `url(assets/fonts/inter.woff2)`.
  for (const [path, value] of dist) {
    if (!path.startsWith("assets/")) continue;
    const bytes = typeof value === "string" ? enc.encode(value) : value;
    for (const prefix of pagePrefixes.slice(1)) {
      await driver.write(`${prefix}${path}`, bytes);
    }
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

function distAssetPrefixes(dist: Map<string, string | Uint8Array>): string[] {
  const prefixes = ["dist/"];
  for (const path of dist.keys()) {
    if (!path.endsWith("/index.html")) continue;
    const pageDir = path.slice(0, -"index.html".length);
    if (pageDir.length > 0) prefixes.push(`dist/${pageDir}`);
  }
  return prefixes;
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
