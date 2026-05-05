# 0006 — contactCard: mailto anti-harvest and map-embed privacy

- **Status:** Accepted
- **Date:** 2026-05-05
- **Issue:** #13

## Context

Issue #13 asks for the `contactCard` block. The PRD calls out two privacy
contracts in the block library section that this issue must meet:

> Email in `contactCard` uses JS-reveal anti-harvest. Map embed defaults to
> OpenStreetMap; Google Maps is opt-in with privacy notice.

Both lines are load-bearing security/privacy decisions. They impose hard
contracts on the renderer's HTML output:

1. The plain-text email address must NOT appear in the rendered HTML, in any
   form a naive scraper could pick up — no `name@domain.tld` substring, no
   `mailto:name@domain.tld` URL. A real human visitor must still be able to
   open their mail client with one click. Screen-reader users must still
   understand the affordance.
2. Embedded maps must NOT issue any third-party network request unless the
   site author explicitly opts in. OpenStreetMap is the privacy-friendly
   default option (no API key, no Google contact). Google Maps is the opt-in
   escape hatch and requires a visible privacy notice both in the editor (so
   the author understands the trade-off) and on the published site (so
   visitors do).

The PRD does not pin the specific anti-harvest technique or the specific
map-URL strategy. This ADR records those choices.

## Decision

### Mailto anti-harvest: split-base64 + JS reveal + numeric-ref noscript

The address is split into local-part and domain at the `@` character. Each
half is base64-encoded independently and stamped onto a clickable element as
two separate `data-*` attributes (`data-contact-local`, `data-contact-domain`).
A 250-byte inline script reassembles the address on the first user gesture
(`click` / `focus` / `pointerover`) and rewrites the link's `href` to
`mailto:<local>@<domain>`, then removes the data-\* attributes so it doesn't
fire again. Until the gesture, the link's `href` is `#` — a harmless decoy.

The reveal script source itself avoids the literal `@` character: it uses
`String.fromCharCode(64)` to assemble the separator. This is defence in
depth: even pattern-matching scrapers that scan inline-script bodies for
`name@domain` patterns find nothing.

For users without JavaScript, a `<noscript>` fallback renders the address as
a string of HTML numeric character references (`&#99;` for `c`, `&#64;` for
`@`, etc.). These render as the literal address in the browser's accessibility
tree but are not stored as contiguous text in the document — naive scrapers
that read the raw HTML markup miss the address entirely, while users who
genuinely browse without JS get an addressable contact channel.

The interactive control carries an explicit `aria-label` ("Reveal contact
email and open mail composer"). This is the assistive-technology contract —
screen readers announce a real sentence describing what the button does;
they don't read the obfuscated visible text. The visible text inside the
button is `[ click to reveal email ]` wrapped in `aria-hidden="true"` so it
isn't double-announced.

#### Why split-base64 over alternatives

Considered and rejected:

- **Single base64 of the whole address.** Reverses to plain text in one
  `atob()` call, but a naive scraper that decodes base64 patterns finds the
  address. Splitting at `@` means even a base64-aware scraper has to
  reassemble two strings with knowledge of the data-attribute schema; the
  cost-per-address goes up enough that drive-by harvesters skip it.
- **ROT13 / Caesar cipher.** Trivial for harvesters to undo (they were
  already undoing rot13 in the early 2000s). Does not satisfy "no plain text
  in the HTML" because the cipher form is one substitution away from the
  address.
- **Embed an image of the address.** Defeats screen readers, defeats the
  one-click `mailto:` flow, defeats copy-paste. Hostile to visually-impaired
  users.
- **Use a contact form.** Out of scope — the PRD pins "no contact forms" for
  v1 explicitly. Also a contact form means a backend, which we don't have.
- **CSS `unicode-bidi` / `direction: rtl` tricks (write address backwards
  visually).** Visible address still in the DOM; trivially defeated by
  scrapers that read text content.
- **Cloudflare-style email obfuscation.** Requires a runtime helper and an
  external service that knows the address. We don't have a backend; the
  user's published site must work standalone.

The split-base64 + JS-reveal approach is the standard pattern used by sites
like the Apache Foundation and most open-source project sites. It's
well-understood, requires no third-party service, and degrades gracefully
to the noscript fallback.

### Map embed: opt-in by default, OSM keyless, Google opt-in with notice

The schema carries a `mapEmbed` envelope:

```ts
mapEmbed?: {
  enabled: boolean;
  provider: "osm" | "google";
  coordinates?: [number, number];   // [lat, lng] in degrees
  zoom?: number;                    // 1..20
  acknowledgedPrivacyNotice?: boolean; // required for google
}
```

The renderer emits an `<iframe>` only when `enabled === true` AND
`coordinates` is well-formed AND (for Google) `acknowledgedPrivacyNotice ===
true`. Any other state results in zero iframes and zero third-party network
requests. The default — no `mapEmbed` field at all — is the privacy-safe
state.

#### OSM URL strategy

We embed `https://www.openstreetmap.org/export/embed.html` with:

- `bbox=<left>,<bottom>,<right>,<top>` (degrees, four decimals)
- `layer=mapnik` (default OSM tile layer)
- `marker=<lat>,<lng>` to pin the location

The bounding box is computed deterministically from `coordinates` and
`zoom`: `halfSize = max(0.0005, 0.02 / 2^(zoom - 12))`. This is a simple
algebraic mapping — no trigonometry, no environment-dependent math — so the
URL is byte-identical across Node and browser environments, satisfying the
renderer's determinism contract.

OSM's `embed.html` requires no API key. The iframe carries `loading="lazy"`
(no fetch until the user scrolls it into view), `referrerpolicy="no-referrer"`
(no Referer header leaking the publishing site to OSM), and a meaningful
`title` so screen readers announce "Map showing the organisation's location
(OpenStreetMap)".

#### Google URL strategy

When the author has explicitly opted in and acknowledged the privacy notice,
we embed `https://www.google.com/maps/embed` in keyless `view` mode with
`pb=` parameters constructed deterministically from coordinates and zoom.
The iframe carries the same `loading="lazy"`, `referrerpolicy="no-referrer"`,
and meaningful `title` attributes as the OSM variant.

Above the iframe we render a visible privacy notice (`<p
data-map-privacy-notice="true" role="note">`) telling the visitor that
loading the map sends their IP and browser metadata to Google. The
`data-map-privacy-notice` attribute is a stable hook the renderer's test
suite checks for; the prose can be themed later without breaking the
contract.

Considered and rejected:

- **Render the OSM iframe by default for any contactCard with an address.**
  Surfacing a third-party request without explicit author opt-in violates
  the PRD's "Telemetry: none" stance for built sites. The author has to
  flip a flag — the editor surfaces the OSM toggle in the form, which is
  not yet wired (out of scope here, lands with #9-#22 block forms).
- **Allow Mapbox / Leaflet / generic provider URL.** The triage note pinned
  scope to OSM + Google Maps only. Other providers, including self-hosted
  tile servers, are out of scope for v1.
- **Use `<img>` static-map tiles instead of iframes.** OSM's static-map
  service is rate-limited and not a stable public API; Google's static-map
  needs an API key, which the author would have to embed in their built
  site. The iframe approach avoids both problems.
- **Render a Google Maps embed without the privacy-notice gate.** Violates
  the PRD's "Google Maps is opt-in with privacy notice" wording. The schema
  enforces the gate so the renderer is correct by construction: even if a
  buggy editor wrote `enabled=true, provider=google` without the
  acknowledgement flag, the renderer refuses to emit the iframe and
  validation reports the missing flag as an error.

### Schema-level privacy gate

The schema's `MapEmbedSchema` is a `looseObject` with a `superRefine` that
emits a `custom` issue when:

- `enabled === true` and `coordinates` is missing, OR
- `enabled === true` and `provider === "google"` and
  `acknowledgedPrivacyNotice !== true`.

Both fire as `error`-severity validation issues with paths
`["coordinates"]` / `["acknowledgedPrivacyNotice"]` so the editor can
surface them inline. This means:

- A misconfigured Google Maps embed cannot pass `validate()` cleanly, even
  if the editor's UI is buggy.
- The renderer trusts validated input but defends-in-depth by re-checking
  the flag at render time (a redundancy the rest of the renderer does too).

A second, softer rule fires as a `warning`: a contactCard with neither
`email` nor `phone` is a low-quality card. Address-only cards still publish
(per the PRD's severity model — warnings never block), but the editor
surfaces a nudge to add a reachable channel. This is the layered "schema
parse = errors / quality nudges = warnings" contract from ADR 0002 applied
to the new block.

## Rationale

The most subtle requirement is "does NOT contain the plain-text email
substring anywhere in the HTML". Naive implementations that look correct
fail this on close inspection:

- A `mailto:` link with `display: none` still has the address in the DOM.
- A JS-only reveal that stores the address in a string-literal inside the
  inline script puts the address in the rendered HTML (the script body is
  HTML-text).
- A reveal that decodes a single base64 string still contains the
  base64-encoded full address — a base64-aware scraper extracts it.

The split-base64 approach is the only one we found that survives all three
of these lenses:

- Local + domain are stored on separate attributes.
- The reveal script body decodes them and joins with a `String.fromCharCode`
  — no `@` literal anywhere.
- Even after `atob()` the local part is just `"contact"` and the domain is
  just `"example.org"`; neither is harvestable on its own without
  reassembly logic.

The renderer asserts the contract via three layered tests:

1. `expect(html).not.toContain("contact@example.org")` — the literal address.
2. `expect(html).not.toContain("@example.org")` — the contiguous tail.
3. The reveal script body is extracted and the same assertions are run
   against just the script body, so a regression that puts the address back
   into the script (a common refactor mistake) is caught.

The map-embed default is the more straightforward call: the PRD pinned it
verbatim. The schema-level gate on `acknowledgedPrivacyNotice` is the
non-obvious part — putting the gate in the schema rather than just the
renderer means a published `data.json` is auditable: a reviewer can grep
for `"provider": "google"` and check that every match has the
acknowledgement flag set.

## Consequences

- `@sosb/schema` exports a new `ContactCardBlockSchema`, `ContactCardData`,
  `ContactCardMapEmbed` type, and `CONTACT_CARD_BLOCK_VERSION = 1` constant.
- `KnownBlockSchemas` registry now contains two entries; `runBlockRules`
  uses an explicit case-per-type with a defensive `as never` exhaustiveness
  guard. Future blocks (#9-#12, #14-#22) follow the same pattern.
- `@sosb/renderer` ships a new `ContactCard` component registered in
  `page-shell.tsx`'s `renderBlock` dispatcher.
- The stub theme's CSS gains a `[data-block="contactCard"]` block of
  layout-only rules — every value is `var(--token)` or a structural
  primitive, satisfying the "no raw colours outside `:root`" lint that the
  renderer test suite enforces.
- The renderer test suite gains 38 new tests across `contact-card.test.ts`,
  `contact-card-accessibility.test.ts`, `contact-card-golden.test.ts`, and
  `contact-card-block.test.ts`, all green.
- Two new golden files land in `packages/renderer/test/__golden__/`:
  `stub-theme-contact-card.html` and `stub-theme-contact-card-osm.html`.
  The files are deterministic per the renderer's existing contract.
- The OSM iframe issues no network request until scrolled into view (`loading="lazy"`).

## Alternatives considered

- **Bake the JS-reveal script into the renderer's `<head>` once, instead of
  per-block.** Saves bytes when many contactCards exist. We chose
  per-block-self-contained for v1 because most sites have at most one
  contactCard, and the inline approach means a single-file HTML export of
  one page works without dependencies. Easy to refactor if the editor ever
  adds a "global JS" emission seam.
- **Use SVG instead of HTML numeric refs in the noscript fallback.** Defeats
  copy-paste; SVG text is not selectable in many browsers' accessibility
  modes. Numeric refs are universally understood.
- **Encode the email at the Zod schema layer (parse → encoded value).**
  Would mean the parsed data is `{ emailLocal: "Y29udGFjdA==",
emailDomain: "ZXhhbXBsZS5vcmc=" }` instead of `email: "contact@example.org"`.
  This bleeds an output concern into the data layer; the editor form would
  also have to think about it. We keep the schema clean and obfuscate at
  render time.
- **Disable `mapEmbed` entirely for v1.** Would shrink scope but
  contactCards without maps are visibly worse for the
  university-organisation use case the PRD targets. The opt-in default
  preserves privacy without removing the feature.

## Out of scope

- The contactCard editor form (the auto-generated form scaffold is owned
  by #7's form generator; per-block editor extensions for the privacy
  notice live with #9-#22).
- The Google-Maps privacy-notice copy is intentionally generic English —
  i18n into Romanian and other languages lands with #34.
- Per-theme variants of the contactCard layout — themes #28-#31 + #47
  customise via tokens; no per-theme component variants planned for this
  block.
- Static-map fallback for locked-down environments that block iframes —
  out of scope for v1.
