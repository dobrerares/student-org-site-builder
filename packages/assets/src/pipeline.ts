/**
 * Asset upload / delete orchestration.
 *
 * The pipeline is environment-agnostic: it accepts any `ImageProcessor`
 * (the browser-default `CanvasImageProcessor` in production, a sharp-
 * backed processor in Node tests) and any `Vfs` driver. The browser-only
 * APIs live in `./canvas-processor.ts`; nothing here imports them, so
 * this module loads cleanly under JSDOM, Node, or a real browser.
 *
 * Flow:
 *
 * 1. Validate alt text (mandatory, non-empty after trim).
 * 2. Detect MIME from magic bytes; reject unsupported types.
 * 3. SVG -> passthrough (bytes stored verbatim).
 *    Raster -> decode -> resize+re-encode -> store output bytes.
 * 4. Hash the stored bytes with SHA-256, take the leading 16 hex chars
 *    (see `./hash.ts` for the entropy rationale).
 * 5. Write `assets/<hash>.<ext>` and `assets/<hash>.metadata.json`.
 * 6. Return an `AssetRef` referencing both.
 *
 * Dedup is automatic: identical input bytes produce identical output
 * bytes (SVG passthrough is a literal copy; raster re-encoding is
 * deterministic given the same processor + same parameters), which
 * produces the same hash and therefore the same paths. A second upload
 * of the same file overwrites the same VFS entry; net effect is one
 * asset on disk.
 */

import type { Vfs } from "@sosb/vfs";

import { detectMime, isSupportedMime, type SupportedMime } from "./mime.js";
import { sha256HexPrefix } from "./hash.js";
import {
  chooseOutputMime,
  JPEG_QUALITY,
  MAX_LONG_EDGE_PX,
  type ImageProcessor,
} from "./processor.js";
import { AssetError } from "./errors.js";
import type { AssetMetadata, AssetRef, AssetUploadInput } from "./types.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface UploadOptions {
  processor: ImageProcessor;
  /** Override the long-edge cap. Defaults to {@link MAX_LONG_EDGE_PX} (2000). */
  maxLongEdge?: number;
  /** Override JPEG quality. Defaults to {@link JPEG_QUALITY} (85). */
  jpegQuality?: number;
}

/**
 * The single programmatic upload entrypoint. Returns an `AssetRef` that
 * blocks (#14, #17, #21, #46) carry by reference.
 *
 * Throws `AssetError`:
 *   - `asset.alt.missing`       alt is empty or whitespace-only.
 *   - `asset.mime.unsupported`  bytes are neither a recognised raster
 *                                 image nor SVG-shaped XML.
 *   - `asset.decode.failed`     the processor could not decode the input.
 */
export async function uploadAsset(
  input: AssetUploadInput,
  vfs: Vfs,
  options: UploadOptions,
): Promise<AssetRef> {
  const { processor } = options;
  const maxLongEdge = options.maxLongEdge ?? MAX_LONG_EDGE_PX;
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY;

  // 1. Coerce input to bytes + name + declaredMime.
  const { bytes, name, declaredMime, alt } = await normaliseInput(input);

  // 2. Alt enforcement.
  if (!alt || alt.trim().length === 0) {
    throw new AssetError(
      "asset.alt.missing",
      "Alt text is mandatory on image uploads. Provide a non-empty `alt`.",
    );
  }

  // 3. MIME detection.
  const inputMime = detectMime(bytes, declaredMime ?? null);
  if (!inputMime || !isSupportedMime(inputMime)) {
    throw new AssetError(
      "asset.mime.unsupported",
      `Unsupported asset type${declaredMime ? ` (declared "${declaredMime}")` : ""}. ` +
        `The browser pipeline accepts JPEG, PNG, WebP, and SVG.`,
    );
  }

  // 4. Process: SVG passthrough vs raster resize+re-encode.
  let storedBytes: Uint8Array;
  let outputMime: SupportedMime;
  let width: number;
  let height: number;

  if (inputMime === "image/svg+xml") {
    storedBytes = bytes;
    outputMime = "image/svg+xml";
    // SVG dimensions are intrinsic; if absent (viewBox-only SVGs) we
    // record 0/0 and the renderer falls back to its own measurement.
    const dims = parseSvgIntrinsicDimensions(bytes);
    width = dims.width;
    height = dims.height;
  } else {
    let decoded;
    try {
      decoded = await processor.decode(bytes, inputMime);
    } catch (cause) {
      throw new AssetError("asset.decode.failed", "Failed to decode image.", { cause });
    }
    const targetMime = chooseOutputMime(inputMime);
    if (targetMime === "image/svg+xml") {
      // Unreachable for raster inputs; satisfies the type checker.
      throw new AssetError("asset.decode.failed", "Internal: SVG path on raster input.");
    }
    const encoded = await processor.resizeAndEncode(decoded, targetMime, maxLongEdge, jpegQuality);
    storedBytes = encoded.bytes;
    outputMime = encoded.mime;
    width = encoded.width;
    height = encoded.height;
  }

  // 5. Hash the stored bytes.
  const hash = await sha256HexPrefix(storedBytes);
  const ext = extensionFor(outputMime);
  const path = `assets/${hash}.${ext}`;
  const metadataPath = `assets/${hash}.metadata.json`;

  // 6. Write asset bytes and sidecar.
  await vfs.write(path, storedBytes);
  const metadata: AssetMetadata = {
    originalName: name,
    mimeType: outputMime,
    dimensions: { w: width, h: height },
    alt,
  };
  await vfs.write(metadataPath, enc.encode(JSON.stringify(metadata, null, 2) + "\n"));

  return { hash, path, metadataPath, mime: outputMime, width, height, alt };
}

/**
 * Delete an asset and its metadata sidecar. Throws
 * `AssetError("asset.notFound")` if both the asset bytes and sidecar
 * are missing; if either is present, the existing one is removed.
 */
export async function deleteAsset(vfs: Vfs, ref: AssetRef): Promise<void> {
  const hasAsset = await vfs.has(ref.path);
  const hasSidecar = await vfs.has(ref.metadataPath);
  if (!hasAsset && !hasSidecar) {
    throw new AssetError("asset.notFound", `No asset at ${ref.path}.`);
  }
  if (hasAsset) await vfs.delete(ref.path);
  if (hasSidecar) await vfs.delete(ref.metadataPath);
}

/**
 * Read the metadata sidecar for an asset. Throws
 * `AssetError("asset.notFound")` if the sidecar is missing.
 */
export async function readAssetMetadata(vfs: Vfs, ref: AssetRef): Promise<AssetMetadata> {
  if (!(await vfs.has(ref.metadataPath))) {
    throw new AssetError("asset.notFound", `No metadata sidecar at ${ref.metadataPath}.`);
  }
  const bytes = await vfs.read(ref.metadataPath);
  return JSON.parse(dec.decode(bytes)) as AssetMetadata;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NormalisedInput {
  bytes: Uint8Array;
  name: string;
  declaredMime: string | undefined;
  alt: string;
}

async function normaliseInput(input: AssetUploadInput): Promise<NormalisedInput> {
  if (input.kind === "bytes") {
    return {
      bytes: input.bytes,
      name: input.name,
      declaredMime: input.declaredMime,
      alt: input.alt,
    };
  }
  // `kind: "file"`. `File` extends `Blob`; both live in the browser
  // global lib types.
  const buffer = await input.file.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    name: input.file.name,
    declaredMime: input.file.type || undefined,
    alt: input.alt,
  };
}

function extensionFor(mime: SupportedMime): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
  }
}

/**
 * Best-effort extraction of intrinsic `width`/`height` attributes from
 * an SVG. The renderer can fall back to viewBox-based sizing when these
 * are 0.
 */
function parseSvgIntrinsicDimensions(bytes: Uint8Array): { width: number; height: number } {
  const head = dec.decode(bytes.slice(0, Math.min(bytes.length, 1024)));
  const widthMatch = /<svg[^>]*\swidth="([^"]+)"/i.exec(head);
  const heightMatch = /<svg[^>]*\sheight="([^"]+)"/i.exec(head);
  const parseAttr = (raw: string | undefined): number => {
    if (!raw) return 0;
    const num = parseFloat(raw);
    return Number.isFinite(num) ? Math.round(num) : 0;
  };
  return {
    width: parseAttr(widthMatch?.[1]),
    height: parseAttr(heightMatch?.[1]),
  };
}
