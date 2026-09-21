/**
 * `build()` refuses to export a Site whose Theme package is not available
 * (ADR 0051).
 *
 * This is the deliberate alternative to falling back to a built-in Theme. An
 * export is the artefact an organisation publishes; shipping it silently
 * restyled is worse than not shipping it, because nobody involved finds out.
 * The editor catches this earlier and offers a repair, so reaching here means
 * a scripted or CLI build — exactly the case that needs a loud failure.
 */
import { describe, expect, test } from "vitest";
import type { Site } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import singlePageSite from "./fixtures/single-page-site.json" with { type: "json" };
import { BuildThemeMissingError, build } from "../src/index.js";

const PACKAGE_THEME_ID = "org.example.practice";

function siteUnderPackageTheme(): Site {
  const site = structuredClone(singlePageSite) as unknown as Site;
  site.theme = { id: PACKAGE_THEME_ID };
  return site;
}

/** The smallest bundle that renders: no fonts, no assets, a scrap of CSS. */
const bundle = {
  id: PACKAGE_THEME_ID,
  name: "Practice",
  version: "1.0.0",
  origin: "package",
  css: "body{color:#123456}",
  baselineTokens: [],
  supports: { colors: true, fonts: true, density: true, radius: true },
  blockVariants: {},
  shellVariants: [],
  fontSource: { kind: "registry" },
  assets: new Map<string, Uint8Array>(),
} as unknown as ThemeBundle;

describe("build with a Theme package", () => {
  test("throws BuildThemeMissingError when the Theme was not supplied", () => {
    expect(() => build(siteUnderPackageTheme(), { skipValidation: true })).toThrow(
      BuildThemeMissingError,
    );
  });

  test("the error names the Theme, so a CI log says which package to install", () => {
    try {
      build(siteUnderPackageTheme(), { skipValidation: true });
      throw new Error("expected build to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(BuildThemeMissingError);
      expect((error as BuildThemeMissingError).themeId).toBe(PACKAGE_THEME_ID);
      expect((error as Error).message).toContain(PACKAGE_THEME_ID);
    }
  });

  test("builds normally once the Theme is supplied", () => {
    const dist = build(siteUnderPackageTheme(), { skipValidation: true, themes: [bundle] });
    const home = dist.get("index.html");
    expect(typeof home).toBe("string");
    // The packaged Theme's CSS actually reached the page — a build that
    // "succeeded" without applying the Theme would be the silent restyle this
    // whole code path exists to prevent.
    expect(home as string).toContain("body{color:#123456}");
  });

  test("a built-in Theme still needs no entry in options.themes", () => {
    const site = structuredClone(singlePageSite) as unknown as Site;
    site.theme = { id: "modern" };
    expect(() => build(site, { skipValidation: true })).not.toThrow();
  });
});
