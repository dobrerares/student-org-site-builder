import { describe, expect, test } from "vitest";
import {
  EMBED_BLOCK_VERSION,
  EMBED_PROVIDERS,
  EmbedBlockSchema,
  validateBlock,
  type EmbedBlock,
  type EmbedProvider,
} from "../src/index.js";

/**
 * Embed block schema (issue #20).
 *
 * The PRD pins a closed whitelist of 8 providers — YouTube, Vimeo, Spotify,
 * Instagram, Facebook, SoundCloud, Bandcamp, Twitter — with nocookie /
 * privacy variants where available and lazy iframe loading. Any URL that
 * does not match the chosen provider's URL pattern is rejected as a hard
 * error so the editor can never produce an out-of-whitelist embed.
 */

const HAPPY_URLS: Record<EmbedProvider, readonly string[]> = {
  youtube: [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
  ],
  vimeo: ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  spotify: [
    "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    "https://open.spotify.com/episode/3xOLF8C7wqbsFu5JPAGOc7",
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com/album/5ht7ItJgpBH7W6vJ5BqpPr",
    "https://open.spotify.com/show/41zWZdWCpVQrKj7ykQnXRc",
  ],
  instagram: [
    "https://www.instagram.com/p/Cabc123XYZ_/",
    "https://www.instagram.com/reel/Cabc123XYZ_/",
    "https://instagram.com/p/Cabc123XYZ_/",
  ],
  facebook: [
    "https://www.facebook.com/somepage/posts/1234567890",
    "https://www.facebook.com/somepage/videos/1234567890/",
    "https://fb.watch/abc123/",
  ],
  soundcloud: [
    "https://soundcloud.com/forss/flickermood",
    "https://soundcloud.com/some-artist/sets/some-set",
  ],
  bandcamp: [
    "https://artist.bandcamp.com/track/song-title",
    "https://artist.bandcamp.com/album/album-title",
  ],
  twitter: [
    "https://twitter.com/jack/status/20",
    "https://x.com/jack/status/20",
    "https://www.twitter.com/jack/status/20",
  ],
};

describe("embed block schema — provider whitelist", () => {
  test("exports the 8-provider whitelist verbatim from the PRD", () => {
    // Order is alphabetical for stability; presence is what matters.
    expect([...EMBED_PROVIDERS].sort()).toEqual([
      "bandcamp",
      "facebook",
      "instagram",
      "soundcloud",
      "spotify",
      "twitter",
      "vimeo",
      "youtube",
    ]);
    expect(EMBED_PROVIDERS).toHaveLength(8);
  });

  test("EMBED_BLOCK_VERSION is 1 for v1.x", () => {
    expect(EMBED_BLOCK_VERSION).toBe(1);
  });

  test("validates a minimal embed block (provider + url + title)", () => {
    const block: EmbedBlock = {
      id: "blk_emb_1",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Sample video",
      },
    };
    const result = EmbedBlockSchema.safeParse(block);
    expect(result.success).toBe(true);
  });

  test("validates an embed with all optional fields populated", () => {
    const block: EmbedBlock = {
      id: "blk_emb_2",
      type: "embed",
      version: 1,
      data: {
        provider: "vimeo",
        url: "https://vimeo.com/76979871",
        title: "Glass",
        aspectRatio: "16:9",
        lazyLoad: true,
        privacyMode: true,
      },
    };
    expect(EmbedBlockSchema.safeParse(block).success).toBe(true);
  });

  test("lazyLoad and privacyMode are optional in the persisted shape (renderer applies privacy-by-default)", () => {
    const block = {
      id: "blk_emb_3",
      type: "embed",
      version: 1,
      data: {
        provider: "spotify",
        url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
        title: "Track",
      },
    };
    const parsed = EmbedBlockSchema.parse(block);
    // Both fields stay undefined on the persisted shape; the renderer treats
    // undefined as `true` (privacy by default). See @sosb/renderer.
    expect(parsed.data.lazyLoad).toBeUndefined();
    expect(parsed.data.privacyMode).toBeUndefined();
  });

  test("rejects an embed with a non-whitelisted provider", () => {
    const block = {
      id: "blk_emb_4",
      type: "embed",
      version: 1,
      data: {
        provider: "tiktok",
        url: "https://www.tiktok.com/@user/video/1234567890",
        title: "TikTok",
      },
    };
    expect(EmbedBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects an embed missing the title (a11y requirement)", () => {
    const block = {
      id: "blk_emb_5",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    };
    expect(EmbedBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects an embed with an empty title", () => {
    const block = {
      id: "blk_emb_6",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "",
      },
    };
    expect(EmbedBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects an embed missing the url", () => {
    const block = {
      id: "blk_emb_7",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        title: "Sample video",
      },
    };
    expect(EmbedBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a malformed aspectRatio", () => {
    const block = {
      id: "blk_emb_8",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Sample video",
        aspectRatio: "not-an-aspect-ratio",
      },
    };
    expect(EmbedBlockSchema.safeParse(block).success).toBe(false);
  });

  test("accepts canonical aspectRatio strings", () => {
    for (const ratio of ["16:9", "4:3", "1:1", "9:16", "21:9"] as const) {
      const block = {
        id: `blk_emb_ratio_${ratio.replace(":", "x")}`,
        type: "embed",
        version: 1,
        data: {
          provider: "youtube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          title: "ratio test",
          aspectRatio: ratio,
        },
      };
      expect(EmbedBlockSchema.safeParse(block).success).toBe(true);
    }
  });
});

describe("embed block — per-provider URL validation", () => {
  for (const provider of [
    "youtube",
    "vimeo",
    "spotify",
    "instagram",
    "facebook",
    "soundcloud",
    "bandcamp",
    "twitter",
  ] as const) {
    test(`accepts every documented happy-path URL for ${provider}`, () => {
      for (const url of HAPPY_URLS[provider]) {
        const block = {
          id: `blk_emb_${provider}_ok`,
          type: "embed",
          version: 1,
          data: {
            provider,
            url,
            title: `${provider} sample`,
          },
        };
        const result = EmbedBlockSchema.safeParse(block);
        expect(result.success, `${provider} URL ${url} should validate`).toBe(true);
      }
    });

    test(`rejects URLs that don't match ${provider}'s URL pattern`, () => {
      const otherProviders = (
        [
          "youtube",
          "vimeo",
          "spotify",
          "instagram",
          "facebook",
          "soundcloud",
          "bandcamp",
          "twitter",
        ] as const
      ).filter((p) => p !== provider);
      for (const other of otherProviders) {
        for (const url of HAPPY_URLS[other]) {
          const block = {
            id: `blk_emb_${provider}_mismatch`,
            type: "embed",
            version: 1,
            data: {
              provider,
              url,
              title: "mismatch",
            },
          };
          const result = EmbedBlockSchema.safeParse(block);
          expect(
            result.success,
            `provider=${provider} but url=${url} (a ${other} URL) — should be rejected`,
          ).toBe(false);
        }
      }
    });

    test(`rejects clearly bogus URLs for ${provider}`, () => {
      for (const bad of [
        "not a url",
        "http://example.com/foo",
        "javascript:alert(1)",
        "https://evil.example.com/youtube.com/watch?v=abc",
      ]) {
        const block = {
          id: `blk_emb_${provider}_bogus`,
          type: "embed",
          version: 1,
          data: {
            provider,
            url: bad,
            title: "bogus",
          },
        };
        expect(EmbedBlockSchema.safeParse(block).success).toBe(false);
      }
    });
  }
});

describe("embed block — validateBlock surfaces severity-tiered errors", () => {
  test("URL mismatch produces an error issue with a clear message", () => {
    const block = {
      id: "blk_emb_err_1",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://vimeo.com/76979871",
        title: "Wrong provider",
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const messages = result.errors.map((e) => e.message).join(" | ");
    // Message should be human-readable enough that an editor user knows what to fix.
    expect(messages.toLowerCase()).toMatch(/url|provider|youtube/);
  });

  test("non-whitelisted provider produces an error issue", () => {
    const block = {
      id: "blk_emb_err_2",
      type: "embed",
      version: 1,
      data: {
        provider: "tiktok",
        url: "https://www.tiktok.com/@u/video/1",
        title: "Off-whitelist",
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("a happy embed produces no errors (and no warnings unless title is very short)", () => {
    const block = {
      id: "blk_emb_ok_1",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Friendly title for the embed",
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
