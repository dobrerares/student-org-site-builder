/**
 * Message-format engine.
 *
 * Two micro-features:
 *
 *   1. Named placeholders: `Hello, {name}!` → substitutes `params.name`.
 *   2. Single-form ICU plural: `{count, plural, one {# item} other {# items}}`
 *      → selects `one`/`other` per the active locale's plural rule, then
 *      replaces `#` with the count.
 *
 * Why a hand-rolled parser instead of `@formatjs/intl-messageformat`:
 * the editor needs ICU plurals and named substitution, nothing else
 * (no select, no nested formats, no dates, no nested HTML). A 60-line
 * formatter avoids pulling ~20kb of runtime + a CLDR data table for two
 * locales whose plural rules are documented in two lines.
 *
 * Plural rules for v1's two locales:
 *
 *   - English: `n === 1 → one`, otherwise `other`.
 *   - Romanian (CLDR): `one` for 1, `few` for 0 and 2..19 and 100..119, `other`
 *     otherwise. We collapse `few` into `other` for v1 because (a) the editor
 *     UI only currently has count-strings that are precise enough not to
 *     change between `one`/`few`/`other` in practice, and (b) the catalog
 *     lints already enforce that translators write a sensible "few/other"
 *     form. If a future string genuinely needs the `few` form we'll widen the
 *     parser then; the tests pin current behaviour.
 */
import type { Locale } from "./types.js";

type PluralCategory = "one" | "other";

export function pluralCategory(locale: Locale, n: number): PluralCategory {
  switch (locale) {
    case "en":
      return n === 1 ? "one" : "other";
    case "ro":
      // v1 collapse: see comment block above.
      return n === 1 ? "one" : "other";
  }
}

/**
 * Format `template` with `params` for the given locale.
 *
 * Unrecognised placeholders are left as-is and a console.warn is emitted.
 * That mirrors `t(...)`'s missing-key behaviour: the failure is visible
 * rather than silent, but the UI keeps working.
 */
export function formatMessage(
  template: string,
  params: Readonly<Record<string, string | number>> | undefined,
  locale: Locale,
): string {
  // Plural form: {name, plural, one {...} other {...}}
  // We process plural blocks first because they may contain placeholders
  // themselves (`# items`, `{name}` etc.).
  let out = template.replace(
    /\{(\w+),\s*plural\s*,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
    (match, name: string, oneForm: string, otherForm: string) => {
      const value = params?.[name];
      if (typeof value !== "number") return match;
      const branch = pluralCategory(locale, value) === "one" ? oneForm : otherForm;
      return branch.replace(/#/g, String(value));
    },
  );

  // Named placeholders: {name}
  out = out.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (params === undefined || !(name in params)) {
      console.warn(`@sosb/i18n: missing param '${name}' in template '${template}'`);
      return `{${name}}`;
    }
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });

  return out;
}
