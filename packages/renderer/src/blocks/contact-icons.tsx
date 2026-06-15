/** @jsxImportSource preact */

/**
 * Inline channel icons for the contactCard (issue #13 polish).
 *
 * Why inline SVG (not an icon font / sprite / external file):
 *  - **Determinism** — the markup is static, so repeated renders stay
 *    byte-identical (the renderer's binding determinism contract).
 *  - **Self-contained** — a user who copies a single HTML page keeps working
 *    icons; no asset fetch, no CDN, no CSP exception (mirrors the self-host
 *    fonts decision).
 *  - **Theme-aware** — every glyph paints with `currentColor`, so the icon
 *    chip's text color (a theme token) drives the stroke; no per-theme art.
 *
 * Style: Feather-style outline (stroke, 24×24, round caps/joins). Glyphs are
 * decorative — the channel label/text carries the meaning — so each <svg> is
 * `aria-hidden`. Unknown platforms fall back to a generic link glyph rather
 * than dropping the row, so a custom social never renders a blank chip.
 */

export type IconName =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "mail"
  | "phone"
  | "map-pin"
  | "link";

/** Map a free-form social `platform` string to a known glyph (or the link fallback). */
export function iconNameForPlatform(platform: string): IconName {
  const p = platform.trim().toLowerCase();
  if (p === "instagram" || p === "ig") return "instagram";
  if (p === "facebook" || p === "fb" || p === "meta") return "facebook";
  if (p === "linkedin") return "linkedin";
  if (p === "twitter" || p === "x") return "twitter";
  if (p === "youtube" || p === "yt") return "youtube";
  return "link";
}

/** The inner shapes for each glyph (the outer <svg> is shared). */
function glyph(name: IconName): preact.JSX.Element {
  switch (name) {
    case "instagram":
      return (
        <>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </>
      );
    case "facebook":
      return <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />;
    case "linkedin":
      return (
        <>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </>
      );
    case "twitter":
      return (
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
      );
    case "youtube":
      return (
        <>
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </>
      );
    case "mail":
      return (
        <>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </>
      );
    case "phone":
      return (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      );
    case "map-pin":
      return (
        <>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </>
      );
    case "link":
    default:
      return (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      );
  }
}

/** A single decorative channel glyph painted with `currentColor`. */
export function ContactIcon(props: { name: IconName }): preact.JSX.Element {
  return (
    <svg
      class="contact-card__glyph"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph(props.name)}
    </svg>
  );
}
