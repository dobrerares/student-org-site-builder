/**
 * Main-process asset processor adapter (#37).
 *
 * `createAssetIpcHandler` (in `./asset-handlers.ts`) handles validation
 * but delegates the actual encoding to a dependency-injected
 * `processor.processAssetForVariants(...)`. This file provides the
 * production wiring: a function that takes a validated request and runs
 * the Sharp pipeline against it.
 *
 * Lives in its own file (rather than inlined into `main.ts`) so it can
 * be tested in node without an Electron runtime, and so the import of
 * Sharp stays explicit.
 *
 * Sharp is a Node-only library and is loaded via dynamic `import()`
 * (inside `createSharpImageProcessor`). The Electron main process is a
 * Node runtime, so this works at runtime; the dynamic import also keeps
 * the bundler from accidentally pulling sharp into the renderer bundle.
 */

import {
  createSharpImageProcessor,
  detectMime,
  type AssetVariantDescriptor,
  type ImageVariant,
  type SupportedMime,
} from "@sosb/assets";

import type {
  AssetIpcDeps,
  ProcessAssetForVariantsRequest,
  ProcessAssetForVariantsResponse,
} from "./asset-handlers.js";

/**
 * Build the production processor wired to Sharp. Async because we
 * resolve the Sharp module once and reuse the resulting processor
 * instance across IPC calls -- avoids a per-call dynamic-import cost.
 */
export async function createMainProcessAssetProcessor(): Promise<AssetIpcDeps["processor"]> {
  const sharpProc = await createSharpImageProcessor();

  return {
    async processAssetForVariants(
      request: ProcessAssetForVariantsRequest,
    ): Promise<ProcessAssetForVariantsResponse> {
      const mime = detectMime(request.bytes, request.declaredMime);
      if (!mime || mime === "image/svg+xml") {
        // SVG passthrough is not handled at the IPC layer -- the
        // renderer-side pipeline writes SVGs verbatim. The IPC channel
        // is for raster work only.
        throw new Error(
          "processAssetForVariants: SVG and unsupported mimes must not reach the Sharp IPC handler",
        );
      }

      const decoded = await sharpProc.decode(request.bytes, mime);

      // Canonical: same long-edge cap and quality as the browser
      // pipeline so dedup carries across both upload paths.
      const canonicalTargetMime = chooseCanonicalMime(mime);
      const canonical = await sharpProc.resizeAndEncode(decoded, canonicalTargetMime, 2000, 85);

      const variants: readonly ImageVariant[] = await sharpProc.encodeVariants(decoded, {
        widths: request.variantWidths,
        targetMime: request.targetVariantMime ?? "image/webp",
        quality: request.variantQuality ?? 82,
      });

      return {
        canonical: {
          bytes: canonical.bytes,
          mime: canonical.mime,
          width: canonical.width,
          height: canonical.height,
        },
        variants: variants.map(toVariantDescriptor),
      };
    },
  };
}

function chooseCanonicalMime(inputMime: SupportedMime): SupportedMime {
  switch (inputMime) {
    case "image/jpeg":
      return "image/jpeg";
    case "image/png":
      return "image/png";
    case "image/webp":
      // Even Electron-side, the canonical for WebP-with-alpha stays PNG
      // for portability with the browser pipeline.
      return "image/png";
    case "image/svg+xml":
      // Unreachable -- SVG is rejected upstream.
      throw new Error("chooseCanonicalMime: SVG inputs are not handled here");
  }
}

function toVariantDescriptor(v: ImageVariant): {
  requestedWidth: number;
  width: number;
  height: number;
  mime: SupportedMime;
  bytes: Uint8Array;
} {
  return {
    requestedWidth: v.requestedWidth,
    width: v.width,
    height: v.height,
    mime: v.mime,
    bytes: v.bytes,
  };
}

// Re-export the descriptor shape so consumers don't need to dig into
// the assets package to declare what they accept.
export type { AssetVariantDescriptor };
