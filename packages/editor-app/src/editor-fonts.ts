/**
 * Editor chrome fonts.
 *
 * The renderer already bundles Inter (400/500/600/700, latin + latin-ext)
 * as base64 woff2 so exported sites can self-host it. The editor reuses the
 * same bytes for its own UI, which means the chrome looks identical on every
 * machine and in the offline archival build — no dependency on whatever
 * "Segoe UI" or "Liberation Sans" the OS happens to ship.
 *
 * The `@font-face` rules use `data:` URLs rather than blob URLs so they have
 * no lifecycle to manage (the preview iframe's font blobs are revoked on
 * editor unmount; these must outlive that).
 */
import { FONT_FACE_REGISTRY, woff2Base64 } from "@sosb/renderer";

const STYLE_ELEMENT_ID = "sosb-editor-fonts";

/** Families the editor chrome loads. Everything else stays preview-only. */
const EDITOR_FAMILIES: readonly string[] = ["Inter"];

export function editorFontFaceCss(): string {
  const rules: string[] = [];
  for (const family of EDITOR_FAMILIES) {
    const defs = FONT_FACE_REGISTRY[family] ?? [];
    for (const def of defs) {
      const b64 = woff2Base64(def.file);
      if (b64 === undefined) continue;
      rules.push(
        `@font-face{font-family:"${def.family}";font-style:${def.style};font-weight:${def.weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${def.unicodeRange};}`,
      );
    }
  }
  return rules.join("\n");
}

export function injectEditorFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) return;
  const css = editorFontFaceCss();
  if (css.length === 0) return;
  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

injectEditorFonts();
