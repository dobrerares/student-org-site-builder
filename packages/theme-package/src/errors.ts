/**
 * Rejection reasons for a Theme package.
 *
 * Every rejection carries a stable `code` so the editor can choose its own
 * localised wording and, where it makes sense, offer a repair. The `message`
 * is developer-facing English: the person who needs it is the Theme author
 * debugging their own package, not the student editing a site.
 *
 * Rejecting loudly is the point. A half-loaded Theme — one whose CSS silently
 * dropped a rule, or whose font file was missing — renders a site that looks
 * *nearly* right, which is the hardest kind of bug for a non-technical author
 * to notice, let alone report.
 */
export type ThemePackageErrorCode =
  /** `theme.json` missing, unreadable, or not JSON. */
  | "manifest-missing"
  /** `theme.json` present but fails the schema. */
  | "manifest-invalid"
  /** `formatVersion` is a number this builder does not implement. */
  | "format-version-unsupported"
  /** A file the manifest names is not in the package. */
  | "file-missing"
  /** A path escapes the package root, or the zip is malformed. */
  | "path-unsafe"
  /** The CSS reaches for the network — forbidden offline (ADR 0046). */
  | "css-unsafe"
  /**
   * `render.js` will not load: a syntax error, no `export default`, an
   * `import` of another module, or a runaway top-level loop. Rejected at
   * import time rather than at render time, because a Theme whose design
   * throws on every page is not a Theme the author should be able to select.
   */
  | "render-invalid"
  /** The package is structurally fine but too large to be reasonable. */
  | "package-too-large";

export class ThemePackageError extends Error {
  readonly code: ThemePackageErrorCode;
  /** Field path or file path the problem attaches to, when there is one. */
  readonly at: string | undefined;

  constructor(code: ThemePackageErrorCode, message: string, at?: string) {
    super(message);
    this.name = "ThemePackageError";
    this.code = code;
    this.at = at;
  }
}

/** Narrowing helper for call sites that catch broadly. */
export function isThemePackageError(value: unknown): value is ThemePackageError {
  return value instanceof ThemePackageError;
}
