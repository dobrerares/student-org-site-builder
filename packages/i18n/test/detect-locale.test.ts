import { describe, expect, test } from "vitest";

import { detectLocale } from "../src/index.js";

describe("detectLocale", () => {
  const supported = ["en", "ro"] as const;

  test("returns the primary subtag when it matches a supported locale", () => {
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["ro-RO"],
      }),
    ).toBe("ro");
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["en-GB"],
      }),
    ).toBe("en");
  });

  test("walks the navigator.languages array in priority order", () => {
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["fr-FR", "ro-RO", "en-US"],
      }),
    ).toBe("ro");
  });

  test("falls back to defaultLocale when no language is supported", () => {
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["fr-FR", "de-DE"],
      }),
    ).toBe("en");
  });

  test("falls back when navigatorLanguages is empty or undefined", () => {
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: [],
      }),
    ).toBe("en");
    expect(
      detectLocale({
        supported,
        defaultLocale: "ro",
        navigatorLanguages: undefined,
      }),
    ).toBe("ro");
  });

  test("PRD rule: ro-* browser language → RO; everything else → EN", () => {
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["ro"],
      }),
    ).toBe("ro");
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["ro-MD"],
      }),
    ).toBe("ro");
    expect(
      detectLocale({
        supported,
        defaultLocale: "en",
        navigatorLanguages: ["ja-JP"],
      }),
    ).toBe("en");
  });
});
