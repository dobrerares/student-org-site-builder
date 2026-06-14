/**
 * The canonical set of editor message keys.
 *
 * Keys are dot-namespaced by surface:
 *
 *   - `topbar.*`            top-bar action buttons in the editor shell
 *   - `tabs.*`              the narrow-layout tab labels (Editor / Preview)
 *   - `pane.*`              ARIA labels and headings on the two panes
 *   - `form.array.*`        the spine form's array placeholders
 *   - `settings.locale.*`   locale toggle UI in the editor's settings panel
 *   - `wizard.step.*.title` per-step wizard headings (#33's surface; we
 *                           extract the contract here so #33's PR slots in
 *                           without re-shaping this file)
 *   - `wizard.action.*`     wizard nav controls (back / next / skip / finish)
 *   - `welcome.*`           welcome-screen entry points (#32; same logic —
 *                           the contract is here even though the UI lands in
 *                           a follow-up issue)
 *
 * The list is kept short on purpose: only strings that exist (or are about
 * to exist in #32 / #33) are extracted. As more editor UI lands, new keys
 * are added in catalog files in lockstep, with the parity test failing CI
 * if either locale falls behind.
 */

export type EditorMessageKey =
  // Top bar
  | "topbar.import"
  | "topbar.export"
  | "topbar.reset"
  // Save status
  | "saveStatus.localOnly"
  | "saveStatus.saving"
  | "saveStatus.saved"
  | "saveStatus.error"
  // Layout tabs
  | "tabs.editor"
  | "tabs.preview"
  // Pane labels
  | "pane.editor.label"
  | "pane.preview.label"
  // Spine form helpers
  | "form.array.empty"
  | "form.array.itemCount"
  | "form.field.optional"
  | "form.field.unset"
  // Settings — locale
  | "settings.locale.legend"
  | "settings.locale.label"
  | "settings.locale.option.ro"
  | "settings.locale.option.en"
  | "settings.locale.help"
  // Wizard step titles
  | "wizard.step.basics.title"
  | "wizard.step.identity.title"
  | "wizard.step.sections.title"
  | "wizard.step.content.title"
  | "wizard.step.languages.title"
  | "wizard.step.confirm.title"
  // Wizard actions
  | "wizard.action.back"
  | "wizard.action.next"
  | "wizard.action.skip"
  | "wizard.action.finish"
  // Welcome screen
  | "welcome.title"
  | "welcome.subtitle"
  | "welcome.action.wizard"
  | "welcome.action.template"
  | "welcome.action.import"
  | "welcome.action.blank"
  | "welcome.recent.heading"
  | "welcome.recent.empty";
