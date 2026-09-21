# Internal Article-tag filtering

Design interview for [issue #98](https://github.com/dobrerares/student-org-site-builder/issues/98).
The complete design was confirmed by the user on 2026-09-17.
This document describes planned behavior, not implemented functionality.

## Existing decisions from issue #97

The [Article publishing design](issue-97-article-publishing.md) establishes
the Article-list block's “By tag” behavior: match any selected tag, include
all eligible Articles when no tags are selected, include only Published
articles in the containing Page or Article's language, and sort newest
publication date first. Arrow navigation makes all matches accessible.
Empty lists retain their heading and show “No articles yet”; becoming
empty triggers an author toast without blocking export.

Issue #97 also permits a separate explicit-selection mode, expanding
issue #98's original automatic-only premise.

## Confirmed tag-management decisions

- Tags belong to the whole Site and are shared across languages. List
  language filtering remains independent of tag selection.
- Authors can create tags while editing an Article or configuring a list.
  Both surfaces use a searchable picker offering existing tags first.
- A small management screen supports renaming and deleting tags.
- Renaming a tag updates its label everywhere while preserving Article
  associations and configured filters.
- Deleting a tag warns about tagged Articles and removes that tag from
  all of those Articles.
- Deletion also removes the tag from every list filter referencing it.
  The confirmation identifies affected lists and explicitly warns when
  removing the final selected tag will make a list show all eligible
  Articles. Remaining selected tags continue to use any-match behavior.
- Creation and renaming treat labels differing only in case or surrounding
  whitespace as duplicates. Display preserves the author's chosen
  capitalization.

## Review

All interview questions are resolved. The user confirmed the complete
design and requested publication of the resolution on 2026-09-17.
