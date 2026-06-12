import { describe, expect, test } from "vitest";

import { detectMime } from "../src/mime.js";

const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// "RIFF....WEBP"
const WEBP_MAGIC = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// ....ftypavif....
const AVIF_MAGIC = new Uint8Array([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
]);
const SVG_BYTES = new TextEncoder().encode(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
);
const SVG_NO_DECL = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
);

describe("detectMime", () => {
  test("detects JPEG from magic bytes regardless of declared MIME", () => {
    expect(detectMime(JPEG_MAGIC, "image/jpeg")).toBe("image/jpeg");
    expect(detectMime(JPEG_MAGIC, undefined)).toBe("image/jpeg");
    expect(detectMime(JPEG_MAGIC, "application/octet-stream")).toBe("image/jpeg");
  });

  test("detects PNG from magic bytes", () => {
    expect(detectMime(PNG_MAGIC, undefined)).toBe("image/png");
  });

  test("detects WebP from RIFF/WEBP magic bytes", () => {
    expect(detectMime(WEBP_MAGIC, undefined)).toBe("image/webp");
  });

  test("detects AVIF from ftyp/avif box bytes", () => {
    expect(detectMime(AVIF_MAGIC, undefined)).toBe("image/avif");
  });

  test("detects SVG with XML declaration", () => {
    expect(detectMime(SVG_BYTES, undefined)).toBe("image/svg+xml");
  });

  test("detects SVG without XML declaration when declared MIME is svg", () => {
    expect(detectMime(SVG_NO_DECL, "image/svg+xml")).toBe("image/svg+xml");
  });

  test("returns null for unrecognised binary data with no declared MIME", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(detectMime(garbage, undefined)).toBeNull();
  });

  test("magic-byte detection wins over a wrong declared MIME", () => {
    // Caller claims png, but bytes are jpeg.
    expect(detectMime(JPEG_MAGIC, "image/png")).toBe("image/jpeg");
  });
});
