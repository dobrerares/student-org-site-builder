/**
 * The `theme.json` manifest (ADR 0050).
 *
 * Phase one is deliberately declarative: a Theme package is a manifest, a
 * stylesheet, fonts and decorative images. There is no executable code, so
 * "install a Theme" cannot mean "run a stranger's JavaScript" yet, even though
 * ADR 0046 permits trusted extensions to ship code eventually.
 *
 * Forward compatibility is a design constraint, not an afterthought. Phase two
 * adds Custom Blocks with render code, and it must not break packages authored
 * today. Three properties get us there:
 *
 *  - `formatVersion` is an exact literal. A future format bumps it, and this
 *    builder rejects it by name rather than half-understanding it.
 *  - Every object in the manifest is a *loose* object, so a phase-two package
 *    carrying `render`, `public` or `blocks` keys still parses here. Unknown
 *    keys are preserved, matching the Site schema's preserve-unknown-keys rule
 *    (ADR 0002).
 *  - `builder.formatVersion` lets a package state which builder format it
 *    needs, so "this Theme requires a newer builder" is a clear message rather
 *    than a mystery rendering failure.
 *
 * What is deliberately *not* here: anything resembling editable content.
 * ADR 0046 draws that line — Themes style, Blocks hold content. A Theme that
 * could declare its own text fields would quietly become an un-editable
 * second content model.
 */

import { z } from "zod";

/** The only manifest format this builder understands. */
export const THEME_FORMAT_VERSION = 1 as const;

/**
 * Namespaced package id, e.g. `org.example.practice`.
 *
 * Two or more dot-separated segments are required: the namespace is what stops
 * two unrelated developers both shipping `dark` and colliding in a Site's
 * `themes/` directory. Segments are lowercase alphanumeric with internal
 * hyphens, which keeps the id safe as a filesystem path, a zip entry name, a
 * CSS attribute value and a URL segment without any escaping.
 */
export const THEME_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/** Conservative semver: `major.minor.patch` with an optional pre-release. */
export const THEME_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * A bundle-relative file path. No absolute paths, no `..`, no backslashes, no
 * leading `./` — the same rules the zip importer enforces, applied at manifest
 * level so a malformed path is a *validation* error naming the field rather
 * than an extraction error naming a zip entry.
 */
export const THEME_PATH_RE = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

const ThemePathSchema = z
  .string()
  .min(1)
  .regex(THEME_PATH_RE, "must be a relative path without '..' or backslashes")
  .refine((p) => !p.split("/").includes(".."), "must not contain a '..' segment");

const VariantSchema = z.looseObject({
  /** Stable id. Lands in Site data and in the emitted `data-variant`. */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase slug"),
  /** What the author picks from in the Block Inspector. */
  label: z.string().min(1),
  description: z.string().optional(),
});

/**
 * Which builder appearance controls the Theme honours.
 *
 * Every flag defaults to `true`: a Theme that says nothing is assumed to be a
 * good citizen that respects the author's colour and font choices. A Theme
 * with a fixed brand palette opts *out* explicitly, and the editor then hides
 * those controls rather than offering settings the CSS ignores.
 */
const SupportsSchema = z.looseObject({
  colors: z.boolean().default(true),
  fonts: z.boolean().default(true),
  density: z.boolean().default(true),
  radius: z.boolean().default(true),
});

const TokensSchema = z.looseObject({
  colorPrimary: z.string().optional(),
  colorAccent: z.string().optional(),
  fontHeadline: z.string().optional(),
  fontBody: z.string().optional(),
  density: z.string().optional(),
  radius: z.string().optional(),
});

const FontSchema = z.looseObject({
  family: z.string().min(1),
  weight: z.number().int().min(1).max(1000),
  style: z.enum(["normal", "italic"]).default("normal"),
  file: ThemePathSchema,
  /** CSS `unicode-range`. Omit to let the face cover everything. */
  unicodeRange: z.string().optional(),
});

/**
 * The public-site script and what it depends on (ADR 0046, ADR 0054).
 *
 * `network` is **required** when the block is present, even when the honest
 * answer is `[]`. ADR 0046 says each extension "must document those
 * dependencies and which functionality is unavailable offline"; a field with a
 * default would let a Theme ship a script that calls out while the manifest
 * stayed silent, which is the exact failure the rule exists to prevent. Making
 * the empty case an explicit `[]` also means "this script is self-contained"
 * is something the author *said*, not something the builder assumed.
 *
 * `offline` is required only when `network` is non-empty, because with no
 * hosts there is nothing to be unavailable.
 */
/**
 * A host the public-site script may contact: a bare hostname, optionally with
 * a port or a leading `*.` wildcard. Not a URL — a scheme or a path here is a
 * sign the author pasted an endpoint, and an endpoint is not a dependency
 * declaration a reader can scan.
 */
export const THEME_NETWORK_HOST_RE =
  /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i;

const PublicScriptSchema = z
  .looseObject({
    file: ThemePathSchema,
    /** Hosts the script may contact on the published Site. `[]` for none. */
    network: z.array(
      z
        .string()
        .min(1)
        .regex(THEME_NETWORK_HOST_RE, "must be a hostname such as 'api.example.org', not a URL"),
    ),
    /** What stops working without a network. */
    offline: z.string().min(1).optional(),
  })
  .refine((v) => v.network.length === 0 || (v.offline ?? "").length > 0, {
    message:
      "declares network hosts, so it must also declare `offline` — what stops working without a connection",
    path: ["offline"],
  });

const BuilderCompatSchema = z.looseObject({
  /**
   * The manifest format the package is authored against. Separate from the
   * top-level `formatVersion` so a future package can require a newer builder
   * while still being *parseable* by this one — that is what lets us say
   * "this Theme needs a newer builder" instead of "invalid package".
   */
  formatVersion: z.literal(THEME_FORMAT_VERSION),
});

export const ThemeManifestSchema = z.looseObject({
  formatVersion: z.literal(THEME_FORMAT_VERSION),
  id: z
    .string()
    .min(1)
    .regex(THEME_ID_RE, "must be a namespaced lowercase id such as 'org.example.practice'"),
  name: z.string().min(1),
  version: z.string().regex(THEME_VERSION_RE, "must be a semver version such as '1.2.0'"),
  builder: BuilderCompatSchema,
  description: z.string().default(""),
  author: z.string().default(""),
  license: z.string().default(""),
  supports: SupportsSchema.default({
    colors: true,
    fonts: true,
    density: true,
    radius: true,
  }),
  tokens: TokensSchema.default({}),
  /**
   * Baseline tokens as raw CSS custom properties, for Themes that prefer to
   * ship a palette keyed by CSS property rather than by schema key. Mirrors
   * the built-in themes' `*_BASELINE_TOKENS` tuples (ADR 0032).
   */
  cssTokens: z.record(z.string(), z.string()).default({}),
  /** Block type -> named design variants. */
  variants: z.record(z.string(), z.array(VariantSchema)).default({}),
  /** Page-shell variants (header / nav / footer treatments). */
  shellVariants: z.array(VariantSchema).default([]),
  fonts: z.array(FontSchema).default([]),
  /** Entry stylesheet, bundle-relative. */
  css: ThemePathSchema.default("theme.css"),
  /**
   * The executable rendering module (ADR 0054), bundle-relative. Absent for a
   * declarative package, which is still a complete Theme — phase two adds a
   * capability, it does not raise the floor.
   */
  render: ThemePathSchema.optional(),
  /** The public-site script and its declared external dependencies. */
  public: PublicScriptSchema.optional(),
  // There is deliberately no `preview` block of swatches and sample words.
  // The pickers render a real miniature of the Theme instead, so a
  // hand-written palette here would be a second copy of what `theme.css`
  // already says, free to drift with nothing to catch it. The manifest is a
  // loose object, so a package that still carries one parses and is ignored.
});

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;
export type ThemeManifestPublicScript = z.infer<typeof PublicScriptSchema>;
export type ThemeManifestVariant = z.infer<typeof VariantSchema>;
export type ThemeManifestFont = z.infer<typeof FontSchema>;
