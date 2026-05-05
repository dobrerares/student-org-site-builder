/**
 * `@sosb/i18n` — keyed message lookup with RO/EN, browser language
 * detection, and override persistence.
 *
 * Tracking issue: #42. ADR 0028 records the design.
 *
 * Public surface:
 *
 *   - `createTranslator({ catalogs, locale, defaultLocale })`
 *       Build a translator with a registered catalog map. Returns
 *       `{ locale, t, setLocale, subscribe }`.
 *   - `t(key, params?)`
 *       Look up `key` in the active locale (with `defaultLocale` fallback)
 *       and apply named-placeholder + plural interpolation. On missing key,
 *       returns the literal key and warns once per key.
 *   - `findMissingKeys(base, target)`
 *       Diff helper used by the catalog-parity test (CI gate) and any future
 *       in-editor "translation health" panel.
 *   - `detectLocale({ supported, defaultLocale, navigatorLanguages })`
 *       Pure resolver from `navigator.languages` to a supported locale.
 *   - `loadStoredLocale(vfs, supported)` / `saveLocale(vfs, locale)`
 *       VFS-backed persistence; the host shell wires whatever VFS driver it
 *       uses for the editor's auto-save (see ADR 0005).
 *   - Catalogs:
 *       `enCatalog` — English editor messages.
 *       `roCatalog` — Romanian editor messages (AI-drafted; pending native
 *                     review).
 *   - Constants:
 *       `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `LOCALE_PREFERENCE_PATH`.
 */

export type { Locale, MessageCatalog, Translator } from "./types.js";
export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./types.js";

export { createTranslator, findMissingKeys, type CreateTranslatorOptions } from "./translator.js";

export { detectLocale, type DetectLocaleOptions } from "./detect.js";

export { LOCALE_PREFERENCE_PATH, loadStoredLocale, saveLocale } from "./persistence.js";

export { en, enCatalog } from "./locales/en.js";
export { ro, roCatalog } from "./locales/ro.js";
export type { EditorMessageKey } from "./locales/keys.js";
