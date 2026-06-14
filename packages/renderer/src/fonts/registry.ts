// Hand-written font registry. Exposes the generated font data (the typed
// manifest + base64 woff2 bytes) in a render-friendly shape. No @font-face
// CSS emission here — that lands in PR-F2. This module is pure data access.
import { GENERATED_FONT_FACES } from "./fonts.generated.js";
import { FONT_WOFF2_BASE64 } from "./font-bytes.generated.js";

/** Path prefix under which self-hosted woff2 assets are emitted in a build. */
export const FONT_ASSET_PREFIX = "assets/fonts/";

export interface FontFaceDef {
  family: string;
  weight: number;
  style: "normal";
  subset: "latin" | "latin-ext";
  file: string;
  unicodeRange: string;
}

/** family -> ordered defs, grouped from the generated (already-sorted) faces. */
export const FONT_FACE_REGISTRY: Readonly<Record<string, readonly FontFaceDef[]>> = (() => {
  const byFamily: Record<string, FontFaceDef[]> = {};
  for (const face of GENERATED_FONT_FACES) {
    (byFamily[face.family] ??= []).push(face);
  }
  return byFamily;
})();

/** The set of self-hosted font families, in registry order. */
export const SELF_HOSTED_FAMILIES: readonly string[] = Object.keys(FONT_FACE_REGISTRY);

/** Base64-encoded woff2 bytes for a given file, or undefined if not bundled. */
export function woff2Base64(file: string): string | undefined {
  return FONT_WOFF2_BASE64[file];
}
