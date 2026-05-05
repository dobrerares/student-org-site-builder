# 0006 — Embed block: 8-provider whitelist, nocookie variants, lazy iframe loading

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #20

## Context

Issue #20 asks for the `embed` block: a closed whitelist of 8 providers
(YouTube, Vimeo, Spotify, Instagram, Facebook, SoundCloud, Bandcamp,
Twitter/X), per-provider URL validation that rejects mismatches, nocookie /
privacy variants where each provider supports them, lazy iframe loading
driven by `IntersectionObserver` (lazy-load JS under 1kb minified), and
hardened iframe attributes (`loading="lazy"`, accessible `title`, `sandbox`,
`referrerpolicy`, `allow`).

The PRD (Implementation Decisions → "embed enforces a closed provider
whitelist (YouTube, Vimeo, Spotify, Instagram, Facebook, SoundCloud,
Bandcamp, Twitter), nocookie variants where available, lazy iframe loading"
and User Story 88: "I want it to load only when I scroll near it") fixes
the substantive policy. This ADR records the implementation seams.

## Decision

### Closed 8-provider whitelist

`@sosb/schema` exports `EMBED_PROVIDERS` as a `readonly tuple`:

```
["bandcamp", "facebook", "instagram", "soundcloud",
 "spotify",  "twitter",  "vimeo",     "youtube"]
```

The block schema's `provider` field is `z.enum(EMBED_PROVIDERS)`, so any
value outside the whitelist is rejected at schema-parse time and never
reaches the renderer. New providers (TikTok, LinkedIn, …) require an
issue, an ADR amendment, and a new entry; they are explicitly out of
scope for #20.

### Per-provider URL validation

`EMBED_URL_PATTERNS` maps each provider to a `RegExp` that pins the
canonical content-URL shapes the user is likely to paste. Each pattern:

- requires `https://`,
- pins the domain (no subdomain spoofing — `evil.example.com/youtube.com/…`
  is rejected),
- accepts widely-known aliases (`youtu.be`, `x.com`, `fb.watch`,
  `player.vimeo.com`).

The schema's `superRefine` on `EmbedDataSchema` runs the chosen provider's
regex against `data.url`; mismatches surface as a hard error issue at the
`["url"]` path with a human-readable message ("URL does not match the
pattern expected for provider \"youtube\"…"). The editor (#7) consumes the
same `EmbedBlockSchema` and `validateBlock` and surfaces the issue inline.

The same `EMBED_URL_PATTERNS` map is exported from `@sosb/schema` so the
renderer (and tests) cross-check against the single source of truth, never
re-implementing pattern logic.

### nocookie / privacy variants per provider

The privacy posture defaults to **on** for every embed (`privacyMode`
defaults to `true` at consume-time in the renderer; the JSON shape leaves
it `undefined` so the persisted document doesn't lock in a default that
might evolve). Per provider:

| Provider   | Canonical               | Privacy variant                                                   | Notes                                                       |
| ---------- | ----------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| YouTube    | `www.youtube.com`       | `www.youtube-nocookie.com`                                        | Substitution at iframe-src compose time.                    |
| Vimeo      | `player.vimeo.com`      | adds `?dnt=1`                                                     | "Do Not Track" param honoured by Vimeo per their docs.      |
| Spotify    | `open.spotify.com`      | always uses `open.spotify.com/embed/*` (no marketing cookies).    | Spotify embed origin is privacy-equivalent by default.      |
| SoundCloud | `w.soundcloud.com`      | uses the iframe player; no `widgets.js` script loaded             | The iframe pulls audio only on hydration.                   |
| Bandcamp   | `bandcamp.com`          | uses the static EmbeddedPlayer iframe                             | No nocookie equivalent exists; player is cookieless static. |
| Instagram  | `www.instagram.com`     | static blockquote + outbound link; `embed.js` never loaded        | Click-through to canonical post.                            |
| Facebook   | `www.facebook.com`      | static blockquote + outbound link; `connect.facebook.net` blocked | Click-through to canonical post.                            |
| Twitter/X  | `twitter.com` / `x.com` | static blockquote + outbound link; `widgets.twitter.com` blocked  | Click-through to canonical tweet.                           |

**Why blockquote-mode for Instagram / Facebook / Twitter:** Each of these
providers' "official" embed flow ships a third-party JavaScript blob that
loads identifying cookies on initial paint (Meta Pixel, Twitter widgets).
The PRD's privacy posture forbids that. Static blockquote + outbound link
preserves the user's intent (click the post on the originating platform)
without third-party scripts running on the visitor's first paint.

### Lazy iframe loading via IntersectionObserver

When `lazyLoad: true` (the default), iframe-mode embeds render as
`<figure data-block="embed" data-embed-src="…" data-embed-title="…" …>`
placeholder elements with the resolved iframe URL and hardened attributes
baked into `data-embed-*` attributes. The page-shell emits a single small
`<script data-sosb-embed-loader>` block per page that has any lazy embeds.
The script:

1. Selects every `figure[data-block="embed"][data-embed-src]`.
2. If `IntersectionObserver` is unsupported (very old browser), eagerly
   hydrates each placeholder; the resulting iframe still uses
   `loading="lazy"` so the browser handles deferral.
3. Otherwise, observes each placeholder with a `200px 0px` rootMargin and
   on intersection swaps in a real `<iframe>` carrying the `loading="lazy"`,
   `sandbox`, `allow`, `referrerpolicy`, and `allowfullscreen` attributes
   the renderer baked in.

The script never sets `innerHTML` and only uses safe DOM methods
(`createElement`, `setAttribute`, `replaceChildren`) so there is no
sanitisation concern even if a future contributor unwittingly extends the
data-\* contract.

The script is hand-minified and the test suite asserts its UTF-8 size is
under 1024 bytes (current footprint: ~700 bytes).

The `<noscript>` slot inside each lazy `<figure>` carries the same iframe
markup so visitors with JS disabled still see the embed (it just loads
eagerly, governed by the browser's own `loading="lazy"`).

### Hardened iframe attributes

Every iframe rendered by the embed block carries:

- `loading="lazy"` — browser-level lazy-loading.
- `title="…"` — the schema-required, non-empty accessible name. Asserted by
  axe-core in the embed-block accessibility test.
- `sandbox="…"` — minimum-privilege per provider (typically
  `allow-scripts allow-same-origin allow-popups
allow-popups-to-escape-sandbox`; YouTube also gets `allow-presentation`
  for the cast button).
- `referrerpolicy="…"` — `no-referrer-when-downgrade` for video providers,
  `strict-origin-when-cross-origin` for audio providers.
- `allow="…"` — conservative per provider; **never** grants `microphone` /
  `camera` / `geolocation`. Asserted by the test suite.
- `allowfullscreen` — for video providers only.
- `data-embed-provider="…"` — for analytics-free debugging in DevTools.

### Schema shape

```ts
const EmbedDataSchema = z.looseObject({
  provider: z.enum(EMBED_PROVIDERS),
  url: z.string().min(1), // pattern-checked in superRefine
  title: z.string().min(1), // a11y requirement
  aspectRatio: z
    .string()
    .regex(/^\d+:\d+$/)
    .optional(),
  lazyLoad: z.boolean().optional(), // renderer-default = true
  privacyMode: z.boolean().optional(), // renderer-default = true
});
```

`EmbedBlock` and `EmbedData` are derived via `z.input<typeof …>` (rather
than `z.infer`) so the persisted JSON shape is the one the rest of the
codebase sees — `lazyLoad` / `privacyMode` are honestly `boolean | undefined`
on disk, with the renderer applying the privacy-by-default at consume time.

### Aspect ratio default per provider

When `aspectRatio` is omitted, the renderer applies a sensible default per
provider type (16:9 for video, 1:1 for image-first/audio formats). Pinning
the aspect ratio at render time avoids cumulative-layout-shift on lazy
hydration, since the figure reserves space before the iframe instantiates.

### Test plan

- **Schema:** every provider's documented happy-path URLs validate;
  swapping URLs across providers must reject; clearly bogus URLs
  (`javascript:`, plain text, look-alike domains) reject; happy embeds
  produce no errors via `validateBlock`.
- **Renderer:** every iframe carries `loading="lazy"`, a non-empty `title`,
  `sandbox`, `referrerpolicy`, and a microphone/camera-free `allow=` list.
- **Renderer / privacy:** YouTube uses youtube-nocookie.com; Vimeo includes
  `?dnt=1`; Spotify uses the embed origin; SoundCloud/Bandcamp use their
  cookieless iframes; Instagram/Facebook/Twitter render as blockquote +
  outbound link with no `widgets.twitter.com` / `connect.facebook.net` /
  `instagram.com/embed.js` script loaded.
- **Renderer / lazy:** the `<script data-sosb-embed-loader>` is emitted iff
  the page has at least one lazy embed, exactly once, and uses
  `IntersectionObserver`; the script's UTF-8 size is `< 1024 bytes`.
- **Renderer / a11y:** axe-core has zero violations on the embed-only
  fixture page.
- **Golden files:** one per provider × stub theme (8 total). The Academic
  theme (#47) regenerates the matrix when it lands.

## Rationale

The closed whitelist + per-provider regex is the only way to get a binding
contract that the editor never produces an off-whitelist embed: a
permissive URL field would let a future bug or copy-paste accident smuggle
in a tracker. Privacy-by-default with explicit opt-out (`privacyMode:
false`) matches the PRD's "respectful of bandwidth and tracking" framing
and the user story 88 brief: visitors should never have their data eaten by
third parties for a feature the org didn't even use yet.

The blockquote fallback for the three Meta-property providers is the
substantive privacy decision in this ADR. The alternative (loading
`widgets.twitter.com/widgets.js` etc. lazily after intersection) still
loads tracking cookies at the moment of intersection — the visitor's first
scroll-near becomes a third-party identifier event. The blockquote pattern
preserves the user's intent (open the post) without ever loading the
provider's JS in this site's origin.

The hand-minified `IntersectionObserver` loader is small enough to inline
without touching the build pipeline. Pulling in a dedicated lazy-loading
library would be over-engineered for this surface.

## Consequences

- `@sosb/schema` exports `EMBED_PROVIDERS`, `EMBED_URL_PATTERNS`,
  `EmbedBlockSchema`, `EmbedDataSchema`, `isValidEmbedUrl`, and the types
  `EmbedBlock`, `EmbedData`, `EmbedProvider`.
- `@sosb/renderer` exports `EMBED_LAZY_LOAD_SCRIPT` and `resolveEmbed`
  alongside `renderSite`. The page-shell emits the lazy-loader script only
  when a page has lazy embed blocks.
- The renderer's stub theme contributes layout-only CSS for the `.embed`
  figure (`aspect-ratio`, placeholder background). The Academic theme (#47)
  and the rest (#28-#31) replace these with curated visual treatments.
- Eight new golden files land in
  `packages/renderer/test/__golden__/stub-theme-embed-{provider}.html`.
- Existing hero-only and build-pipeline goldens regenerate to absorb the
  new stub-theme CSS rules.

## Alternatives considered

- **oEmbed auto-detection from arbitrary URLs.** Rejected: the PRD
  explicitly says the provider must be explicit, and oEmbed often pulls
  third-party scripts. Out of scope per #20's triage notes.
- **Custom iframe `allow=` editing in the UI.** Rejected: surfaces a
  security footgun. Per-provider defaults with no override is the safest
  posture.
- **An external lazy-load library (lozad, lazysizes, …).** Rejected: the
  AC pins <1kb minified for the lazy-load JS; a dependency would also
  introduce update + supply-chain surface.
- **Loading `widgets.twitter.com` etc. after intersection.** Rejected for
  privacy: see Rationale above.
- **Skipping nocookie substitution.** Rejected: the PRD explicitly
  requires nocookie variants where the provider offers them.

## Out of scope

- New providers beyond the 8 (TikTok, LinkedIn, etc.) — separate ticket.
- A "click-to-load" overlay (an extra layer of consent before even the
  intersection-triggered hydration). Could be a follow-up if a stricter
  privacy mode is requested.
- Editor UI for the embed block — owned by the wizard / spine-form (#7,
  later issues).
- Per-theme curated visual treatment for the embed block (Academic theme =
  #47, others = #28-#31).
