import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";

import { renderSite } from "../src/index.js";

const site: Site = {
  schemaVersion: 1,
  org: { name: "HISTORIPOL" },
  theme: { id: "academic" },
  defaultLanguage: "ro",
  languages: ["ro"],
  pages: [
    {
      slug: "index",
      lang: "ro",
      navLabel: "Acasă",
      navOrder: 0,
      showInNav: true,
      blocks: [
        {
          id: "blk_hero",
          type: "hero",
          version: 1,
          data: { title: "HISTORIPOL" },
        },
        {
          id: "blk_footer",
          type: "siteFooter",
          version: 1,
          data: {
            contactTitle: "Contact",
            email: "contact@example.org",
            socials: [
              { platform: "instagram", url: "https://instagram.com/example" },
              { platform: "facebook", url: "https://facebook.com/example" },
            ],
            membership: {
              text: "HISTORIPOL este membră ANOSR",
              name: "ANOSR",
              url: "https://anosr.ro",
              logo: {
                hash: "abc123",
                path: "assets/anosr.png",
                metadataPath: "assets/anosr.json",
                mime: "image/png",
                width: 780,
                height: 400,
                alt: "ANOSR logo",
              },
            },
          },
        },
      ],
    },
  ],
};

describe("renderSite — siteFooter", () => {
  test("renders the footer as a semantic footer after main", () => {
    const html = renderSite(site, "academic");
    expect(html).toMatch(/<\/main><footer[^>]*data-block="siteFooter"/);
    expect(html).toContain('data-block-id="blk_footer"');
  });

  test("keeps the footer at the bottom of short production pages", () => {
    const html = renderSite(site, "academic");
    expect(html).toContain("body {\n  min-height: 100vh;\n  display: flex;");
    expect(html).toContain("body > main {\n  flex: 1 0 auto;");
    expect(html).toContain('body > [data-block="siteFooter"] {\n  flex: 0 0 auto;');
  });

  test("renders social links and membership logo", () => {
    const html = renderSite(site, "academic");
    expect(html).toContain('href="https://instagram.com/example"');
    expect(html).toContain('href="https://facebook.com/example"');
    expect(html).toContain("HISTORIPOL este membră ANOSR");
    expect(html).toMatch(
      /<img[^>]*class="site-footer__membership-logo"[^>]*src="assets\/anosr\.png"/,
    );
  });

  test("allows the visible contact heading to be removed", () => {
    const withoutHeading = structuredClone(site) as Site;
    delete withoutHeading.pages[0]!.blocks[1]!.data.contactTitle;
    const html = renderSite(withoutHeading, "academic");
    expect(html).not.toContain('class="site-footer__heading"');
    expect(html).toContain('class="site-footer__contact" aria-label="Contact"');

    const blankHeading = structuredClone(site) as Site;
    blankHeading.pages[0]!.blocks[1]!.data.contactTitle = "";
    const blankHtml = renderSite(blankHeading, "academic");
    expect(blankHtml).not.toContain('class="site-footer__heading"');
    expect(blankHtml).toContain('class="site-footer__contact" aria-label="Contact"');
  });

  test("does not expose the footer email as plain text", () => {
    const html = renderSite(site, "academic");
    expect(html).not.toContain("contact@example.org");
    expect(html).not.toContain("@example.org");
    expect(html).not.toMatch(/mailto:contact@example\.org/);
    expect(html).toMatch(/data-site-footer-email\b/);
    expect(html).toMatch(/data-site-footer-reveal\b/);
  });

  test("suppresses empty footer data", () => {
    const empty = structuredClone(site) as Site;
    empty.pages[0]!.blocks[1]!.data = {};
    const html = renderSite(empty, "academic");
    expect(html).not.toMatch(/<footer[^>]*data-block="siteFooter"/);
  });
});
