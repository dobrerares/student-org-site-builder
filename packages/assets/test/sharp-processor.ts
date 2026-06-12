/**
 * Test-only `ImageProcessor` backed by sharp.
 *
 * The production pipeline uses `CanvasImageProcessor` (browser-only,
 * exercised in Playwright). For Node-side unit tests we plug in a
 * sharp-based processor that implements the same interface and produces
 * real, behaviourally-equivalent output.
 *
 * Sharp is a devDependency only — it never appears in the runtime
 * bundle. This file imports it directly with `await import("sharp")` to
 * keep the assets package's public surface free of any sharp typings.
 *
 * IMPORTANT: this is *not* a mock. It is a real, full-fidelity image
 * encoder/decoder used purely to substitute the canvas-based one in
 * tests, so the orchestration logic (mime detection, hashing, dedup,
 * sidecar writing, alt enforcement, deletion) is exercised against a
 * pipeline that produces real PNG/JPEG bytes. The behavioural contracts
 * — alpha preservation, output size budget, output content-type — are
 * all properties of any honest implementation, not artefacts of canvas
 * vs sharp.
 */

import type { ImageProcessor, ImageDecode, ImageEncoded } from "../src/processor.js";
import type { SupportedMime } from "../src/mime.js";

/**
 * Build a sharp-backed processor. Async because we resolve the runtime
 * import once and reuse it.
 */
export async function createSharpProcessor(): Promise<ImageProcessor> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;

  return {
    async decode(bytes: Uint8Array): Promise<ImageDecode> {
      const image = sharp(Buffer.from(bytes));
      const metadata = await image.metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      // We don't materialise the bitmap eagerly — sharp does its own
      // pipeline and the resize step starts from the original bytes.
      return {
        width,
        height,
        original: bytes,
      };
    },

    async resizeAndEncode(
      decoded: ImageDecode,
      targetMime: SupportedMime,
      maxLongEdge: number,
      jpegQuality: number,
    ): Promise<ImageEncoded> {
      const longEdge = Math.max(decoded.width, decoded.height);
      const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
      const targetWidth = Math.max(1, Math.round(decoded.width * scale));
      const targetHeight = Math.max(1, Math.round(decoded.height * scale));

      let pipeline = sharp(Buffer.from(decoded.original));
      if (scale < 1) {
        pipeline = pipeline.resize(targetWidth, targetHeight, { fit: "fill" });
      }

      let outBuffer: Buffer;
      let outMime: SupportedMime;
      switch (targetMime) {
        case "image/jpeg":
          // Default chroma subsampling 4:2:0 matches both typical web
          // photo encoding and what `HTMLCanvasElement.toBlob` produces
          // by default. Quality at the configured pipeline value.
          outBuffer = await pipeline
            .jpeg({ quality: jpegQuality, mozjpeg: false, chromaSubsampling: "4:2:0" })
            .toBuffer();
          outMime = "image/jpeg";
          break;
        case "image/png":
          // Preserve alpha; do not flatten.
          outBuffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
          outMime = "image/png";
          break;
        case "image/webp":
          outBuffer = await pipeline.webp({ quality: jpegQuality, lossless: false }).toBuffer();
          outMime = "image/webp";
          break;
        case "image/avif":
          outBuffer = await pipeline.avif({ quality: jpegQuality, effort: 4 }).toBuffer();
          outMime = "image/avif";
          break;
        default:
          throw new Error(`SharpImageProcessor: unsupported target mime ${targetMime}`);
      }

      // Derive actual dimensions from the encoded output, in case sharp
      // applied EXIF rotation etc.
      const finalMeta = await sharp(outBuffer).metadata();
      return {
        bytes: new Uint8Array(outBuffer),
        mime: outMime,
        width: finalMeta.width ?? targetWidth,
        height: finalMeta.height ?? targetHeight,
      };
    },
  };
}

/**
 * Generate a realistic-entropy JPEG fixture of approximately the
 * requested byte size. Used by the "12MB → <500KB" AC test.
 *
 * Pure RGB noise is uncompressible by any DCT-based codec; real
 * photographs have a 1/f spectral falloff (most energy in low spatial
 * frequencies, very little in high). To synthesise a fixture whose
 * compressibility is comparable to a real photo, we generate noise and
 * then apply a Gaussian blur — which simulates the optical PSF of a
 * real lens and gives the spectrum a realistic falloff. Our q=85
 * resize-and-encode pipeline can then hit a representative size
 * compression ratio on this fixture, the same way it would on a real
 * 12MP camera shot.
 *
 * The fixture is deterministic enough for the test (the assertion is
 * a "less than" budget, not byte-equality), so we accept the small
 * variance sharp introduces.
 */
export async function makeLargeJpegFixture(approxBytes: number): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;

  // ~6500x4500 already produces >12MB of JPEG when we encode at q=95
  // with realistic-entropy content (noise + light blur).
  let width = 6500;
  let height = 4500;
  let attempt = 0;
  while (attempt < 6) {
    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
        noise: { type: "gaussian", mean: 128, sigma: 50 },
      },
    })
      // Gaussian blur gives the spectrum a 1/f falloff so the JPEG DCT
      // can actually compress it — like a real photograph. Sigma ~3px
      // is comparable to a typical lens point-spread function on a
      // 6000-pixel-wide sensor.
      .blur(3)
      .jpeg({ quality: 95, mozjpeg: false, chromaSubsampling: "4:4:4" })
      .toBuffer();
    if (buffer.byteLength >= approxBytes * 0.9) {
      const meta = await sharp(buffer).metadata();
      return {
        bytes: new Uint8Array(buffer),
        width: meta.width ?? width,
        height: meta.height ?? height,
      };
    }
    // Bump up.
    width = Math.round(width * 1.15);
    height = Math.round(height * 1.15);
    attempt++;
  }
  throw new Error(`Could not synthesise ~${approxBytes}B JPEG fixture`);
}

/**
 * Build a small PNG with a known transparent rectangle. Used to assert
 * alpha preservation through the re-encode.
 *
 * The image is `2400 x 1600` (so the resize path triggers) with the
 * left half opaque red and the right half fully transparent.
 */
export async function makePngWithAlpha(
  width = 2400,
  height = 1600,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;

  const channels = 4;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (x < width / 2) {
        raw[i] = 220; // R
        raw[i + 1] = 30; // G
        raw[i + 2] = 30; // B
        raw[i + 3] = 255; // A — opaque
      } else {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0; // A — transparent
      }
    }
  }
  const buffer = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
  const meta = await sharp(buffer).metadata();
  return {
    bytes: new Uint8Array(buffer),
    width: meta.width ?? width,
    height: meta.height ?? height,
  };
}

/**
 * Read a single pixel's RGBA from a PNG (or any decodable image).
 */
export async function readPixelRgba(
  bytes: Uint8Array,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;

  const { data, info } = await sharp(Buffer.from(bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const idx = (y * info.width + x) * channels;
  return [data[idx] ?? 0, data[idx + 1] ?? 0, data[idx + 2] ?? 0, data[idx + 3] ?? 255];
}
