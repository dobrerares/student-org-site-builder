/**
 * The recoverable copy an author-controlled package update leaves behind
 * (ADR 0055; issue-106 plan, "author-controlled extension updates").
 *
 * Before an update changes Block data, the builder keeps the working package
 * and the affected Block envelopes under `themes-recovery/<id>/`, inside the
 * Site's VFS so it travels in the editable archive like `themes/` does. One
 * copy per package id — the next update replaces it — which is the minimal
 * honest version: enough to undo the last update completely, offline, on
 * another machine, without a history of every version ever installed.
 *
 * `blocks.json` holds the pre-update envelopes keyed by Block id. Restoring
 * reinstalls the package files and puts those envelopes back where a Block
 * with the same id still exists; a Block deleted since the update stays
 * deleted (the author did that on purpose), and one added since is untouched
 * (it was authored against the newer declaration, which is now gone — its
 * data is kept and validation reports it).
 */

import { BlockEnvelopeSchema, type BlockEnvelope, type Site } from "@sosb/schema";
import type { Vfs } from "@sosb/vfs/vfs";
import { THEME_ID_RE } from "./manifest.js";
import type { LoadedThemePackage } from "./load.js";
import { replaceVfsPrefixes, removeVfsPrefix, readVfsPrefix } from "./replace-vfs-prefixes.js";

/** Where recovery copies live inside a Site's VFS. */
export const THEME_RECOVERY_VFS_PREFIX = "themes-recovery/";
/**
 * Where a copy is assembled before it replaces the previous one. Outside
 * `themes-recovery/`, so it never travels in an archive and is never listed
 * as a copy; a failure part-way leaves the earlier copy whole.
 */
const STAGING_PREFIX = "themes-recovery-staging/";

const BLOCKS_FILE = "blocks.json";
const PACKAGE_DIR = "package/";
const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

export interface ThemeRecoveryCopy {
  readonly id: string;
  /** The package version the copy holds. */
  readonly version: string;
  /** The package files, bundle-relative. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  /** Pre-update Block envelopes, keyed by Block id. */
  readonly blocks: ReadonlyMap<string, BlockEnvelope>;
}

function prefixFor(id: string): string {
  return `${THEME_RECOVERY_VFS_PREFIX}${id}/`;
}

/**
 * Keep `previous` and the given Block envelopes as the recovery copy for its
 * package id, replacing any earlier copy.
 *
 * Stage and read every byte before touching the live copy, then retain an
 * on-disk backup until promotion finishes. A failed transfer restores the old
 * bytes. If storage also refuses rollback, the backup remains for the next
 * save to retry and the error names it. This is failure recovery, not an
 * atomic swap: the VFS has no transaction/rename primitive, so a process crash
 * or concurrent reader during promotion can still observe an incomplete copy.
 */
export async function saveThemeRecoveryCopy(
  vfs: Vfs,
  previous: LoadedThemePackage,
  blocks: readonly BlockEnvelope[],
): Promise<void> {
  const id = previous.bundle.id;
  const staging = `${STAGING_PREFIX}${id}/`;
  await removeVfsPrefix(vfs, staging);
  try {
    for (const [path, bytes] of themeRecoveryFiles(previous, blocks)) {
      await vfs.write(staging + path, bytes);
    }
    const files = await readVfsPrefix(vfs, staging);
    await replaceVfsPrefixes(
      vfs,
      [{ prefix: prefixFor(id), files }],
      `themes-recovery-backup/${id}/`,
    );
  } finally {
    // Do not mask the original failure if storage also refuses cleanup.
    await removeVfsPrefix(vfs, staging).catch(() => {});
  }
}

/** The files of a recovery point, also used by a combined package update. */
export function themeRecoveryFiles(
  previous: LoadedThemePackage,
  blocks: readonly BlockEnvelope[],
): ReadonlyMap<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const path of [...previous.files.keys()].sort()) {
    files.set(PACKAGE_DIR + path, previous.files.get(path)!);
  }
  const byId: Record<string, BlockEnvelope> = {};
  for (const block of blocks) byId[block.id] = block;
  const record = { version: previous.bundle.version, blocks: byId };
  files.set(BLOCKS_FILE, enc.encode(JSON.stringify(record, null, 2) + "\n"));
  return files;
}

/** The package ids that have a recovery copy, sorted. */
export async function themeRecoveryIds(vfs: Vfs): Promise<string[]> {
  const ids = new Set<string>();
  for (const path of await vfs.list(THEME_RECOVERY_VFS_PREFIX)) {
    const rest = path.slice(THEME_RECOVERY_VFS_PREFIX.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) continue;
    const id = rest.slice(0, slash);
    if (THEME_ID_RE.test(id)) ids.add(id);
  }
  return [...ids].sort();
}

/** Read the recovery copy for a package id, or `undefined` when there is none. */
export async function readThemeRecoveryCopy(
  vfs: Vfs,
  id: string,
): Promise<ThemeRecoveryCopy | undefined> {
  if (!THEME_ID_RE.test(id)) return undefined;
  const prefix = prefixFor(id);
  const paths = await vfs.list(prefix);
  if (paths.length === 0) return undefined;
  const files = new Map<string, Uint8Array>();
  let version = "";
  const blocks = new Map<string, BlockEnvelope>();
  for (const path of paths) {
    const rest = path.slice(prefix.length);
    if (rest === BLOCKS_FILE) {
      try {
        // The file travelled in an archive and is read as untrusted: only
        // envelopes the schema accepts are kept, so a restore can never write
        // a Block without a `version` or `data` into the Site.
        const record: unknown = JSON.parse(dec.decode(await vfs.read(path)));
        if (typeof record !== "object" || record === null) continue;
        const { version: v, blocks: saved } = record as { version?: unknown; blocks?: unknown };
        if (typeof v === "string") version = v;
        if (typeof saved === "object" && saved !== null && !Array.isArray(saved)) {
          for (const [blockId, envelope] of Object.entries(saved)) {
            const parsed = BlockEnvelopeSchema.safeParse(envelope);
            if (parsed.success) blocks.set(blockId, parsed.data as BlockEnvelope);
          }
        }
      } catch {
        // A damaged blocks.json still leaves the package files restorable.
      }
      continue;
    }
    if (rest.startsWith(PACKAGE_DIR))
      files.set(rest.slice(PACKAGE_DIR.length), await vfs.read(path));
  }
  return { id, version, files, blocks };
}

/** Remove the recovery copy for a package id. */
export async function discardThemeRecoveryCopy(vfs: Vfs, id: string): Promise<void> {
  for (const path of await vfs.list(prefixFor(id))) await vfs.delete(path);
}

/**
 * Put the saved envelopes back into the Site where a Block with the same id
 * still exists. Pure: returns a new Site, or the same object when nothing
 * matched.
 */
export function restoreRecoveredBlocks(site: Site, copy: ThemeRecoveryCopy): Site {
  if (copy.blocks.size === 0) return site;
  let changed = false;
  const restore = (blocks: readonly BlockEnvelope[]): BlockEnvelope[] =>
    blocks.map((block) => {
      const saved = copy.blocks.get(block.id);
      if (saved === undefined) return block;
      changed = true;
      // Only the envelope's content fields come back; a variant chosen since
      // the update is presentation, not the package's data, and stays.
      return { ...block, version: saved.version, data: saved.data };
    });
  const pages = site.pages.map((page) => ({ ...page, blocks: restore(page.blocks) }));
  const articles = (site.articles ?? []).map((article) => ({
    ...article,
    blocks: restore(article.blocks),
  }));
  if (!changed) return site;
  const next: Site = { ...site, pages };
  if (site.articles !== undefined) (next as { articles: typeof articles }).articles = articles;
  return next;
}
