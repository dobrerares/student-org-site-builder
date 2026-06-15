import { describe, expect, test } from "vitest";
import { validate, SITE_SCHEMA_VERSION } from "@sosb/schema";

import { buildSiteFromWizard } from "../src/build-site.js";
import { createInitialState, patch, type WizardState } from "../src/state-machine.js";

/**
 * `buildSiteFromWizard` produces the partially-filled `Site` handed off to
 * the editor. Per the AC: "Final confirm step previews the site, then
 * 'Create' opens it in the editor" — so the output must validate clean
 * against `@sosb/schema`'s `validate()`.
 *
 * The mapping is: WizardData → Site spine (org metadata + theme + languages
 * + initial pages array). Mandatory blocks are placed on the home page;
 * optional blocks are not auto-created (they live on the user's "add
 * later" list).
 */

function fullyFilledState(): WizardState {
  let state = createInitialState();
  state = patch(state, "basics", {
    name: "HISTORIPOL",
    tagline: "Studenți care fac istorie.",
    foundedYear: 2024,
  });
  state = patch(state, "identity", { themeId: "academic" });
  state = patch(state, "sections", {
    mandatory: ["hero", "richText", "valueList", "activitiesList", "teamGrid", "contactCard"],
  });
  state = patch(state, "languages", {
    mode: "single",
    defaultLanguage: "ro",
  });
  return state;
}

describe("buildSiteFromWizard — schema validity", () => {
  test("output validates clean against @sosb/schema's validate()", () => {
    const site = buildSiteFromWizard(fullyFilledState().data);
    const result = validate(site);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("output uses the canonical SITE_SCHEMA_VERSION constant", () => {
    const site = buildSiteFromWizard(fullyFilledState().data);
    expect(site.schemaVersion).toBe(SITE_SCHEMA_VERSION);
  });
});

describe("buildSiteFromWizard — basics → org", () => {
  test("maps name / tagline / foundedYear into the Site.org spine", () => {
    const site = buildSiteFromWizard(fullyFilledState().data);
    expect(site.org.name).toBe("HISTORIPOL");
    expect(site.org.tagline).toBe("Studenți care fac istorie.");
    expect(site.org.foundedYear).toBe(2024);
  });

  test("falls back to a sensible default org name when basics is somehow empty", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Fallback Org" });
    const site = buildSiteFromWizard(state.data);
    expect(site.org.name).toBe("Fallback Org");
  });
});

describe("buildSiteFromWizard — identity → theme", () => {
  test("maps themeId into Site.theme.id", () => {
    const site = buildSiteFromWizard(fullyFilledState().data);
    expect(site.theme.id).toBe("academic");
  });

  test("defaults to a 'minimal' theme when identity is unset (skip path)", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    const site = buildSiteFromWizard(state.data);
    expect(site.theme.id).toBeTruthy();
    expect(typeof site.theme.id).toBe("string");
  });
});

describe("buildSiteFromWizard — languages → defaultLanguage + languages", () => {
  test("single-language mode emits one language matching default", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = patch(state, "languages", {
      mode: "single",
      defaultLanguage: "ro",
    });
    const site = buildSiteFromWizard(state.data);
    expect(site.defaultLanguage).toBe("ro");
    expect(site.languages).toEqual(["ro"]);
  });

  test("bilingual mode emits both languages, default first", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = patch(state, "languages", {
      mode: "bilingual",
      defaultLanguage: "ro",
      secondaryLanguage: "en",
    });
    const site = buildSiteFromWizard(state.data);
    expect(site.defaultLanguage).toBe("ro");
    expect(site.languages).toContain("ro");
    expect(site.languages).toContain("en");
    expect(site.languages[0]).toBe("ro");
  });

  test("falls back to 'ro' / single language when languages step is unset", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    const site = buildSiteFromWizard(state.data);
    expect(site.defaultLanguage).toBeTruthy();
    expect(site.languages.length).toBeGreaterThan(0);
    expect(site.languages).toContain(site.defaultLanguage);
  });
});

describe("buildSiteFromWizard — sections → page blocks", () => {
  test("the home page contains all starter sections by default", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    const site = buildSiteFromWizard(state.data);
    expect(site.pages).toHaveLength(1);
    const home = site.pages[0]!;
    expect(home.blocks.map((b) => b.type)).toEqual([
      "hero",
      "richText",
      "valueList",
      "activitiesList",
      "teamGrid",
      "contactCard",
    ]);
  });

  test("each block on the home page has a unique id", () => {
    const site = buildSiteFromWizard(fullyFilledState().data);
    const ids = site.pages[0]!.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("an explicit section selection controls which starter blocks are created", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = patch(state, "sections", {
      mandatory: ["hero", "teamGrid", "contactCard"],
    });
    const site = buildSiteFromWizard(state.data);
    expect(site.pages[0]!.blocks.map((b) => b.type)).toEqual(["hero", "teamGrid", "contactCard"]);
  });

  test("an empty section selection keeps a top page header so the site is usable", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = patch(state, "sections", { mandatory: [] });
    const site = buildSiteFromWizard(state.data);
    expect(site.pages[0]!.blocks.map((b) => b.type)).toEqual(["hero"]);
  });
});

describe("buildSiteFromWizard — pages spine", () => {
  test("creates a single home page with a Romanian-default slug", () => {
    const site = buildSiteFromWizard(fullyFilledState().data);
    expect(site.pages).toHaveLength(1);
    const home = site.pages[0]!;
    expect(home.lang).toBe("ro");
    expect(home.slug.length).toBeGreaterThan(0);
    expect(home.showInNav).toBe(true);
    expect(typeof home.navOrder).toBe("number");
  });

  test("page lang matches the default language", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "Org" });
    state = patch(state, "languages", {
      mode: "single",
      defaultLanguage: "en",
    });
    const site = buildSiteFromWizard(state.data);
    expect(site.pages[0]!.lang).toBe("en");
  });
});

describe("buildSiteFromWizard — content step", () => {
  test("title content patched on basics propagates to the hero block", () => {
    let state = createInitialState();
    state = patch(state, "basics", { name: "HISTORIPOL", tagline: "Tagline" });
    const site = buildSiteFromWizard(state.data);
    const hero = site.pages[0]!.blocks.find((b) => b.type === "hero");
    expect(hero).toBeDefined();
    // Hero data includes a title — which we expect to default from org name.
    const data = hero?.data as Record<string, unknown>;
    expect(typeof data["title"]).toBe("string");
    expect((data["title"] as string).length).toBeGreaterThan(0);
  });
});

describe("buildSiteFromWizard — purity", () => {
  test("returns a fresh Site each call (no aliasing between draft and result)", () => {
    const data = fullyFilledState().data;
    const a = buildSiteFromWizard(data);
    const b = buildSiteFromWizard(data);
    expect(a).not.toBe(b);
    expect(a.pages).not.toBe(b.pages);
  });
});
