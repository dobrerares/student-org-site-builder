import { z } from "zod";

/**
 * Embed block (issue #20).
 *
 * Per the PRD: a closed whitelist of 8 providers (YouTube, Vimeo, Spotify,
 * Instagram, Facebook, SoundCloud, Bandcamp, Twitter), with each URL
 * validated against the chosen provider's URL pattern. nocookie / privacy
 * variants are emitted by the renderer where the provider offers them; the
 * lazy-load AC ("iframe instantiated only when scrolled near") is also a
 * renderer concern. This file owns the schema only.
 *
 * Why per-provider patterns rather than a single permissive URL field:
 * the AC explicitly requires "all 8 providers' URL patterns validated;
 * mismatches rejected with clear errors". A user picking "youtube" and
 * pasting a Vimeo URL is rejected by the schema, never reaches the
 * renderer, and never produces an off-whitelist embed at build time.
 */

/** The closed 8-provider whitelist, in alphabetical order. */
export const EMBED_PROVIDERS = [
  "bandcamp",
  "facebook",
  "instagram",
  "soundcloud",
  "spotify",
  "twitter",
  "vimeo",
  "youtube",
] as const;

export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

/**
 * Per-provider URL patterns. Each pattern matches the canonical, public,
 * non-malicious shapes of that provider's content URL. They are deliberately
 * written to:
 *
 *  - require https,
 *  - pin the domain (no subdomain spoofing like `evil.example.com/youtube.com`),
 *  - allow common alias forms the user is likely to paste (e.g. `youtu.be`,
 *    `x.com`, `fb.watch`, `player.vimeo.com`).
 *
 * Patterns are exported so the renderer (and future tests) can cross-check
 * against the same source-of-truth.
 */
export const EMBED_URL_PATTERNS: Readonly<Record<EmbedProvider, RegExp>> = {
  // YouTube — watch links, shortened links, embed links, shorts.
  youtube:
    /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=[\w-]+(?:&[^\s]*)?|embed\/[\w-]+(?:\?[^\s]*)?|shorts\/[\w-]+(?:\?[^\s]*)?)|youtu\.be\/[\w-]+(?:\?[^\s]*)?)$/,
  // Vimeo — main site or player.vimeo.com.
  vimeo:
    /^https:\/\/(?:www\.)?(?:vimeo\.com\/(?:channels\/[\w-]+\/)?(?:video\/)?\d+(?:\/[\w-]+)?(?:\?[^\s]*)?|player\.vimeo\.com\/video\/\d+(?:\?[^\s]*)?)$/,
  // Spotify — open.spotify.com canonical content URLs.
  spotify:
    /^https:\/\/open\.spotify\.com\/(?:track|episode|playlist|album|show|artist)\/[A-Za-z0-9]+(?:\?[^\s]*)?$/,
  // Instagram — public posts and reels.
  instagram: /^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+\/?(?:\?[^\s]*)?$/,
  // Facebook — page posts, videos, fb.watch shortlinks.
  facebook:
    /^https:\/\/(?:www\.)?(?:facebook\.com\/[\w.-]+\/(?:posts|videos)\/[\w/]+\/?(?:\?[^\s]*)?|fb\.watch\/[\w-]+\/?(?:\?[^\s]*)?)$/,
  // SoundCloud — artist tracks and sets.
  soundcloud:
    /^https:\/\/(?:www\.)?soundcloud\.com\/[\w-]+(?:\/(?:sets\/)?[\w-]+)?\/?(?:\?[^\s]*)?$/,
  // Bandcamp — artist subdomain with a track or album.
  bandcamp: /^https:\/\/[\w-]+\.bandcamp\.com\/(?:track|album)\/[\w-]+\/?(?:\?[^\s]*)?$/,
  // Twitter / X — status URLs.
  twitter:
    /^https:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[\w]+\/status\/\d+(?:\?[^\s]*)?$/,
};

const EmbedProviderSchema = z.enum(EMBED_PROVIDERS);

const AspectRatioSchema = z
  .string()
  .regex(/^\d+:\d+$/, "Aspect ratio must be in W:H form, e.g. 16:9.");

/**
 * The data shape behind an embed block.
 *
 * `lazyLoad` and `privacyMode` default to `true` per the PRD's "privacy by
 * default" stance. The renderer honours these — see ADR 0006.
 */
export const EmbedDataSchema = z
  .looseObject({
    provider: EmbedProviderSchema,
    url: z.string().min(1),
    title: z.string().min(1),
    aspectRatio: AspectRatioSchema.optional(),
    /** Defaults to `true` (privacy by default). The renderer applies this
     *  default at consume time so the inferred type stays honest about what
     *  the persisted JSON shape actually looks like. */
    lazyLoad: z.boolean().optional(),
    /** Defaults to `true` (privacy by default). Applied by the renderer. */
    privacyMode: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const pattern = EMBED_URL_PATTERNS[data.provider];
    if (!pattern.test(data.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: `URL does not match the pattern expected for provider "${data.provider}". Paste a canonical ${data.provider} URL.`,
      });
    }
  });

export const EmbedBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("embed"),
  version: z.literal(1),
  data: EmbedDataSchema,
});

export const EMBED_BLOCK_VERSION = 1 as const;

/**
 * EmbedBlock is the *input* shape of a persisted embed block — i.e. what
 * the editor writes to JSON. `lazyLoad` and `privacyMode` are optional in
 * this shape because the renderer applies their defaults (true) at consume
 * time. We use `z.input` rather than `z.infer` so the persisted JSON shape
 * is the one downstream code sees.
 */
export type EmbedBlock = z.input<typeof EmbedBlockSchema>;
export type EmbedData = z.input<typeof EmbedDataSchema>;

/**
 * Test whether a URL is a valid match for a given provider. Exposed so the
 * editor (and the renderer's cross-check) can use the same source-of-truth
 * regex without re-implementing it.
 */
export function isValidEmbedUrl(provider: EmbedProvider, url: string): boolean {
  const pattern = EMBED_URL_PATTERNS[provider];
  return pattern.test(url);
}
