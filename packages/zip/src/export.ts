import { MemoryDriver, ZipDriver, type Vfs } from "@sosb/vfs";

import { DEPLOY_MD } from "./deploy-md.js";

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
 * dist/.gitkeep          # placeholder (real build output lives in #5/#46)
 * DEPLOY.md              # placeholder English deployment guide
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
  for (const path of assetPaths) {
    const bytes = await vfs.read(path);
    await driver.write(path, bytes);
  }

  // 3. Placeholder `dist/` (real build output lands with #5/#46).
  await driver.write("dist/.gitkeep", new Uint8Array(0));

  // 4. Deployment guide.
  await driver.write("DEPLOY.md", enc.encode(DEPLOY_MD));

  const zipBytes = driver.toZipBytes();
  return new Blob([zipBytes], { type: "application/zip" });
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
