/**
 * Locale toggle — the user's "always wins" override per PRD.
 *
 * Surfaced as a `<select>` in the editor's settings area. The host shell
 * decides whether this control is rendered inline (browser shell) or in a
 * native menu (Electron); the editor-app version is a small inline form
 * suitable for either.
 *
 * The control reads / writes the active locale via the `Translator` context.
 * Persistence (writing the chosen locale into the editor's VFS) is the
 * caller's responsibility — they can subscribe to `translator.subscribe(...)`
 * and call `saveLocale(...)` from `@sosb/i18n`. We deliberately do not bake
 * persistence into this component because the editor app does not own a VFS
 * directly (see ADR 0005); the host shell does.
 */
import type { JSX } from "preact";
import { SUPPORTED_LOCALES, type Locale } from "@sosb/i18n";

import { useTranslator } from "./i18n-context.js";

const LOCALE_LABEL_KEY: Readonly<
  Record<Locale, "settings.locale.option.ro" | "settings.locale.option.en">
> = {
  ro: "settings.locale.option.ro",
  en: "settings.locale.option.en",
};

export function LocaleToggle(): JSX.Element {
  const t = useTranslator();
  return (
    <fieldset data-testid="locale-toggle">
      <legend>{t("settings.locale.legend")}</legend>
      <label>
        <span>{t("settings.locale.label")}</span>
        <select
          data-testid="locale-select"
          value={t.locale}
          onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) => {
            const next = event.currentTarget.value;
            // The select's options are limited to SUPPORTED_LOCALES, but we
            // re-validate at the boundary because the DOM is not the source
            // of truth — a buggy stylesheet could in principle smuggle in a
            // bad value.
            if ((SUPPORTED_LOCALES as readonly string[]).includes(next)) {
              t.setLocale(next as Locale);
            }
          }}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {t(LOCALE_LABEL_KEY[locale])}
            </option>
          ))}
        </select>
      </label>
      <p data-testid="locale-help">{t("settings.locale.help")}</p>
    </fieldset>
  );
}
