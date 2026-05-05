/**
 * Inline an SPA's HTML + asset map into a single self-contained document.
 *
 * The archival single-file build (PRD: "An archival single-file HTML
 * version of the editor downloadable from GitHub Releases, so that I can
 * keep editing offline indefinitely") is a `file://`-runnable HTML.
 *
 * The transformation:
 *
 *   - `<script src="<local-url>">` → `<script>` + the asset's text.
 *   - `<link rel="stylesheet" href="<local-url>">` → `<style>` + the asset's
 *     text.
 *   - `<img src="<local-url>">` → `<img src="data:<mime>;base64,<...>">`.
 *   - Cross-origin (`https://`, `http://`, `//`) refs are passed through
 *     untouched. We do not fetch them at build time — that would inject a
 *     network dep into the archival flow and silently break offline use if
 *     the CDN later disappeared.
 *
 * The transformation is pure: deterministic on input, no DOM, no network,
 * no filesystem.
 */

export interface ArchivalInput {
  /** The shell HTML, typically a hand-written `index.html` shell. */
  readonly html: string;
  /**
   * Asset map keyed by URL (relative or absolute path). Values are either
   * UTF-8 strings (for JS/CSS/text) or `Uint8Array` (for images).
   */
  readonly assets: ReadonlyMap<string, string | Uint8Array>;
}

export interface ArchivalOutput {
  /** The single inlined HTML document. */
  readonly html: string;
  /** UTF-8 byte length of `html`. The CLI uses this to assert the AC budget. */
  readonly bytes: number;
}

const enc = new TextEncoder();

/**
 * Run the archival inline pass. The output is a single string with no
 * external `<script src>` / `<link rel="stylesheet" href>` / inlinable
 * `<img src>` references for any asset present in the asset map.
 */
export function buildArchival(input: ArchivalInput): ArchivalOutput {
  let html = input.html;
  html = inlineScripts(html, input.assets);
  html = inlineStylesheets(html, input.assets);
  html = inlineImages(html, input.assets);
  const bytes = enc.encode(html).byteLength;
  return { html, bytes };
}

// -----------------------------------------------------------------
// helpers
// -----------------------------------------------------------------

/**
 * `<script ... src="..."></script>` → `<script ...>...</script>` with the
 * asset's text spliced in. Preserves the script tag's other attributes
 * (notably `type="module"`).
 */
function inlineScripts(
  html: string,
  assets: ReadonlyMap<string, string | Uint8Array>,
): string {
  const pattern = /<script\b([^>]*?)\s+src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi;
  return html.replace(pattern, (match, before: string, _q: string, src: string, after: string) => {
    if (isExternalUrl(src)) return match;
    const asset = assets.get(src);
    if (asset === undefined) return match;
    const text = asAssetText(asset);
    if (text === null) return match;
    const safe = neutraliseScriptCloser(text);
    const attrs = mergeAttrs(before, after);
    return `<script${attrs}>${safe}</script>`;
  });
}

/**
 * `<link rel="stylesheet" href="..."/>` → `<style>...</style>`. Preserves
 * a `media` attribute if present.
 */
function inlineStylesheets(
  html: string,
  assets: ReadonlyMap<string, string | Uint8Array>,
): string {
  const pattern = /<link\b([^>]*?)\s*\/?>(?!\s*<\/link>)/gi;
  return html.replace(pattern, (match, attrsRaw: string) => {
    const attrs = attrsRaw;
    if (!/\brel\s*=\s*(["'])\s*stylesheet\s*\1/i.test(attrs)) return match;
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([^"']+)\1/i);
    if (hrefMatch === null) return match;
    const href = hrefMatch[2]!;
    if (isExternalUrl(href)) return match;
    const asset = assets.get(href);
    if (asset === undefined) return match;
    const text = asAssetText(asset);
    if (text === null) return match;
    const mediaMatch = attrs.match(/\bmedia\s*=\s*(["'])([^"']+)\1/i);
    const mediaAttr = mediaMatch !== null ? ` media="${escapeAttr(mediaMatch[2]!)}"` : "";
    return `<style${mediaAttr}>${text}</style>`;
  });
}

/**
 * `<img src="..."/>` → data-URI when the src maps to a local asset.
 * The mime type is sniffed from the path extension; unknown extensions
 * fall back to `application/octet-stream`.
 */
function inlineImages(
  html: string,
  assets: ReadonlyMap<string, string | Uint8Array>,
): string {
  const pattern = /<img\b([^>]*?)\s+src=(["'])([^"']+)\2([^>]*?)\/?>/gi;
  return html.replace(pattern, (match, before: string, _q: string, src: string, after: string) => {
    if (isExternalUrl(src)) return match;
    if (src.startsWith("data:")) return match;
    const asset = assets.get(src);
    if (asset === undefined) return match;
    const bytes = asAssetBytes(asset);
    const mime = sniffMime(src);
    const dataUrl = `data:${mime};base64,${base64FromBytes(bytes)}`;
    const attrs = mergeAttrs(before, after);
    return `<img${attrs} src="${dataUrl}"/>`;
  });
}

function isExternalUrl(url: string): boolean {
  return /^(https?:)?\/\//i.test(url);
}

function asAssetText(asset: string | Uint8Array): string | null {
  if (typeof asset === "string") return asset;
  return new TextDecoder("utf-8", { fatal: false }).decode(asset);
}

function asAssetBytes(asset: string | Uint8Array): Uint8Array {
  if (typeof asset === "string") return enc.encode(asset);
  return asset;
}

/**
 * The `</script>` closer inside a string literal is the most common
 * archival-build hazard: the parser will close the wrapping `<script>` at
 * the first `</script>` it sees. We split it so the text means the same
 * thing to the JS parser but is inert to the HTML tokenizer.
 */
function neutraliseScriptCloser(text: string): string {
  return text.replace(/<\/script/gi, "<\\/script");
}

function mergeAttrs(before: string, after: string): string {
  const merged = `${before} ${after}`.replace(/\s+/g, " ").trim();
  return merged.length === 0 ? "" : ` ${merged}`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
};

function sniffMime(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = path.slice(dot + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * UTF-safe base64 encoder for `Uint8Array`. We hand-roll it (instead of
 * `Buffer.toString("base64")`) so the module remains node-built-in-free
 * (matches the @sosb/build constraint — see ADR 0004).
 */
function base64FromBytes(bytes: Uint8Array): string {
  const len = bytes.length;
  let out = "";
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;
    const triplet = (b1 << 16) | (b2 << 8) | b3;
    out += B64[(triplet >> 18) & 0x3f]!;
    out += B64[(triplet >> 12) & 0x3f]!;
    out += i + 1 < len ? B64[(triplet >> 6) & 0x3f]! : "=";
    out += i + 2 < len ? B64[triplet & 0x3f]! : "=";
  }
  return out;
}
