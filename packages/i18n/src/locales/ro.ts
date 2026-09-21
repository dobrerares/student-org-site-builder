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

  // Articles
  "articles.nav.pages": "Pagini",
  "articles.nav.articles": "Articole",
  "articles.panel.title": "Articole",
  "articles.search.label": "Caută articole",
  "articles.search.placeholder": "Caută după titlu sau rezumat",
  "articles.filter.language": "Limbă",
  "articles.filter.state": "Stare",
  "articles.filter.tag": "Etichetă",
  "articles.filter.all": "Toate",
  "articles.state.draft": "Ciornă",
  "articles.state.published": "Publicat",
  "articles.state.unlisted": "Nelistat",
  "articles.action.create": "Creează articol",
  "articles.action.manageTags": "Gestionează etichetele",
  "articles.action.edit": "Editează",
  "articles.action.delete": "Șterge",
  "articles.action.addTranslation": "Adaugă versiunea {lang}",
  "articles.action.back": "Înapoi la articole",
  "articles.create.title": "Creează articol",
  "articles.create.label": "Titlul articolului",
  "articles.create.placeholder": "Despre ce este articolul?",
  "articles.create.submit": "Creează",
  "articles.create.cancel": "Anulează",
  "articles.empty": "Niciun articol încă. Creează-l pe primul.",
  "articles.empty.filtered": "Niciun articol nu corespunde filtrelor.",
  "articles.count": "{count, plural, one {# articol} other {# articole}}",
  "articles.delete.confirm": "Ștergi definitiv „{title}”? Linkurile către el nu vor mai funcționa.",
  "articles.settings.title": "Setările articolului",
  "articles.settings.titleField": "Titlu",
  "articles.settings.summary": "Rezumat",
  "articles.settings.cover": "Imagine de copertă",
  "articles.settings.coverAlt": "Descrierea imaginii (pentru cititoare de ecran)",
  "articles.settings.date": "Data publicării",
  "articles.settings.slug": "Linkul articolului",
  "articles.settings.slug.hint":
    "Aceasta este adresa web a articolului. Dacă o schimbi, adresa veche continuă să funcționeze, așa că linkurile distribuite nu se strică.",
  "articles.settings.slug.error.invalid":
    "Folosește litere mici, cifre și cratime simple, de exemplu gala-de-final.",
  "articles.settings.slug.error.taken":
    "Alt articol în această limbă folosește deja acest link, acum sau în trecut.",
  "articles.settings.state": "Stare",
  "articles.settings.state.hint":
    "Ciornele rămân în proiect și nu ajung pe site. Articolele publicate apar peste tot. Articolele nelistate se pot deschide prin link, dar rămân în afara listelor și a motoarelor de căutare. Modificările ajung pe site doar după ce exporți site-ul și îl încarci din nou.",
  "articles.settings.tags": "Etichete",
  "articles.settings.tags.add": "Adaugă etichetă",
  "articles.settings.tags.placeholder": "Caută sau creează o etichetă",
  "articles.settings.language": "Limbă",
  "articles.settings.related": "Articole similare",
  "articles.settings.related.enable": "Arată articole similare la final",
  "articles.settings.related.hint":
    "Adaugă o listă de articole după acest articol. Dacă o dezactivezi, setările rămân salvate, dar lista nu mai apare pe site.",
  "articles.settings.blocks": "Conținut",
  "articles.tags.title": "Gestionează etichetele",
  "articles.tags.empty": "Nicio etichetă încă.",
  "articles.tags.create": "Creează etichetă",
  "articles.tags.newLabel": "Numele etichetei noi",
  "articles.tags.rename": "Redenumește",
  "articles.tags.delete": "Șterge",
  "articles.tags.save": "Salvează",
  "articles.tags.cancel": "Anulează",
  "articles.tags.error.duplicate": "Există deja o etichetă cu acest nume.",
  "articles.tags.error.empty": "Dă un nume etichetei.",
  "articles.tags.delete.confirm": "Ștergi eticheta „{label}”?",
  "articles.tags.delete.articles":
    "Va fi eliminată din {count, plural, one {# articol} other {# articole}}.",
  "articles.tags.delete.lists": "Va fi eliminată din aceste liste: {names}.",
  "articles.tags.delete.unfiltered":
    "Aceste liste nu mai au altă etichetă selectată și vor începe să arate toate articolele eligibile: {names}.",
  "articleList.mode": "Ce articole",
  "articleList.mode.byTag": "După etichetă",
  "articleList.mode.selected": "Alege articole",
  "articleList.mode.hint":
    "Varianta după etichetă se actualizează singură pe măsură ce publici. Varianta cu alegere fixează o listă exactă, în ordinea stabilită de tine.",
  "articleList.tags": "Etichete",
  "articleList.tags.hint":
    "Un articol se potrivește dacă are oricare dintre etichetele selectate. Fără nicio etichetă selectată, apar toate articolele publicate în această limbă, cele mai noi primele.",
  "articleList.tags.none": "Nicio etichetă selectată — se afișează toate",
  "articleList.selected.search": "Caută un articol",
  "articleList.selected.add": "Adaugă",
  "articleList.selected.remove": "Elimină",
  "articleList.selected.empty": "Niciun articol ales încă.",
  "articleList.selected.hint":
    "Poți alege articole în orice limbă, inclusiv nelistate. Ciornele nu fac parte din site, așa că alegerea uneia oprește exportul până o publici sau o scoți din listă.",
  "articleList.moveUp": "Mută mai sus",
  "articleList.moveDown": "Mută mai jos",
  "articleList.matches": "Articole care se potrivesc",
  "articleList.matches.empty":
    "Nimic nu se potrivește încă. Lista va afișa „Încă nu există articole.”",
  "articleList.sort": "Ordine",
  "articleList.sort.desc": "Cele mai noi primele",
  "articleList.sort.asc": "Cele mai vechi primele",
  "articleList.missing": "Acest articol nu mai este disponibil",
  "articleList.heading": "Titlu",
  "articleList.intro": "Text introductiv",

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
