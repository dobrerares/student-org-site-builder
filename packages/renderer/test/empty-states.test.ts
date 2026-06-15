import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import { renderSite } from "../src/index.js";

/**
 * Empty-state suppression (foolproofing).
 *
 * An optional content block that has no meaningful content must render
 * NOTHING — no empty/broken styled container — in deploy and preview alike.
 * A non-designer who drops a block and leaves it blank should not get an
 * empty box on their site.
 *
 * Mechanism (verified against `page-shell.tsx`): `renderBlock` returns the
 * JSX ELEMENT for every KNOWN block type and `null` only for UNKNOWN types
 * (which become an `<!-- unknown block -->` comment). So a KNOWN block that
 * renders empty is suppressed simply by having its component return `null`:
 * preact renders it to an empty string and, because `renderBlock` still
 * returned a truthy element, the page-shell does NOT emit an unknown-block
 * comment. These tests assert exactly that contract from the outside.
 *
 * `renderSite` trusts the shape (it does not run schema validation), so we
 * can feed deliberately-empty data — including shapes the schema would reject
 * (e.g. teamGrid with `people: []`) — to exercise the loose-data tolerance
 * path the renderer must survive.
 */

const THEME = "minimal";

/** Wrap a single block in a minimal one-page Site. */
function siteWithBlock(block: unknown): Site {
  return {
    schemaVersion: 1,
    org: { name: "Empty State Org", tagline: "Suppression fixture" },
    theme: { id: THEME, tokens: { colorPrimary: "#1f3a5f", colorAccent: "#c08a3e" } },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        seo: { title: "Empty-state test", description: "Suppression fixture." },
        blocks: [block],
      },
    ],
  } as unknown as Site;
}

/**
 * Strip the renderer's `<style>` block(s) before inspecting markup. Theme CSS
 * contains `[data-block="..."]` *selectors*, so a naive substring/regex check
 * for `data-block="x"` would match the stylesheet even when no element exists.
 * We only care about the rendered DOM in `<body>`.
 */
function bodyMarkup(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/**
 * Does the rendered HTML carry a styled container ELEMENT for this block type?
 * Matches `data-block="type"` only when it sits inside an opening tag (the
 * preceding `<...` of an element), not inside a CSS selector.
 */
function hasBlock(html: string, type: string): boolean {
  return new RegExp(`<[a-z][^>]*\\bdata-block="${escapeRe(type)}"`, "i").test(bodyMarkup(html));
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Case {
  /** Human-readable block name. */
  readonly name: string;
  /** The `data-block` attribute value the renderer emits for this block. */
  readonly blockMarker: string;
  /** An empty block (id `blk_empty`) that MUST be suppressed. */
  readonly empty: unknown;
  /** A populated block (id `blk_full`) that MUST still render. */
  readonly full: unknown;
}

const CASES: readonly Case[] = [
  {
    name: "richText",
    blockMarker: "richText",
    empty: { id: "blk_empty", type: "richText", version: 1, data: { markdown: "   \n  " } },
    full: {
      id: "blk_full",
      type: "richText",
      version: 1,
      data: { markdown: "## Hello\n\nReal prose here." },
    },
  },
  {
    name: "quote",
    blockMarker: "quote",
    empty: { id: "blk_empty", type: "quote", version: 1, data: { text: "   " } },
    full: {
      id: "blk_full",
      type: "quote",
      version: 1,
      data: { text: "A real quote.", author: "Cineva" },
    },
  },
  {
    name: "ctaBanner",
    blockMarker: "ctaBanner",
    // No title, no subtitle, no actionable button → nothing visible.
    empty: { id: "blk_empty", type: "ctaBanner", version: 1, data: { title: "", button: {} } },
    full: {
      id: "blk_full",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Join us",
        button: { label: "Sign up", url: "https://example.org", style: "primary" },
      },
    },
  },
  {
    name: "valueList",
    blockMarker: "valueList",
    empty: {
      id: "blk_empty",
      type: "valueList",
      version: 1,
      data: { title: "Values", items: [], layout: "grid", columns: 3 },
    },
    full: {
      id: "blk_full",
      type: "valueList",
      version: 1,
      data: { title: "Values", items: [{ label: "Community" }], layout: "grid", columns: 3 },
    },
  },
  {
    name: "activitiesList",
    blockMarker: "activitiesList",
    empty: {
      id: "blk_empty",
      type: "activitiesList",
      version: 1,
      data: { title: "Activities", layout: "cards", items: [] },
    },
    full: {
      id: "blk_full",
      type: "activitiesList",
      version: 1,
      data: { title: "Activities", layout: "cards", items: [{ title: "Workshop" }] },
    },
  },
  {
    name: "teamGrid",
    blockMarker: "teamGrid",
    empty: {
      id: "blk_empty",
      type: "teamGrid",
      version: 1,
      data: { title: "Team", columns: 3, people: [] },
    },
    full: {
      id: "blk_full",
      type: "teamGrid",
      version: 1,
      data: { title: "Team", columns: 3, people: [{ name: "Ana", role: "Lead" }] },
    },
  },
  {
    name: "eventList",
    blockMarker: "event-list",
    empty: {
      id: "blk_empty",
      type: "eventList",
      version: 1,
      data: { title: "Events", events: [] },
    },
    full: {
      id: "blk_full",
      type: "eventList",
      version: 1,
      data: {
        title: "Events",
        events: [{ id: "ev1", title: "Launch", startsAt: "2026-06-15T18:00:00+03:00" }],
      },
    },
  },
  {
    name: "partnerLogos",
    blockMarker: "partnerLogos",
    empty: {
      id: "blk_empty",
      type: "partnerLogos",
      version: 1,
      data: { title: "Partners", partners: [] },
    },
    full: {
      id: "blk_full",
      type: "partnerLogos",
      version: 1,
      data: {
        title: "Partners",
        partners: [
          {
            name: "Acme",
            logo: {
              hash: "abc",
              path: "assets/abc.png",
              metadataPath: "assets/abc.metadata.json",
              mime: "image/png",
              width: 100,
              height: 40,
              alt: "Acme logo",
            },
          },
        ],
      },
    },
  },
  {
    name: "documentDownloads",
    blockMarker: "documentDownloads",
    empty: {
      id: "blk_empty",
      type: "documentDownloads",
      version: 1,
      data: { title: "Docs", layout: "list", files: [] },
    },
    full: {
      id: "blk_full",
      type: "documentDownloads",
      version: 1,
      data: {
        title: "Docs",
        layout: "list",
        files: [
          {
            asset: {
              hash: "abc",
              path: "assets/abc.pdf",
              metadataPath: "assets/abc.metadata.json",
              mime: "application/pdf",
              byteSize: 1024,
            },
            label: "Regulament",
          },
        ],
      },
    },
  },
  {
    name: "imageGallery",
    blockMarker: "imageGallery",
    empty: {
      id: "blk_empty",
      type: "imageGallery",
      version: 1,
      data: { title: "Gallery", layout: "grid", columns: 3, lightbox: false, images: [] },
    },
    full: {
      id: "blk_full",
      type: "imageGallery",
      version: 1,
      data: {
        title: "Gallery",
        layout: "grid",
        columns: 3,
        lightbox: false,
        images: [
          {
            alt: "A photo",
            asset: {
              hash: "abc",
              path: "assets/abc.jpg",
              metadataPath: "assets/abc.metadata.json",
              mime: "image/jpeg",
              width: 800,
              height: 600,
              alt: "A photo",
            },
          },
        ],
      },
    },
  },
  {
    name: "faq",
    blockMarker: "faq",
    empty: { id: "blk_empty", type: "faq", version: 1, data: { title: "FAQ", items: [] } },
    full: {
      id: "blk_full",
      type: "faq",
      version: 1,
      data: { title: "FAQ", items: [{ question: "Why?", answer: "Because." }] },
    },
  },
  {
    name: "contactCard",
    blockMarker: "contactCard",
    // No address, email, phone, socials, or enabled map → bare heading only.
    empty: { id: "blk_empty", type: "contactCard", version: 1, data: {} },
    full: {
      id: "blk_full",
      type: "contactCard",
      version: 1,
      data: { email: "hello@example.org" },
    },
  },
  {
    name: "embed",
    blockMarker: "embed",
    // No url → nothing to embed.
    empty: {
      id: "blk_empty",
      type: "embed",
      version: 1,
      data: { provider: "youtube", url: "", title: "Untitled" },
    },
    full: {
      id: "blk_full",
      type: "embed",
      version: 1,
      data: {
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Video",
      },
    },
  },
  {
    name: "customHTML",
    blockMarker: "customHTML",
    empty: {
      id: "blk_empty",
      type: "customHTML",
      version: 1,
      data: { html: "   \n ", sanitize: true },
    },
    full: {
      id: "blk_full",
      type: "customHTML",
      version: 1,
      data: { html: "<p>Custom widget</p>", sanitize: true },
    },
  },
];

describe("empty-state suppression — empty optional blocks render nothing", () => {
  for (const c of CASES) {
    test(`${c.name}: empty block emits no container and no unknown-block comment`, () => {
      const html = renderSite(siteWithBlock(c.empty), THEME);
      // No styled container for this block type.
      expect(hasBlock(html, c.blockMarker)).toBe(false);
      // The block's id never appears (no orphaned wrapper / data-block-id).
      expect(html).not.toContain("blk_empty");
      // It must NOT fall through to the unknown-block placeholder comment.
      expect(html).not.toMatch(/<!-- unknown block/);
    });
  }
});

describe("empty-state suppression — populated blocks still render (no over-suppression)", () => {
  for (const c of CASES) {
    test(`${c.name}: populated block still renders its container`, () => {
      const html = renderSite(siteWithBlock(c.full), THEME);
      expect(hasBlock(html, c.blockMarker)).toBe(true);
      expect(html).toContain("blk_full");
    });
  }
});

describe("empty-state suppression — suppression is mode-agnostic (deploy == preview)", () => {
  for (const c of CASES) {
    test(`${c.name}: empty block is suppressed in preview mode too`, () => {
      const html = renderSite(siteWithBlock(c.empty), THEME, { mode: "preview" });
      expect(hasBlock(html, c.blockMarker)).toBe(false);
      expect(html).not.toContain("blk_empty");
    });
  }
});

describe("empty-state suppression — hero is never suppressed", () => {
  test("a hero with only its required title still renders", () => {
    const hero = {
      id: "blk_hero",
      type: "hero",
      version: 1,
      data: { title: "Welcome" },
    };
    const html = renderSite(siteWithBlock(hero), THEME);
    expect(hasBlock(html, "hero")).toBe(true);
    expect(html).toContain("blk_hero");
  });
});

describe("empty-state suppression — surrounding blocks are unaffected", () => {
  test("an empty block between two populated blocks drops only itself", () => {
    const site = siteWithBlock(null);
    site.pages[0]!.blocks = [
      {
        id: "blk_before",
        type: "richText",
        version: 1,
        data: { markdown: "Before." },
      },
      {
        id: "blk_empty",
        type: "valueList",
        version: 1,
        data: { items: [], layout: "grid", columns: 3 },
      },
      {
        id: "blk_after",
        type: "richText",
        version: 1,
        data: { markdown: "After." },
      },
    ] as unknown as Site["pages"][number]["blocks"];

    const html = renderSite(site, THEME);
    expect(html).toContain("blk_before");
    expect(html).toContain("blk_after");
    expect(html).not.toContain("blk_empty");
    expect(hasBlock(html, "valueList")).toBe(false);
    expect(html).not.toMatch(/<!-- unknown block/);
  });
});
