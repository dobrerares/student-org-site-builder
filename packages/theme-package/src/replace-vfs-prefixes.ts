/** Failure recovery for disjoint VFS prefixes; deliberately not crash atomic. */
import type { Vfs } from "@sosb/vfs/vfs";

interface Replacement {
  readonly prefix: string;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export async function removeVfsPrefix(vfs: Vfs, prefix: string): Promise<void> {
  for (const path of await vfs.list(prefix)) await vfs.delete(path);
}

export async function readVfsPrefix(vfs: Vfs, prefix: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const path of await vfs.list(prefix)) {
    files.set(path.slice(prefix.length), await vfs.read(path));
  }
  return files;
}

async function replace(vfs: Vfs, replacements: readonly Replacement[]): Promise<void> {
  for (const { prefix, files } of replacements) {
    for (const [path, bytes] of files) await vfs.write(prefix + path, bytes);
    for (const path of await vfs.list(prefix)) {
      if (!files.has(path.slice(prefix.length))) await vfs.delete(path);
    }
  }
}

/**
 * Retain complete old bytes until every replacement succeeds. On rejected
 * I/O restore all prefixes, including ones whose replacement finished. If
 * rollback also fails, keep its on-disk backup and retry it on the next call.
 * The VFS has no atomic rename/transaction: process crashes and concurrent
 * readers during transfer are not covered by this rollback guarantee.
 * Callers supply internal, disjoint prefixes and a separate backup prefix.
 */
export async function replaceVfsPrefixes(
  vfs: Vfs,
  replacements: readonly Replacement[],
  backup: string,
): Promise<void> {
  const ready = backup + ".ready";
  if (await vfs.has(ready)) {
    // The manifest is internal, but a damaged persistent file must never
    // supply an arbitrary prefix to the restore operation.
    const prefixes: unknown = JSON.parse(new TextDecoder().decode(await vfs.read(ready)));
    const allowed = new Set(replacements.map(({ prefix }) => prefix));
    if (
      !Array.isArray(prefixes) ||
      prefixes.some((p) => typeof p !== "string" || !allowed.has(p))
    ) {
      throw new Error(`Unrecognised recovery backup at ${backup}; the backup was retained.`);
    }
    const saved: Replacement[] = [];
    for (const prefix of prefixes as string[]) {
      saved.push({ prefix, files: await readVfsPrefix(vfs, backup + prefix) });
    }
    await replace(vfs, saved);
    await vfs.delete(ready);
  }
  await removeVfsPrefix(vfs, backup);
  try {
    const outgoing: Replacement[] = [];
    for (const { prefix } of replacements) {
      outgoing.push({ prefix, files: await readVfsPrefix(vfs, prefix) });
    }
    for (const { prefix, files } of outgoing) {
      for (const [path, bytes] of files) await vfs.write(backup + prefix + path, bytes);
    }
    await vfs.write(ready, new TextEncoder().encode(JSON.stringify(outgoing.map((r) => r.prefix))));
    try {
      await replace(vfs, replacements);
      await vfs.delete(ready);
    } catch (transferError) {
      try {
        await replace(vfs, outgoing);
        await vfs.delete(ready);
      } catch (rollbackError) {
        throw new AggregateError(
          [transferError, rollbackError],
          `Transfer and rollback failed; the previous files are retained at ${backup}`,
        );
      }
      throw transferError;
    }
  } finally {
    // Temporary cleanup must not mask the original I/O failure, nor turn a
    // committed replacement into an error. Never erase an unfinished backup.
    if (!(await vfs.has(ready).catch(() => true))) {
      await removeVfsPrefix(vfs, backup).catch(() => {});
    }
  }
}
