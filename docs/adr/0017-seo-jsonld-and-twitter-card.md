# 0008 — Schema.org JSON-LD, Twitter Card, and the SEO emission boundary

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #39

## Context

Issue #39 finishes the SEO surface the build pipeline is responsible for:
Schema.org JSON-LD blobs in every page's `<head>`, Twitter Card meta-tag
parity with `og:*`, sitemap completeness verified against the multi-page +
multi-language paths #23/#24 already wired up, and a `robots.txt` that
references the sitemap when one is configured.

The PRD pins the broad strokes (PRD § 90, § 249): full Schema.org JSON-LD
covering `Organization` (site-level), `Person` (per teamGrid member),
`Event` (per eventList item), `FAQPage` (per faq block), and
`BreadcrumbList` (when nav depth >1), plus per-page Open Graph + Twitter
Card tags, canonical URLs, hreflang in head and sitemap, and a
sitemap-aware `robots.txt`. The PRD does **not** pin:

- where JSON-LD generation lives (renderer? build pipeline?),
- the JSON-LD blob *order* in the rendered HTML,
- how the build degrades when no `siteUrl` is configured (skip JSON-LD?
  emit relative URLs?),
- the contract for *unknown* / *future* block types — the formal block
  schemas for `teamGrid`, `eventList`, `faq`, etc., land in #9-#22, but
  #39 asks for JSON-LD that *anticipates* those shapes today,
- where Twitter Card tags live (renderer head? build overlay?),
- a `<lastmod>` strategy for sitemap entries.

## Decision

### JSON-LD lives in `@sosb/build`, not in `@sosb/renderer`

A new `packages/build/src/json-ld.ts` module owns JSON-LD generation. The
build pipeline's existing `injectSeoMeta` head-overlay splices the
generated `<script type="application/ld+json">…</script>` blocks in
immediately before `</head>`, alongside the canonical / og:url / og:image
overlay it already manages.

Reasons to keep JSON-LD out of the renderer:

- Several payload fields (`Organization.url`, `Organization.logo`,
  `Person.image`, `Event.image`, `BreadcrumbList.item`) need absolute
  URLs to validate cleanly under Google's Rich Results test — and
  `siteUrl` is a build-time concern (ADR 0004 § "siteUrl flow"). Adding
  it to the renderer would cross the deliberate render-time / build-time
  boundary.
- The renderer's deterministic-byte-identity contract (ADR 0003) is per
  `(siteData, themeId, opts)`. Pulling `siteUrl` into the renderer would
  widen the determinism surface. The current split keeps the renderer
  unchanged for any given site.
- Block-level JSON-LD (`Person`, `Event`, `FAQPage`) reads a *future*
  schema shape today (`teamGrid`, `eventList`, `faq` block schemas land
  in #9-#22). Letting the build read the loose `BlockEnvelope.data` lets
  us emit JSON-LD before those blocks have formal renderers, without
  expanding the renderer's known-block registry early.

Reasons we did not split JSON-LD into its own package:

- It's a thin module (one file). A new workspace package would carry a
  `package.json`, two `tsconfig`s, and a workspace dep on `@sosb/schema`
  + `@sosb/renderer` for the same code that fits in `@sosb/build`.
- The build pipeline already owns the sitemap, robots.txt, and
  per-page-canonical overlay — JSON-LD is the same kind of static-site
  metadata, and grouping the SEO surface together keeps callers from
  having to import three separate modules.

### Always emit JSON-LD, even without `siteUrl`

The build emits Organization JSON-LD on every page in every build, and
emits Person / Event / FAQPage / BreadcrumbList payloads when their
respective blocks (or nav depth) are present. When `siteUrl` is **not**
configured, URL-bearing fields (`Organization.url`, `Organization.logo`,
`Person.image`, etc.) fall back to the original relative path. The
relative form keeps the user able to preview the structured data they're
shipping (Google's Rich Results test rejects nothing with relative
images; it just warns) and matches the existing "preview the dist before
you decide on hosting" stance ADR 0004 took.

Rejected:

- **Skip JSON-LD when `siteUrl` is missing.** Would degrade the editor's
  preview build (no JSON-LD until you publish), making the editor's "what
  does my site look like" feedback misleading. Users would land on a
  surprise — "I see structured data only after deploy" — which the v1
  positioning explicitly rejects.
- **Synthesise an absolute URL from `window.location.origin`.** Couples
  the build to the editor's runtime and pollutes the dist with
  preview-host URLs.

### JSON-LD emission order: Organization → Person\* → Event\* → FAQPage\* → BreadcrumbList?

A fixed deterministic order, matching Google's sample documents and
keeping per-file golden snapshots stable across rebuilds. Within each
list, members are emitted in `pages[].blocks[]` declaration order — same
order the renderer walks them — so block reordering in the editor is the
single signal that drives JSON-LD reordering.

### Block-level JSON-LD reads the loose `BlockEnvelope.data` shape

The build reads `teamGrid` / `eventList` / `faq` block envelopes by
their `type` discriminator string and walks `data.members[]`,
`data.events[]`, `data.items[]` loosely (`Record<string, unknown>` →
runtime `typeof` checks → skip when shape doesn't match). Three reasons:

- The formal block schemas (#9-#22) haven't landed yet, but the SEO
  emission has to ship today. Reading the envelope loosely is
  forward-compatible: when the formal schemas pin the exact field names,
  the build's reads still work as long as the names align.
- The schema-level `BlockEnvelope` already accepts unknown block types
  (preserve-unknown-keys, ADR 0002). The validator emits a warning for
  unknown block types but does not reject them. Block-level JSON-LD
  inherits that contract: unknown shape → skip silently rather than
  throw. This matches the renderer's "unknown block → HTML comment"
  fallback (ADR 0003).
- A `data.members[].name`/`data.events[].startDate`-style read is small
  enough that we don't gain anything from a dedicated "JSON-LD adapter
  per block type" registry. When block types grow rich JSON-LD needs
  beyond the v1 set (`Article`, `Course`, `LocalBusiness`, …), a
  registry becomes worth the indirection.

The exact field names the build reads are documented in
`packages/build/src/json-ld.ts` next to each reader. When #9-#22 finalise
the formal schemas, they should ship `data.members[]` /
`data.events[]` / `data.items[]` with the documented field names, or
update the build's reader in lockstep.

### BreadcrumbList: home → active page only

V1 has no nested page hierarchy (PRD § 195, § 339; ADR 0006), so every
non-home page's breadcrumb is exactly two levels: language home → active
page. The home page itself emits no breadcrumb (no depth to advertise),
and single-page sites emit none either. The breadcrumb's first item is
the active language's home (so a `/en/about/` page breadcrumbs
`Home → About`, not `Acasă → About`); this matches Google's i18n
breadcrumb guidance.

Rejected:

- **Emit BreadcrumbList for every page including home.** The home page
  has only one position; a single-item BreadcrumbList confuses Google's
  Rich Results test (no parent to link to) and surfaces a warning.
- **Emit a `Site` → `Section` → `Page` three-level breadcrumb.** No
  source signal — there are no sections in v1. Inventing a section name
  ("Home", site.org.name) would be guesswork.

### `</script>` escape: `</…>` → `<\/…>`

JSON-LD payloads that contain user-provided strings (`org.name`,
`page.navLabel`, etc.) could embed a literal `</script>` sequence and
break the surrounding `<script>` tag. The build's `renderJsonLdScripts`
helper escapes the closing-slash form (`</script>` → `<\/script>`) and
the comment delimiters (`<!--` → `<!--`, `-->` → `-->`) before
emission. The JSON parses identically (the slash is unconstrained inside
JSON strings), so consumers reading the payload back never see the
escape. A test asserts `inner.toLowerCase()` never contains `</script>`
even when `org.name` is `Evil </script><script>alert(1)</script>`.

### Twitter Card lives in the renderer head; absolutisation in the build

The renderer emits `twitter:card`, `twitter:title`, `twitter:description`,
and `twitter:image` parity with the existing `og:*` head tags. Card type
defaults to `summary_large_image` when the page's first hero block has a
`backgroundImage`, otherwise `summary`. Image references use the
relative path (e.g. `assets/hero.jpg`) — the build's `injectSeoMeta`
overlay rewrites `twitter:image` to absolute URL when `siteUrl` is set,
the same way it overlays `og:image`. Absolute URLs in the source
(`https://cdn.example.com/...`) are passed through unchanged.

This split keeps the parity logic (card type, title, description) in the
renderer where it can read `page.seo` directly, and the URL-absolutisation
logic in the build where `siteUrl` is known. The renderer's golden
snapshot grows by four meta tags (covered by the `golden-file.test.ts`
re-snapshot).

### Sitemap `<lastmod>`: still deferred

Pre-#39 ADRs (0004, 0006, 0007) all deferred `<lastmod>` because the
schema has no `updatedAt` source signal yet. #39 does not change that —
synthesising a `<lastmod>` from the build's wall-clock would break the
deterministic-byte-identity contract, and pinning it to a fake date
(`1970-01-01`) ships misleading data to crawlers. We continue to omit
`<lastmod>` until the schema gains a real updated-at field. The sitemap
is otherwise structurally complete: every page entry, every language
counterpart annotated via `xhtml:link`, plus `x-default`.

### `robots.txt`: unchanged

The existing `robots.txt` from #5 (PRD-aligned: `User-agent: *`,
`Allow: /`, plus `Sitemap: <siteUrl>/sitemap.xml` when `siteUrl` is set)
satisfies the AC. We did not extend it: no per-bot rules, no crawl-delay,
no per-path Allow/Disallow lists. Those are escape hatches users can
add through a future "advanced robots.txt" affordance — keeping the v1
default minimal makes the file auditable.

## Rationale

The most subtle requirement is "JSON-LD must validate against Google's
Rich Results test on a multi-block fixture". Three properties make that
hold:

1. **`@context: "https://schema.org"`** on every blob — Google's
   validator rejects payloads without a valid context.
2. **Required fields per type** — Organization needs `name`; Event needs
   `name` + `startDate`; FAQPage needs `mainEntity[].acceptedAnswer`;
   BreadcrumbList needs `itemListElement[].position`. The readers skip
   blob entries that miss required fields rather than emit invalid
   blobs.
3. **Absolute URLs when configured** — Google warns on relative URLs in
   image / url / item fields. The build emits absolutes whenever
   `siteUrl` is set; relatives are still parseable but flagged
   "missing recommended". This trades AC verbatim ("validates against
   Schema.org" — yes) for a warning when the user previews unhosted.

The block-loose-read approach is the load-bearing forward-compat
decision. When #9-#22 land formal `teamGrid` / `eventList` / `faq`
schemas, they will need to keep `data.members[]` / `data.events[]` /
`data.items[]` as their top-level array names and the field names
documented in `json-ld.ts`. If those issues choose different field names,
they update `json-ld.ts` in the same PR — but the *envelope* contract
(typed as `BlockEnvelope` with loose `data`) doesn't change.

## Consequences

- `packages/build/src/json-ld.ts` is the new home of all Schema.org
  payload generation. `injectSeoMeta` always calls it — no longer
  gated on `siteUrl`.
- `packages/renderer/src/page-shell.tsx` emits four new Twitter Card
  meta tags (`twitter:card`, `twitter:title`, `twitter:description`,
  `twitter:image`). The renderer's golden snapshot grows; the renderer's
  parity / determinism contracts are unchanged because the new tags
  derive from `page.seo` + the first hero block, both already part of
  the renderer's input.
- `packages/build/src/index.ts`'s `injectSeoMeta` now runs in every
  build (not just when `siteUrl` is set), and rewrites `twitter:image`
  to absolute URLs when `siteUrl` is configured.
- The `with-site-url` and `no-site-url` golden snapshots both grow by a
  JSON-LD `<script>` and four Twitter Card meta tags. The
  with-site-url variant additionally rewrites `twitter:image` to an
  absolute URL.
- A new `packages/build/test/json-ld.test.ts` covers Organization,
  Person, Event, FAQPage, BreadcrumbList shapes plus determinism + the
  `</script>` escape.
- A new `packages/build/test/twitter-card.test.ts` covers the build's
  absolutisation overlay; a new `packages/renderer/test/twitter-card.test.ts`
  covers the renderer's emission.
- A new fixture `packages/build/test/fixtures/jsonld-rich-site.json`
  carries `teamGrid`, `eventList`, and `faq` blocks that exercise the
  block-level JSON-LD readers. The fixture uses unknown block types
  the schema validator allows under preserve-unknown-keys — no
  schema changes.

## Alternatives considered

- **JSON-LD inside the renderer.** Rejected (see Decision § 1) — would
  cross the render/build boundary and require `siteUrl` plumbing
  through the renderer.
- **A separate `@sosb/seo` package.** Rejected (see Decision § 1) —
  one-file package overhead vs. an existing build pipeline that already
  owns canonical / og:url / og:image / sitemap / robots.
- **Per-block JSON-LD adapters in a registry.** Rejected for v1 — three
  block types' worth of tightly-coupled readers fits comfortably in one
  module and the registry layer would be 10x the code for no extra
  capability today. Worth revisiting at #20+ when the block matrix
  grows.
- **Re-render the page when `siteUrl` is provided to inject JSON-LD
  inline.** Same objection as the canonical / og:image overlay (ADR
  0004): doubles per-page work and breaks renderer determinism.
- **Inline structured data via microdata / RDFa.** JSON-LD is what the
  PRD § 90 + § 249 calls out, and Google's documentation explicitly
  recommends JSON-LD over inline microdata. A second format would just
  be duplication.

## Out of scope

- **Sitemap `<lastmod>` / `<changefreq>` / `<priority>`** — deferred
  until the schema carries an updatedAt signal (consistent with ADRs
  0004, 0006, 0007).
- **Auto-rendered Open Graph / Twitter Card images** — explicitly out of
  scope for #39 (image generation pipeline is a separate concern).
- **Structured-data validation UI in the editor** — explicitly out of
  scope for #39 ("no editor surface" per the issue body).
- **Search Console submission automation** — explicitly out of scope for
  #39.
- **`Article` / `Course` / `LocalBusiness` / `Product` JSON-LD types** —
  not in the PRD § 249 set. A future feature can extend
  `jsonLdBlobsForPage` without restructuring the boundary.
- **Translated `BreadcrumbList.name`** — uses the page's `navLabel`
  in the page's language. PRD § 109 requires native names, which
  `navLabel` already carries per language.
