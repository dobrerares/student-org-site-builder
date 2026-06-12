import type { Vfs } from "@sosb/vfs/vfs";

import {
  DEFAULT_DATABASE_NAME,
  openIndexedDbDriver,
  type IndexedDbDriverOptions,
} from "./indexed-db-driver.js";
import { openOpfsDriver, type OpfsDriverOptions } from "./opfs-driver.js";

export interface PreferredPersistentVfsOptions {
  readonly opfs?: OpfsDriverOptions;
  readonly indexedDb?: IndexedDbDriverOptions;
}

/**
 * Open the browser-shell persistent VFS with the PRD's preferred order:
 * OPFS first, IndexedDB fallback.
 */
export async function openPreferredPersistentVfs(
  options: PreferredPersistentVfsOptions = {},
): Promise<Vfs> {
  try {
    return await openOpfsDriver(options.opfs);
  } catch {
    return openIndexedDbDriver({
      databaseName: DEFAULT_DATABASE_NAME,
      ...options.indexedDb,
    });
  }
}
