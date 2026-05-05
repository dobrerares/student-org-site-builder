/**
 * URL safety filter for markdown link href attributes.
 *
 * The strict whitelist: http(s), mailto, tel, and relative paths
 * (slash-rooted, dot-rooted, anchor-only, or bare-path-no-colon).
 * Anything else is dropped — callers fall back to rendering the link text
 * without an href. Returns null when unsafe.
 *
 * Defence-in-depth:
 *  1. Decode HTML numeric character references at the head of the URL so
 *     an entity-encoded scheme prefix does not slip past the allowlist.
 *  2. Strip leading whitespace + ASCII control chars (browsers strip them
 *     before resolving a scheme).
 *  3. Reject any URL containing whitespace / newlines / control chars
 *     anywhere — never legit, almost always a smuggling attempt.
 *  4. Case-fold the prefix against an allowlist of safe schemes; reject
 *     any unknown scheme.
 */

const FORBIDDEN_SCHEME_RE = /^(?:javascript|data|vbscript|file)\s*:/i;

// Whitespace plus ASCII controls (U+0000 - U+001F and U+007F).
// eslint-disable-next-line no-control-regex
const CONTROL_OR_WS_RE = /[\s\x00-\x1f\x7f]/;

// Leading whitespace and ASCII control bytes — used to lstrip the URL.
// eslint-disable-next-line no-control-regex
const LEADING_WS_RE = /^[\s\x00-\x1f\x7f]+/;

// Allowed leading shapes: explicit safe schemes, relative paths, anchors.
const ALLOWED_PREFIX_RE = /^(?:https?:|mailto:|tel:|[/.#?])/i;

/**
 * Decode HTML numeric character references at the head of a URL so that an
 * attacker-encoded scheme prefix is normalised before the scheme allowlist
 * runs. Decodes ONLY the head — full URL decoding is the browser's job.
 */
function decodeLeadingEntities(value: string): string {
  return value.replace(/^(?:&#(?:x([0-9a-f]+)|([0-9]+));)+/i, (full) => {
    return full.replace(
      /&#(?:x([0-9a-f]+)|([0-9]+));/gi,
      (_match, hex: string | undefined, dec: string | undefined) => {
        const code = hex !== undefined ? parseInt(hex, 16) : parseInt(dec ?? "0", 10);
        if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return "";
        return String.fromCodePoint(code);
      },
    );
  });
}

export function sanitizeUrl(rawUrl: string): string | null {
  // Decode leading numeric entities so encoded scheme prefixes can't slip
  // past the allowlist.
  const decoded = decodeLeadingEntities(rawUrl);

  // Strip leading whitespace + ASCII controls.
  const trimmed = decoded.replace(LEADING_WS_RE, "");

  if (trimmed.length === 0) return null;

  // Refuse URLs containing whitespace / newlines / control chars anywhere.
  if (CONTROL_OR_WS_RE.test(trimmed)) return null;

  if (FORBIDDEN_SCHEME_RE.test(trimmed)) return null;

  // Allow recognised safe schemes and relative paths.
  if (ALLOWED_PREFIX_RE.test(trimmed)) return trimmed;

  // No leading scheme prefix and no leading slash/dot/anchor: treat as a
  // bare relative path (e.g. "page.html"). Reject if a colon appears before
  // any slash — that means an unknown scheme.
  const firstColon = trimmed.indexOf(":");
  const firstSlash = trimmed.indexOf("/");
  if (firstColon !== -1 && (firstSlash === -1 || firstColon < firstSlash)) {
    return null;
  }

  return trimmed;
}
