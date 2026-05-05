import { describe, expect, test, vi } from "vitest";

import { createTranslator, findMissingKeys, type MessageCatalog } from "../src/index.js";

const en: MessageCatalog = {
  "topbar.import": "Import",
  "topbar.export": "Export",
  "topbar.reset": "Reset",
  "tabs.editor": "Editor",
  "tabs.preview": "Preview",
  "greeting.hello": "Hello, {name}!",
  "items.count": "{count, plural, one {# item} other {# items}}",
};

const ro: MessageCatalog = {
  "topbar.import": "Importă",
  "topbar.export": "Exportă",
  "topbar.reset": "Resetează",
  "tabs.editor": "Editor",
  "tabs.preview": "Previzualizare",
  "greeting.hello": "Salut, {name}!",
  // intentionally missing items.count to exercise fallback
};

describe("createTranslator", () => {
  test("looks up the requested locale's message", () => {
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "ro",
    });
    expect(t("topbar.import")).toBe("Importă");
    expect(t("tabs.editor")).toBe("Editor");
  });

  test("interpolates {placeholder} params", () => {
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "ro",
    });
    expect(t("greeting.hello", { name: "Maria" })).toBe("Salut, Maria!");
  });

  test("missing key in active locale falls back to defaultLocale", () => {
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "ro",
    });
    // ro is missing 'items.count'; falls back to en.
    expect(t("items.count", { count: 1 })).toBe("1 item");
    expect(t("items.count", { count: 5 })).toBe("5 items");
  });

  test("missing key everywhere returns the key itself and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "ro",
    });
    expect(t("nonexistent.key" as never)).toBe("nonexistent.key");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("nonexistent.key"));
    warn.mockRestore();
  });

  test("plural rule selects 'one' for 1 and 'other' otherwise (English)", () => {
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "en",
    });
    expect(t("items.count", { count: 1 })).toBe("1 item");
    expect(t("items.count", { count: 0 })).toBe("0 items");
    expect(t("items.count", { count: 42 })).toBe("42 items");
  });

  test("setLocale changes lookup at runtime and notifies subscribers", () => {
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "en",
    });
    expect(t.locale).toBe("en");
    expect(t("topbar.import")).toBe("Import");

    const listener = vi.fn();
    const unsub = t.subscribe(listener);
    t.setLocale("ro");

    expect(t.locale).toBe("ro");
    expect(t("topbar.import")).toBe("Importă");
    expect(listener).toHaveBeenCalledWith("ro");

    unsub();
    t.setLocale("en");
    // listener was unsubscribed before second call
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("rejects unknown locale at construction", () => {
    expect(() =>
      createTranslator({
        catalogs: { en },
        defaultLocale: "en",
        locale: "fr" as never,
      }),
    ).toThrow(/unknown locale/i);
  });

  test("rejects unknown locale at setLocale", () => {
    const t = createTranslator({
      catalogs: { en, ro },
      defaultLocale: "en",
      locale: "en",
    });
    expect(() => t.setLocale("fr" as never)).toThrow(/unknown locale/i);
  });
});

describe("findMissingKeys", () => {
  test("lists keys present in the base but absent in the target", () => {
    const missing = findMissingKeys(en, ro);
    expect(missing).toEqual(["items.count"]);
  });

  test("returns empty array when target is a superset", () => {
    const missing = findMissingKeys(ro, en);
    expect(missing).toEqual([]);
  });
});
