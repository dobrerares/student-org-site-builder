import { describe, expect, test } from "vitest";
import { ContactCardBlockSchema, validateBlock } from "../src/index.js";

/**
 * Schema tests for the `contactCard` block (issue #13).
 *
 * The block holds optional address, email, phone, and social links, plus a
 * privacy-sensitive `mapEmbed` envelope:
 *  - `mapEmbed` defaults to disabled (no third-party request) — both OSM and
 *    Google Maps must be opted in explicitly.
 *  - When `mapEmbed.provider` is `"google"`, an `acknowledgedPrivacyNotice`
 *    flag must be true. The editor surfaces the notice; the schema enforces
 *    that the flag travels with the data.
 *  - Coordinates use a `[lat, lng]` array (numbers) so the renderer can build
 *    the embed URL deterministically.
 */
describe("contactCard block schema", () => {
  const contactCardWithSocialUrl = (url: string) => ({
    id: "blk_contact_social_url",
    type: "contactCard",
    version: 1,
    data: {
      socials: [{ platform: "instagram", url }],
    },
  });

  test("validates an empty contactCard (all fields optional)", () => {
    const block = {
      id: "blk_contact_01",
      type: "contactCard",
      version: 1,
      data: {},
    };
    expect(ContactCardBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a contactCard with full org-style fields", () => {
    const block = {
      id: "blk_contact_02",
      type: "contactCard",
      version: 1,
      data: {
        address: "Universitatea „Ovidius” Constanța",
        email: "contact@historipol.ro",
        phone: "+40 241 000 000",
        socials: [
          { platform: "instagram", url: "https://instagram.com/historipol" },
          { platform: "facebook", url: "https://facebook.com/historipol" },
        ],
      },
    };
    expect(ContactCardBlockSchema.safeParse(block).success).toBe(true);
  });

  test.each([
    ["javascript: URL", "javascript:void(0)"],
    ["data: URL", "data:text/plain,hello"],
    ["bare domain without scheme", "www.example.org"],
  ])("rejects contactCard social link with %s", (_caseName, url) => {
    expect(ContactCardBlockSchema.safeParse(contactCardWithSocialUrl(url)).success).toBe(false);
  });

  test.each([
    ["https URL", "https://example.org"],
    ["site-relative path", "/contact"],
  ])("accepts contactCard social link with %s", (_caseName, url) => {
    expect(ContactCardBlockSchema.safeParse(contactCardWithSocialUrl(url)).success).toBe(true);
  });

  test("validates a contactCard with OSM map embed opted-in", () => {
    const block = {
      id: "blk_contact_03",
      type: "contactCard",
      version: 1,
      data: {
        address: "Constanța, RO",
        mapEmbed: {
          enabled: true,
          provider: "osm",
          coordinates: [44.1733, 28.6383],
          zoom: 14,
        },
      },
    };
    expect(ContactCardBlockSchema.safeParse(block).success).toBe(true);
  });

  test("validates a contactCard with Google Maps embed if privacy notice acknowledged", () => {
    const block = {
      id: "blk_contact_04",
      type: "contactCard",
      version: 1,
      data: {
        mapEmbed: {
          enabled: true,
          provider: "google",
          coordinates: [44.1733, 28.6383],
          zoom: 14,
          acknowledgedPrivacyNotice: true,
        },
      },
    };
    expect(ContactCardBlockSchema.safeParse(block).success).toBe(true);
  });

  test("rejects contactCard with map enabled but no coordinates", () => {
    const block = {
      id: "blk_contact_05",
      type: "contactCard",
      version: 1,
      data: {
        mapEmbed: {
          enabled: true,
          provider: "osm",
          // coordinates missing
          zoom: 14,
        },
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path.some((seg) => seg === "mapEmbed"))).toBe(true);
  });

  test("rejects Google Maps embed without acknowledgedPrivacyNotice = true", () => {
    const block = {
      id: "blk_contact_06",
      type: "contactCard",
      version: 1,
      data: {
        mapEmbed: {
          enabled: true,
          provider: "google",
          coordinates: [44.1733, 28.6383],
          zoom: 14,
          // acknowledgedPrivacyNotice intentionally missing
        },
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.path.some((seg) => seg === "acknowledgedPrivacyNotice")),
    ).toBe(true);
  });

  test("rejects contactCard with the wrong type literal", () => {
    const block = {
      id: "blk_contact_07",
      type: "hero",
      version: 1,
      data: {},
    };
    expect(ContactCardBlockSchema.safeParse(block).success).toBe(false);
  });

  test("validateBlock returns severity-tiered issues for malformed mapEmbed", () => {
    const block = {
      id: "blk_contact_08",
      type: "contactCard",
      version: 1,
      data: {
        mapEmbed: {
          enabled: true,
          provider: "osm",
          coordinates: ["not-a-number", 28.6383],
          zoom: 14,
        },
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.severity).toBe("error");
  });

  test("validateBlock warns when an email is provided without a confirmable contact channel", () => {
    // The PRD pins email as the "JS-reveal anti-harvest" pattern. A contact
    // card with neither an email nor a phone is a quality nudge, not a hard
    // error — the editor still allows publishing.
    const block = {
      id: "blk_contact_09",
      type: "contactCard",
      version: 1,
      data: {
        address: "Just an address with no contact channel",
      },
    };
    const result = validateBlock(block);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "block.contactCard.contact.missing")).toBe(true);
  });

  test("preserves unknown fields on contactCard data (forward-compat)", () => {
    const block = {
      id: "blk_contact_10",
      type: "contactCard",
      version: 1,
      data: {
        email: "x@example.org",
        futureField: "preserve me",
      },
    };
    const parsed = ContactCardBlockSchema.parse(block);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped.data.futureField).toBe("preserve me");
  });
});
