import { describe, expect, test } from "vitest";
import historipol from "./fixtures/historipol.json" with { type: "json" };
import { validate } from "../src/index.js";

/**
 * Multi-language support (#24): localizedAs cross-references.
 *
 * Each Page may declare localizedAs: { [otherLang]: counterpartSlug }. The
 * schema parser already accepts the field (looseObject record); this layer
 * validates that:
 *
 *   - referenced languages are declared in site.languages
 *   - referenced slugs exist in pages[] for that language
 *   - a page does not list its own language in localizedAs (self-reference)
 *
 * Pages without language counterparts are valid (graceful: missing
 * translations fall back to the language home at render time, per PRD AC).
 */
describe("validate - localizedAs cross-references", () => {
  test("HISTORIPOL fixture's localizedAs entries validate", () => {
    const result = validate(historipol);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("rejects localizedAs entries pointing at undeclared languages", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { localizedAs?: Record<string, string> }[];
    };
    broken.pages[0]!.localizedAs = { fr: "accueil" };
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.code === "site.page.localizedAs.unknownLanguage")).toBe(
      true,
    );
  });

  test("rejects localizedAs slugs that do not exist for that language", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { localizedAs?: Record<string, string> }[];
    };
    broken.pages[0]!.localizedAs = { en: "does-not-exist" };
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.code === "site.page.localizedAs.unknownCounterpart")).toBe(
      true,
    );
  });

  test("rejects localizedAs that lists the page's own language (self-reference)", () => {
    const broken = structuredClone(historipol) as unknown as {
      pages: { lang: string; localizedAs?: Record<string, string>; slug: string }[];
    };
    broken.pages[0]!.localizedAs = { ro: broken.pages[0]!.slug };
    const result = validate(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((i) => i.code === "site.page.localizedAs.selfReference")).toBe(true);
  });

  test("warns when a bilingual site has pages with no counterpart in some declared language", () => {
    const result = validate(historipol);
    expect(result.warnings.some((i) => i.code === "site.page.localizedAs.missingCounterpart")).toBe(
      true,
    );
  });

  test("does not warn for single-language sites missing counterparts", () => {
    const single = {
      ...(historipol as object),
      languages: ["ro"],
      pages: (historipol as { pages: unknown[] }).pages
        .filter((p) => (p as { lang: string }).lang === "ro")
        .map((p) => {
          const copy = { ...(p as object) } as { localizedAs?: unknown };
          delete copy.localizedAs;
          return copy;
        }),
    };
    const result = validate(single);
    expect(result.warnings.some((i) => i.code === "site.page.localizedAs.missingCounterpart")).toBe(
      false,
    );
  });
});
