import { describe, expect, test } from "vitest";
import { parseSite, validate } from "@sosb/schema";
import {
  generateA11yFixture,
  ROMANIAN_DIACRITIC_CHARSET,
  type A11yFixtureOptions,
} from "./a11y-fixture.js";

/**
 * Unit tests for the a11y regression-fixture generator.
 *
 * The generator produces a `Site` for a given (themeId, blocksPresent[])
 * pair, populated with the test-corpus contract from issue #40:
 *  - Romanian diacritics (Ă/Â/Î/Ș/Ț + lowercase counterparts)
 *  - long Romanian copy for line-wrapping edge cases
 *  - multi-language switcher (lang + localizedAs)
 *
 * The Playwright a11y spec consumes this generator at run time; these tests
 * keep the contract honest at unit level so the e2e layer can rely on the
 * shape without re-asserting it.
 */

describe("generateA11yFixture", () => {
  test("returns a schema-valid Site with the supplied themeId", () => {
    const site = generateA11yFixture("stub", ["hero"]);
    expect(site.theme.id).toBe("stub");
    const result = validate(site);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    // Strict-parse must not throw — the renderer trusts this shape.
    expect(() => parseSite(site)).not.toThrow();
  });

  test("places every requested block on the home page", () => {
    const site = generateA11yFixture("stub", ["hero"]);
    const home = site.pages[0];
    if (home === undefined) throw new Error("expected home page");
    const presentTypes = home.blocks.map((b) => b.type);
    expect(presentTypes).toContain("hero");
  });

  test("the home page contains every Romanian diacritic at least once", () => {
    const site = generateA11yFixture("stub", ["hero"]);
    const serialised = JSON.stringify(site);
    for (const ch of ROMANIAN_DIACRITIC_CHARSET) {
      expect(serialised, `missing diacritic '${ch}' in fixture`).toContain(ch);
    }
  });

  test("the home page carries long Romanian copy (>=200 chars in a single field)", () => {
    const site = generateA11yFixture("stub", ["hero"]);
    const home = site.pages[0];
    if (home === undefined) throw new Error("expected home page");
    const longest = home.blocks
      .flatMap((b) => Object.values(b.data ?? {}))
      .filter((v): v is string => typeof v === "string")
      .reduce((acc, v) => Math.max(acc, v.length), 0);
    expect(longest).toBeGreaterThanOrEqual(200);
  });

  test("declares both languages and provides EN counterpart pages with localizedAs links", () => {
    const site = generateA11yFixture("stub", ["hero"]);
    expect(site.languages).toEqual(expect.arrayContaining(["ro", "en"]));
    expect(site.defaultLanguage).toBe("ro");

    const ro = site.pages.find((p) => p.lang === "ro");
    const en = site.pages.find((p) => p.lang === "en");
    if (ro === undefined || en === undefined) {
      throw new Error("expected one ro and one en page");
    }
    // Each side must carry a localizedAs link to the other (per #24 schema).
    expect(ro.localizedAs?.["en"]).toBe(en.slug);
    expect(en.localizedAs?.["ro"]).toBe(ro.slug);
  });

  test("is deterministic — same input produces byte-identical JSON", () => {
    const a = JSON.stringify(generateA11yFixture("stub", ["hero"]));
    const b = JSON.stringify(generateA11yFixture("stub", ["hero"]));
    expect(a).toBe(b);
  });

  test("respects empty blocksPresent[] by emitting only the mandatory hero", () => {
    // The PRD pins hero as the mandatory page-opener. The generator must not
    // emit a heroless page even if the caller passes an empty corpus, so that
    // axe sees a structurally complete document.
    const site = generateA11yFixture("stub", []);
    const home = site.pages[0];
    if (home === undefined) throw new Error("expected home page");
    expect(home.blocks.some((b) => b.type === "hero")).toBe(true);
  });

  test("accepts a different themeId without changing the page shape", () => {
    const optsA: A11yFixtureOptions = {};
    const stubSite = generateA11yFixture("stub", ["hero"], optsA);
    const academicSite = generateA11yFixture("academic", ["hero"], optsA);
    expect(stubSite.theme.id).toBe("stub");
    expect(academicSite.theme.id).toBe("academic");
    // Page count + block-type sequence must match — the only differing axis
    // is the theme id (and its tokens, which we leave to theme defaults).
    expect(academicSite.pages.length).toBe(stubSite.pages.length);
    expect(academicSite.pages[0]?.blocks.map((b) => b.type)).toEqual(
      stubSite.pages[0]?.blocks.map((b) => b.type),
    );
  });
});
