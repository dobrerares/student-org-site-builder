/**
 * Page slug rules.
 *
 * Per PRD: slugs are flat (no nested `/`), URL-safe, deterministic. The
 * renderer maps a non-home page to `/<slug>/` and the build pipeline emits
 * `dist/<slug>/index.html`. Two consequences for the slug rules:
 *
 *   1. No `/` ever — that would imply nested page hierarchy, explicitly
 *      out-of-scope for v1 (see issue #23 + PRD § 195).
 *   2. The slug must round-trip through a URL path segment without
 *      percent-encoding to keep generated paths human-readable.
 *
 * The shipped pattern is a conservative subset: lowercase ASCII letters and
 * digits, optional hyphens between segments. Romanian content uses ASCII-fold
 * conventions in v1 (`despre`, `acasa`, `puterea-cuvintelor`); the wizard /
 * import flow is responsible for ASCII-folding accented characters before
 * the slug is stored.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SlugValidationFailure {
  readonly code: "slug.empty" | "slug.containsSlash" | "slug.invalidCharacters" | "slug.malformed";
  readonly message: string;
}

/**
 * Stateless slug check. Returns `null` on success, a structured failure
 * otherwise. The editor surfaces `message` as the inline error and the schema
 * uses `code` for diagnostic reporting.
 */
export function checkSlug(value: string): SlugValidationFailure | null {
  if (value.length === 0) {
    return { code: "slug.empty", message: "Page slug cannot be empty." };
  }
  if (value.includes("/")) {
    return {
      code: "slug.containsSlash",
      message: "Page slug cannot contain '/'. Nested page hierarchy is not supported.",
    };
  }
  // Catch obvious garbage early with a friendlier message than the catch-all.
  if (/[^a-zA-Z0-9-]/.test(value)) {
    return {
      code: "slug.invalidCharacters",
      message: "Page slug must contain only lowercase letters, digits, and hyphens.",
    };
  }
  if (!SLUG_PATTERN.test(value)) {
    return {
      code: "slug.malformed",
      message:
        "Page slug must be lowercase letters, digits, and single hyphens between segments (e.g. 'despre', 'puterea-cuvintelor').",
    };
  }
  return null;
}

export function isValidSlug(value: string): boolean {
  return checkSlug(value) === null;
}
