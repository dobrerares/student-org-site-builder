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

  // Articles
  "articles.nav.pages": "Pages",
  "articles.nav.articles": "Articles",
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
  "articles.action.create": "Create article",
  "articles.action.manageTags": "Manage tags",
  "articles.action.edit": "Edit",
  "articles.action.delete": "Delete",
  "articles.action.addTranslation": "Add {lang} version",
  "articles.action.back": "Back to articles",
  "articles.create.title": "Create article",
  "articles.create.label": "Article title",
  "articles.create.placeholder": "What is this article about?",
  "articles.create.submit": "Create",
  "articles.create.cancel": "Cancel",
  "articles.empty": "No articles yet. Create your first one.",
  "articles.empty.filtered": "No articles match these filters.",
  "articles.count": "{count, plural, one {# article} other {# articles}}",
  "articles.delete.confirm": "Delete “{title}” permanently? Links to it will stop working.",
  "articles.settings.title": "Article settings",
  "articles.settings.titleField": "Title",
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
  "articles.settings.blocks": "Content",
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
