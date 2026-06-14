import { describe, expect, test } from "vitest";
import { PartnerLogosBlockSchema, validateBlock } from "../src/index.js";

/**
 * Schema tests for the partnerLogos block.
 *
 * Per issue #17 the block carries an optional `title`, plus a `partners` array
 * where each entry is `{ name, logo (AssetRef), url? }`. Mandatory `name`
 * doubles as the alt-text/aria-label source. Logos are AssetRef-shaped:
 * { hash, path, mime, width, height, alt }.
 */
describe("partnerLogos block schema", () => {
  const partnerLogo = {
    hash: "8e3a7f",
    path: "assets/8e3a7f.png",
    metadataPath: "assets/8e3a7f.metadata.json",
    mime: "image/png",
    width: 320,
    height: 120,
    alt: "Acme Corp logo",
  };

  const partnerLogosWithUrl = (url?: string) => ({
    id: "blk_partners_url",
    type: "partnerLogos",
    version: 1,
    data: {
      partners: [
        {
          name: "Acme Corp",
          ...(url === undefined ? {} : { url }),
          logo: partnerLogo,
        },
      ],
    },
  });

  test("validates a minimal partnerLogos block (no title, single partner)", () => {
    const block = {
      id: "blk_partners_1",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            name: "Acme Corp",
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 320,
              height: 120,
              alt: "Acme Corp logo",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(true);
  });

  test.each([
    ["javascript: URL", "javascript:void(0)"],
    ["data: URL", "data:text/plain,hello"],
    ["bare domain without scheme", "www.example.org"],
  ])("rejects partnerLogos partner URL with %s", (_caseName, url) => {
    expect(PartnerLogosBlockSchema.safeParse(partnerLogosWithUrl(url)).success).toBe(false);
  });

  test.each([
    ["https URL", "https://example.org"],
    ["site-relative path", "/contact"],
  ])("accepts partnerLogos partner URL with %s", (_caseName, url) => {
    expect(PartnerLogosBlockSchema.safeParse(partnerLogosWithUrl(url)).success).toBe(true);
  });

  test("accepts partnerLogos partner URL being absent", () => {
    expect(PartnerLogosBlockSchema.safeParse(partnerLogosWithUrl()).success).toBe(true);
  });

  test("validates a partnerLogos block with title and multiple partners with optional URLs", () => {
    const block = {
      id: "blk_partners_2",
      type: "partnerLogos",
      version: 1,
      data: {
        title: "Partenerii noștri",
        partners: [
          {
            name: "Acme Corp",
            url: "https://acme.example.com",
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 320,
              height: 120,
              alt: "Acme Corp logo",
            },
          },
          {
            name: "Beta University",
            logo: {
              hash: "4a91d2",
              path: "assets/4a91d2.svg",
              metadataPath: "assets/4a91d2.metadata.json",
              mime: "image/svg+xml",
              width: 400,
              height: 100,
              alt: "Beta University crest",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects partnerLogos with the wrong type literal", () => {
    const block = {
      id: "blk_partners_3",
      type: "hero",
      version: 1,
      data: {
        partners: [
          {
            name: "Acme",
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              alt: "Acme logo",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a partner missing the mandatory name", () => {
    const block = {
      id: "blk_partners_4",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            // name omitted — must be rejected because name doubles as alt/aria source
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              alt: "logo",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a partner with an empty name", () => {
    const block = {
      id: "blk_partners_5",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            name: "",
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              alt: "logo",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a partner whose logo AssetRef is missing alt text", () => {
    const block = {
      id: "blk_partners_6",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            name: "Acme",
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              // alt omitted — alt is mandatory per ADR 0004
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects a logo with an unsupported MIME type", () => {
    const block = {
      id: "blk_partners_7",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            name: "Acme",
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.gif",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/gif",
              width: 100,
              height: 100,
              alt: "Acme logo",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock returns severity-tiered errors when name is missing", () => {
    const block = {
      id: "blk_partners_8",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              alt: "logo",
            },
          },
        ],
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validates an SVG logo (passthrough MIME)", () => {
    const block = {
      id: "blk_partners_9",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            name: "Beta University",
            logo: {
              hash: "4a91d2",
              path: "assets/4a91d2.svg",
              metadataPath: "assets/4a91d2.metadata.json",
              mime: "image/svg+xml",
              // SVG without intrinsic dimensions can be 0/0 per ADR 0004
              width: 0,
              height: 0,
              alt: "Beta University crest",
            },
          },
        ],
      },
    };
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(true);
  });

  test("preserves unknown extra fields on partner data (forward-compat)", () => {
    const block = {
      id: "blk_partners_10",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [
          {
            name: "Acme",
            tier: "gold", // hypothetical future field
            logo: {
              hash: "8e3a7f",
              path: "assets/8e3a7f.png",
              metadataPath: "assets/8e3a7f.metadata.json",
              mime: "image/png",
              width: 100,
              height: 100,
              alt: "Acme logo",
            },
          },
        ],
      },
    };
    const parsed = PartnerLogosBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const partner = parsed.data.data.partners[0]!;
      expect((partner as Record<string, unknown>).tier).toBe("gold");
    }
  });

  test("accepts a partnerLogos block with an empty partners array (T19, ADR 0044)", () => {
    const block = {
      id: "blk_partners_11",
      type: "partnerLogos",
      version: 1,
      data: {
        partners: [],
      },
    };
    // Per ADR 0044 Corollary 2 and T19 of the form-overrides plan: a
    // freshly-added partnerLogos block ships with `partners: []` rather
    // than a fabricated placeholder logo. The schema must accept the
    // empty array so the default round-trips through `safeParse`; the
    // empty state's UX is owned by the AssetPicker / BlockForm array
    // editor. A future validate-rules pass may surface a `warning` for
    // empty grids; that's a separate concern.
    expect(PartnerLogosBlockSchema.safeParse(block).success).toBe(true);
  });
});
