import { z } from "zod";
import { AssetRefSchema } from "./blocks/asset-ref.js";
import { BlockEnvelopeSchema } from "./blocks/index.js";

/**
 * Schema version of the site root. v1.x is additive-only, so this constant
 * stays at 1 for the entire v1 series. Real version-bump migrations land
 * in #26 and bump this constant.
 */
export const SITE_SCHEMA_VERSION = 1 as const;

const SocialLinkSchema = z.looseObject({
  platform: z.string().min(1),
  url: z.string().min(1),
});

const OrgSchema = z.looseObject({
  name: z.string().min(1),
  tagline: z.string().optional(),
  foundedYear: z.number().int().optional(),
  logo: AssetRefSchema.optional(),
  logoAlt: z.string().optional(),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  social: z.array(SocialLinkSchema).optional(),
});

const ThemeTokensSchema = z.looseObject({
  colorPrimary: z.string().optional(),
  colorAccent: z.string().optional(),
  fontHeadline: z.string().optional(),
  fontBody: z.string().optional(),
  density: z.string().optional(),
  radius: z.string().optional(),
});

const ThemeSchema = z.looseObject({
  /**
   * Built-in Theme id (`modern`, `civic`, …) or an imported Theme package's
   * namespaced id (`org.example.practice`). An id that resolves to neither is
   * a validation error with a repair action, not a silent fallback — see
   * ADR 0051 and `themeReferenceIssue` in `@sosb/renderer`.
   */
  id: z.string().min(1),
  /**
   * Version of the imported Theme package this Site was last edited against.
   * Absent for built-in Themes. Recorded so a same-id import can tell the
   * author whether it is an upgrade, a downgrade, or the same version.
   */
  version: z.string().min(1).optional(),
  tokens: ThemeTokensSchema.optional(),
  /** Active page-shell variant (header/nav/footer treatment), if any. */
  shellVariant: z.string().min(1).optional(),
  /**
   * Per-Theme memory of shell-variant choices, keyed by Theme id. The Block
   * envelope's `variantsByTheme` counterpart, with the same rationale.
   */
  shellVariantsByTheme: z.record(z.string(), z.string()).optional(),
});

const PageSeoSchema = z.looseObject({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const PageSchema = z.looseObject({
  slug: z.string().min(1),
  lang: z.string().min(1),
  navLabel: z.string().min(1),
  navOrder: z.number().int(),
  showInNav: z.boolean(),
  seo: PageSeoSchema.optional(),
  blocks: z.array(BlockEnvelopeSchema),
  localizedAs: z.record(z.string(), z.string()).optional(),
});

export const SiteSchema = z.looseObject({
  schemaVersion: z.literal(SITE_SCHEMA_VERSION),
  org: OrgSchema,
  theme: ThemeSchema,
  defaultLanguage: z.string().min(1),
  languages: z.array(z.string().min(1)).min(1),
  pages: z.array(PageSchema),
});

export type Site = z.infer<typeof SiteSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Org = z.infer<typeof OrgSchema>;

/**
 * Strict-parse helper: throws on shape violations. Use when the caller has
 * already gated the input through `validate()` and now needs typed access
 * to the data. For diagnostic flows, prefer `validate()` directly.
 */
export function parseSite(data: unknown): Site {
  return SiteSchema.parse(data);
}
