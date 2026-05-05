/** @jsxImportSource preact */
import type { EmbedBlock, EmbedData, EmbedProvider } from "@sosb/schema";

/**
 * Embed block renderer (issue #20).
 *
 * The block schema (in `@sosb/schema`) already validated the URL against
 * the chosen provider's pattern, so the renderer can trust `data.provider`
 * + `data.url` and focus on:
 *
 *  - converting the canonical URL into the provider's iframe-embed URL,
 *  - substituting the nocookie / DNT variant when `privacyMode` is true,
 *  - emitting hardened iframe attributes (loading="lazy", title, sandbox,
 *    referrerpolicy, allow),
 *  - emitting a placeholder element for `lazyLoad: true` so the page-shell
 *    can wire up the small IntersectionObserver loader,
 *  - falling back to a static blockquote (with a link out) for providers
 *    that don't support an iframe embed reliably (Twitter, Instagram,
 *    Facebook) so no third-party scripts run on initial paint.
 *
 * Privacy posture (per ADR 0006):
 *  - YouTube => youtube-nocookie.com when privacyMode=true.
 *  - Vimeo => `dnt=1` query param.
 *  - Spotify, SoundCloud, Bandcamp => their canonical embed origins (which
 *    do not set marketing cookies; they're nocookie-equivalent by default).
 *  - Instagram, Facebook, Twitter => static blockquote + outbound link only.
 *    No widgets.js / instagram embed.js / connect.facebook.net is loaded.
 */

interface EmbedDataResolved {
  provider: EmbedProvider;
  url: string;
  title: string;
  aspectRatio: string;
  lazyLoad: boolean;
  privacyMode: boolean;
}

const DEFAULT_ASPECT_RATIO_BY_PROVIDER: Record<EmbedProvider, string> = {
  youtube: "16:9",
  vimeo: "16:9",
  spotify: "1:1",
  soundcloud: "16:5",
  bandcamp: "1:1",
  instagram: "1:1",
  facebook: "16:9",
  twitter: "16:9",
};

function resolveData(data: EmbedData): EmbedDataResolved {
  return {
    provider: data.provider,
    url: data.url,
    title: data.title,
    aspectRatio:
      typeof data.aspectRatio === "string" && data.aspectRatio.length > 0
        ? data.aspectRatio
        : DEFAULT_ASPECT_RATIO_BY_PROVIDER[data.provider],
    lazyLoad: data.lazyLoad ?? true,
    privacyMode: data.privacyMode ?? true,
  };
}

/**
 * Convert an aspect ratio string ("16:9") into a CSS value ready to drop
 * onto `aspect-ratio: ...;`.
 */
function aspectRatioToCss(ratio: string): string {
  // Validated by the schema (\d+:\d+); split is safe.
  const [w, h] = ratio.split(":");
  return `${w} / ${h}`;
}

interface IframeEmbed {
  kind: "iframe";
  src: string;
  allow: string;
  sandbox: string;
  referrerPolicy: string;
}

interface BlockquoteEmbed {
  kind: "blockquote";
  text: string;
  /** The URL to link out to. */
  linkUrl: string;
}

type ResolvedEmbed = IframeEmbed | BlockquoteEmbed;

function firstMatch(re: RegExp, input: string): string | undefined {
  const m = re.test(input) ? re : null;
  if (!m) return undefined;
  const result = input.match(re);
  return result?.[1];
}

function captureGroups(re: RegExp, input: string): RegExpMatchArray | null {
  return input.match(re);
}

/**
 * Provider-specific URL parsing + embed URL composition. Each function
 * receives the raw URL (already validated for shape against the provider
 * pattern) plus the privacyMode flag; it returns a `ResolvedEmbed`.
 */
const PROVIDERS: Record<EmbedProvider, (url: string, privacy: boolean) => ResolvedEmbed> = {
  youtube: (url, privacy) => {
    const id = extractYouTubeId(url);
    const host = privacy ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
    const src = `${host}/embed/${encodeURIComponent(id)}`;
    return {
      kind: "iframe",
      src,
      // Conservative: no microphone / camera / geolocation. autoplay is left
      // off since the iframe loads only after intersection.
      allow: "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
      sandbox:
        "allow-scripts allow-same-origin allow-popups allow-presentation allow-popups-to-escape-sandbox",
      referrerPolicy: "no-referrer-when-downgrade",
    };
  },
  vimeo: (url, privacy) => {
    const id = extractVimeoId(url);
    const params = new URLSearchParams();
    if (privacy) params.set("dnt", "1");
    const qs = params.toString();
    const src = `https://player.vimeo.com/video/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
    return {
      kind: "iframe",
      src,
      allow: "fullscreen; picture-in-picture; clipboard-write",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
      referrerPolicy: "no-referrer-when-downgrade",
    };
  },
  spotify: (url) => {
    // open.spotify.com/{kind}/{id} -> open.spotify.com/embed/{kind}/{id}
    const m = captureGroups(
      /^https:\/\/open\.spotify\.com\/(track|episode|playlist|album|show|artist)\/([A-Za-z0-9]+)/,
      url,
    );
    const kind = m?.[1] ?? "track";
    const id = m?.[2] ?? "";
    const src = `https://open.spotify.com/embed/${kind}/${encodeURIComponent(id)}`;
    return {
      kind: "iframe",
      src,
      allow: "encrypted-media; clipboard-write",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
      referrerPolicy: "strict-origin-when-cross-origin",
    };
  },
  soundcloud: (url) => {
    // SoundCloud's iframe embed expects the original artist URL via ?url=.
    // No widgets.js needed for the basic player.
    const params = new URLSearchParams({
      url,
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "true",
      show_reposts: "false",
      show_teaser: "false",
    });
    const src = `https://w.soundcloud.com/player/?${params.toString()}`;
    return {
      kind: "iframe",
      src,
      allow: "autoplay; clipboard-write",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
      referrerPolicy: "strict-origin-when-cross-origin",
    };
  },
  bandcamp: (url) => {
    // Bandcamp doesn't expose track/album IDs in URLs; their docs recommend
    // using the EmbeddedPlayer URL pattern. We use a link-fed embed that
    // points back at the canonical URL.
    const src = `https://bandcamp.com/EmbeddedPlayer/size=large/bgcol=ffffff/linkcol=0687f5/transparent=true/?u=${encodeURIComponent(url)}`;
    return {
      kind: "iframe",
      src,
      allow: "autoplay; clipboard-write",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
      referrerPolicy: "strict-origin-when-cross-origin",
    };
  },
  instagram: (url) => ({
    kind: "blockquote",
    text: "View this Instagram post",
    linkUrl: url,
  }),
  facebook: (url) => ({
    kind: "blockquote",
    text: "View this Facebook post",
    linkUrl: url,
  }),
  twitter: (url) => ({
    kind: "blockquote",
    text: "View this post on X / Twitter",
    linkUrl: url,
  }),
};

function extractYouTubeId(url: string): string {
  // Patterns: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID,
  // youtube.com/shorts/ID. The schema regex already constrained ID chars.
  const watchId = firstMatch(/[?&]v=([\w-]+)/, url);
  if (watchId) return watchId;
  const pathId = firstMatch(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts)\/)([\w-]+)/, url);
  return pathId ?? "";
}

function extractVimeoId(url: string): string {
  const direct = firstMatch(/vimeo\.com\/(?:channels\/[\w-]+\/)?(?:video\/)?(\d+)/, url);
  if (direct) return direct;
  const player = firstMatch(/player\.vimeo\.com\/video\/(\d+)/, url);
  return player ?? "";
}

/**
 * Resolve the iframe embed (or static blockquote) for an embed block. Pure;
 * exported for tests / cross-checks.
 */
export function resolveEmbed(data: EmbedData): ResolvedEmbed {
  const resolver = PROVIDERS[data.provider];
  return resolver(data.url, data.privacyMode ?? true);
}

export function Embed(props: { block: EmbedBlock }): preact.JSX.Element {
  const { id } = props.block;
  const data = resolveData(props.block.data);
  const resolved = resolveEmbed(props.block.data);
  const aspectCss = aspectRatioToCss(data.aspectRatio);
  const figureStyle = `aspect-ratio: ${aspectCss};`;

  if (resolved.kind === "blockquote") {
    return (
      <figure
        data-block="embed"
        data-block-id={id}
        data-embed-provider={data.provider}
        class="embed embed--blockquote"
      >
        <blockquote class="embed__blockquote" cite={resolved.linkUrl}>
          <p class="embed__title">{data.title}</p>
          <p class="embed__link">
            <a href={resolved.linkUrl} rel="noopener noreferrer nofollow" target="_blank">
              {resolved.text}
            </a>
          </p>
        </blockquote>
      </figure>
    );
  }

  // Iframe-based providers. When lazy, we render a placeholder div with
  // data-embed-* attributes; the page-shell's small JS loader replaces it
  // with a real <iframe> on intersection.
  if (data.lazyLoad) {
    return (
      <figure
        data-block="embed"
        data-block-id={id}
        data-embed-provider={data.provider}
        data-embed-src={resolved.src}
        data-embed-title={data.title}
        data-embed-allow={resolved.allow}
        data-embed-sandbox={resolved.sandbox}
        data-embed-referrerpolicy={resolved.referrerPolicy}
        class="embed embed--lazy"
        style={figureStyle}
      >
        <noscript>
          <iframe
            src={resolved.src}
            title={data.title}
            loading="lazy"
            referrerpolicy={resolved.referrerPolicy as preact.JSX.HTMLAttributeReferrerPolicy}
            sandbox={resolved.sandbox}
            allow={resolved.allow}
            data-embed-provider={data.provider}
            allowFullScreen
          />
        </noscript>
        <div class="embed__placeholder" aria-hidden="true" />
      </figure>
    );
  }

  // Eager mode: render the iframe directly.
  return (
    <figure
      data-block="embed"
      data-block-id={id}
      data-embed-provider={data.provider}
      class="embed"
      style={figureStyle}
    >
      <iframe
        src={resolved.src}
        title={data.title}
        loading="lazy"
        referrerpolicy={resolved.referrerPolicy as preact.JSX.HTMLAttributeReferrerPolicy}
        sandbox={resolved.sandbox}
        allow={resolved.allow}
        data-embed-provider={data.provider}
        allowFullScreen
      />
    </figure>
  );
}

/** Used by `page-shell` to detect whether a page has any lazy embed blocks. */
export function pageHasLazyEmbed(blocks: ReadonlyArray<{ type: string; data: unknown }>): boolean {
  for (const b of blocks) {
    if (b.type !== "embed") continue;
    const lazy = (b.data as Record<string, unknown>).lazyLoad;
    // Default-true behaviour: undefined means lazy.
    if (lazy === undefined || lazy === true) return true;
  }
  return false;
}

/** Stable id-attribute marker the page-shell uses to dedupe the loader script. */
export const EMBED_LOADER_MARKER = "data-sosb-embed-loader";
