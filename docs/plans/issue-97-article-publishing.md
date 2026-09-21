# Article publishing, URLs, and placement

Design interview for [issue #97](https://github.com/dobrerares/student-org-site-builder/issues/97).
The complete design was confirmed by the user on 2026-09-17.
This document specifies planned behavior, not implemented functionality.

## Publication and export

- Articles have Draft, Published, and Unlisted states. New Articles start as Draft.
- Export uses current edits. There is no separate unpublished revision of a
  Published article; changes reach the live Site after redeployment.
- Draft content and files used only by Draft articles are excluded from the
  public export. The editable project archive retains both.
- Published articles are exported and eligible for automatic discovery.
- Unlisted articles are exported and explicitly linkable/selectable, but excluded
  from automatic lists, the sitemap, and automatic translation discovery. They
  include a `noindex` directive; they are not private or access-controlled.
- Draft articles have full editor previews, including configured related-Article lists.
- Broken selections inside Draft articles appear as editor issues but do not
  block public export. Unavailable targets in active explicit selections in
  public content block export without an override. As revised during issue #100's
  design interview, broken prose links instead warn and render as unlinked text,
  retaining their target references in the editable project for repair.

## Content and metadata

- Main content is an ordered collection of existing Blocks.
- The full Article automatically displays its title, publication date, and optional
  summary and cover image above those Blocks.
- Cards show a required title and publication date, plus an optional author-written
  summary and cover image. Placements reflect current Article fields, not copies.
- Publication date starts as today, is author-editable, and does not change when
  publication state changes. Dates describe and sort; they do not schedule releases.
- Search and sharing metadata default to title, summary, and cover image.
  Optional title and description overrides live under “More options.”

## Article-list blocks

One Article-list block has two modes: automatic selection by tag and explicit
selection. This deliberately expands the original issue's automatic-only scope.

### By tag

- Include only Published articles in the containing Page or Article's language.
  There is no language fallback.
- Match any selected tag. With no tags selected, include all eligible Articles.
- Sort newest publication date first.
- When the list becomes empty, show the author a toast; export remains allowed.
  A reduction that leaves matches does not trigger that toast.
- Public empty output retains the heading and shows “No articles yet.”

### Select articles

- Authors select and order Articles explicitly, including Unlisted articles.
- Cross-language selection is allowed; the picker and card show the Article's language.
- If a selected Article becomes Draft or is deleted, block export from public
  content until the selection is repaired or removed.

### Display

- Linked cards use arrow navigation between groups, with group size determined
  responsively by the layout. All eligible matches or explicit selections remain
  accessible through that navigation.
- There is no separate limited mode or “View more” action.

## Related Articles

- Each Article has a related-Article list setting, disabled by default.
- Enabling it reveals one configurable Article-list block at the end of the Article,
  rather than allowing such lists anywhere in its main content.
- Disabling it retains settings but omits the list from public output and
  export-blocking reference checks.
- “By tag” excludes the containing Article itself. Explicit self-selection is allowed.

## Languages

- Translations are separate linked Articles with independent publication states.
- Article language switching offers only Published translations. Draft and Unlisted
  counterparts are omitted; Unlisted articles can still be linked explicitly.
- Languages without a Published counterpart are omitted from both the Article
  language switcher and search-engine translation links, with no language-home fallback.

## URLs

- Selections and translation relationships reference permanent Article identity,
  not URLs. Slug changes update their links; recreating a deleted Article at the
  same URL does not restore references to the deleted Article.
- Default-language Articles use `/articles/<slug>/`; secondary languages use
  `/<lang>/articles/<slug>/`, following the language-prefix convention of ADR 0015.
- The `articles` route prefix is reserved for Articles.
- A slug conflicting with another Article's current slug or reserved historical
  slug in the same language is rejected with an explanation. Slugs can be reused
  across languages.
- There is no automatic index at `/articles/`. Authors create listing Pages with
  Article-list blocks.
- Generate a slug from the initial title, then keep it stable across title changes.
  Authors may deliberately edit the slug.
- Slug changes preserve historical URLs as redirects. Historical URLs remain
  reserved while the Article exists, including while it is Draft. Redirects are
  exported only when the destination is Published or Unlisted.
- Permanent deletion releases both current and historical URLs for reuse. A reused
  URL can therefore make an old shared link point to unrelated content.

## Existing architecture to account for

- ADR 0007 defers Page redirects; Article redirect history extends routing without
  deciding Page redirect behavior.
- ADR 0015 uses language-home fallbacks for Pages. Article translation discovery
  requires its own publication-aware behavior.
- Page `showInNav` controls menus, not export eligibility. It cannot substitute
  for Article publication state.
- Current export copies all assets into the public output; Draft-only asset
  exclusion requires changing that behavior while retaining full editable archives.

## Review

The user confirmed the complete design on 2026-09-17. The lasting architectural
choices are recorded in [accepted ADR 0047](../adr/0047-article-publication-and-url-identity.md).
