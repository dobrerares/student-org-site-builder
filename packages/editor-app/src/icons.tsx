/**
 * Inline SVG icons for the editor chrome.
 *
 * Kept as tiny Preact components (no icon-library dependency) so the
 * archival single-file build stays lean. Every icon is decorative
 * (`aria-hidden`) — the surrounding control always carries the accessible
 * name via visible text, `aria-label`, or `title`.
 */
import type { JSX } from "preact";

interface IconProps {
  readonly size?: number;
}

function base(size: number | undefined): JSX.SVGAttributes<SVGSVGElement> {
  const s = size ?? 16;
  return {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
    class: "icon",
  };
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
