---
status: accepted
---

# Article publication boundaries and stable URL identity

For [issue #97](https://github.com/dobrerares/student-org-site-builder/issues/97),
Articles have permanent identities independent of their public URLs, three
publication states, and separate linked translations. These boundaries preserve
references across renames and keep unfinished content out of deployable output
without requiring separate published revisions.

## Publication boundary

Draft articles and Draft-only files remain in the editable archive but are omitted
from public export. Published and Unlisted articles export current content;
Unlisted articles permit explicit links and selections but carry `noindex` and
are excluded from automatic discovery, including sitemaps and translation links.
Publication dates do not schedule releases. Changes take effect after redeployment.

This deliberately separates editorial state from Page `showInNav`, which only
controls navigation, and requires public asset export to stop copying Draft-only files.

## Identity and routing

Article selections and translation relationships use permanent identity rather
than a mutable URL. URLs use `/articles/<slug>/` in the default language and
`/<lang>/articles/<slug>/` otherwise. There is no generated index at the prefix.
Title edits preserve the slug. Explicit slug changes retain historical URLs as
redirects to the current public Article; those URLs remain reserved while the
Article exists, even as a Draft. Conflicting slugs within a language are rejected.
Permanent deletion releases all of the Article's URLs, but replacement content
does not inherit references to the deleted identity.

This extends ADR 0007's deferred redirect scope for Articles only and retains
ADR 0015's language-prefix convention. Deletion deliberately favors URL reuse
over preserving the meaning of every previously shared link.

## Translation boundary

Each translation is a separate Article with its own publication state. Automatic
translation links include only Published counterparts, with no language-home
fallback. This differs deliberately from the Page fallback in ADR 0015: a homepage
is not an Article translation, and automatic links must not expose Unlisted content.

The full authoring and placement contract is in the
[design document](../plans/issue-97-article-publishing.md).
