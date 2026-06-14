import { MemoryDriver } from "@sosb/vfs/memory";
import { ZipDriver } from "@sosb/vfs/zip-driver";
import type { Vfs } from "@sosb/vfs/vfs";
import { migrateSite, validate, type Site } from "@sosb/schema";

import { ZipImportError } from "./errors.js";

/**
 * The imported result.
 *
 * `siteData` is the parsed-and-validated, schema-migrated site object.
 * `vfs` is a `MemoryDriver` populated with every `assets/...` entry from
 * the zip — it is *not* a reference to a `ZipDriver`. The editor mutates
 * the asset VFS during editing, and we don't want those mutations to
 * leak back into a still-loaded zip representation.
 */
export interface ImportResult {
  siteData: Site;
  vfs: Vfs;
}

const dec = new TextDecoder("utf-8", { fatal: false });

/**
 * Import a site from a zip `Blob`.
 *
 * Steps, in order, each producing a typed `ZipImportError` on failure:
 *
 * 1. Decode the zip bytes via `ZipDriver.fromZipBytes`. Failure →
 *    `zip.invalid` or `zip.limitsExceeded`.
 * 2. Read `data.json`. Missing → `zip.dataJson.missing`.
 * 3. Parse the JSON. Failure → `zip.dataJson.invalidJson`.
 * 4. Run `migrateSite` from `@sosb/schema`. Versions newer than this
 *    editor → `zip.dataJson.versionTooNew`.
 * 5. Run `validate()`. Errors present → `zip.dataJson.invalidShape`,
 *    with the `ValidationResult` attached on `error.validation`.
 * 6. Copy every `assets/...` path into a fresh `MemoryDriver`.
 *
 * The shape of the returned `siteData` is the migrated-and-validated
 * `Site` — but the runtime preserves unknown keys per ADR-0002, so
 * forward-compat fields and unknown block types make it through.
 */
export async function importFromZip(blob: Blob): Promise<ImportResult> {
  // 1. Decode zip bytes.
  const buf = new Uint8Array(await blob.arrayBuffer());
  let zipDriver: ZipDriver;
  try {
    zipDriver = ZipDriver.fromZipBytes(buf);
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("zip: import limits exceeded")) {
      throw new ZipImportError(
        "zip.limitsExceeded",
        "The zip archive exceeds the import size limits.",
        { cause },
      );
    }
    throw new ZipImportError(
      "zip.invalid",
      "Failed to decode zip bytes — the input is not a valid zip archive.",
      { cause },
    );
  }

  // 2. Read data.json.
  if (!(await zipDriver.has("data.json"))) {
    throw new ZipImportError(
      "zip.dataJson.missing",
      "Zip is missing data.json — this does not look like an exported site zip.",
    );
  }
  const dataJsonBytes = await zipDriver.read("data.json");
  const dataJsonText = dec.decode(dataJsonBytes);

  // 3. Parse JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataJsonText);
  } catch (cause) {
    throw new ZipImportError("zip.dataJson.invalidJson", "data.json is not parseable JSON.", {
      cause,
    });
  }

  // 4. Migrate site.
  let migrated: unknown;
  try {
    migrated = migrateSite(parsed).data;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/newer than/i.test(message)) {
      throw new ZipImportError(
        "zip.dataJson.versionTooNew",
        "data.json was produced by a newer editor than this one understands.",
        { cause },
      );
    }
    // `migrateSite` also throws on non-object / non-integer schemaVersion
    // inputs. Those are shape errors, not "version too new" errors.
    throw new ZipImportError(
      "zip.dataJson.invalidShape",
      "data.json could not be migrated: " + message,
      { cause },
    );
  }

  // 5. Validate.
  const validation = validate(migrated);
  if (!validation.ok) {
    throw new ZipImportError(
      "zip.dataJson.invalidShape",
      "data.json does not match the site schema. See error.validation for details.",
      { validation },
    );
  }

  // 6. Copy assets into a fresh MemoryDriver.
  const vfs = new MemoryDriver();
  for (const path of await zipDriver.list("assets/")) {
    await vfs.write(path, await zipDriver.read(path));
  }

  return { siteData: migrated as Site, vfs };
}
