import { describe, expect, test } from "vitest";
import { SiteSchema, parseSite, validate } from "@sosb/schema";
import { renderSite } from "@sosb/renderer";
import {
  ASOCIATIA_STUDENTEASCA_DEMO,
  asociatiaStudenteascaDemoData,
  asociatiaStudenteascaDemoMetadata,
} from "../src/templates/asociatia-studenteasca-demo/index.js";

describe("Asociația Studențească Demo template — schema validation", () => {
  test("data shape matches the SiteSchema", () => {
    const result = SiteSchema.safeParse(asociatiaStudenteascaDemoData);
    expect(result.success).toBe(true);
  });

  test("validate() reports zero errors", () => {
    const result = validate(asociatiaStudenteascaDemoData);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("parseSite() returns typed data", () => {
    const site = parseSite(asociatiaStudenteascaDemoData);
    expect(site.org.name).toBe("Asociația Studențească Demo");
    expect(site.schemaVersion).toBe(1);
  });
});

describe("Asociația Studențească Demo template — content shape", () => {
  test("declares Romanian as the default language", () => {
    expect(asociatiaStudenteascaDemoData.defaultLanguage).toBe("ro");
    expect(asociatiaStudenteascaDemoData.languages).toContain("ro");
  });

  test("ships at least the home and about pages", () => {
    const slugs = asociatiaStudenteascaDemoData.pages.map((p) => p.slug);
    expect(slugs).toContain("acasa");
    expect(slugs).toContain("despre");
  });

  test("home page opens with a hero block", () => {
    const home = asociatiaStudenteascaDemoData.pages.find((p) => p.slug === "acasa");
    expect(home).toBeDefined();
    expect(home!.blocks[0]!.type).toBe("hero");
  });

  test("Romanian content uses correct diacritics (ă, â, î, ș, ț)", () => {
    // Stringify the whole site and look for the Romanian diacritic set.
    // At least one occurrence of each diacritic family must appear somewhere
    // in the demo content.
    const blob = JSON.stringify(asociatiaStudenteascaDemoData);
    expect(blob).toMatch(/[ăâ]/);
    expect(blob).toMatch(/[îÎ]/);
    expect(blob).toMatch(/[șȘ]/);
    expect(blob).toMatch(/[țȚ]/);
  });

  test("exercises the full v1 block surface across pages", () => {
    // Per the PRD, v1 shipped 15 block types (#9-#22). The demo also seeds
    // later additive blocks such as the site footer so the template continues
    // to exercise the full known block surface.
    // instance of each so once the corresponding implementations land, the
    // template lights up automatically. Forward-compat unknown blocks are
    // still valid envelopes today.
    const expectedTypes = [
      "hero",
      "richText",
      "valueList",
      "activitiesList",
      "teamGrid",
      "contactCard",
      "imageGallery",
      "quote",
      "ctaBanner",
      "partnerLogos",
      "faq",
      "customHTML",
      "embed",
      "documentDownloads",
      "eventList",
      "siteFooter",
    ];
    const observed = new Set<string>();
    for (const page of asociatiaStudenteascaDemoData.pages) {
      for (const block of page.blocks) {
        observed.add(block.type);
      }
    }
    for (const expected of expectedTypes) {
      expect(observed.has(expected)).toBe(true);
    }
  });

  test("placeholder asset paths follow the assets/placeholder-* convention", () => {
    const blob = JSON.stringify(asociatiaStudenteascaDemoData);
    // Any image or media reference must be a placeholder under assets/.
    const assetReferences = blob.match(/assets\/[^"']+/g) ?? [];
    expect(assetReferences.length).toBeGreaterThan(0);
    for (const ref of assetReferences) {
      // We accept either logo-placeholder or photo placeholders, all under
      // the assets/placeholder-... path prefix.
      expect(ref).toMatch(/^assets\/placeholder-/);
    }
  });
});

describe("Asociația Studențească Demo template — metadata", () => {
  test("flags the demo as AI-drafted with native review pending", () => {
    expect(asociatiaStudenteascaDemoMetadata.aiDrafted).toBe(true);
    expect(asociatiaStudenteascaDemoMetadata.nativeReviewPending).toBe(true);
  });

  test("lists at least one [de înlocuit] marker for editor-only display", () => {
    expect(asociatiaStudenteascaDemoMetadata.replaceMarkers.length).toBeGreaterThan(0);
    for (const marker of asociatiaStudenteascaDemoMetadata.replaceMarkers) {
      // Each marker is a stable code editors can use to surface a "swap me"
      // hint without leaking the marker into the rendered HTML.
      expect(typeof marker.code).toBe("string");
      expect(marker.code.length).toBeGreaterThan(0);
      expect(typeof marker.path).toBe("string");
      expect(marker.path.length).toBeGreaterThan(0);
    }
  });

  test("declares CC0 licensing for placeholder asset references", () => {
    expect(asociatiaStudenteascaDemoMetadata.assetCredits.license).toBe("CC0");
    expect(typeof asociatiaStudenteascaDemoMetadata.assetCredits.notice).toBe("string");
    expect(asociatiaStudenteascaDemoMetadata.assetCredits.notice.length).toBeGreaterThan(0);
  });

  test("the [de înlocuit] markers do not appear inside the demo data itself", () => {
    // The PRD requires that the editor surface these as hints, but the
    // rendered HTML must NOT carry them. The simplest mechanism: store the
    // hints as separate metadata, never inside the data file's strings.
    const blob = JSON.stringify(asociatiaStudenteascaDemoData);
    expect(blob).not.toContain("[de înlocuit]");
    expect(blob).not.toContain("[de inlocuit]");
  });

  test("template is exported with id, name, and a one-line description", () => {
    expect(typeof ASOCIATIA_STUDENTEASCA_DEMO.id).toBe("string");
    expect(ASOCIATIA_STUDENTEASCA_DEMO.id.length).toBeGreaterThan(0);
    expect(typeof ASOCIATIA_STUDENTEASCA_DEMO.name).toBe("string");
    expect(ASOCIATIA_STUDENTEASCA_DEMO.name.length).toBeGreaterThan(0);
    expect(typeof ASOCIATIA_STUDENTEASCA_DEMO.description).toBe("string");
    expect(ASOCIATIA_STUDENTEASCA_DEMO.description.length).toBeGreaterThan(0);
  });
});

describe("Asociația Studențească Demo template — renderer integration", () => {
  test("renderSite(demo, 'stub') produces a complete HTML document", () => {
    const site = parseSite(asociatiaStudenteascaDemoData);
    const html = renderSite(site, "stub");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("renderSite output is deterministic across calls", () => {
    const site = parseSite(asociatiaStudenteascaDemoData);
    const a = renderSite(site, "stub");
    const b = renderSite(site, "stub");
    expect(a).toBe(b);
  });

  test("renderSite output never carries the [de înlocuit] marker text", () => {
    const site = parseSite(asociatiaStudenteascaDemoData);
    const html = renderSite(site, "stub");
    expect(html).not.toContain("[de înlocuit]");
    expect(html).not.toContain("[de inlocuit]");
  });

  test("renders both the home and the about pages", () => {
    const site = parseSite(asociatiaStudenteascaDemoData);
    const home = renderSite(site, "stub", { pageIndex: 0 });
    const about = renderSite(site, "stub", {
      pageIndex: site.pages.findIndex((p) => p.slug === "despre"),
    });
    expect(home).not.toBe(about);
    expect(home).toContain("<html");
    expect(about).toContain("<html");
  });
});
