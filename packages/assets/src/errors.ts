/**
 * Typed errors with stable codes for the asset pipeline.
 *
 * Callers handle errors by `code`, never by string-matching the message.
 * The codes are stable across versions; messages may change for clarity.
 */

export type AssetErrorCode =
  | "asset.alt.missing"
  | "asset.label.missing"
  | "asset.mime.unsupported"
  | "asset.decode.failed"
  | "asset.size.exceeded"
  | "asset.notFound";

export class AssetError extends Error {
  override readonly name = "AssetError";
  readonly code: AssetErrorCode;
  constructor(code: AssetErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}
