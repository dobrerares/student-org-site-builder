import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import contactCardOnly from "./fixtures/contact-card-only.json" with { type: "json" };
import contactCardOsm from "./fixtures/contact-card-osm.json" with { type: "json" };
import { renderSite } from "../src/index.js";

const fixture = contactCardOnly as unknown as Site;
const osmFixture = contactCardOsm as unknown as Site;

/**
 * Renderer tests for the `contactCard` block (issue #13).
 *
 * Two privacy-sensitive contracts are exercised here:
 *
 *  1. The plain-text email never appears in the rendered HTML. The block
 *     uses a JS-reveal anti-harvest pattern: the email is split into local +
 *     domain pieces (also encoded) and assembled by an inline script on
 *     click. Tests assert the raw email substring `contact@example.org` is
 *     absent from the document, but a noscript fallback exposes the
 *     address for users without JS so they are not locked out.
 *
 *  2. The OSM iframe is only rendered when `mapEmbed.enabled` is true and
 *     `mapEmbed.provider` is `"osm"`. The default state is no map, so a
 *     contactCard with no `mapEmbed` produces no third-party iframe and
 *     no network request to `openstreetmap.org`.
 */
describe("renderSite — contactCard structural", () => {
  test("renders a section with data-block contactCard", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<section[^>]*data-block="contactCard"/);
  });

  test("renders the address as semantic <address> when present", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<address[^>]*>[\s\S]*Constanța[\s\S]*<\/address>/);
  });

  test("renders the phone as a tel: link", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/href="tel:\+40241000000"/);
  });

  test("renders a list of social links when present", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toContain('href="https://instagram.com/example"');
    expect(html).toContain('href="https://facebook.com/example"');
  });

  test("suppresses a contactCard with no fields at all (empty-state foolproofing)", () => {
    // Empty-state suppression: a contactCard with no contact channels (no
    // address, email, phone, social, or enabled map) is just a bare "Contact"
    // heading — render nothing rather than an empty styled card. (Previously
    // this emitted the wrapper <section>; the suppression guard now drops it.)
    const minimal = structuredClone(fixture) as Site;
    minimal.pages[0]!.blocks[0]!.data = {};
    const html = renderSite(minimal, "stub");
    expect(html).not.toMatch(/<section[^>]*data-block="contactCard"/);
    expect(html).not.toMatch(/<!-- unknown block/);
  });

  test("tolerates an unknown extra field on contactCard data (forward-compat)", () => {
    const withExtra = structuredClone(fixture) as Site;
    (withExtra.pages[0]!.blocks[0]!.data as Record<string, unknown>).futureField = "ignored-ok";
    const html = renderSite(withExtra, "stub");
    expect(html).toMatch(/<section[^>]*data-block="contactCard"/);
  });
});

describe("renderSite — contactCard channel structure (icon chips)", () => {
  test("renders the channels list with each row carrying an aria-hidden decorative glyph chip", () => {
    const html = renderSite(fixture, "stub");
    expect(html).toMatch(/<ul class="contact-card__channels">/);
    // The chip is a contact-card__icon wrapping an inline SVG marked decorative
    // (the label/link carries the meaning, not the glyph).
    expect(html).toMatch(/contact-card__icon[\s\S]*?<svg[^>]*aria-hidden="true"/);
  });

  test("renders an unknown/custom social platform as a row (generic glyph + capitalized label), never dropped", () => {
    const custom = structuredClone(fixture) as Site;
    (custom.pages[0]!.blocks[0]!.data as Record<string, unknown>).socials = [
      { platform: "mastodon", url: "https://mastodon.social/@example" },
    ];
    const html = renderSite(custom, "stub");
    expect(html).toContain('href="https://mastodon.social/@example"');
    // platformLabel capitalizes an unknown platform rather than leaving it bare.
    expect(html).toContain(">Mastodon<");
    // ...and it lives inside a channel row (chip + body), not dropped.
    expect(html).toMatch(/contact-card__channel[\s\S]*?mastodon\.social/);
  });
});

describe("renderSite — contactCard mailto anti-harvest", () => {
  test("does NOT contain the plain-text email substring anywhere in the HTML", () => {
    const html = renderSite(fixture, "stub");
    // The single hardest contract: scrapers must not find the address.
    expect(html).not.toContain("contact@example.org");
  });

  test("does not contain a literal mailto: with the plain-text address", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toMatch(/mailto:contact@example\.org/);
  });

  test("does not write the at-sign + domain as adjacent characters", () => {
    // Defence in depth: even split mailto: patterns shouldn't surface
    // 'contact@example' as a contiguous string.
    const html = renderSite(fixture, "stub");
    expect(html).not.toContain("@example.org");
  });

  test("does include a JS-reveal element for the email (button or link)", () => {
    const html = renderSite(fixture, "stub");
    // An interactive element that JS hooks onto for click-to-reveal.
    expect(html).toMatch(/data-contact-email\b/);
  });

  test("includes encoded email parts in data-* attributes (not plain text)", () => {
    const html = renderSite(fixture, "stub");
    // The encoding strategy exposes base64 chunks the script reassembles.
    // Concretely, the local part and domain are stored as separate base64
    // values so the literal `contact@example.org` never occurs.
    expect(html).toMatch(/data-contact-local="[A-Za-z0-9+/=]+"/);
    expect(html).toMatch(/data-contact-domain="[A-Za-z0-9+/=]+"/);
  });

  test("includes an inline reveal <script> that assembles the mailto: link", () => {
    const html = renderSite(fixture, "stub");
    // The inline script must NOT contain the plain-text email either.
    const scriptMatch = /<script[^>]*data-contact-reveal[^>]*>([\s\S]*?)<\/script>/.exec(html);
    expect(scriptMatch).not.toBeNull();
    const scriptBody = scriptMatch![1] ?? "";
    expect(scriptBody).not.toContain("contact@example.org");
    expect(scriptBody).not.toContain("@example.org");
  });

  test("provides an accessible label so screen readers announce reveal email", () => {
    const html = renderSite(fixture, "stub");
    // The interactive control must carry an aria-label — visually the text
    // can be obfuscated, but the assistive-tech announcement must be a real
    // sentence so screen-reader users understand what the click does.
    expect(html).toMatch(/<(?:button|a)[^>]*data-contact-email[^>]*\saria-label="[^"]+"/);
  });

  test("renders nothing email-related when no email is supplied", () => {
    const noEmail = structuredClone(fixture) as Site;
    delete (noEmail.pages[0]!.blocks[0]!.data as Record<string, unknown>).email;
    const html = renderSite(noEmail, "stub");
    expect(html).not.toMatch(/data-contact-email\b/);
    expect(html).not.toMatch(/data-contact-reveal\b/);
  });
});

describe("renderSite — contactCard OSM map opt-in", () => {
  test("does NOT render any iframe when mapEmbed is absent (default opt-out)", () => {
    const html = renderSite(fixture, "stub");
    expect(html).not.toMatch(/<iframe/);
    expect(html).not.toContain("openstreetmap.org");
  });

  test("does NOT render any iframe when mapEmbed.enabled is false", () => {
    const optedOut = structuredClone(fixture) as Site;
    (optedOut.pages[0]!.blocks[0]!.data as Record<string, unknown>).mapEmbed = {
      enabled: false,
      provider: "osm",
      coordinates: [44.1733, 28.6383],
      zoom: 14,
    };
    const html = renderSite(optedOut, "stub");
    expect(html).not.toMatch(/<iframe/);
    expect(html).not.toContain("openstreetmap.org");
  });

  test("renders an OSM iframe when mapEmbed.enabled = true and provider = osm", () => {
    const html = renderSite(osmFixture, "stub");
    expect(html).toMatch(/<iframe[^>]*src="https:\/\/www\.openstreetmap\.org\/export\/embed\.html/);
  });

  test("OSM iframe carries lazy loading and a meaningful title for assistive tech", () => {
    const html = renderSite(osmFixture, "stub");
    expect(html).toMatch(/<iframe[^>]*loading="lazy"/);
    expect(html).toMatch(/<iframe[^>]*\btitle="[^"]+"/);
  });

  test("OSM iframe URL embeds the bbox derived deterministically from coordinates and zoom", () => {
    const html = renderSite(osmFixture, "stub");
    // Same input → same URL across runs (asserted elsewhere by the
    // determinism suite); here we just check the bbox parameter is present.
    expect(html).toMatch(/bbox=/);
    expect(html).toMatch(/marker=44\.1733/);
  });

  test("does NOT render Google Maps embed for OSM-configured contactCard", () => {
    const html = renderSite(osmFixture, "stub");
    expect(html).not.toContain("google.com/maps");
    expect(html).not.toContain("maps.google");
  });

  test("Google Maps opt-in path renders the google embed iframe with privacy notice text", () => {
    const googleSite = structuredClone(osmFixture) as Site;
    const data = googleSite.pages[0]!.blocks[0]!.data as Record<string, unknown>;
    data.mapEmbed = {
      enabled: true,
      provider: "google",
      coordinates: [44.1733, 28.6383],
      zoom: 14,
      acknowledgedPrivacyNotice: true,
    };
    const html = renderSite(googleSite, "stub");
    expect(html).toMatch(/<iframe[^>]*src="https:\/\/www\.google\.com\/maps\/embed/);
    // Privacy notice for the published site itself: tells visitors that the
    // map embed contacts Google.
    expect(html).toMatch(/data-map-privacy-notice/);
  });

  test("Google Maps embed is omitted when acknowledgedPrivacyNotice is missing", () => {
    const googleSite = structuredClone(osmFixture) as Site;
    const data = googleSite.pages[0]!.blocks[0]!.data as Record<string, unknown>;
    data.mapEmbed = {
      enabled: true,
      provider: "google",
      coordinates: [44.1733, 28.6383],
      zoom: 14,
      // acknowledgedPrivacyNotice intentionally not set
    };
    const html = renderSite(googleSite, "stub");
    expect(html).not.toContain("google.com/maps");
    expect(html).not.toMatch(/<iframe/);
  });
});

describe("renderSite — contactCard determinism", () => {
  test("repeated renders of the contactCard fixture produce byte-identical output", () => {
    const a = renderSite(fixture, "stub");
    const b = renderSite(fixture, "stub");
    expect(a).toBe(b);
  });

  test("repeated renders of the OSM-enabled contactCard fixture produce byte-identical output", () => {
    const a = renderSite(osmFixture, "stub");
    const b = renderSite(osmFixture, "stub");
    expect(a).toBe(b);
  });
});

describe("renderSite — contactCard map-only suppression (empty-state edge)", () => {
  // A card whose ONLY content is a map should render iff that map actually
  // renders — otherwise the card would show an empty heading.
  function siteWithMapOnly(mapEmbed: Record<string, unknown>): Site {
    const site = structuredClone(osmFixture) as Site;
    site.pages[0]!.blocks[0]!.data = { mapEmbed };
    return site;
  }
  const COORDS = [44.1733, 28.6383];

  test("suppresses a card whose only content is a Google map without privacy acknowledgement", () => {
    const html = renderSite(
      siteWithMapOnly({ enabled: true, provider: "google", coordinates: COORDS, zoom: 14 }),
      "stub",
    );
    expect(html).not.toMatch(/<section[^>]*data-block="contactCard"/);
    expect(html).not.toContain("<!-- unknown block");
  });

  test("suppresses a card whose only content is an enabled map with no coordinates", () => {
    const html = renderSite(siteWithMapOnly({ enabled: true, provider: "osm" }), "stub");
    expect(html).not.toMatch(/<section[^>]*data-block="contactCard"/);
  });

  test("renders a card whose only content is an OSM map", () => {
    const html = renderSite(
      siteWithMapOnly({ enabled: true, provider: "osm", coordinates: COORDS, zoom: 14 }),
      "stub",
    );
    expect(html).toMatch(/<section[^>]*data-block="contactCard"/);
    expect(html).toMatch(/openstreetmap\.org\/export\/embed\.html/);
  });

  test("renders a card whose only content is an acknowledged Google map", () => {
    const html = renderSite(
      siteWithMapOnly({
        enabled: true,
        provider: "google",
        coordinates: COORDS,
        zoom: 14,
        acknowledgedPrivacyNotice: true,
      }),
      "stub",
    );
    expect(html).toMatch(/<section[^>]*data-block="contactCard"/);
    expect(html).toMatch(/google\.com\/maps\/embed/);
  });
});
