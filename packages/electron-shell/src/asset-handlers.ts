/**
 * Asset-pipeline IPC handler factory (#37).
 *
 * The renderer cannot run Sharp directly: Sharp is a Node-only library,
 * the renderer is sandboxed (`sandbox: true, nodeIntegration: false`),
 * and it has no native binary access. Instead the renderer hands raw
 * image bytes to the main process via `window.sosb.processAssetForVariants`
 * and the main process runs Sharp.
 *
 * **Security boundary.** The IPC channel is the only path between
 * untrusted renderer code and the Sharp encoder. The handler:
 *
 *   1. Refuses any payload that isn't bytes -- never accepts a
 *      filesystem path. The renderer cannot coerce the main process
 *      into reading arbitrary files via this channel.
 *   2. Validates declared mime against an allowlist (JPEG/PNG/WebP/SVG).
 *   3. Caps the bytes at a hard limit (50 MB) so a malicious renderer
 *      can't OOM the main process.
 *   4. Validates `variantWidths` is a non-empty array of positive
 *      finite numbers.
 *   5. Validates alt non-empty (the same hard requirement the asset
 *      pipeline enforces upstream).
 *
 * The actual encoding work is delegated to a `MultiVariantImageProcessor`
 * (the production Sharp processor at runtime; a fake in tests). This
 * keeps the validation logic isolated and unit-testable in node without
 * Electron / Sharp / a real ipcMain.
 */

import type { SupportedMime } from "@sosb/assets";

/**
 * Hard cap on payload size. 50 MB is generous for a single image upload
 * (typical 24-megapixel raw photo is ~12 MB) and is the same number
 * GitHub uses for git-LFS images.
 */
export const MAX_ASSET_PAYLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Allowlist of declared MIMEs accepted at the IPC boundary. The handler
 * enforces this check BEFORE the bytes reach Sharp -- a malformed mime
 * is rejected as a security posture, not a Sharp error.
 */
const ALLOWED_MIMES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export interface ProcessAssetForVariantsRequest {
  readonly bytes: Uint8Array;
  readonly declaredMime: string;
  readonly name: string;
  readonly alt: string;
  readonly variantWidths: readonly number[];
  /** Optional: target mime for variants. Defaults to `image/webp`. */
  readonly targetVariantMime?: SupportedMime;
  /** Optional: variant quality factor (0-100). */
  readonly variantQuality?: number;
}

export interface ProcessAssetForVariantsResponse {
  readonly canonical: {
    readonly bytes: Uint8Array;
    readonly mime: SupportedMime;
    readonly width: number;
    readonly height: number;
  };
  readonly variants: ReadonlyArray<{
    readonly requestedWidth: number;
    readonly width: number;
    readonly height: number;
    readonly mime: SupportedMime;
    readonly bytes: Uint8Array;
  }>;
}

export interface AssetIpcDeps {
  readonly processor: {
    processAssetForVariants(
      request: ProcessAssetForVariantsRequest,
    ): Promise<ProcessAssetForVariantsResponse>;
  };
}

/**
 * Typed error surface for IPC validation failures. Codes:
 *
 *   - `ipc.asset.alt.missing`        empty/whitespace alt
 *   - `ipc.asset.mime.unsupported`   declaredMime not in allowlist
 *   - `ipc.asset.payload.tooLarge`   bytes > MAX_ASSET_PAYLOAD_BYTES
 *   - `ipc.asset.variants.invalid`   variantWidths empty or contains
 *                                       non-positive / non-finite values
 */
export type AssetIpcErrorCode =
  | "ipc.asset.alt.missing"
  | "ipc.asset.mime.unsupported"
  | "ipc.asset.payload.tooLarge"
  | "ipc.asset.variants.invalid";

export class AssetIpcError extends Error {
  override readonly name = "AssetIpcError";
  readonly code: AssetIpcErrorCode;
  constructor(code: AssetIpcErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Build a handler that validates the incoming payload and dispatches to
 * the underlying processor. The returned function is what the IPC
 * registry calls; the validation runs on every invocation so a renderer
 * cannot bypass it by re-using a handler reference.
 */
export function createAssetIpcHandler(
  deps: AssetIpcDeps,
): (request: ProcessAssetForVariantsRequest) => Promise<ProcessAssetForVariantsResponse> {
  return async (request) => {
    validateRequest(request);
    return deps.processor.processAssetForVariants(request);
  };
}

function validateRequest(request: ProcessAssetForVariantsRequest): void {
  // alt
  if (typeof request.alt !== "string" || request.alt.trim().length === 0) {
    throw new AssetIpcError(
      "ipc.asset.alt.missing",
      "alt text is mandatory on image uploads (got empty or whitespace-only)",
    );
  }

  // declaredMime
  if (typeof request.declaredMime !== "string" || !ALLOWED_MIMES.includes(request.declaredMime)) {
    throw new AssetIpcError(
      "ipc.asset.mime.unsupported",
      `unsupported declared mime "${request.declaredMime}" -- accepted: ${ALLOWED_MIMES.join(", ")}`,
    );
  }

  // bytes (size cap)
  if (!(request.bytes instanceof Uint8Array)) {
    throw new AssetIpcError("ipc.asset.payload.tooLarge", "bytes must be a Uint8Array");
  }
  if (request.bytes.byteLength > MAX_ASSET_PAYLOAD_BYTES) {
    throw new AssetIpcError(
      "ipc.asset.payload.tooLarge",
      `payload exceeds ${MAX_ASSET_PAYLOAD_BYTES} bytes (got ${request.bytes.byteLength})`,
    );
  }

  // variantWidths
  if (
    !Array.isArray(request.variantWidths) ||
    request.variantWidths.length === 0 ||
    request.variantWidths.some((w) => typeof w !== "number" || !Number.isFinite(w) || w <= 0)
  ) {
    throw new AssetIpcError(
      "ipc.asset.variants.invalid",
      "variantWidths must be a non-empty array of positive finite numbers",
    );
  }
}
