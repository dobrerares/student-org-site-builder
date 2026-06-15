/**
 * Pure color math for the token layer.
 *
 * Two consumers: (1) scrims need an "r, g, b" triplet so CSS can apply a
 * partial-alpha version of a theme color via `rgb(var(--color-fg-rgb) / 0.7)`
 * while the renderer keeps the "no raw color outside :root" discipline;
 * (2) the contrast-safe override feature needs to pick a readable text color
 * for whatever accent/primary a theme default or user override resolves to.
 *
 * No CSS or token knowledge lives here — just parsing and WCAG arithmetic.
 */

/** Parse a `#rgb` or `#rrggbb` hex string to an `"r, g, b"` triplet, or undefined. */
export function hexToRgbTriplet(hex: string): string | undefined {
  const value = hex.trim();
  const six = /^#([0-9a-fA-F]{6})$/.exec(value);
  const three = /^#([0-9a-fA-F]{3})$/.exec(value);
  let r: number;
  let g: number;
  let b: number;
  if (six !== null) {
    r = parseInt(six[1]!.slice(0, 2), 16);
    g = parseInt(six[1]!.slice(2, 4), 16);
    b = parseInt(six[1]!.slice(4, 6), 16);
  } else if (three !== null) {
    const c = three[1]!;
    r = parseInt(c[0]! + c[0]!, 16);
    g = parseInt(c[1]! + c[1]!, 16);
    b = parseInt(c[2]! + c[2]!, 16);
  } else {
    return undefined;
  }
  return `${r}, ${g}, ${b}`;
}

/** WCAG 2.x relative luminance (0..1) of a hex color, or undefined if unparseable. */
export function relativeLuminance(hex: string): number | undefined {
  const triplet = hexToRgbTriplet(hex);
  if (triplet === undefined) return undefined;
  const [r, g, b] = triplet.split(", ").map((n) => Number(n) / 255) as [number, number, number];
  const channel = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21), or undefined if either is unparseable. */
export function contrastRatio(a: string, b: string): number | undefined {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === undefined || lb === undefined) return undefined;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the more readable of white vs. a dark ink for text placed on `hex`,
 * by comparing actual WCAG contrast ratios (not a luminance threshold —
 * thresholding mis-handles mid-luminance colors like gold). Ties and
 * unparseable inputs fall back to white.
 */
export function onColorFor(hex: string, darkInk = "#16181c"): string {
  const onWhite = contrastRatio(hex, "#ffffff");
  const onDark = contrastRatio(hex, darkInk);
  if (onWhite === undefined || onDark === undefined) return "#ffffff";
  return onDark > onWhite ? darkInk : "#ffffff";
}

/**
 * Blend hex `a` toward hex `b` by `t` (0..1) and return a `#rrggbb` hex, or
 * undefined if either is unparseable. Used to derive a subtle card surface (a
 * faint tint of the background toward the foreground) — theme-aware, so it
 * darkens a light bg and lightens a dark bg, giving cards quiet definition
 * without a hard border.
 */
export function mixHex(a: string, b: string, t: number): string | undefined {
  const ta = hexToRgbTriplet(a);
  const tb = hexToRgbTriplet(b);
  if (ta === undefined || tb === undefined) return undefined;
  const [ar, ag, ab] = ta.split(", ").map(Number) as [number, number, number];
  const [br, bg, bb] = tb.split(", ").map(Number) as [number, number, number];
  const lerp = (x: number, y: number): number => Math.round(x + (y - x) * t);
  const hex2 = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${hex2(lerp(ar, br))}${hex2(lerp(ag, bg))}${hex2(lerp(ab, bb))}`;
}
