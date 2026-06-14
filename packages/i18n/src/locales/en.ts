/**
 * English editor messages — primary source-of-quality for English UX.
 *
 * Style notes:
 *   - Use plain action labels for non-technical users ("Open site", "Download copy").
 *   - Sentence-case for descriptions and help text.
 *   - Avoid "click here" — link or button text should describe its action.
 */
import type { MessageCatalog } from "../types.js";
import type { EditorMessageKey } from "./keys.js";

type EnglishCatalog = Readonly<Record<EditorMessageKey, string>>;

export const en: EnglishCatalog = {
  // Top bar
  "topbar.import": "Open site",
  "topbar.export": "Download copy",
  "topbar.reset": "Start over",

  // Save status
  "saveStatus.localOnly": "Download a copy to keep this site",
  "saveStatus.saving": "Saving...",
  "saveStatus.saved": "Saved in this browser",
  "saveStatus.error": "Save failed. Download a copy now.",

  // Layout tabs
  "tabs.editor": "Editor",
  "tabs.preview": "Preview",

  // Pane labels
  "pane.editor.label": "Editor",
  "pane.preview.label": "Site preview",

  // Spine form helpers
  "form.array.empty": "(empty)",
  "form.array.itemCount": "{count, plural, one {# item} other {# items}}",
  "form.field.optional": "Optional",
  "form.field.unset": "(unset)",

  // Settings — locale
  "settings.locale.legend": "Editor language",
  "settings.locale.label": "Language",
  "settings.locale.option.ro": "Română",
  "settings.locale.option.en": "English",
  "settings.locale.help": "Changes take effect immediately. Your choice is saved with this site.",

  // Wizard step titles
  "wizard.step.basics.title": "Basics",
  "wizard.step.identity.title": "Identity",
  "wizard.step.sections.title": "Sections",
  "wizard.step.content.title": "Content",
  "wizard.step.languages.title": "Languages",
  "wizard.step.confirm.title": "Confirm",

  // Wizard actions
  "wizard.action.back": "Back",
  "wizard.action.next": "Next",
  "wizard.action.skip": "Skip for now",
  "wizard.action.finish": "Finish",

  // Welcome screen
  "welcome.title": "Build your organisation's website",
  "welcome.subtitle": "Make a clean site, keep your files, and download a copy when you are ready.",
  "welcome.action.wizard": "Start the guided wizard",
  "welcome.action.template": "Start from a template",
  "welcome.action.import": "Open a saved site",
  "welcome.action.blank": "Start from scratch",
  "welcome.recent.heading": "Recent sites",
  "welcome.recent.empty": "No recent sites yet.",
} as const;

// Re-exported as a plain catalog for the translator's consumption.
export const enCatalog: MessageCatalog = en;
