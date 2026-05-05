/**
 * HTML escape helpers.
 *
 * Two flavours: escape-for-text and escape-for-attribute. Both are pure
 * string-in/string-out and never round-trip raw HTML — text and attribute
 * values are always entity-encoded before being concatenated into the
 * output.
 */

const TEXT_RE = /[&<>]/g;
const TEXT_MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const ATTR_RE = /[&<>"']/g;
const ATTR_MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a string for use as text content between tags. */
export function escapeText(value: string): string {
  return value.replace(TEXT_RE, (ch) => TEXT_MAP[ch] ?? ch);
}

/** Escape a string for use inside a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return value.replace(ATTR_RE, (ch) => ATTR_MAP[ch] ?? ch);
}
