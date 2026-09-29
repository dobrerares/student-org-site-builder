/** @jsxImportSource react */
/**
 * Inline SVG icons for the editor chrome.
 *
 * Kept as tiny React components (no icon-library dependency) so the
 * archival single-file build stays lean. Every icon is decorative
 * (`aria-hidden`) — the surrounding control always carries the accessible
 * name via visible text, `aria-label`, or `title`.
 */
import type { JSX } from "react";
import type * as React from "react";

interface IconProps {
  readonly size?: number;
}

function base(size: number | undefined): React.SVGProps<SVGSVGElement> {
  const s = size ?? 16;
  return {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    className: "icon",
  };
}

/** Opens the main navigation as a drawer at phone width (issue #102). */
export function IconMenu(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function IconArrowUp(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function IconArrowDown(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function IconTrash(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconCopy(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconPlus(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconClose(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconUndo(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function IconRedo(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconChevronUp(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function IconSettings(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function IconPalette(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <circle cx="13.5" cy="6.5" r=".8" />
      <circle cx="17.5" cy="10.5" r=".8" />
      <circle cx="8.5" cy="7.5" r=".8" />
      <circle cx="6.5" cy="12.5" r=".8" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a2.5 2.5 0 0 0 2.5-2.5c0-.6-.3-1.2-.7-1.6-.4-.4-.6-1-.6-1.6a2.5 2.5 0 0 1 2.5-2.5H18a4 4 0 0 0 4-4c0-4.4-4.5-8-10-8z" />
    </svg>
  );
}

export function IconFile(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function IconImage(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export function IconGrip(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)} stroke="none" fill="currentColor">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function IconCheck(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconAlert(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconInfo(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function IconDownload(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function IconFolder(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconSparkle(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />
    </svg>
  );
}

export function IconLayout(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

export function IconGlobe(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

/* ------------------------------------------------------------------
 * Navigation destinations (issue #102 main nav)
 * ------------------------------------------------------------------ */

export function IconHome(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

export function IconPages(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M15 3H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z" />
      <path d="M15 3v4h4" />
      <path d="M3 7v13a2 2 0 0 0 2 2h10" />
    </svg>
  );
}

export function IconArticle(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M4 4h13a1 1 0 0 1 1 1v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" />
      <path d="M18 8h2a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2" />
      <path d="M8 8h6" />
      <path d="M8 12h6" />
      <path d="M8 16h3" />
    </svg>
  );
}

export function IconUpload(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

export function IconRotate(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

/* ------------------------------------------------------------------
 * Block types — one glyph per Block, shared by the Add-block dialog and
 * the Block outline so a section is recognisable in both places.
 * ------------------------------------------------------------------ */

const BLOCK_GLYPHS: Record<string, JSX.Element> = {
  hero: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 10h10" />
      <path d="M7 14h6" />
    </>
  ),
  richText: (
    <>
      <path d="M4 6h16" />
      <path d="M4 10h16" />
      <path d="M4 14h16" />
      <path d="M4 18h10" />
    </>
  ),
  valueList: (
    <>
      <path d="m3 6 1.5 1.5L7 5" />
      <path d="m3 12 1.5 1.5L7 11" />
      <path d="m3 18 1.5 1.5L7 17" />
      <path d="M11 6h10" />
      <path d="M11 12h10" />
      <path d="M11 18h10" />
    </>
  ),
  activitiesList: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  contactCard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </>
  ),
  ctaBanner: (
    <>
      <path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  customHTML: (
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>
  ),
  documentDownloads: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6" />
      <path d="m9 15 3 3 3-3" />
    </>
  ),
  embed: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  eventList: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M8 18h.01" />
    </>
  ),
  faq: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  imageGallery: (
    <>
      <rect x="6" y="2" width="16" height="16" rx="2" />
      <path d="M2 6v14a2 2 0 0 0 2 2h14" />
      <circle cx="12" cy="8" r="1.5" />
      <path d="m22 13-3.5-3.5L10 18" />
    </>
  ),
  partnerLogos: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.2 13.6 7 22l5-3 5 3-1.2-8.4" />
    </>
  ),
  quote: (
    <>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.2-.8-2-2-2H4c-1.2 0-2 .8-2 2v6c0 1.2.8 2 2 2h3c0 4-2 6-4 6z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.2-.8-2-2-2h-4c-1.2 0-2 .8-2 2v6c0 1.2.8 2 2 2h3c0 4-2 6-4 6z" />
    </>
  ),
  articleList: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <path d="M14 4h7" />
      <path d="M14 8h5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 15h7" />
      <path d="M14 19h5" />
    </>
  ),
  siteFooter: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 15h18" />
      <path d="M7 18h4" />
    </>
  ),
  teamGrid: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
};

/** Custom Blocks (ADR 0045) and anything not in the table: a puzzle piece. */
const CUSTOM_BLOCK_GLYPH = (
  <path d="M19.4 12.6a2.4 2.4 0 0 0 0-3.4L17 7h-3.1a2.5 2.5 0 1 0-4.8 0H6a2 2 0 0 0-2 2v3.1a2.5 2.5 0 1 1 0 4.8V20a2 2 0 0 0 2 2h3.1a2.5 2.5 0 1 1 4.8 0H17a2 2 0 0 0 2-2v-3.1a2.5 2.5 0 1 0 .4-4.3z" />
);

export function IconBlockType(props: IconProps & { readonly type: string }): JSX.Element {
  return <svg {...base(props.size)}>{BLOCK_GLYPHS[props.type] ?? CUSTOM_BLOCK_GLYPH}</svg>;
}
