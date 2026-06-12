/**
 * MIME detection from magic bytes plus a declared-MIME fallback.
 *
 * The browser asset pipeline cares about exactly four image types:
 * JPEG, PNG, WebP, and SVG. PDF and other documents are out of scope
 * (issue #21). For the four supported types we always trust the magic
 * bytes over the caller's declared MIME — file extensions and `File.type`
 * are user-supplied and routinely lie.
 *
 * SVG is the one type that can't be detected by a fixed magic-byte
 * pattern; it's plain XML and may or may not start with `<?xml`. We
 * accept three signals: an XML prolog, a leading `<svg`, or a declared
 * `image/svg+xml` MIME — any one is enough.
 */

export type SupportedMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "image/svg+xml";

export function isSupportedMime(mime: string | null): mime is SupportedMime {
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/avif" ||
    mime === "image/svg+xml"
  );
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];
const FTYP_MAGIC = [0x66, 0x74, 0x79, 0x70];
const AVIF_BRANDS = ["avif", "avis"];

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  // Sniff the first ~256 bytes as ASCII/UTF-8 and look for `<svg` or `<?xml`.
  const len = Math.min(bytes.length, 256);
  let text = "";
  for (let i = 0; i < len; i++) {
    const ch = bytes[i];
    if (ch === undefined) break;
    text += String.fromCharCode(ch);
  }
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
}

function looksLikeAvif(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, FTYP_MAGIC, 4)) return false;
  const len = Math.min(bytes.length, 32);
  let brands = "";
  for (let i = 8; i < len; i++) {
    const ch = bytes[i];
    if (ch === undefined) break;
    brands += String.fromCharCode(ch);
  }
  return AVIF_BRANDS.some((brand) => brands.includes(brand));
}

/**
 * Detect a supported image MIME. Returns `null` if the bytes are neither
 * a recognised raster format nor SVG-shaped XML.
 */
export function detectMime(
  bytes: Uint8Array,
  declared?: string | null | undefined,
): SupportedMime | null {
  if (startsWith(bytes, JPEG_MAGIC)) return "image/jpeg";
  if (startsWith(bytes, PNG_MAGIC)) return "image/png";
  if (startsWith(bytes, RIFF_MAGIC) && startsWith(bytes, WEBP_MAGIC, 8)) return "image/webp";
  if (looksLikeAvif(bytes)) return "image/avif";

  if (looksLikeSvg(bytes)) return "image/svg+xml";
  if (declared === "image/avif") return "image/avif";
  if (declared === "image/svg+xml") return "image/svg+xml";

  return null;
}
