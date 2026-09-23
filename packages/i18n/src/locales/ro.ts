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
  "articles.untitled": "Articol fără titlu",
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
  "articles.settings.language.hint":
    "Fiecare limbă este un articol separat, cu propriul statut de publicare. Vizitatorii văd doar versiunile pe care le-ai publicat.",
  "articles.settings.seo": "Căutare și distribuire",
  "articles.settings.seo.hint":
    "Motoarele de căutare și rețelele sociale arată în mod normal titlul și rezumatul articolului. Completează aceste câmpuri doar dacă vrei să apară altceva.",
  "articles.settings.seo.title": "Titlu pentru rezultatele căutării",
  "articles.settings.seo.description": "Descriere pentru rezultatele căutării",
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
  // Builder shell — persistent navigation and top-bar actions
  "builder.nav.label": "Principal",
  "builder.nav.group.site": "Site",
  "builder.nav.group.create": "Creează",
  "builder.nav.overview": "Prezentare generală",
  "builder.nav.pages": "Pagini",
  "builder.nav.articles": "Articole",
  "builder.nav.theme": "Temă",
  "builder.nav.settings": "Setările site-ului",
  "builder.nav.open": "Deschide meniul principal",
  "builder.nav.close": "Închide meniul",
  "builder.nav.contentLanguage": "Limba conținutului",
  "builder.action.createPage": "Creează pagină",
  "builder.action.createArticle": "Creează articol",
  "builder.action.save": "Salvează proiectul",
  "builder.action.export": "Exportă site-ul",
  "builder.action.export.count": "Exportă site-ul ({count})",
  "builder.save.unsaved": "Modificări nesalvate",
  "builder.save.never": "Încă nesalvat",
  "builder.save.downloaded": "Copie descărcată: {when}",
  "builder.save.downloaded.never": "niciodată",
  "builder.save.info.label": "Despre salvare și export",
  "builder.save.info":
    "Salvează proiectul păstrează lucrul tău în acest browser, inclusiv ciornele, ca să poți continua mai târziu. Exportă site-ul descarcă site-ul public pe calculatorul tău; apoi îl încarci la găzduire ca vizitatorii să îl vadă.",

  // Builder shell — chrome, tip, and screen explanations (#102 completion)
  "builder.brand": "Site Builder",
  "builder.tip.title": "Cum funcționează",
  "builder.tip.body":
    "Alege o pagină sau un articol, apoi un bloc, ca să îi schimbi textul și imaginile. Previzualizarea de alături se actualizează pe măsură ce scrii. Când ești mulțumit, folosește {action} ca să primești site-ul ca un folder gata de publicat.",
  "builder.tip.dismiss": "Ascunde acest sfat",
  "builder.history": "Istoric",
  "builder.undo": "Anulează (Ctrl+Z)",
  "builder.redo": "Refă (Ctrl+Shift+Z)",
  "builder.import.title": "Deschide un proiect descărcat mai devreme",
  "builder.reset.title": "Înapoi la ecranul de start",
  "builder.reset.confirm":
    "Te întorci la ecranul de start? Lucrul tău rămâne salvat în acest browser și îl poți continua mai târziu.",
  "builder.export.failed": "Site-ul nu a putut fi exportat. {reason}",
  "builder.import.failed": "Fișierul nu a putut fi deschis ca proiect.",
  "builder.inspector.unknownType":
    "Acest bloc ({type}) nu are editor aici. Este păstrat exact așa cum este și se exportă în continuare.",
  "articles.info":
    "Articolele sunt texte cu dată: știri, relatări de la evenimente, anunțuri. Un articol nou începe ca ciornă, pe care o vezi doar tu. Nimic nu ajunge la vizitatori până nu îl publici, exporți site-ul și îl încarci din nou.",
  "theme.info":
    "Aspectul întregului site: culori, fonturi și așezare în pagină. Schimbarea aspectului nu îți modifică niciodată textele sau imaginile, iar previzualizarea de alături arată pagina pe care ai editat-o ultima dată.",
  "settings.info":
    "Detalii valabile pentru tot site-ul: numele organizației și datele de contact, limbile și cum se numește fiecare pagină în meniu.",

  // Content overview
  "overview.title": "Prezentare generală",
  "overview.theme": "Temă: {theme}",
  "overview.pages.title": "Pagini",
  "overview.pages.info":
    "Părțile fixe ale site-ului: acasă, despre, înscriere și orice pagină de listare pe care o construiești. Articolele sunt texte cu dată și au destinația lor separată.",
  "overview.pages.all": "Toate paginile",
  "overview.pages.blocks": "{count, plural, one {# bloc} other {# blocuri}}",
  "overview.pages.empty": "Nicio pagină încă.",
  "overview.articles.title": "Articole",
  "overview.articles.all": "Toate articolele",
  "overview.articles.empty": "Niciun articol încă.",
  "overview.health.title": "Starea site-ului",
  "overview.health.info":
    "Tot ce a observat aplicația despre acest proiect. Problemele marcate ca blocante trebuie rezolvate înainte de a putea exporta site-ul; avertismentele sunt sfaturi pe care le poți urma când vrei. Salvarea proiectului funcționează întotdeauna.",
  "overview.health.allGood": "Totul e în regulă",
  "overview.health.summary": "{errors} de rezolvat · {warnings} de verificat",
  "overview.health.empty": "Nimic nu îți cere atenția.",
  "overview.finding.fix": "Rezolvă",
  "overview.finding.info.label": "Despre această problemă",
  "overview.finding.blocks": "Blochează exportul site-ului.",
  "overview.finding.noBlock": "Nu blochează exportul.",

  // Pages destination
  "pages.title": "Pagini",
  "pages.info":
    "Fiecare pagină devine o intrare în meniul site-ului, dacă nu o ascunzi. Alege una ca să îi editezi secțiunile.",
  "pages.search.label": "Caută pagini",
  "pages.search.placeholder": "Caută pagini după nume",
  "pages.empty.filtered": "Nimic nu se potrivește cu această căutare. Încearcă una mai scurtă.",
  "pages.meta.inMenu": "în meniu",
  "pages.meta.hidden": "ascunsă din meniu",

  // Editing workspace
  "workspace.back.pages": "Toate paginile",
  "workspace.back.articles": "Toate articolele",
  "workspace.back.content": "Înapoi la „{title}”",
  "workspace.title.page": "Titlul paginii",
  "workspace.title.article": "Titlul articolului",
  "workspace.settings.page": "Setările paginii",
  "workspace.settings.article": "Setările articolului",
  "workspace.settings.page.hint": "Eticheta din meniu, adresa web, previzualizarea în căutări",
  "workspace.settings.article.hint":
    "Rezumat, imagine de copertă, data publicării, etichete, adresă web",
  "workspace.blocks": "Blocuri",
  "workspace.blocks.info":
    "Blocurile sunt piesele din care e făcut acest conținut, în ordinea în care apar. Alege unul ca să îl editezi. Trage de mâner sau folosește Mută mai sus și Mută mai jos ca să le reordonezi.",
  "workspace.tabs.label": "Arată editarea sau previzualizarea",
  "workspace.tab.edit": "Editare",
  "workspace.tab.preview": "Previzualizare",
  "workspace.missing": "Acest conținut nu mai există.",

  // Preview pane
  "preview.title": "Previzualizare",
  "preview.info":
    "Linkurile și cardurile de aici se comportă ca pe site-ul real, așa că poți naviga la fel ca un vizitator. Folosește Editează această pagină sau Editează acest articol ca să deschizi ce vezi.",
  "preview.edit.page": "Editează această pagină",
  "preview.edit.article": "Editează acest articol",
  "preview.back.page": "Înapoi la această pagină",
  "preview.back.article": "Înapoi la acest articol",
  "preview.viewport.label": "Dimensiunea previzualizării",
  "preview.viewport.fit": "Potrivit",
  "preview.viewport.desktop": "Desktop",
  "preview.viewport.tablet": "Tabletă",
  "preview.viewport.phone": "Telefon",

  // Export readiness panel
  "export.title": "Exportă site-ul",
  "export.info.label": "Despre export",
  "export.info":
    "Exportul construiește site-ul public ca folder și îl descarcă pe acest calculator. Nu actualizează site-ul pe care îl văd vizitatorii — tot trebuie să încarci folderul exportat la găzduirea ta. Ciornele nu fac niciodată parte din export, iar salvarea proiectului rămâne disponibilă chiar și când există probleme listate aici.",
  "export.blockers": "Rezolvă mai întâi acestea ({count})",
  "export.warnings": "De verificat ({count})",
  "export.warnings.info": "Acestea nu opresc exportul. Rezolvă-le când ai timp.",
  "export.ready": "Gata de export.",
  "export.ready.detail": "Ciornele rămân pe loc; restul va fi scris în export.",
  "export.action": "Exportă site-ul",
  "export.cancel": "Anulează",
  "export.override.label": "Ca să exporți oricum, scrie {phrase} mai jos:",
  "export.override.hint": "Cel mai bine e să le rezolvi întâi, dar poți exporta oricum o copie.",
  "export.blocked.note":
    "Acestea trebuie rezolvate înainte ca site-ul să poată fi construit. Proiectul tău rămâne salvat — doar exportul site-ului este afectat.",

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
