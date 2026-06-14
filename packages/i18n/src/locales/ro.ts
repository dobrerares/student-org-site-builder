/**
 * Romanian editor messages.
 *
 * STATUS: AI-drafted; native Romanian speaker review pending.
 *
 * The agent that produced these strings consulted the PRD's voice
 * (formal/standard Romanian, proper diacritics — ă, â, î, ș, ț) and aimed
 * for the register a serious student organisation would use in their own
 * communications. Several keys are flagged below where the choice between
 * two acceptable Romanian words depends on house style; native review is
 * recommended before public release.
 *
 * Translator notes for the reviewer:
 *   - Top-bar actions use plain user outcomes rather than file-format
 *     terminology: "Deschide site", "Descarcă o copie".
 *   - "Previzualizare" for "Preview" is the standard tech translation.
 *   - "Vrăjitor" is the common RO localisation of "Wizard"; some apps use
 *     "Asistent" instead. We picked "Vrăjitor" for consistency with major
 *     OS-level localisations (Windows, macOS).
 *   - The wizard step titles deliberately stay short to match the EN side.
 */
import type { MessageCatalog } from "../types.js";
import type { EditorMessageKey } from "./keys.js";

type RomanianCatalog = Readonly<Record<EditorMessageKey, string>>;

export const ro: RomanianCatalog = {
  // Top bar
  "topbar.import": "Deschide site",
  "topbar.export": "Descarcă o copie",
  "topbar.reset": "Începe de la capăt",

  // Save status
  "saveStatus.localOnly": "Descarcă o copie ca să păstrezi site-ul",
  "saveStatus.saving": "Se salvează...",
  "saveStatus.saved": "Salvat în acest browser",
  "saveStatus.error": "Salvarea a eșuat. Descarcă acum o copie.",

  // Layout tabs
  "tabs.editor": "Editor",
  "tabs.preview": "Previzualizare",

  // Pane labels
  "pane.editor.label": "Editor",
  "pane.preview.label": "Previzualizarea site-ului",

  // Spine form helpers
  "form.array.empty": "(gol)",
  "form.array.itemCount": "{count, plural, one {# element} other {# elemente}}",
  "form.field.optional": "Opțional",
  "form.field.unset": "(neselectat)",

  // Settings — locale
  "settings.locale.legend": "Limba editorului",
  "settings.locale.label": "Limbă",
  "settings.locale.option.ro": "Română",
  "settings.locale.option.en": "English",
  "settings.locale.help": "Modificările se aplică imediat. Alegerea este salvată odată cu site-ul.",

  // Wizard step titles
  "wizard.step.basics.title": "Date de bază",
  "wizard.step.identity.title": "Identitate",
  "wizard.step.sections.title": "Secțiuni",
  "wizard.step.content.title": "Conținut",
  "wizard.step.languages.title": "Limbi",
  "wizard.step.confirm.title": "Confirmare",

  // Wizard actions
  "wizard.action.back": "Înapoi",
  "wizard.action.next": "Înainte",
  "wizard.action.skip": "Sari peste",
  "wizard.action.finish": "Finalizează",

  // Welcome screen
  "welcome.title": "Construiește site-ul organizației tale",
  "welcome.subtitle": "Creează un site curat, păstrează fișierele și descarcă o copie când e gata.",
  "welcome.action.wizard": "Pornește vrăjitorul",
  "welcome.action.template": "Pornește de la un șablon",
  "welcome.action.import": "Deschide un site salvat",
  "welcome.action.blank": "Începe de la zero",
  "welcome.recent.heading": "Site-uri recente",
  "welcome.recent.empty": "Niciun site recent.",
} as const;

// Re-exported as a plain catalog for the translator's consumption.
export const roCatalog: MessageCatalog = ro;
