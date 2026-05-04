import type { ValidationResult } from "@sosb/schema";

/**
 * Stable error codes for `importFromZip`. Callers can branch on
 * `error.code` rather than parsing message text.
 *
 * - `zip.invalid` — the byte stream is not a valid zip.
 * - `zip.dataJson.missing` — the zip is valid but contains no `data.json`.
 * - `zip.dataJson.invalidJson` — `data.json` exists but is not parseable JSON.
 * - `zip.dataJson.invalidShape` — `data.json` parses but does not match the
 *   site schema. The full `ValidationResult` is attached on `validation`.
 * - `zip.dataJson.versionTooNew` — the input `schemaVersion` is greater than
 *   this editor's `SITE_SCHEMA_VERSION` (re-thrown from `migrateSite`).
 */
export type ZipImportErrorCode =
  | "zip.invalid"
  | "zip.dataJson.missing"
  | "zip.dataJson.invalidJson"
  | "zip.dataJson.invalidShape"
  | "zip.dataJson.versionTooNew";

/**
 * The single error type `importFromZip` throws on every malformed-input
 * branch. Wraps the underlying cause via `Error.cause` so callers can
 * still introspect (`fflate` decode error, `migrateSite` version error,
 * etc.) without parsing messages.
 */
export class ZipImportError extends Error {
  override readonly name = "ZipImportError";
  readonly code: ZipImportErrorCode;
  readonly validation?: ValidationResult;

  constructor(
    code: ZipImportErrorCode,
    message: string,
    options?: { cause?: unknown; validation?: ValidationResult },
  ) {
    super(message);
    this.code = code;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    if (options?.validation) {
      this.validation = options.validation;
    }
  }
}
