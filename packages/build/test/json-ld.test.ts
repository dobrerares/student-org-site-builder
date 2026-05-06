import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import multiPageSite from "./fixtures/multi-page-site.json" with { type: "json" };
import bilingualSite from "./fixtures/bilingual-site.json" with { type: "json" };
import jsonLdRichSite from "./fixtures/jsonld-rich-site.json" with { type: "json" };
import { build } from "../src/index.js";

const single = singlePageSite as unknown as Site;
const multi = multiPageSite as unknown as Site;
const bilingual = bilingualSite as unknown as Site;
const rich = jsonLdRichSite as unknown as Site;

/**
 * Per the issue (#39) JSON-LD requirements:
 *   - Organization (always, site-level)
 *   - Person (per teamGrid member)
 *   - Event (per eventList item)
 *   - FAQPage (per faq block)
 *   - BreadcrumbList (when nav depth > 1)
 *
 * The build pipeline emits one or more application/ld+json script tags
 * inside head. Each script body is a parseable JSON object whose @context is
 * https://schema.org and whose @type discriminates the payload.
 */

/**
 * Extract every JSON-LD blob from a rendered HTML string. Returns the
 * parsed JSON for each script tag in document order.
 */
function extractJsonLd(html: string): unknown[] {
  const pattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const result: unknown[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const body = match[1] ?? "";
    result.push(JSON.parse(body));
  }
  return result;
}

function findByType(blobs: unknown[], type: string): Record<string, unknown> | undefined {
  return blobs.find(
    (blob): blob is Record<string, unknown> =>
      typeof blob === "object" &&
      blob !== null &&
      "@type" in blob &&
      (blob as { "@type": unknown })["@type"] === type,
  );
}

describe("build - JSON-LD: Organization (always emitted, site-level)", () => {
  test("each rendered page contains an Organization JSON-LD script in head", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    for (const path of [
      "index.html",
      "echipa/index.html",
      "evenimente/index.html",
      "intrebari/index.html",
    ]) {
      const html = dist.get(path)!;
      const headEnd = html.indexOf("</head>");
      const head = html.slice(0, headEnd);
      expect(head).toMatch(/<script type="application\/ld\+json">/);
      const blobs = extractJsonLd(head);
      const org = findByType(blobs, "Organization");
      expect(org).toBeDefined();
    }
  });

  test("Organization JSON-LD has @context https://schema.org and required fields", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("index.html")!);
    const org = findByType(blobs, "Organization");
    expect(org).toBeDefined();
    expect(org!["@context"]).toBe("https://schema.org");
    expect(org!.name).toBe("Asociația Stub");
  });

  test("Organization JSON-LD includes optional org fields when present", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("index.html")!);
    const org = findByType(blobs, "Organization");
    expect(org).toBeDefined();
    expect(org!.logo).toBe("https://stub.example.org/assets/logo.png");
    expect(org!.foundingDate).toBe("2024");
    expect(org!.email).toBe("contact@stub.example.org");
    expect(org!.telephone).toBe("+40 700 000 000");
    expect(org!.address).toBeDefined();
    expect(org!.sameAs).toEqual(
      expect.arrayContaining([
        "https://facebook.com/asociatia.stub",
        "https://instagram.com/asociatia.stub",
      ]),
    );
    expect(org!.url).toBe("https://stub.example.org/");
  });

  test("Organization JSON-LD without siteUrl uses relative URL fallbacks", () => {
    const dist = build(rich);
    const blobs = extractJsonLd(dist.get("index.html")!);
    const org = findByType(blobs, "Organization");
    expect(org).toBeDefined();
    expect(org!.name).toBe("Asociația Stub");
    expect(org!.url).toBe("/");
    expect(org!.logo).toBe("assets/logo.png");
  });

  test("Organization JSON-LD on a minimal site (no socials/logo/etc) still validates", () => {
    const dist = build(single);
    const blobs = extractJsonLd(dist.get("index.html")!);
    const org = findByType(blobs, "Organization");
    expect(org).toBeDefined();
    expect(org!["@context"]).toBe("https://schema.org");
    expect(org!.name).toBe("Asociația Stub");
    expect(org).not.toHaveProperty("logo");
    expect(org).not.toHaveProperty("sameAs");
    expect(org).not.toHaveProperty("foundingDate");
  });

  test("Organization JSON-LD escapes the script-close sequence safely", () => {
    const evil = structuredClone(rich) as Site;
    (evil.org as { name: string }).name = "Evil </script><script>alert(1)</script>";
    const dist = build(evil);
    const html = dist.get("index.html")!;
    const headEnd = html.indexOf("</head>");
    const head = html.slice(0, headEnd);
    const scripts = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    for (const script of scripts) {
      const inner = script.replace(/<script[^>]*>/, "").replace(/<\/script>$/, "");
      expect(inner.toLowerCase()).not.toContain("</script>");
    }
    const blobs = extractJsonLd(head);
    const org = findByType(blobs, "Organization");
    expect(org!.name).toContain("Evil");
  });
});

describe("build - JSON-LD: Person (when teamGrid block present)", () => {
  test("emits one Person blob per team member on the team page", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const html = dist.get("echipa/index.html")!;
    const blobs = extractJsonLd(html);
    const persons = blobs.filter(
      (b): b is Record<string, unknown> =>
        typeof b === "object" && b !== null && (b as { "@type": unknown })["@type"] === "Person",
    );
    expect(persons.length).toBe(2);
    expect(persons[0]!.name).toBe("Ana Popescu");
    expect(persons[0]!.jobTitle).toBe("Președinte");
    expect(persons[0]!["@context"]).toBe("https://schema.org");
    expect(persons[1]!.name).toBe("Bogdan Ionescu");
  });

  test("Person.image is absolutised against siteUrl", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("echipa/index.html")!);
    const persons = blobs.filter(
      (b): b is Record<string, unknown> =>
        typeof b === "object" && b !== null && (b as { "@type": unknown })["@type"] === "Person",
    );
    expect(persons[0]!.image).toBe("https://stub.example.org/assets/ana.jpg");
  });

  test("does NOT emit Person on pages without a teamGrid block", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const homeBlobs = extractJsonLd(dist.get("index.html")!);
    expect(
      homeBlobs.filter(
        (b) =>
          typeof b === "object" && b !== null && (b as { "@type": unknown })["@type"] === "Person",
      ),
    ).toEqual([]);
  });
});

describe("build - JSON-LD: Event (when eventList block present)", () => {
  test("emits one Event blob per event on the events page", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("evenimente/index.html")!);
    const events = blobs.filter(
      (b): b is Record<string, unknown> =>
        typeof b === "object" && b !== null && (b as { "@type": unknown })["@type"] === "Event",
    );
    expect(events.length).toBe(2);
    expect(events[0]!.name).toBe("Conferința de toamnă");
    expect(events[0]!.startDate).toBe("2026-10-12T18:00:00+03:00");
    expect(events[0]!.endDate).toBe("2026-10-12T21:00:00+03:00");
    expect(events[0]!.location).toBeDefined();
    expect(events[0]!.image).toBe("https://stub.example.org/assets/conf.jpg");
    expect(events[0]!.description).toBe("O conferință despre studenție.");
  });

  test("Event with no endDate / image / description still validates", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("evenimente/index.html")!);
    const events = blobs.filter(
      (b): b is Record<string, unknown> =>
        typeof b === "object" && b !== null && (b as { "@type": unknown })["@type"] === "Event",
    );
    const minimal = events[1]!;
    expect(minimal.name).toBe("Workshop primăvară");
    expect(minimal.startDate).toBe("2026-04-05T10:00:00+03:00");
    expect(minimal).not.toHaveProperty("endDate");
    expect(minimal).not.toHaveProperty("image");
    expect(minimal).not.toHaveProperty("description");
  });

  test("does NOT emit Event on pages without an eventList block", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const homeBlobs = extractJsonLd(dist.get("index.html")!);
    expect(
      homeBlobs.filter(
        (b) =>
          typeof b === "object" && b !== null && (b as { "@type": unknown })["@type"] === "Event",
      ),
    ).toEqual([]);
  });
});

describe("build - JSON-LD: FAQPage (when faq block present)", () => {
  test("emits one FAQPage blob per faq block, with mainEntity entries", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("intrebari/index.html")!);
    const faq = findByType(blobs, "FAQPage");
    expect(faq).toBeDefined();
    expect(faq!["@context"]).toBe("https://schema.org");
    const main = faq!.mainEntity as Array<Record<string, unknown>>;
    expect(main).toHaveLength(2);
    expect(main[0]!["@type"]).toBe("Question");
    expect(main[0]!.name).toBe("Cum mă alătur?");
    const answer = main[0]!.acceptedAnswer as Record<string, unknown>;
    expect(answer["@type"]).toBe("Answer");
    expect(answer.text).toBe("Trimite un email la contact@stub.example.org.");
  });

  test("does NOT emit FAQPage on pages without a faq block", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const homeBlobs = extractJsonLd(dist.get("index.html")!);
    expect(
      homeBlobs.filter(
        (b) =>
          typeof b === "object" &&
          b !== null &&
          (b as { "@type": unknown })["@type"] === "FAQPage",
      ),
    ).toEqual([]);
  });
});

describe("build - JSON-LD: BreadcrumbList (when nav depth > 1)", () => {
  test("emits BreadcrumbList on non-home pages of a multi-page site", () => {
    const dist = build(multi, { siteUrl: "https://stub.example.org" });
    const aboutBlobs = extractJsonLd(dist.get("despre/index.html")!);
    const crumbs = findByType(aboutBlobs, "BreadcrumbList");
    expect(crumbs).toBeDefined();
    expect(crumbs!["@context"]).toBe("https://schema.org");
    const items = crumbs!.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]!.position).toBe(1);
    expect(items[0]!.name).toBe("Acasă");
    expect(items[0]!.item).toBe("https://stub.example.org/");
    expect(items[1]!.position).toBe(2);
    expect(items[1]!.name).toBe("Despre");
    expect(items[1]!.item).toBe("https://stub.example.org/despre/");
  });

  test("does NOT emit BreadcrumbList on the home page itself", () => {
    const dist = build(multi, { siteUrl: "https://stub.example.org" });
    const homeBlobs = extractJsonLd(dist.get("index.html")!);
    const crumbs = findByType(homeBlobs, "BreadcrumbList");
    expect(crumbs).toBeUndefined();
  });

  test("does NOT emit BreadcrumbList on a single-page site (no nav depth)", () => {
    const dist = build(single, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("index.html")!);
    const crumbs = findByType(blobs, "BreadcrumbList");
    expect(crumbs).toBeUndefined();
  });
});

describe("build - JSON-LD determinism", () => {
  test("rich-fixture builds produce byte-identical JSON-LD across calls", () => {
    const a = build(rich, { siteUrl: "https://stub.example.org" });
    const b = build(rich, { siteUrl: "https://stub.example.org" });
    for (const path of [
      "index.html",
      "echipa/index.html",
      "evenimente/index.html",
      "intrebari/index.html",
    ]) {
      expect(a.get(path)!).toBe(b.get(path)!);
    }
  });

  test("JSON-LD is emitted before </head> (search engines parse head only)", () => {
    const dist = build(rich, { siteUrl: "https://stub.example.org" });
    const html = dist.get("index.html")!;
    const firstScript = html.indexOf('<script type="application/ld+json">');
    const headClose = html.indexOf("</head>");
    expect(firstScript).toBeGreaterThan(0);
    expect(firstScript).toBeLessThan(headClose);
  });
});

describe("build - JSON-LD: bilingual site sanity", () => {
  test("each language's pages emit Organization JSON-LD", () => {
    const dist = build(bilingual, { siteUrl: "https://stub.example.org" });
    for (const path of [
      "index.html",
      "en/index.html",
      "despre/index.html",
      "en/about/index.html",
    ]) {
      const blobs = extractJsonLd(dist.get(path)!);
      const org = findByType(blobs, "Organization");
      expect(org).toBeDefined();
      expect(org!.name).toBe("Asociația Bilingual");
    }
  });

  test("BreadcrumbList for the en/about page uses the active language home label and path", () => {
    const dist = build(bilingual, { siteUrl: "https://stub.example.org" });
    const blobs = extractJsonLd(dist.get("en/about/index.html")!);
    const crumbs = findByType(blobs, "BreadcrumbList");
    expect(crumbs).toBeDefined();
    const items = crumbs!.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]!.name).toBe("Home");
    expect(items[0]!.item).toBe("https://stub.example.org/en/");
    expect(items[1]!.name).toBe("About");
    expect(items[1]!.item).toBe("https://stub.example.org/en/about/");
  });
});
