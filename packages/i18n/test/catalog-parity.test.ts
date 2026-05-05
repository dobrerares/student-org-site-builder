import { describe, expect, test } from "vitest";

import { en } from "../src/locales/en.js";
import { ro } from "../src/locales/ro.js";
import { findMissingKeys } from "../src/index.js";

describe("editor message catalog parity", () => {
  test("ro has every key that en defines (PRD: EN parity from day one, no fallback for wizard)", () => {
    const missingInRo = findMissingKeys(en, ro);
    expect(missingInRo).toEqual([]);
  });

  test("en has every key that ro defines (RO is source-of-truth; EN must keep up)", () => {
    const missingInEn = findMissingKeys(ro, en);
    expect(missingInEn).toEqual([]);
  });

  test("every catalog string is non-empty", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en[${key}] empty`).not.toBe("");
    }
    for (const [key, value] of Object.entries(ro)) {
      expect(value, `ro[${key}] empty`).not.toBe("");
    }
  });

  test("interpolation placeholders match between locales for shared keys", () => {
    // Whatever {name}, {count}, {orgName} placeholders the EN message uses,
    // the RO translation must use the same set — otherwise interpolation will
    // silently leave gaps in one language.
    const placeholderSet = (text: string): Set<string> => {
      const out = new Set<string>();
      const matches = text.matchAll(/\{(\w+)(?:,[^}]*)?\}/g);
      for (const m of matches) {
        const name = m[1];
        if (name !== undefined) out.add(name);
      }
      return out;
    };

    for (const key of Object.keys(en)) {
      const enText = en[key as keyof typeof en];
      const roText = ro[key as keyof typeof ro];
      if (enText === undefined || roText === undefined) continue;
      const enPh = placeholderSet(enText);
      const roPh = placeholderSet(roText);
      expect(Array.from(roPh).sort(), `placeholder mismatch on key '${key}'`).toEqual(
        Array.from(enPh).sort(),
      );
    }
  });
});
