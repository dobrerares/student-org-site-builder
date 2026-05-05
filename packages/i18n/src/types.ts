/**
 * The set of locales the editor speaks. Romanian first per the PRD: RO is the
 * primary editor language; EN reaches parity from day one.
 *
 * Locale codes are BCP-47 primary subtags. Region variants
 * (`ro-RO`, `ro-MD`, `en-GB`, `en-US`) are normalised down to the primary
 * subtag at detection time.
 */
export const SUPPORTED_LOCALES = ["ro", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * The locale used when a key is missing in the requested locale and when
 * detection cannot identify a supported language.
 *
 * Per PRD ("ro-* browser language → RO; everything else → EN"), the
 * default-on-no-match is **English**. When the user explicitly chooses RO it
 * remains the active locale; the default only matters for the fallback chain.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * A flat catalog of message keys to localised strings. Keys are
 * dot-namespaced (`topbar.import`, `wizard.step.basics.title`) and the same
 * key set must appear across every locale (enforced by the parity test).
 *
 * Values may use `{name}` placeholders (substituted by params) and a
 * single-form ICU plural construct
 * `{count, plural, one {# foo} other {# foos}}` for count-bearing strings.
 */
export type MessageCatalog = Readonly<Record<string, string>>;

/**
 * The shape of the translator the editor obtains by calling
 * `createTranslator(...)`.
 *
 * `Translator` is a CALLABLE object: `t("topbar.import")` performs a
 * lookup, while `t.locale`, `t.setLocale(...)`, and `t.subscribe(...)`
 * expose the imperative surface. Keeping `t` callable matches the i18n
 * convention that consumers see in their code: short, dense, JSX-friendly.
 */
export interface Translator {
  (key: string, params?: Readonly<Record<string, string | number>>): string;
  /** Active locale. */
  readonly locale: Locale;
  /**
   * Switch the active locale at runtime. Subscribers receive the new locale.
   * Throws if the new locale is not in the registered catalog map.
   */
  setLocale(locale: Locale): void;
  /** Subscribe to locale changes. Returns an unsubscribe function. */
  subscribe(listener: (locale: Locale) => void): () => void;
}
