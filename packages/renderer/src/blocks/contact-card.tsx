/** @jsxImportSource preact */
import type { ContactCardBlock } from "@sosb/schema";

/**
 * `contactCard` block — issue #13.
 *
 * Two privacy-sensitive contracts this component upholds (binding):
 *
 *  1. **Mailto anti-harvest.** The email address never appears as a
 *     contiguous plain-text substring (no literal `name@domain.tld`, no
 *     `mailto:name@domain.tld`) anywhere in the rendered HTML. The address
 *     is split into its local-part and domain, each base64-encoded
 *     independently, and stamped onto data-* attributes. A small inline
 *     script (~250 bytes, gzipped well under the per-page JS budget)
 *     reassembles the address on the first user gesture (click, focus,
 *     pointerover) and rewrites the link's `href` to `mailto:`. Until that
 *     gesture the link is a no-op decoy. A `<noscript>` fallback gives JS-
 *     less users a reachable channel — but even there we render the address
 *     using HTML numeric character references (`&#x40;` for `@`, individual
 *     codepoints for the rest), which are not contiguous text either, so
 *     naive scrapers still miss them.
 *
 *     ADR 0006 records the technique and its rejected alternatives.
 *
 *  2. **OSM map opt-in.** The default state is no map — there is no
 *     `<iframe>` in the rendered HTML and no third-party network request.
 *     When `mapEmbed.enabled` is true and `mapEmbed.provider` is `"osm"`,
 *     an OpenStreetMap `embed.html` iframe is rendered with `loading="lazy"`
 *     and a meaningful `title`. Google Maps is the explicit opt-in escape
 *     hatch: it is only rendered when the schema also carries
 *     `acknowledgedPrivacyNotice: true`, which the editor only sets after
 *     showing a privacy notice.
 *
 *  Determinism: every URL we emit is derived deterministically from the
 *  schema-supplied coordinates and zoom, so repeated renders are
 *  byte-identical (the existing renderer determinism contract).
 */

interface MapEmbedShape {
  enabled?: unknown;
  provider?: unknown;
  coordinates?: unknown;
  zoom?: unknown;
  acknowledgedPrivacyNotice?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asLatLng(value: unknown): readonly [number, number] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length !== 2) return undefined;
  const [lat, lng] = value;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return [lat, lng] as const;
}

function asZoom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 14;
}

/**
 * Tiny base64 encoder that works in both Node and browser without depending
 * on `Buffer` (which is Node-only) or `btoa` (browser-only). We need this
 * because the renderer must run byte-identical in both environments.
 */
function toBase64(input: string): string {
  // We encode UTF-8 explicitly, then base64. The renderer guarantees
  // determinism, so we hand-roll a small encoder rather than branching on
  // `typeof Buffer` / `typeof btoa`.
  const utf8: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
      i += 1;
    }
    if (codePoint < 0x80) utf8.push(codePoint);
    else if (codePoint < 0x800) {
      utf8.push(0xc0 | (codePoint >> 6));
      utf8.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      utf8.push(0xe0 | (codePoint >> 12));
      utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf8.push(0x80 | (codePoint & 0x3f));
    } else {
      utf8.push(0xf0 | (codePoint >> 18));
      utf8.push(0x80 | ((codePoint >> 12) & 0x3f));
      utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf8.push(0x80 | (codePoint & 0x3f));
    }
  }
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  while (i < utf8.length) {
    const a = utf8[i++]!;
    const b = i < utf8.length ? utf8[i++]! : -1;
    const c = i < utf8.length ? utf8[i++]! : -1;
    const triplet = (a << 16) | ((b !== -1 ? b : 0) << 8) | (c !== -1 ? c : 0);
    out += ALPHA[(triplet >> 18) & 0x3f];
    out += ALPHA[(triplet >> 12) & 0x3f];
    out += b !== -1 ? ALPHA[(triplet >> 6) & 0x3f] : "=";
    out += c !== -1 ? ALPHA[triplet & 0x3f] : "=";
  }
  return out;
}

/**
 * Convert a string to HTML numeric character references so the rendered
 * markup never contains the literal characters. Used by the noscript
 * fallback so even users without JS can reach the email, while a naive
 * scraper that only looks at raw text still misses it.
 */
function toNumericRefs(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    out += `&#${input.charCodeAt(i).toString(10)};`;
  }
  return out;
}

/**
 * The inline reveal script. The script:
 *
 *  - Finds every element with `data-contact-email` inside the current
 *    contactCard.
 *  - On the first interaction, decodes the local + domain parts (atob is
 *    available everywhere we ship to: every modern browser; we never run
 *    this in Node).
 *  - Sets `href = "mailto:<local>@<domain>"` and the rendered text content,
 *    then removes the data-* attributes so it doesn't fire again.
 *  - Until interaction, the link's `href` is the harmless `#` fragment so
 *    no real address sits in the DOM.
 *
 *  The script is injected once at the end of the block and uses `data-
 *  contact-reveal` so the renderer test can find it. It is intentionally
 *  inline (not external) so users who copy a single HTML page get a
 *  self-contained working contactCard.
 *
 *  Note: we use `String.fromCharCode(64)` for the @ character so the
 *  script source itself contains no literal `@` (defence in depth — even
 *  the script body avoids the contiguous email shape).
 */
const REVEAL_SCRIPT =
  '(function(){var els=document.querySelectorAll("[data-contact-email]");for(var i=0;i<els.length;i++){(function(el){function reveal(){var l=el.getAttribute("data-contact-local");var d=el.getAttribute("data-contact-domain");if(!l||!d)return;var addr=atob(l)+String.fromCharCode(64)+atob(d);el.setAttribute("href","mailto:"+addr);el.textContent=addr;el.removeAttribute("data-contact-local");el.removeAttribute("data-contact-domain");}el.addEventListener("click",reveal,{once:true});el.addEventListener("focus",reveal,{once:true});el.addEventListener("pointerover",reveal,{once:true});})(els[i]);}})();';

function buildOsmEmbedUrl(coords: readonly [number, number], zoom: number): string {
  // Compute a small bounding box around the marker. Width/height in degrees
  // shrink as zoom increases — a simple deterministic mapping (no
  // trigonometry): bbox half-size = 0.02 / 2^(zoom-12). We clamp to a
  // sensible minimum so even very high zooms still produce a non-degenerate
  // box for OSM's renderer.
  const halfSize = Math.max(0.0005, 0.02 / Math.pow(2, zoom - 12));
  const [lat, lng] = coords;
  const left = lng - halfSize;
  const right = lng + halfSize;
  const top = lat + halfSize;
  const bottom = lat - halfSize;
  const fmt = (n: number): string => n.toFixed(4);
  // marker= takes lat,lng; bbox= takes left,bottom,right,top (per OSM docs).
  const bbox = `${fmt(left)},${fmt(bottom)},${fmt(right)},${fmt(top)}`;
  const marker = `${fmt(lat)},${fmt(lng)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

function buildGoogleEmbedUrl(coords: readonly [number, number], zoom: number): string {
  // Google's `maps/embed` keyless `view` mode (no API key required).
  // Determinism: identical input → identical URL.
  const [lat, lng] = coords;
  return `https://www.google.com/maps/embed?pb=!1m1!2m1!1d${lat.toFixed(4)}!2d${lng.toFixed(4)}!3i${zoom}`;
}

function ContactSocials(props: {
  socials: ContactCardBlock["data"]["socials"];
}): preact.JSX.Element | null {
  const socials = props.socials;
  if (!Array.isArray(socials) || socials.length === 0) return null;
  return (
    <ul class="contact-card__socials">
      {socials.map((s, idx) => {
        const platform = asString(s.platform) ?? "link";
        const url = asString(s.url);
        if (url === undefined) return null;
        return (
          <li key={`${platform}-${idx}`} class="contact-card__social">
            <a href={url} rel="noopener noreferrer">
              {platform}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function MapEmbed(props: {
  blockId: string;
  mapEmbed: MapEmbedShape | undefined;
}): preact.JSX.Element | null {
  const m = props.mapEmbed;
  if (m === undefined || m.enabled !== true) return null;
  const coords = asLatLng(m.coordinates);
  if (coords === undefined) return null;
  const zoom = asZoom(m.zoom);
  const provider = m.provider;

  if (provider === "osm") {
    const src = buildOsmEmbedUrl(coords, zoom);
    return (
      <div class="contact-card__map" data-map-provider="osm">
        <iframe
          src={src}
          loading="lazy"
          title="Map showing the organisation's location (OpenStreetMap)"
          referrerpolicy="no-referrer"
        />
      </div>
    );
  }

  if (provider === "google") {
    if (m.acknowledgedPrivacyNotice !== true) return null;
    const src = buildGoogleEmbedUrl(coords, zoom);
    return (
      <div class="contact-card__map" data-map-provider="google" data-map-privacy-notice="true">
        <p class="contact-card__map-notice" role="note">
          This map is embedded from Google Maps. Loading it sends your IP address and other browser
          metadata to Google.
        </p>
        <iframe
          src={src}
          loading="lazy"
          title="Map showing the organisation's location (Google Maps)"
          referrerpolicy="no-referrer"
        />
      </div>
    );
  }

  return null;
}

export function ContactCard(props: { block: ContactCardBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const address = asString(data.address);
  const email = asString(data.email);
  const phone = asString(data.phone);
  const mapEmbed = (data as { mapEmbed?: MapEmbedShape }).mapEmbed;

  // Anti-harvest: split + base64 the email, store on data-* attributes,
  // never put the literal address in any text node or attribute.
  let emailLocalB64: string | undefined;
  let emailDomainB64: string | undefined;
  let emailNoscript: string | undefined;
  if (email !== undefined) {
    const atIdx = email.indexOf("@");
    if (atIdx > 0 && atIdx < email.length - 1) {
      emailLocalB64 = toBase64(email.slice(0, atIdx));
      emailDomainB64 = toBase64(email.slice(atIdx + 1));
      // Numeric refs version for the noscript fallback. The literal email
      // never reaches the text stream — only its codepoint references do.
      emailNoscript = toNumericRefs(email);
    }
  }

  // Phone is a tel: link; numbers are far less harvest-targeted than email
  // and the AC scope only obfuscates the email channel.
  const phoneTel = phone !== undefined ? phone.replace(/[^\d+]/g, "") : undefined;

  return (
    <section
      data-block="contactCard"
      data-block-id={id}
      aria-labelledby={`${id}__heading`}
      class="contact-card"
    >
      <div class="contact-card__inner">
        <h2 id={`${id}__heading`} class="contact-card__heading">
          Contact
        </h2>
        {address !== undefined && <address class="contact-card__address">{address}</address>}
        {emailLocalB64 !== undefined && emailDomainB64 !== undefined && (
          <p class="contact-card__email-row">
            <a
              href="#"
              class="contact-card__email"
              data-contact-email=""
              data-contact-local={emailLocalB64}
              data-contact-domain={emailDomainB64}
              aria-label="Reveal contact email and open mail composer"
              rel="noopener noreferrer"
            >
              <span aria-hidden="true">[ click to reveal email ]</span>
            </a>
            {emailNoscript !== undefined && (
              <noscript>
                <span
                  class="contact-card__email-fallback"
                  dangerouslySetInnerHTML={{ __html: emailNoscript }}
                />
              </noscript>
            )}
          </p>
        )}
        {phoneTel !== undefined && (
          <p class="contact-card__phone-row">
            <a href={`tel:${phoneTel}`} class="contact-card__phone">
              {phone}
            </a>
          </p>
        )}
        <ContactSocials socials={data.socials} />
        <MapEmbed blockId={id} mapEmbed={mapEmbed} />
      </div>
      {emailLocalB64 !== undefined && (
        <script data-contact-reveal="" dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
      )}
    </section>
  );
}
