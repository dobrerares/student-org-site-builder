/**
 * `uploadAssetWithVariants` -- the Electron-side upload entrypoint that
 * extends the browser pipeline (#8) with responsive variants (#37).
 *
 * The single-output `uploadAsset` is unchanged: same flow (mime detect,
 * decode, resize+encode, hash, write asset + sidecar). This entry adds:
 *
 *  1. After the canonical upload completes, run `processor.encodeVariants(...)`
 *     against the same `ImageDecode`.
 *  2. Write each variant to `assets/<hash>.<width>.<ext>` (deterministic;
 *     same input => same paths regardless of upload order or alt text).
 *  3. Update the sidecar with a `variants` array.
 *  4. Return the augmented `AssetRef` carrying both the canonical and
 *     variant locations so blocks can render `<img srcset>` directly.
 *
 * SVG passthrough is preserved verbatim -- vectors are infinitely
 * scalable and we don't generate raster variants for them.
 */

import type { Vfs } from "@sosb/vfs";

import { detectMime, isSupportedMime, type SupportedMime } from "./mime.js";
import { sha256HexPrefix } from "./hash.js";
import {
  chooseOutputMime,
  JPEG_QUALITY,
  MAX_LONG_EDGE_PX,
  type MultiVariantImageProcessor,
  RESPONSIVE_VARIANT_WIDTHS,
  WEBP_VARIANT_QUALITY,
} from "./processor.js";
import { AssetError } from "./errors.js";
import type { AssetMetadata, AssetRef, AssetUploadInput, AssetVariantDescriptor } from "./types.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface UploadVariantsOptions {
  readonly processor: MultiVariantImageProcessor;
  /** Variant widths to emit. Defaults to {@link RESPONSIVE_VARIANT_WIDTHS}. */
  readonly variantWidths?: readonly number[];
  /** Output mime for variants. Defaults to `image/webp`. */
  readonly targetVariantMime?: Extract<
    SupportedMime,
    "image/webp" | "image/avif" | "image/png" | "image/jpeg"
  >;
  /** Quality factor for variant lossy encoders. Defaults to {@link WEBP_VARIANT_QUALITY}. */
  readonly variantQuality?: number;
  /** Override the canonical long-edge cap. Defaults to {@link MAX_LONG_EDGE_PX} (2000). */
  readonly maxLongEdge?: number;
  /** Override canonical JPEG quality. Defaults to {@link JPEG_QUALITY} (85). */
  readonly jpegQuality?: number;
}

export async function uploadAssetWithVariants(
  input: AssetUploadInput,
  vfs: Vfs,
  options: UploadVariantsOptions,
): Promise<AssetRef> {
  const { processor } = options;
  const variantWidths = options.variantWidths ?? [...RESPONSIVE_VARIANT_WIDTHS];
  const targetVariantMime = options.targetVariantMime ?? "image/webp";
  const variantQuality = options.variantQuality ?? WEBP_VARIANT_QUALITY;
  const maxLongEdge = options.maxLongEdge ?? MAX_LONG_EDGE_PX;
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY;

  const { bytes, name, declaredMime, alt } = await normaliseInput(input);

  if (!alt || alt.trim().length === 0) {
    throw new AssetError(
      "asset.alt.missing",
      "Alt text is mandatory on image uploads. Provide a non-empty `alt`.",
    );
  }

  const inputMime = detectMime(bytes, declaredMime ?? null);
  if (!inputMime || !isSupportedMime(inputMime)) {
    throw new AssetError(
      "asset.mime.unsupported",
      `Unsupported asset type${declaredMime ? ` (declared "${declaredMime}")` : ""}. ` +
        `The Electron pipeline accepts JPEG, PNG, WebP, and SVG.`,
    );
  }

  // SVG path: passthrough, no variants.
  if (inputMime === "image/svg+xml") {
    const dims = parseSvgIntrinsicDimensions(bytes);
    const hash = await sha256HexPrefix(bytes);
    const path = `assets/${hash}.svg`;
    const metadataPath = `assets/${hash}.metadata.json`;
    await vfs.write(path, bytes);
    const meta: AssetMetadata = {
      originalName: name,
      mimeType: "image/svg+xml",
      dimensions: { w: dims.width, h: dims.height },
      alt,
    };
    await vfs.write(metadataPath, enc.encode(JSON.stringify(meta, null, 2) + "\n"));
    return {
      hash,
      path,
      metadataPath,
      mime: "image/svg+xml",
      width: dims.width,
      height: dims.height,
      alt,
    };
  }

  // Raster path.
  let decoded;
  try {
    decoded = await processor.decode(bytes, inputMime);
  } catch (cause) {
    throw new AssetError("asset.decode.failed", "Failed to decode image.", { cause });
  }

  const canonicalTargetMime = chooseOutputMime(inputMime);
  if (canonicalTargetMime === "image/svg+xml") {
    throw new AssetError("asset.decode.failed", "Internal: SVG path on raster input.");
  }

  let canonical;
  try {
    canonical = await processor.resizeAndEncode(
      decoded,
      canonicalTargetMime,
      maxLongEdge,
      jpegQuality,
    );
  } catch (cause) {
    throw new AssetError("asset.decode.failed", "Failed to encode canonical image.", { cause });
  }

  const hash = await sha256HexPrefix(canonical.bytes);
  const ext = extensionFor(canonical.mime);
  const path = `assets/${hash}.${ext}`;
  const metadataPath = `assets/${hash}.metadata.json`;

  await vfs.write(path, canonical.bytes);

  let variantOutputs;
  try {
    variantOutputs = await processor.encodeVariants(decoded, {
      widths: variantWidths,
      targetMime: targetVariantMime,
      quality: variantQuality,
    });
  } catch (cause) {
    throw new AssetError("asset.decode.failed", "Failed to encode variants.", { cause });
  }

  const sortedVariants = [...variantOutputs].sort((a, b) => a.requestedWidth - b.requestedWidth);
  const variantDescriptors: AssetVariantDescriptor[] = [];
  const seenRequestedWidths = new Set<number>();
  for (const v of sortedVariants) {
    if (seenRequestedWidths.has(v.requestedWidth)) continue;
    seenRequestedWidths.add(v.requestedWidth);
    const variantExt = extensionFor(v.mime);
    const variantPath = `assets/${hash}.${v.requestedWidth}.${variantExt}`;
    await vfs.write(variantPath, v.bytes);
    variantDescriptors.push({
      width: v.width,
      height: v.height,
      mime: v.mime,
      path: variantPath,
      bytes: v.bytes.byteLength,
    });
  }

  const meta: AssetMetadata = {
    originalName: name,
    mimeType: canonical.mime,
    dimensions: { w: canonical.width, h: canonical.height },
    alt,
    variants: variantDescriptors,
  };
  await vfs.write(metadataPath, enc.encode(JSON.stringify(meta, null, 2) + "\n"));

  return {
    hash,
    path,
    metadataPath,
    mime: canonical.mime,
    width: canonical.width,
    height: canonical.height,
    alt,
    variants: variantDescriptors,
  };
}

/**
 * Build an `<img srcset>` string from a list of variant descriptors.
 * Sorts ascending by width. Returns "" when given no variants.
 */
export function buildSrcset(variants: readonly AssetVariantDescriptor[]): string {
  if (variants.length === 0) return "";
  const sorted = [...variants].sort((a, b) => a.width - b.width);
  return sorted.map((v) => `${v.path} ${v.width}w`).join(", ");
}

/**
 * Sensible default for `<img sizes>` when emitting a responsive image
 * with the PRD-pinned 400/800/1600 widths.
 */
export const DEFAULT_RESPONSIVE_SIZES = "(max-width: 480px) 400px, (max-width: 960px) 800px, 100vw";

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
    case "image/avif":
      return "avif";
    case "image/svg+xml":
      return "svg";
  }
}

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
