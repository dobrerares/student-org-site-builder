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
  "topbar.reset": "Start over",

  // Save status
  "saveStatus.localOnly": "Download a copy to keep this site",
  "saveStatus.saving": "Saving...",
  "saveStatus.saved": "Saved in this browser",
  "saveStatus.error": "Save failed. Download a copy now.",

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

  // Articles
  "articles.panel.title": "Articles",
  "articles.search.label": "Search articles",
  "articles.search.placeholder": "Search by title or summary",
  "articles.filter.language": "Language",
  "articles.filter.state": "Status",
  "articles.filter.tag": "Tag",
  "articles.filter.all": "All",
  "articles.state.draft": "Draft",
  "articles.state.published": "Published",
  "articles.state.unlisted": "Unlisted",
  "articles.action.manageTags": "Manage tags",
  "articles.action.edit": "Edit",
  "articles.action.delete": "Delete",
  "articles.action.addTranslation": "Add {lang} version",
  "articles.create.cancel": "Cancel",
  "articles.empty": "No articles yet. Create your first one.",
  "articles.untitled": "Untitled article",
  "articles.empty.filtered": "No articles match these filters.",
  "articles.count": "{count, plural, one {# article} other {# articles}}",
  "articles.delete.confirm": "Delete “{title}” permanently? Links to it will stop working.",
  "articles.settings.summary": "Summary",
  "articles.settings.cover": "Cover image",
  "articles.settings.coverAlt": "Image description (for screen readers)",
  "articles.settings.date": "Publication date",
  "articles.settings.slug": "Article link",
  "articles.settings.slug.hint":
    "This is the web address of the article. Changing it keeps the old address working, so shared links do not break.",
  "articles.settings.slug.error.invalid":
    "Use lowercase letters, digits, and single hyphens, such as gala-de-final.",
  "articles.settings.slug.error.taken":
    "Another article in this language already uses that link, now or in the past.",
  "articles.settings.state": "Status",
  "articles.settings.state.hint":
    "Draft articles stay in your project and are left out of the website. Published articles appear everywhere. Unlisted articles are reachable by their link but stay out of lists and search engines. Changes go live only after you export the website and upload it again.",
  "articles.settings.tags": "Tags",
  "articles.settings.tags.add": "Add tag",
  "articles.settings.tags.placeholder": "Find or create a tag",
  "articles.settings.language": "Language",
  "articles.settings.language.hint":
    "Each language is a separate article with its own publication status. Visitors are only offered the versions you have published.",
  "articles.settings.seo": "Search and sharing",
  "articles.settings.seo.hint":
    "Search engines and social networks normally show the article's own title and summary. Fill these in only when you want them to show something different.",
  "articles.settings.seo.title": "Title for search results",
  "articles.settings.seo.description": "Description for search results",
  "articles.settings.related": "Related articles",
  "articles.settings.related.enable": "Show related articles at the end",
  "articles.settings.related.hint":
    "Adds one article list after this article. Turning it off keeps your settings but hides the list from the website.",
  "articles.tags.title": "Manage tags",
  "articles.tags.empty": "No tags yet.",
  "articles.tags.create": "Create tag",
  "articles.tags.newLabel": "New tag name",
  "articles.tags.rename": "Rename",
  "articles.tags.delete": "Delete",
  "articles.tags.save": "Save",
  "articles.tags.cancel": "Cancel",
  "articles.tags.error.duplicate": "A tag with that name already exists.",
  "articles.tags.error.empty": "Give the tag a name.",
  "articles.tags.delete.confirm": "Delete the tag “{label}”?",
  "articles.tags.delete.articles":
    "It will be removed from {count, plural, one {# article} other {# articles}}.",
  "articles.tags.delete.lists": "It will be removed from these lists: {names}.",
  "articles.tags.delete.unfiltered":
    "These lists have no other tag selected and will start showing every eligible article: {names}.",
  "articleList.mode": "Which articles",
  "articleList.mode.byTag": "By tag",
  "articleList.mode.selected": "Select articles",
  "articleList.mode.hint":
    "By tag keeps itself up to date as you publish. Select articles pins an exact list in the order you choose.",
  "articleList.tags": "Tags",
  "articleList.tags.hint":
    "An article matches when it has any of the selected tags. With no tags selected, every published article in this language is shown, newest first.",
  "articleList.tags.none": "No tags selected — showing all",
  "articleList.selected.search": "Find an article",
  "articleList.selected.add": "Add",
  "articleList.selected.remove": "Remove",
  "articleList.selected.empty": "No articles selected yet.",
  "articleList.selected.hint":
    "You can pick articles in any language, including unlisted ones. Draft articles are not part of the website, so selecting one stops the export until you publish it or remove it.",
  "articleList.moveUp": "Move up",
  "articleList.moveDown": "Move down",
  "articleList.matches": "Matching articles",
  "articleList.matches.empty": "Nothing matches yet. The list will show “No articles yet.”",
  "articleList.sort": "Order",
  "articleList.sort.desc": "Newest first",
  "articleList.sort.asc": "Oldest first",
  "articleList.missing": "This article is no longer available",
  "articleList.heading": "Heading",
  "articleList.intro": "Intro text",

  // Wizard step titles
  // Builder shell — persistent navigation and top-bar actions
  "builder.nav.label": "Main",
  "builder.nav.group.site": "Site",
  "builder.nav.group.project": "Project",
  "builder.nav.group.create": "Create",
  "builder.nav.overview": "Overview",
  "builder.nav.pages": "Pages",
  "builder.nav.articles": "Articles",
  "builder.nav.theme": "Theme",
  "builder.nav.settings": "Site settings",
  "builder.nav.open": "Open the main menu",
  "builder.nav.close": "Close menu",
  "builder.nav.contentLanguage": "Content language",
  "builder.action.createPage": "Create Page",
  "builder.action.createArticle": "Create Article",
  "builder.action.save": "Save project",
  "builder.action.export": "Export website",
  "builder.action.export.count": "Export website ({count})",
  "builder.save.never": "Not saved yet",
  "builder.save.downloaded": "Downloaded copy: {when}",
  "builder.save.downloaded.never": "never",
  "builder.save.info.label": "About saving and exporting",
  "builder.save.info":
    "Save project keeps your work in this browser, Drafts included, so you can carry on later. Export website downloads the public website to your computer; you then upload it to your hosting for visitors to see it.",

  // Builder shell — chrome, tip, and screen explanations (#102 completion)
  "builder.brand": "Site Builder",
  "builder.tip.title": "How this works",
  "builder.tip.body":
    "Pick a page or article, then choose a block to change its text and images. The preview beside it updates as you type. When you are happy, use {action} to get your website as a folder ready to publish.",
  "builder.tip.dismiss": "Hide this tip",
  "builder.history": "History",
  "builder.undo": "Undo (Ctrl+Z)",
  "builder.redo": "Redo (Ctrl+Shift+Z)",
  "builder.import.title": "Open a project you downloaded earlier",
  "builder.reset.title": "Go back to the start screen",
  "builder.reset.confirm":
    "Go back to the start screen? Your work stays saved in this browser and you can continue it later.",
  "builder.export.failed": "Your website could not be exported. {reason}",
  "builder.import.failed": "That file could not be opened as a project.",
  "builder.inspector.unknownType":
    "This block ({type}) has no editor here. It is kept exactly as it is and still exports.",
  "articles.info":
    "Articles are dated pieces of writing: news, event reports, announcements. A new article starts as a Draft that only you can see. Nothing reaches your visitors until you publish it, export the website and upload it again.",
  "theme.info":
    "The look of the whole website: colours, fonts and layout. Switching the look never changes your text or images, and the preview beside it shows the page you were last editing.",
  "settings.info":
    "Details that apply to the whole website: organisation name and contact details, languages, and what each page is called in the menu.",

  // Content overview
  "overview.title": "Overview",
  "overview.theme": "Theme: {theme}",
  "overview.pages.title": "Pages",
  "overview.pages.info":
    "The fixed parts of your website: home, about, join, and any listing page you build. Articles are dated pieces of writing and live in their own destination.",
  "overview.pages.all": "All pages",
  "overview.pages.blocks": "{count, plural, one {# block} other {# blocks}}",
  "overview.pages.empty": "No pages yet.",
  "overview.articles.title": "Articles",
  "overview.articles.all": "All articles",
  "overview.articles.empty": "No articles yet.",
  "overview.health.title": "Site Health",
  "overview.health.info":
    "Everything the builder has noticed about this project. Problems marked as blocking must be fixed before you can export the website; warnings are advice you can act on whenever you like. Saving your project always works.",
  "overview.health.allGood": "All good",
  "overview.health.summary": "{errors} to fix · {warnings} to look at",
  "overview.health.empty": "Nothing needs your attention.",
  "overview.finding.fix": "Fix",
  "overview.finding.info.label": "About this problem",
  "overview.finding.blocks": "Blocks exporting the website.",
  "overview.finding.noBlock": "Does not block exporting.",

  // Pages destination
  "pages.title": "Pages",
  "pages.info":
    "Every page becomes an entry in your site menu unless you hide it. Choose one to edit its sections.",
  "pages.search.label": "Search pages",
  "pages.search.placeholder": "Search pages by name",
  "pages.empty.filtered": "Nothing matches that search. Try a shorter one.",
  "pages.meta.hidden": "hidden from the menu",

  // Pages list rows and the Block outline rows
  "blocks.hint.page": "Blocks on “{title}”, top to bottom. Choose one to edit it.",
  "blocks.hint": "Choose a block to edit it.",
  "blocks.add": "Add block",
  "blocks.empty.title": "Nothing here yet.",
  "blocks.empty.body": "Add a block to start building it — a page header is a good first pick.",
  "blocks.empty.add": "Add your first block",
  "blocks.row.drag": "Drag to reorder {label}",
  "blocks.row.drag.title": "Drag to reorder",
  "blocks.row.edit": "Edit {label}",
  "blocks.row.edit.title": "Edit this block",
  "blocks.row.actions": "Actions for {label}",
  "blocks.row.moveUp": "Move {label} up",
  "blocks.row.moveUp.title": "Move up",
  "blocks.row.moveDown": "Move {label} down",
  "blocks.row.moveDown.title": "Move down",
  "blocks.row.remove": "Remove {label}",
  "blocks.row.remove.title": "Remove block (you can undo)",
  "pages.row.open": "Open this page",
  "pages.row.open.current": "The page you were editing last",
  "pages.row.actions": "Actions for {label}",
  "pages.row.moveUp": "Move {label} up",
  "pages.row.moveUp.title": "Move up in the menu",
  "pages.row.moveDown": "Move {label} down",
  "pages.row.moveDown.title": "Move down in the menu",
  "pages.row.duplicate": "Duplicate {label}",
  "pages.row.duplicate.title": "Duplicate this page",
  "pages.row.delete": "Delete {label}",
  "pages.row.delete.title": "Delete this page",
  "pages.row.delete.confirm": "Confirm delete {label}",
  "pages.row.delete.confirm.title": "Click again to delete this page",
  "pages.row.delete.confirm.label": "Confirm delete",
  "pages.row.delete.last": "A site needs at least one page",
  "pages.row.missing": "Missing: {languages}",
  "pages.row.addVersion": "Add {language} version",
  "pages.row.addVersion.label": "Add {language} version of {title}",
  "pages.group.label": "Pages in {language}",
  "pages.add.legend": "Add a page",
  "pages.add.placeholder": "e.g. Events, About us, Contact",
  "pages.add.submit": "Create page",
  "pages.add.help.link": "Link will be /{slug}",
  "pages.add.help": "You can rename it or change its link later in Page settings.",
  "pages.add.error.taken": "A page with the link “{slug}” already exists in {lang}.",

  // Editing workspace
  "workspace.back.pages": "All pages",
  "workspace.back.articles": "All articles",
  "workspace.back.content": "Back to “{title}”",
  "workspace.title.page": "Page title",
  "workspace.title.article": "Article title",
  "workspace.settings.page": "Page settings",
  "workspace.settings.article": "Article settings",
  "workspace.settings.page.hint": "Menu label, web address, search preview",
  "workspace.settings.article.hint": "Summary, cover image, publication date, tags, web address",
  "workspace.blocks": "Blocks",
  "workspace.blocks.info":
    "Blocks are the pieces this content is made of, in the order they appear. Choose one to edit it. Drag the handle, or use Move up and Move down, to reorder them.",
  "workspace.tabs.label": "Show editing or preview",
  "workspace.tab.edit": "Edit",
  "workspace.tab.preview": "Preview",
  "workspace.missing": "This content no longer exists.",

  // Preview pane
  "preview.title": "Preview",
  "preview.info":
    "Links and cards here behave like the real website, so you can click through it the way a visitor would. Use Edit this Page or Edit this Article to open whatever you are looking at.",
  "preview.edit.page": "Edit this Page",
  "preview.edit.article": "Edit this Article",
  "preview.back.page": "Back to this page",
  "preview.back.article": "Back to this article",
  "preview.viewport.label": "Preview viewport size",
  "preview.viewport.fit": "Fit",
  "preview.viewport.desktop": "Desktop",
  "preview.viewport.tablet": "Tablet",
  "preview.viewport.phone": "Phone",

  // Export readiness panel
  "export.title": "Export website",
  "export.info.label": "About exporting",
  "export.info":
    "Exporting builds the public website as a folder and downloads it to this computer. It does not update the website your visitors see — you still have to upload the exported folder to your hosting. Drafts are never part of the export, and saving your project stays available even while there are problems listed here.",
  "export.blockers": "Fix these first ({count})",
  "export.warnings": "Worth a look ({count})",
  "export.warnings.info": "These do not stop the export. Fix them when you have time.",
  "export.ready": "Ready to export.",
  "export.ready.detail": "Drafts stay behind; everything else will be written out.",
  "export.action": "Export website",
  "export.cancel": "Cancel",
  "export.override.label": "To export anyway, type {phrase} below:",
  "export.override.hint": "Fixing these first is best, but you can still export a copy.",
  "export.blocked.note":
    "These must be fixed before the website can be built. Your project is still saved — only the website export is affected.",
  "export.omitted": "Left out of the website ({count})",
  "export.omitted.info":
    "These blocks will not appear on the exported website, because this Theme has no design for them. Your content is kept; switching Theme shows them again.",
  "export.omitted.page": "Page “{title}”: the {type} block has no design in this Theme.",
  "export.omitted.article": "Article “{title}”: the {type} block has no design in this Theme.",
  "export.omitted.ack": "I understand these blocks will not appear on the exported website.",

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
