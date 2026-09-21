---
status: accepted
---

# Trusted executable Theme and Block extensions

For issue #105, extensions are authored by an organisation or someone it
trusts. Custom Themes may control page layouts and Block markup, and
extensions may supply JavaScript both for rendering during preview/export
and for interactions on the exported public Site, rather than being
restricted to declarative definitions.

The author's concrete design reference is the
[Figma Make Site mockup](https://www.figma.com/make/DfvpSosZacb1vsd9CPlNJl/Site-mockup).
The extension contract should support recreating a design like this while
retaining editable Site content. The
[published reference](https://caveat-savor-57868963.figma.site/) was inspected
at desktop and mobile homepage sizes and through its main navigation.
It includes responsive navigation, a decorative hero, card grids,
image/text sections, team tabs, educational accordions, news and events,
partner groups, and forms. The reference uses client-state navigation;
recreation under this contract retains builder-owned Page URLs. Its
registration form source only changes local success state, so it is not
evidence of a working submission service.

Developers may share a complete editable Template containing its Theme,
Custom Blocks, Pages, and sample content, so organisations can start by
editing the supplied Site. The Theme remains separately reusable.

Editable text and images belong to Site content or Blocks, including
content used in headers and footers. Theme settings control appearance
only, such as colours, spacing, and Block design variants; Themes do not
define their own editable content fields.

Custom Blocks declare their editable fields; the builder provides the
editing forms, including supported asset pickers and list controls.
Extensions do not supply executable custom editing interfaces.

Themes may offer named Block design variants for the same Block type.
Authors select a variant through a builder-provided control without
changing the Block's type.
If the new Theme does not offer the selected variant, use its default
design for that Block and remember the previous Theme's selection for
switching back. A Custom Block without any supported design still follows
the omission and export-acknowledgement rule in ADR 0045.

Themes control the visible page shell, including header, navigation,
footer, and content layout. The builder retains ownership of URLs,
language links, and essential SEO metadata; Themes do not replace the
entire HTML document.

Themes must preserve the author-defined Block reading order. They may
use columns, overlaps, and other visual layouts without changing that
reading order.

Custom Themes may use arbitrary CSS within the public page and packaged
fonts, with their styling isolated from the editor. They must document
which builder appearance controls they support. This relaxes the
token-only styling contract in ADRs 0021 and 0032 for Custom Themes.

The project must clearly document supported Theme capabilities and limits.
This expands the CSS-focused Theme contract described in ADR 0021; its
built-in Modern Theme styling choices remain unaffected.

During preview/export, rendering code may use supplied Site content,
packaged assets, and documented builder helpers only. Network requests
and direct access to the computer's files are outside the supported
rendering contract, preserving offline operation in browser and Electron.
The builder must enforce these rendering access limits rather than rely
on extension authors to follow documentation. The enforcement mechanism
remains an implementation decision.

For the same saved Site, Theme, extensions, and assets, rendering must
generate identical page HTML across browser preview and Electron/export,
retaining ADR 0032's determinism guarantee. Rendering must not depend on
the current time, randomness, or browser-specific state. Public-site
scripts may add changing behaviour after rendering.

On the published Site, extension JavaScript may contact external services.
Each extension must document those dependencies and which functionality
is unavailable offline. This permission does not extend to rendering
code during preview/export.

Editor preview is static by default. Public-site scripts and their
external connections run only in an explicitly enabled interactive-preview
mode, isolated from editor controls and native computer access. This
avoids triggering real external actions during ordinary content editing.

Custom extensions may bundle browser frameworks and exceed the existing
10 KB interaction-JavaScript budget, provided their runtime dependencies
and size are documented. This is an exception to the no-client-framework
contract in ADRs 0021 and 0032 and the script budget described in ADR 0021;
built-in Themes retain the existing restrictions.

Exported Sites must expose core content from supported Blocks as readable
HTML and provide working Page navigation before JavaScript runs. Scripts
may enhance this content with interactions; externally fetched content
may depend on JavaScript. Allowing bundled frameworks does not permit
extensions to make all core content dependent on client-side rendering.
