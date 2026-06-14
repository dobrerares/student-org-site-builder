export const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Validate a user-entered link URL. Returns true iff the value is safe to
 * put on an outbound `<a href>` attribute on a published static site.
 * Empty string is acceptable here ("unset"); required fields enforce
 * non-emptiness separately via `.min(1)`.
 */
export function isAcceptableLinkUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length === 0) return true;
  if (value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    return SAFE_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}
