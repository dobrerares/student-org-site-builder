import { describe, expect, test } from "vitest";

import { SiteFooterBlockSchema, validateBlock } from "../src/index.js";

const logo = {
  hash: "abc123",
  path: "assets/anosr.png",
  metadataPath: "assets/anosr.json",
  mime: "image/png",
  width: 780,
  height: 400,
  alt: "ANOSR logo",
};

describe("siteFooter block schema", () => {
  test("accepts contact links and membership logo data", () => {
    const result = SiteFooterBlockSchema.safeParse({
      id: "blk_footer",
      type: "siteFooter",
      version: 1,
      data: {
        contactTitle: "Contact",
        email: "contact@example.org",
        socials: [{ platform: "instagram", url: "https://instagram.com/example" }],
        membership: {
          text: "HISTORIPOL este membră ANOSR",
          name: "ANOSR",
          url: "https://anosr.ro",
          logo,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects malformed social URLs", () => {
    const result = SiteFooterBlockSchema.safeParse({
      id: "blk_footer",
      type: "siteFooter",
      version: 1,
      data: {
        socials: [{ platform: "instagram", url: "javascript:alert(1)" }],
      },
    });

    expect(result.success).toBe(false);
  });

  test("validateBlock recognises a well-formed siteFooter as ok", () => {
    const result = validateBlock({
      id: "blk_footer",
      type: "siteFooter",
      version: 1,
      data: {
        email: "contact@example.org",
        membership: { text: "Member", logo },
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
