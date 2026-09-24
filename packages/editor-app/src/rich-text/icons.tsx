/** @jsxImportSource react */
/**
 * Formatting icons for the rich-text toolbar.
 *
 * Kept beside the editor rather than in the shared `icons.tsx` because they
 * are used nowhere else, and kept as inline SVG for the same reason the
 * shared file is: an icon library would be a new dependency and new bytes in
 * the offline single-file archive for no gain (ADR 0049 phase-one notes).
 *
 * All decorative — the toolbar button always carries the accessible name.
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
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    className: "icon",
  };
}

export function IconBold(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M6 4h7a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h8a4 4 0 0 1 0 8H6z" />
    </svg>
  );
}

export function IconItalic(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M19 4h-9" />
      <path d="M14 20H5" />
      <path d="M15 4 9 20" />
    </svg>
  );
}

export function IconUnderline(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function IconStrikethrough(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <path d="M4 12h16" />
    </svg>
  );
}

export function IconCode(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  );
}

export function IconBulletList(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

export function IconOrderedList(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M10 6h11" />
      <path d="M10 12h11" />
      <path d="M10 18h11" />
      <path d="M4 4h1v5" />
      <path d="M4 14h2a1 1 0 0 1 .7 1.7L4 18h3" />
    </svg>
  );
}

export function IconQuote(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M7 8h4v4a4 4 0 0 1-4 4" />
      <path d="M15 8h4v4a4 4 0 0 1-4 4" />
    </svg>
  );
}

export function IconLink(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

export function IconUnlink(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M17 7l3-3a5 5 0 0 1 0 7l-2 2" />
      <path d="M7 17l-3 3a5 5 0 0 1 0-7l2-2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function IconHeading(props: IconProps & { level: 2 | 3 | 4 }): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M5 5v14" />
      <path d="M13 5v14" />
      <path d="M5 12h8" />
      <text x="16" y="19" fontSize="10" stroke="none" fill="currentColor" fontFamily="inherit">
        {props.level}
      </text>
    </svg>
  );
}

export function IconParagraph(props: IconProps): JSX.Element {
  return (
    <svg {...base(props.size)}>
      <path d="M13 4v16" />
      <path d="M17 4v16" />
      <path d="M17 4H9a4 4 0 0 0 0 8h4" />
    </svg>
  );
}
