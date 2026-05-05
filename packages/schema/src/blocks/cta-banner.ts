import { z } from "zod";

/**
 * `ctaBanner` block — call-to-action band with a single button.
 *
 * Per issue #16:
 *   - title is required (the headline visitors see).
 *   - subtitle is optional supporting copy.
 *   - button is required and carries `{ label, url, style }`. v1 is single-button.
 *   - backgroundImage is an optional `AssetRef`-shaped reference to an image
 *     in the VFS. When absent, themes fall back to a solid colour from
 *     theme tokens.
 *
 * Forward-compat: declared with `z.looseObject()` so unknown fields survive
 * a read-write-read round trip (the v1.x contract).
 *
 * URL validation accepts:
 *   - http(s) absolute URLs (the most common case),
 *   - mailto: links,
 *   - tel: links,
 *   - site-relative paths starting with `/`.
 *   It rejects free-text strings and any URL whose scheme is not in the
 *   allow-list (notably `javascript:` and `data:` are rejected as unsafe).
 */

const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Validate a button URL string. Returns true iff the value is safe to put on
 * an outbound `<a href>` attribute on a published static site.
 *
 * The check is intentionally narrow: we accept the schemes a student-org
 * site realistically needs and explicitly reject `javascript:` and `data:`,
 * which are XSS vectors and have no legitimate use in this context.
 */
function isAcceptableButtonUrl(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  // Site-relative paths are allowed — they resolve against the deployed origin.
  if (value.startsWith("/")) return true;
  // Otherwise, the value must parse as an absolute URL with an allowed scheme.
  try {
    const parsed = new URL(value);
    return SAFE_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}

export const CtaButtonStyleSchema = z.enum(["primary", "secondary"]);

export const CtaButtonSchema = z.looseObject({
  label: z.string().min(1, "Button label is required."),
  url: z.string().min(1, "Button URL is required.").refine(isAcceptableButtonUrl, {
    message:
      "Button URL is malformed. Use a full URL (https://example.org), a site-relative path (/contact), or mailto:/tel: links.",
  }),
  style: CtaButtonStyleSchema,
});

/**
 * `AssetRef`-shaped reference for `backgroundImage`. Mirrors the structural
 * fields of `@sosb/assets`'s `AssetRef` (#8) without taking a runtime
 * dependency on that package — the schema layer must stay free of editor /
 * pipeline dependencies. The shape is `looseObject` so future fields on
 * AssetRef do not break this schema.
 */
export const CtaBannerAssetRefSchema = z.looseObject({
  hash: z.string().min(1),
  path: z.string().min(1),
  metadataPath: z.string().min(1),
  mime: z.string().min(1),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  // alt is required when the AssetRef is present; an empty string surfaces
  // as a *warning*, not a hard error (handled by the validate-rules pass,
  // mirroring the hero block's contract).
  alt: z.string(),
});

export const CtaBannerDataSchema = z.looseObject({
  title: z.string().min(1, "ctaBanner needs a title."),
  subtitle: z.string().optional(),
  button: CtaButtonSchema,
  backgroundImage: CtaBannerAssetRefSchema.optional(),
});

export const CtaBannerBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("ctaBanner"),
  version: z.literal(1),
  data: CtaBannerDataSchema,
});

export const CTA_BANNER_BLOCK_VERSION = 1 as const;

export type CtaButtonStyle = z.infer<typeof CtaButtonStyleSchema>;
export type CtaButton = z.infer<typeof CtaButtonSchema>;
export type CtaBannerAssetRef = z.infer<typeof CtaBannerAssetRefSchema>;
export type CtaBannerData = z.infer<typeof CtaBannerDataSchema>;
export type CtaBannerBlock = z.infer<typeof CtaBannerBlockSchema>;
