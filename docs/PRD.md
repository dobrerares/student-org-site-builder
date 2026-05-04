<!--
This document is the v1 PRD for the Student Org Site Builder. It originated as
GitHub issue #1, produced from a structured grilling session that worked
through 24 dependency-ordered design questions. The issue itself was closed
once this PRD was committed; future scope decisions should reference this file
before reopening settled questions.
-->

# v1 PRD: Student Org Site Builder

## Problem Statement

Student organizations across Romanian universities (and similar contexts) need a public website to communicate their identity, activities, team, and contact information â€” but they consistently struggle to produce one that meets a credible quality bar.

The realities for a typical org:

- A small leadership team (President, Vice-Presidents, Directors), most non-technical
- Membership that turns over yearly â€” every September, the team page changes meaningfully
- A standard set of recurring sections: about, mission, vision, values, activities, team, contact
- A pre-existing visual identity (palette, sometimes logo, sometimes fonts) reflecting the org's character (academic, civic, cultural)
- Romanian-primary content, occasional bilingual needs (international conferences, diaspora, exchange contexts)
- No budget for hosting and no in-house designer or developer
- Real quality expectations: the public site must look like a serious student organization's, not a free-template carnival

The current options fail one or more of these:

- **Free SaaS site builders** lock content into a vendor, brand the output with their watermarks, and impose cost or shutdown risk
- **WordPress/CMS self-hosting** demands ongoing technical maintenance no student officer wants
- **Hand-built sites by a tech-savvy volunteer** rot the moment the volunteer graduates
- **No site / Linktree / social-media-only** caps the org's professional surface

There is no path that produces high-quality output, gives the org full ownership of their content as a portable artifact, survives leadership turnover, and costs the org effectively nothing.

## Solution

A free, open-source, no-backend site builder. Distributed as both a cross-platform desktop application (Electron) and a hosted browser SPA. Users build their site through a guided onboarding (wizard, template, import, or empty) plus a two-pane editor with structured forms and live preview. Output is a portable zip containing their canonical content (`data.json`), all media (`assets/`), and a built static site (`dist/`) ready to deploy to Cloudflare Pages.

Sites are multi-page, optionally bilingual, accessible by WCAG 2.2 AA, performant by Lighthouse 95+, and SEO-rich with full Schema.org structured data. They look polished out of the box (5 hand-tuned themes plus design tokens for per-org expression), and they ship with no analytics, no forms, no third-party JS by default.

The data file is a first-class portable artifact: orgs can back it up, share it with sister orgs, hand it to next year's leadership, or seed a new org's site by importing a sister org's structure. The tool is open source (MIT) so anyone can fork, self-host, or rebuild if the project's primary maintainer steps away.

## User Stories

### Onboarding & first-run

1. As a first-time non-technical organization officer, I want a welcome screen that offers me a guided wizard, a starter template, an import option, or a blank start, so that I can pick the entry point that matches my comfort level.
2. As a first-time user, I want a guided wizard that asks for my org's name, founding year, language, logo, theme, and the sections I want, so that I can produce a credible starter site without having to learn the editor first.
3. As a first-time user, I want each wizard step to be skippable when optional, so that I can defer hard choices (logo not ready, content not yet written) and finish setup quickly.
4. As a first-time user, I want the wizard to remember my progress if I close it midway, so that I don't lose my work to a closed tab or laptop battery dying.
5. As a returning user, I want to skip the wizard and start from a curated demo template or a blank page, so that I can use familiar entry points after my first session.
6. As an officer inheriting a site from last year's leadership, I want to import a zip another officer gave me, so that I can pick up exactly where they left off.
7. As a new org studying how a respected sister org structures their site, I want to import a sister org's exported zip and use it as the starting point for my own site, so that I can save weeks of structure decisions and just replace their content with mine.
8. As a returning user, I want a "recent sites" list on the welcome screen, so that I can resume work in one click.

### Content authoring â€” spine

9. As an org officer, I want to enter my org's name, tagline, founding year, logo, address, email, phone, and social links in one place (Site Settings), so that I'm not retyping basics across multiple pages.
10. As an org officer, I want my logo to be auto-resized and optimized when I upload it, so that I don't have to think about image sizing.
11. As an org officer, I want to set my site's default language and add additional language versions later, so that I can ship a Romanian site fast and add English as bandwidth allows.
12. As an org officer, I want my Site Settings to surface validation issues (missing org name, missing email, broken social URL), so that I'm warned before publishing.

### Content authoring â€” pages

13. As an org officer, I want to create new pages with a slug, title, and language, so that I can structure my site beyond a single landing page.
14. As an org officer, I want to mark some pages as hidden from navigation, so that I can have utility pages (e.g., "thank you" after a CTA) without cluttering the menu.
15. As an org officer, I want to reorder pages in the navigation, so that the most important content appears first.
16. As an org officer, I want to clone an existing page as a starting point for a new page, so that I don't have to rebuild similar layouts from scratch.
17. As an org officer, I want to delete a page (with confirmation) when it's no longer relevant, so that I can prune outdated content.
18. As an org officer with a multi-language site, I want to link two pages as language counterparts so visitors can switch between them, so that bilingual visitors get a coherent experience.
19. As an org officer, I want a clear visual signal when one of my Romanian pages doesn't yet have an English counterpart, so that I can prioritize translation work.

### Content authoring â€” blocks

20. As an org officer, I want a hero block with a title, subtitle, optional eyebrow, and optional background image at the top of every page, so that visitors immediately understand what each page is about.
21. As an org officer, I want a rich-text block where I can write prose with markdown formatting (bold, italic, lists, headings, links, quotes), so that I can express ideas naturally without HTML.
22. As an org officer, I want a values block where I can list our org's principles with optional icons, so that visitors can see what we stand for at a glance.
23. As an org officer, I want an activities block where I can list our recurring projects with descriptions, images, and optional badges (Anual / Lunar / Sezonier), so that visitors can see what we do throughout the year.
24. As an org officer, I want a team block where I can list members with name, role, photo, optional short bio, and optional social links, with optional grouping by department, so that visitors can put names to faces and reach out to leadership.
25. As an org officer, I want a contact block with our address, email, social links, and optional embedded map, so that visitors have a single canonical place to reach us.
26. As an org officer, I want my email rendered with anti-harvest protection by default, so that publishing it doesn't flood my inbox with spam.
27. As an org officer, I want an image gallery block with captions and a lightbox for fullscreen viewing, so that I can showcase event photos without leaving the page.
28. As an org officer with a great quote from an alumni or member, I want a pull-quote block with attribution, so that I can highlight testimonials prominently.
29. As an org officer running a campaign, I want a CTA banner block with a headline, optional subhead, and a button linking to a registration form or external page, so that I can direct visitors to actions.
30. As an org officer with sponsors or partners, I want a partner-logos block with optional links, so that I can credit our supporters.
31. As an org officer with a recurring "how do I join?" question, I want an FAQ block with collapsible accordions, so that visitors can self-serve common questions.
32. As an org officer wanting to embed a YouTube highlight reel, a Spotify podcast, or an Instagram post, I want an embed block with a strict provider whitelist and lazy-loading, so that I can include rich media without sacrificing privacy or performance.
33. As an org officer providing downloadable resources (regulamente, formulare, brochure PDFs), I want a documents block where visitors can download files with clear labels and descriptions, so that I can serve as a hub for org artifacts.
34. As an org officer announcing past and upcoming events, I want an event-list block where past events are visually de-emphasized but still visible, so that visitors get historical context plus what's coming up.
35. As a power-user officer with niche embed needs, I want a custom-HTML block as an escape hatch, so that I'm not blocked when the standard blocks don't cover my edge case.
36. As an org officer using the custom-HTML block, I want clear warnings about its risks and a sanitization toggle, so that I don't accidentally break my site or expose visitors to bad scripts.
37. As an org officer adding a block, I want to pick from a categorized block library (mandatory / optional / advanced), so that I can find what I need without scrolling through 15 options.
38. As an org officer with a long page, I want to drag-and-drop blocks to reorder them, so that I can rearrange content without rebuilding it.
39. As an org officer experimenting with layouts, I want undo and redo, so that I can try changes without fear of breaking my page.
40. As an org officer working over multiple sessions, I want my work auto-saved locally between sessions, so that I never lose progress to a closed tab or app crash.

### Theme & visual customization

41. As an org officer, I want to pick from 5 hand-designed themes (Academic / Modern / Editorial / Civic / Minimal), so that my site feels appropriate to my org's character without my having to design from scratch.
42. As an org officer, I want a one-line description and a preview of each theme, so that I understand each option before committing.
43. As an org officer, I want to switch themes mid-edit without losing my content, so that I can experiment with looks before committing.
44. As an org officer, I want to customize my site's primary color, accent color, headline font, body font, density, and corner radius via tokens, so that I can express my org's visual identity without writing CSS.
45. As an org officer, I want a warning if my chosen color combination fails accessibility contrast, so that my site remains readable to people with low vision.
46. As an org officer who is happy with the theme defaults, I want to skip token customization and accept the theme's intended palette, so that I don't have to make design decisions I'm not equipped for.

### Multi-language

47. As an org officer running a bilingual program, I want to add an English version of selected pages, so that international visitors get content they can read.
48. As an org officer building a bilingual site, I want a language switcher to appear in the navigation automatically when â‰¥2 languages exist, so that I don't have to configure it manually.
49. As an English-speaking visitor, I want to switch to my language by clicking a clearly-labeled language link (with native names like "RomÃ¢nÄƒ" / "English"), so that I can read content I understand.
50. As a bilingual visitor whose target page hasn't been translated, I want to land on the home page of my chosen language instead of a 404, so that I can still navigate the site.
51. As an org officer, I want pages without language counterparts to be silently omitted from the other language's navigation, so that partial translation looks intentional rather than broken.

### Editor experience

52. As a non-technical user, I want the editor's UI in Romanian by default with the option to switch to English, so that I work in my preferred language.
53. As an English-speaking technical user, I want my editor UI in English when my browser/OS is in English, so that I work in my preferred language.
54. As an org officer, I want a side-by-side editor and live preview layout, so that I can see exactly what my site will look like as I edit.
55. As an org officer customizing colors, I want token changes to update the preview instantly without flicker, so that I can iterate on look-and-feel quickly.
56. As an org officer on a smaller screen, I want the editor to switch to a tabbed layout (Editor / Preview), so that I can still work effectively without two visible panes.
57. As an org officer reviewing a page, I want a clear summary of all errors, warnings, and info-level issues for the page, so that I can decide what to fix before publishing.
58. As an org officer iterating quickly, I want to be allowed to publish even with warnings (with a confirmation), so that I'm not blocked from shipping draft versions.

### Image and asset handling

59. As an org officer uploading a logo, I want it auto-optimized to a sensible size and format, so that my site stays fast.
60. As an org officer uploading 9 team headshots, I want bulk-friendly upload (one at a time is OK in v1) with each photo automatically resized, so that I don't have to pre-process images.
61. As an org officer using the same logo in multiple places, I want the editor to deduplicate it transparently, so that my zip stays small.
62. As an org officer in the desktop app, I want my photos to be processed at higher quality (Sharp + responsive variants), so that my published site looks crisp on retina displays.
63. As a screen-reader user visiting an org's site, I want every image to have alt text, so that I can understand what the image conveys.
64. As an org officer, I want to be warned if I upload an image without alt text, so that I'm reminded to add it.

### Validation & quality

65. As an org officer, I want fields with hard requirements (org name, page slug, block titles) to show errors that block publishing-with-confirmation, so that I can't accidentally publish nameless content.
66. As an org officer, I want quality nudges (missing alt, low contrast, oversized images, missing meta descriptions) to show as warnings, so that I'm informed without being blocked.
67. As an org officer with a published site, I want the build pipeline to verify my site against Lighthouse 95+ budgets and warn me if it slips, so that I keep the published quality bar.

### Export, deployment & ownership

68. As an org officer ready to publish, I want to export my site as a single zip containing my data, my assets, the built site, and a deployment guide, so that I have everything I need in one place.
69. As an org officer, I want the deployment guide to walk me through Cloudflare Pages step-by-step in my language, so that I can publish without external help.
70. As an org officer with a Cloudflare Pages account, I want clear guidance on connecting a custom domain (e.g., `historipol.ro`), so that my site has a memorable URL.
71. As an org officer who already exported and now wants to update content, I want to import my last zip, edit, and re-export, so that round-trips are lossless.
72. As an outgoing org leader, I want to hand my successor my data zip and a one-page guide, so that they can take over the site without me.
73. As an org officer worried about the long-term, I want my data zip to be readable by any future version of the editor (forward-compatible) and self-contained (no external dependencies), so that my site survives even if the editor project ends.

### Updates & versioning

74. As an Electron app user, I want the app to check for updates in the background and notify me when one is available, so that I get fixes without checking manually.
75. As an Electron app user mid-edit, I do NOT want the app to auto-restart for an update, so that I never lose work to a surprise update.
76. As a browser editor user, I want a "new version available â€” reload to update" toast to appear when an update has been deployed, so that I'm aware without being forced.
77. As an Electron app user updating to a new version, I want to see release notes the first time I launch the new version, so that I understand what changed.
78. As an org officer using a slightly older editor, I want to be able to open a zip exported from a slightly newer editor with a clear notice that some new features may not be visible, so that I'm not blocked by version mismatches.

### Privacy & ownership

79. As a privacy-conscious org officer, I want the editor to send no analytics or telemetry, so that my work isn't watched.
80. As a privacy-conscious org officer, I want my published sites to ship with no third-party scripts by default, so that visitors aren't tracked.
81. As an org officer concerned about any project maintainer "going away," I want the editor's source to be public and MIT-licensed, so that anyone can fork, host, or rebuild it.
82. As an org officer worried about long-term access, I want an archival single-file HTML version of the editor downloadable from GitHub Releases, so that I can keep editing offline indefinitely.

### Visitor (read-side) stories

83. As a prospective member visiting an org's site, I want to read About / Mission / Values / Activities / Team / Contact, so that I can decide whether to apply.
84. As a journalist or alumni searching for an org, I want to find rich snippets in Google search results (logo, description, address, founding year), so that I can verify the org without clicking through.
85. As a screen-reader user visiting a published site, I want full keyboard navigation, AA contrast, and semantic landmarks, so that I can use the site like any sighted visitor.
86. As a mobile visitor, I want pages to load in under 2 seconds on 4G and lay out correctly on a 360px-wide screen, so that I can browse without frustration.
87. As a visitor on a flaky connection, I want hero images and below-the-fold content to lazy-load, so that I see content before everything finishes loading.
88. As a visitor who clicks a YouTube embed, I want it to load only when I scroll near it (not eat my data on page load), so that browsing is fast and respectful of my bandwidth.
89. As a member looking up a specific past event, I want past events visually de-emphasized but still findable in the event list, so that I have historical context without confusion about what's upcoming.
90. As a search-engine bot indexing the site, I want a sitemap.xml with hreflang annotations, robots.txt, canonical URLs, and Schema.org structured data, so that I can index the site correctly across languages.

### Maintainer / contributor stories

91. As a developer evaluating the project, I want a public GitHub repository with a clear README, contribution guide, and code of conduct, so that I can decide whether to use or contribute.
92. As a developer setting up the project locally, I want a single command to install dependencies and run the editor in development mode, so that I can start contributing in <30 minutes.
93. As a developer adding a new block type, I want a documented pattern (define schema, write Preact render, register in editor) and not have to touch theme files, so that I can ship a new block without N theme implementations.
94. As a designer contributing a new theme, I want a documented brief format (identity, type, palette, density, hero variants) plus a checklist (axe-core pass, diacritic test, Lighthouse 95+), so that I have a clear quality bar to hit.
95. As a translator, I want a single source-of-truth file for translatable strings with tooling that flags missing translations, so that I can contribute translations without hunting through code.

## Implementation Decisions

### Distribution & ownership

- The editor is distributed as **two artifacts** sharing a single codebase: an Electron desktop app (Mac/Windows/Linux) and a hosted browser SPA. An archival single-file HTML build is also produced for offline disaster-recovery use.
- Per-org **static deployments**. The project runs no backend for member-org sites. Sites are static folders deployable to any static host. Cloudflare Pages is the sole recommended/documented host; other hosts will work but will not be supported in the docs.
- Auto-update for Electron via `electron-updater` against GitHub Releases. Background check + auto-download + prompt to install. Single stable channel for v1. Never auto-restarts mid-session.
- Browser editor updates via service worker; user-triggered reload.

### Data & schema

- The canonical artifact is a zip containing `data.json` (source of truth), `assets/` (hash-named, content-addressed), `dist/` (built site), and `DEPLOY.md` (deployment guide).
- Site schema: site-level fixed spine (org metadata, theme selection + tokens, default language) plus a `pages` array. Each page has `slug`, `lang`, `navLabel`, `navOrder`, `showInNav`, `seo`, `blocks`, optional `localizedAs`. The site has `schemaVersion: 1` for all of v1.x.
- Multi-page from v1 with no soft cap; default 1 page on new sites. Flat slugs only (no nested page hierarchy). No typed pages (no blog/event page types).
- Multi-language via separate page trees. Each page declares `lang`. Default language at root URLs (e.g., `/despre`); secondary languages prefixed (`/en/about`). Cross-references via `localizedAs` field.
- Block envelope: `{ id, type, version, data }`. Per-block `version` field allows independent migration.
- **Additive-only changes within v1.x.** Forward compatibility via preserve-unknown-keys: unknown blocks render as placeholder cards in editor and HTML comments in built sites; unknown fields preserved opaquely on round-trip. Migration framework exists from day one but is exercised only minimally in v1.

### Schema validation & severity

- Validation runs live as the user types and again on pre-export.
- Three severity levels: errors (high-friction confirmation, but never hard-block â€” manual override allowed), warnings (don't block), info (silent, surfaced only on a Site Health panel).
- Errors are conservative: empty org name, missing pages, malformed/duplicate slugs, missing required block fields, broken asset references, malformed customHTML when sanitization is on, page-language not in language list.
- Warnings include: missing image alt, missing page meta description, color contrast under AA, oversized images, missing org email, sanitize-off on customHTML, untranslated counterparts in declared bilingual pages, outdated block versions auto-migrated.

### Renderer & themes

- **Renderer is a shared Preact module** using `preact-render-to-string`. The same code runs at build time (in Node for Electron, in the browser-side build pipeline for the browser editor) and in the editor preview iframe. Renderer output is byte-identical between environments.
- Built sites ship with **no client framework**. Pure HTML + CSS + â‰¤10kb total of hand-written vanilla JS for interactive blocks (lightbox, accordion, embed lazy-load, mobile nav, eventList past-fade).
- Tokens emitted as CSS custom properties on `:root`. Live token edits in the editor update the iframe's style element without DOM rebuild.
- Five themes ship in v1: `academic`, `modern`, `editorial`, `civic`, `minimal`. Themes own page-level composition (header, hero, footer, nav, page rhythm). Most blocks use shared templates customized via tokens; only blocks where layout meaningfully varies per theme (`hero`) get per-theme variants.
- Themes are designed via a disciplined AI-assist process: written brief + reference imagery â†’ AI first draft â†’ human refinement passes (block audit, accessibility, diacritic test, responsive test, Lighthouse pass) â†’ ship. Fallback contract: if quality slips, drop to 3 themes (Academic + Modern + Civic) rather than ship 5 mediocre.
- Themes are switchable mid-project. Tokens are theme-independent. No theme-specific blocks; no custom CSS; no dark/light mode toggle (auto-derived from `bg`/`fg` tokens if needed).

### Block library (15 blocks total)

Mandatory (auto-created on new site/page): `hero`, `richText`, `valueList`, `activitiesList`, `teamGrid`, `contactCard`.
Optional: `imageGallery`, `quote`, `ctaBanner`, `partnerLogos`, `faq`, `customHTML`, `embed`, `documentDownloads`, `eventList`.

- Markdown rendering uses a strict whitelist: bold, italic, links, lists, headings (h2â€“h4), inline code, blockquotes. No raw HTML in markdown. XSS-safe by construction.
- `embed` enforces a closed provider whitelist (YouTube, Vimeo, Spotify, Instagram, Facebook, SoundCloud, Bandcamp, Twitter), nocookie variants where available, lazy iframe loading.
- `eventList` ships with a single safe mode (all events sorted by date) plus client-side past-fade. No recurring rules, no iCal export in v1.
- `documentDownloads` extends the asset system to non-image files (PDF, DOC, XLS, PPT, ZIP, TXT, CSV, ODT, ODS), 25MB per-file cap.
- `customHTML` is the lone escape hatch with prominent danger UI, sanitize-on-by-default, and explicit override toggle.
- Email in `contactCard` uses JS-reveal anti-harvest. Map embed defaults to OpenStreetMap; Google Maps is opt-in with privacy notice.
- No contact forms, newsletter signups, comments, RSVPs, or analytics blocks in v1.

### Editor architecture

- Two-pane layout: structured editor pane (forms for spine + reorderable block list with expandable per-block editors) on the left; live preview iframe rendering the actual themed site on the right. Mobile/narrow layouts swap to tabs.
- **Per-block forms are auto-generated from per-block schemas.** Adding a new block type is: define schema + Preact render component + default data + editor metadata. Editor form is derived. No hand-coded forms per block.
- Mandatory undo/redo via debounced data snapshots.
- Drag-and-drop block reordering via explicit drag handle (not body drag).
- Browser-version persistence: OPFS-backed VFS with IndexedDB fallback. Single-site v1 (multi-site browser is v2).
- Electron persistence: real filesystem. Sites are folders (`<site-name>/data.json`, `<site-name>/assets/`, generated `<site-name>/dist/`). Recent-sites list via app preferences.
- Editor UI is bilingual (RO default, EN parity from day one). Translation system with TS-typed message keys; missing-key detector in dev builds.

### Welcome screen & onboarding

- Welcome screen offers four paths plus a recent-sites list: (1) Wizard guided creation, (2) Start from template (single curated demo), (3) Import existing site (zip drop), (4) Start blank.
- Wizard is six steps: basics â†’ identity â†’ sections â†’ content â†’ languages â†’ confirm. State persisted per step. Output is normal site data (no wizard-only schema).
- Single curated demo template with realistic Romanian content showcasing all 15 block types and 2 pages. Tagged with `[de Ã®nlocuit]` markers in editor (not in rendered HTML) to remind users to swap content.
- Import flow validates schema, runs migrations, unpacks assets, opens editor.

### Quality commitments

- **Accessibility:** WCAG 2.2 AA. Zero axe-core violations as a CI gate. Mandatory alt text on all image-bearing blocks. Full keyboard navigation. Focus indicators across all interactive elements. Semantic HTML structure (nav, main, article, section, hierarchical headings).
- **Performance:** Lighthouse 95+ on all metrics. Per-page budgets: HTML â‰¤50kb, CSS â‰¤15kb gzipped, JS â‰¤10kb total, hero image â‰¤200kb (WebP/AVIF). Native `loading="lazy"` for below-the-fold images.
- **SEO:** Per-page title and meta description, Open Graph tags, Twitter Card tags, canonical URLs, hreflang annotations, sitemap.xml with `xhtml:link rel="alternate"` per language, robots.txt with sitemap reference. Full Schema.org JSON-LD: Organization (site-level), Person (team members), Event (eventList items), FAQPage (faq blocks), BreadcrumbList (when nav depth >1).

### Asset processing

- Hash-based content-addressing using SHA-256 prefix (e.g., `assets/8e3a7f.jpg`). Auto-deduplicates identical files.
- Image processing differs by environment:
  - **Browser editor:** canvas-based single-size resize (max 2000px long edge), JPEG q=85 for non-alpha, PNG/WebP for alpha, SVG passthrough.
  - **Electron app:** Sharp-based responsive variants (400/800/1600 widths) with WebP/AVIF encoding.
- Asset metadata sidecar (`<hash>.metadata.json`) stores original filename, mime type, dimensions, and a mandatory `alt` field.
- Built sites in Electron use responsive `srcset`; browser-built sites use single-size with a documented quality trade-off.

### Open source & operational

- License: **MIT**. Public GitHub repository from day one.
- README, CONTRIBUTING.md, CODE_OF_CONDUCT.md (Contributor Covenant 2.1), issue templates, PR template.
- No CLA. No financial sponsorship infrastructure in v1.
- Releases tagged with semver on GitHub. Cross-platform Electron installers (.dmg / .exe / .AppImage) attached to releases. Archival single-file HTML attached.
- Code signing: Apple Developer Account ($99/yr) mandatory for Mac. Windows code signing planned but unsigned acceptable for v1. Linux unsigned.
- **Telemetry: none.** No analytics, no crash reports, no third-party scripts. The only network call is the auto-update manifest GET (anonymous).

### Modules

The implementation is organized into deep modules (encapsulated behavior, narrow interface, isolation-testable) and integration modules:

**Deep modules:**

- **Schema** â€” block + site schemas, validation with severity tiers, migration framework, preserve-unknown-keys
- **Renderer** â€” pure function from `(siteData, themeId)` to HTML. Same code in browser preview and Node build
- **Markdown** â€” strict-whitelist sanitized markdown. Used by richText, faq, quote
- **VFS** â€” virtual filesystem abstraction with multiple drivers (Memory, IndexedDB, OPFS, Electron filesystem, Zip)
- **Assets** â€” image processing pipeline with environment-specific implementations behind a unified interface
- **Zip** â€” bidirectional import/export with round-trip preservation
- **Build** â€” `(siteData) â†’ distFolder` pipeline including SEO metadata generation and budget verification
- **i18n** â€” keyed message lookup with RO/EN, browser language detection, override persistence

**Integration / UI modules:**

- **Editor state** â€” live document model with undo/redo, block manipulation actions
- **Preview bridge** â€” postMessage protocol between editor and preview iframe
- **Editor app** â€” Preact UI composing the deep modules (forms, block list, preview pane, validation panel)
- **Wizard** â€” 6-step state machine + Preact UI
- **Themes** â€” five Preact theme component sets + token defaults
- **Electron shell** â€” main process, IPC bridge to Sharp, `electron-updater` integration, native dialogs, cross-platform packaging
- **Browser shell** â€” service worker, single-file archival build, OPFS bootstrap, hosted-deployment artifact

## Testing Decisions

- **Tests cover external behavior, not implementation details.** A test should fail when behavior changes from a user's perspective and survive refactors that preserve behavior. Tests should not assert on internal function calls or private fields.
- **Tests are co-located with the modules they cover** (per common JS/TS practice).
- **Snapshot/golden-file tests for the renderer** to catch regressions across the 15 blocks Ã— 5 themes matrix.
- **No prior art in the codebase** â€” this is a greenfield project. Test conventions established in v1 should be documented in CONTRIBUTING.md so contributors follow them.

**Modules with full test coverage in v1:**

- **Schema:** unit tests on validation rules; fixture tests with realistic org data (HISTORIPOL-shaped); migration round-trip tests; preserve-unknown-keys tests.
- **Renderer:** golden-file HTML snapshots per block Ã— per theme; rendering determinism tests (same input â†’ same output across runs); diacritic rendering smoke tests.
- **Markdown:** unit tests on whitelist enforcement; XSS test corpus (known attack vectors must all sanitize); fuzz tests on malformed input.
- **Assets:** unit tests per environment driver; image type detection; SHA-256 content-addressing; alt-text presence enforcement.
- **Zip:** import â†’ export â†’ import = identity round-trip tests; schema migration on import; corrupted zip handling.
- **Build:** end-to-end test on a sample site producing a `dist/` folder; assertions against Lighthouse-budget thresholds; sitemap and Schema.org JSON-LD shape validation.
- **i18n:** unit tests; missing-translation detector; fallback behavior.
- **Editor state:** action reducer tests (add/remove/reorder/edit/undo/redo).
- **Wizard:** state machine unit tests; full-flow e2e (Playwright) producing a valid site.
- **VFS:** Memory and Zip drivers fully unit-tested; OPFS, IndexedDB, Electron-FS drivers covered with integration tests in their respective environments.

**Modules with lighter coverage:**

- **Preview bridge:** unit tests on serialization; manual e2e.
- **Editor app:** sparse component tests on critical interactions; 3â€“5 Playwright e2e on golden-path user flows (new site â†’ wizard â†’ edit â†’ export, import â†’ edit â†’ export).
- **Themes:** axe-core accessibility regression tests per theme; visual snapshot tests for key blocks per theme.
- **Electron shell and Browser shell:** manual smoke tests per platform; installer QA before each release.

## Out of Scope

The following are explicit non-goals for v1:

- **No backend services run by the project.** No SaaS, no hosted database, no shared form gateway, no telemetry endpoint, no analytics service.
- **No collaborative editing.** Single-user sessions only. No real-time sync, no commenting, no review workflow.
- **No mobile editing app.** Desktop-only (Electron) and browser SPA (which works on tablet but is not phone-optimized).
- **No template gallery, marketplace, or community-shared templates.** Single curated template only.
- **No theme creation by users.** No custom CSS, no plugin system, no theme inheritance, no third-party themes.
- **No contact forms, newsletter signups, comments, RSVPs, or built-in analytics on published sites.** mailto and social links only.
- **No nested pages, no typed pages (blog/event types), no per-page password protection.**
- **No video or audio assets.**
- **No spell-check or AI content suggestions in the editor.**
- **No deploy history, rollback, staging environments, or automatic redeployment.** Each export is a fresh deploy.
- **No FTP/SFTP, Netlify, GitHub Pages, or Vercel integration in v1 docs.** Cloudflare Pages only is documented and recommended.
- **No bulk image upload, no image cropping UI, no AI alt-text generation.**
- **No locale-aware date/number formatting in built sites in v1.**
- **No RTL language support.**
- **No mixed-language single pages.**
- **No language auto-detection / auto-redirect on built sites.**
- **No translation memory or AI translation.**
- **No theme switching transitions or animations.**
- **No CLA, no bug-bounty, no formal RFC governance for v1.**
- **No `mailto`-prefilled fake forms, no third-party form services, no centralized form gateway.**

## Further Notes

- **Estimated v1 scope:** ~130 working days for one experienced full-stack developer (~6 months full-time, longer if part-time). Breakdown: theme implementation ~30 days; editor + renderer + asset pipeline ~40 days; wizard + welcome + onboarding ~20 days; Electron packaging + dual-build ~15 days; i18n + EN translation ~10 days; testing + a11y + Lighthouse ~10 days; docs + deployment guides + release ~5 days.
- **Quality fallback contract:** if 5-theme quality slips during AI-assist + refinement, the project drops to 3 themes (Academic + Modern + Civic) rather than ship 5 mediocre. This is a v1 commitment, not a failure mode.
- **HISTORIPOL** (AsociaÈ›ia StudenÈ›eascÄƒ HISTORIPOL, founded 2024 at Universitatea â€žOvidius" ConstanÈ›a) is the canonical reference user. Every theme, the demo template, and the test corpus use HISTORIPOL-shaped content for QA. If a theme breaks rendering HISTORIPOL's content, the theme is wrong.
- **Forward-compatibility commitment:** within the v1.x series, all schema changes are additive only. Field renames, removals, and semantic shifts are deferred to v2.0. This makes the v1 series safe for users to upgrade across.
- **Privacy positioning is a feature, not a constraint.** "We don't watch you. Your work never leaves your machine unless you publish it." This stance is documented in the editor's About screen and is a marketable differentiator.
- The architectural decisions in this PRD were produced via a structured grilling session that worked through 24 dependency-ordered design questions. Future scope decisions should reference this PRD before reopening settled questions.

