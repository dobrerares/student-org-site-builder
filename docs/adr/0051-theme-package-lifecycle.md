# 0051 — Theme package import, reuse, update and removal

- **Status:** Accepted
- **Date:** 2026-09-21
- **Issue:** [#108](https://github.com/dobrerares/student-org-site-builder/issues/108)

## Context

[ADR 0050](0050-theme-package-format.md) defines what a Theme package _is_.
Issue #108 asks what _happens_ to one: storage scope across Sites, identity
collisions, version coexistence or replacement, how design choices survive a
Theme switch, and what becomes of a Site whose Theme disappears — including
the whole-Site zip round trip and another organisation reopening the result
offline.

The governing constraint comes from the
[issue-106 plan](../plans/issue-106-custom-block-contract.md): "every editable
Site archive must include its required extensions. A recipient must be able to
open the archive offline without finding and installing those packages
separately." A missing package is therefore a _damaged archive_, not the
normal hand-off.

The users here are student volunteers who hand projects to next year's
committee. The expensive failures are silent ones.

## Decision

### Storage is per Site

An imported Theme lives in that Site's VFS under `themes/<id>/...`, alongside
`assets/`. There is no builder-wide Theme library.

Per-Site storage is what makes the archive self-contained. A shared library
would mean an archive could open correctly on the machine that made it and
wrong everywhere else, and the person who discovers that is the recipient,
after the sender has moved on. The cost — the same Theme duplicated across
several Sites on one machine — is a few hundred kilobytes, and buys a
hand-off that works.

`themes/` is mirrored by the zip export and restored by the import, exactly
as `assets/` is. The raw package is _not_ copied into `dist/`: the build
already emits what the Theme actually contributes at `assets/theme/<id>/...`,
and shipping the manifest and README to the public site serves no one.

### Identity collisions: same id replaces, after confirmation

Ids are namespaced (ADR 0050), so a collision means the same package, not two
different Themes that happen to share a name. Importing an id that is already
installed replaces it. The Site records `theme.version`, so the editor can
tell the author whether the incoming package is an upgrade, a downgrade or
the same version.

Installing first removes the previous files for that id, so upgrading to a
version with _fewer_ files cannot leave orphans behind that a later load
would happily pick up.

**Versions do not coexist.** One Site, one version of a given Theme. Side-by-
side versions would require version-qualified ids in Site data and in emitted
asset paths, for a benefit — running two versions of the same design in one
Site — that nobody has asked for.

### A rejected import changes nothing

The package is fully loaded and validated before a single byte is written.
The previously installed Theme stays installed and selected. A bad file is
never able to leave a Site worse than it found it.

### Design choices survive Theme switches

ADR 0046 requires that when a Theme does not offer a selected variant, the
Block falls back to the new Theme's default _and_ the previous Theme's
selection is remembered for switching back.

The split that makes this simple:

- `block.variant` is the **live** choice. The renderer reads this one field
  and emits `data-variant`.
- `block.variantsByTheme` is a **per-Theme archive**, keyed by Theme id, that
  the editor maintains. `site.theme.shellVariant` and
  `site.theme.shellVariantsByTheme` are the page-shell counterparts.

On every switch the editor files the outgoing choice under the outgoing
Theme's id and loads the incoming Theme's, if that Theme still offers it.
The renderer never has to ask "which of these two is current?".

A remembered choice that the Theme no longer offers (because the Theme was
re-authored) stays filed but inactive, so re-adding the variant upstream
restores it.

Switching Themes never touches Block `data`. It is a presentation change.

### A missing Theme preserves content and blocks export

When `site.theme.id` names a package that is not installed — a damaged
archive, a hand-edited `data.json`, a package the author removed:

- The Site **opens and saves** with all content intact.
- The renderer falls back to the layout baseline so content stays visible and
  legible. Rendering never hard-fails on a missing Theme.
- The editor names the missing Theme and offers a repair: switch to a
  built-in look. The author's variant choices stay filed, so importing the
  package later restores the design.
- `build()` **refuses to export**, with `BuildThemeMissingError` naming the
  Theme.

What we deliberately do not do is quietly substitute another Theme. That
produces a plausible-looking wrong site, and an author who exports it never
finds out. "Preserve the content, block the export" is the same posture the
issue-106 plan takes for missing Custom Block extensions.

### Removal is blocked while in use

Removing the Theme a Site is currently using is disabled, with the reason
stated next to the disabled control and the fix named (switch Theme first).

A disabled control with an explanation teaches the rule. Hiding the control
looks broken, and allowing the removal would silently restyle the Site —
landing the author in the missing-Theme state for no reason.

### Standalone sharing

Any installed Theme can be exported back out as a `.sosb-theme.zip` from the
Theme settings. The export re-loads and therefore re-validates first: a
package that has been through an archive round trip should not be re-shared
without re-checking it, and an invalid one is better caught by the sender
than by the recipient.

## Rationale

The through-line is that every irreversible or invisible outcome is converted
into a visible, recoverable one. Content is never lost; the loud failures are
placed at export, where someone is paying attention, rather than at open,
where they just want to fix a typo.

Recording `theme.version` in the Site costs one optional string and is what
makes an upgrade legible as an upgrade.

## Consequences

- The same Theme is duplicated across Sites that use it. Accepted, in exchange
  for self-contained archives.
- Site archives grow by the size of their Theme (a few hundred KB for the
  example Theme, mostly subset woff2).
- Block envelopes and `site.theme` carry a small amount of per-Theme memory
  that the renderer ignores. It is additive and round-trips as unknown-key-
  preserving data for older builders.
- A Site whose Theme is missing cannot be exported until it is imported or
  the Site is switched to a built-in Theme. That is the intended outcome.

## Alternatives considered

- **A builder-wide Theme library.** Rejected: breaks the offline hand-off, and
  the breakage is invisible to the sender.
- **Silently falling back to a built-in Theme when one is missing.** Rejected:
  it lets an author publish the wrong design without ever learning.
- **Refusing to open a Site whose Theme is missing.** Rejected: the content is
  intact and far more valuable than the styling; refusing to open holds it
  hostage to a cosmetic problem.
- **Version-qualified ids allowing coexistence.** Rejected: complexity in Site
  data and asset paths with no requested benefit.
- **Deleting remembered variants on Theme switch.** Rejected: ADR 0046
  requires remembering them, and it makes trying another look free.

## Out of scope

- Custom Block extension lifecycle — governed by the issue-106 plan and
  landing with phase two.
- Automatic update checks or a Theme registry: there is no network.
