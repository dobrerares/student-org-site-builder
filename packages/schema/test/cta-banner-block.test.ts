import { describe, expect, test } from "vitest";
import { CtaBannerBlockSchema, validateBlock } from "../src/index.js";

/**
 * `ctaBanner` block schema tests.
 *
 * The shape (per issue #16):
 *   - title: required, non-empty string
 *   - subtitle: optional string
 *   - button: required object { label, url, style }
 *     - label: required, non-empty
 *     - url: required, must be a parseable absolute URL OR a site-relative path starting with "/"
 *     - style: required, one of "primary" | "secondary"
 *   - backgroundImage: optional AssetRef-shaped object (hash, path, mime, width, height, alt)
 *
 * Forward-compat: `data` is `looseObject` so unknown fields round-trip.
 */

describe("ctaBanner block schema", () => {
  test("validates a minimal well-formed ctaBanner with primary button", () => {
    const block = {
      id: "blk_cta_01",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Join us this fall",
        button: {
          label: "Apply now",
          url: "https://historipol.ro/apply",
          style: "primary",
        },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a ctaBanner with all optional fields", () => {
    const block = {
      id: "blk_cta_02",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Become a member",
        subtitle: "Open recruitment runs through October.",
        button: {
          label: "Read more",
          url: "/recrutare",
          style: "secondary",
        },
        backgroundImage: {
          hash: "8e3a7f9b1c0d2e4f",
          path: "assets/8e3a7f9b1c0d2e4f.jpg",
          metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
          mime: "image/jpeg",
          width: 1600,
          height: 900,
          alt: "Students gathered at a recruitment event",
        },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects ctaBanner with no title", () => {
    const block = {
      id: "blk_cta_03",
      type: "ctaBanner",
      version: 1,
      data: {
        button: { label: "Go", url: "/x", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects ctaBanner with empty title", () => {
    const block = {
      id: "blk_cta_04",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "",
        button: { label: "Go", url: "/x", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects ctaBanner with no button", () => {
    const block = {
      id: "blk_cta_05",
      type: "ctaBanner",
      version: 1,
      data: { title: "Headline only" },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects ctaBanner with empty button label", () => {
    const block = {
      id: "blk_cta_06",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "", url: "/x", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects ctaBanner with malformed URL", () => {
    const block = {
      id: "blk_cta_07",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "not a url", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects ctaBanner with javascript: URL (unsafe scheme)", () => {
    const block = {
      id: "blk_cta_08",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "javascript:alert(1)", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("accepts a site-relative URL starting with /", () => {
    const block = {
      id: "blk_cta_09",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "/contact", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(true);
  });

  test("accepts a mailto: URL", () => {
    const block = {
      id: "blk_cta_10",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Email us", url: "mailto:hello@historipol.ro", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects ctaBanner with an unknown button style", () => {
    const block = {
      id: "blk_cta_11",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "/x", style: "tertiary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("rejects ctaBanner with the wrong block type", () => {
    const block = {
      id: "blk_cta_12",
      type: "hero",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "/x", style: "primary" },
      },
    };
    expect(CtaBannerBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock returns severity-tiered errors with paths", () => {
    const block = {
      id: "blk_cta_13",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "not-a-url", style: "primary" },
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
    // The error should mention the malformed URL field somewhere in its path.
    expect(result.errors.some((issue) => issue.path.some((segment) => segment === "url"))).toBe(
      true,
    );
  });

  test("validateBlock surfaces a helpful message for malformed URLs", () => {
    const block = {
      id: "blk_cta_14",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "ftp:nope", style: "primary" },
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    // The English diagnostic should mention "URL" so a non-technical user sees what to fix.
    const messages = result.errors.map((issue) => issue.message).join("\n");
    expect(messages.toLowerCase()).toContain("url");
  });

  test("validateBlock warns when a backgroundImage has empty alt text", () => {
    const block = {
      id: "blk_cta_15",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "/x", style: "primary" },
        backgroundImage: {
          hash: "8e3a7f9b1c0d2e4f",
          path: "assets/8e3a7f9b1c0d2e4f.jpg",
          metadataPath: "assets/8e3a7f9b1c0d2e4f.metadata.json",
          mime: "image/jpeg",
          width: 1600,
          height: 900,
          alt: "",
        },
      },
    };
    const result = validateBlock(block);
    // Empty alt is a quality nudge (warning), not a hard error — same severity model as hero.
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]!.severity).toBe("warning");
  });

  test("preserves unknown fields on data (forward compat)", () => {
    const block = {
      id: "blk_cta_16",
      type: "ctaBanner",
      version: 1,
      data: {
        title: "Headline",
        button: { label: "Go", url: "/x", style: "primary" },
        experimentalAlignment: "center",
      },
    };
    const parsed = CtaBannerBlockSchema.parse(block);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped).toEqual(block);
  });
});
