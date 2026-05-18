/**
 * Schema.org JSON-LD emission.
 *
 * Per PRD § 249 / issue #39, every page emits site-level Organization
 * structured data. Pages may additionally emit:
 *
 *   - Person, one per `teamGrid` block member,
 *   - Event, one per `eventList` block item,
 *   - FAQPage, one per `faq` block,
 *   - BreadcrumbList, on non-home pages of multi-page sites.
 *
 * The block-level schemas (`teamGrid`, `eventList`, `faq`) ship in #9-#22.
 * In the meantime this module reads those blocks loosely from the schema's
 * `BlockEnvelope` (`type` discriminates, `data` is `Record<string, unknown>`)
 * so it stays forward-compatible with whatever shape the formal schemas
 * eventually pin. Unknown / malformed entries are skipped silently rather
 * than throwing — the build pipeline's contract is "render what we can,
 * don't crash on unfamiliar data" (PRD § 53 forward-compat).
 *
 * All payloads are emitted as one `<script type="application/ld+json">`
 * block per blob, in a deterministic order:
 *   Organization → Person* → Event* → FAQPage* → BreadcrumbList?
 * which matches Google's sample documents and keeps the per-file golden
 * snapshots stable across runs.
 */

import type { BlockEnvelope, Org, Page, Site } from "@sosb/schema";
import { navPagesFor, pagePath } from "@sosb/renderer";

/**
 * The shape of a single JSON-LD blob ready for emission. Keys are emitted
 * in insertion order (per `JSON.stringify`); insertion order matches a
 * top-down read of the Google schema docs (`@context` / `@type` first).
 */
type JsonLdBlob = Record<string, unknown>;

/**
 * Build all JSON-LD blobs for a single page in deterministic order.
 *
 * @param site    Validated site data.
 * @param page    Page being rendered.
 * @param siteUrl Optional canonical origin (`https://example.org`). When
 *                set, URL-bearing fields (Organization.url / .logo,
 *                Person.image, Event.image, BreadcrumbList.item) are
 *                absolutised. When omitted, relative URLs are emitted —
 *                which Google's Rich Results test still accepts as a
 *                preview, while the production build supplies absolutes.
 */
export function jsonLdBlobsForPage(
  site: Site,
  page: Page,
  siteUrl: string | undefined,
): JsonLdBlob[] {
  const blobs: JsonLdBlob[] = [];
  blobs.push(organizationBlob(site.org, siteUrl));
  for (const block of page.blocks) {
    if (block.type === "teamGrid") {
      blobs.push(...personBlobsFromTeamGrid(block, siteUrl));
    } else if (block.type === "eventList") {
      blobs.push(...eventBlobsFromEventList(block, siteUrl));
    } else if (block.type === "faq") {
      const faq = faqPageBlobFromFaq(block);
      if (faq !== undefined) blobs.push(faq);
    }
  }
  const breadcrumbs = breadcrumbListBlob(site, page, siteUrl);
  if (breadcrumbs !== undefined) blobs.push(breadcrumbs);
  return blobs;
}

/**
 * Render every blob as a `<script type="application/ld+json">…</script>`
 * concatenation. Empty array → empty string (callers may always splice
 * into `<head>` without checking).
 */
export function renderJsonLdScripts(blobs: JsonLdBlob[]): string {
  return blobs.map((blob) => renderJsonLdScript(blob)).join("");
}

function renderJsonLdScript(blob: JsonLdBlob): string {
  // Keep the blob deterministic across rebuilds: the caller controls key
  // insertion order; we serialise without spaces so byte-identity holds.
  const json = JSON.stringify(blob);
  // Defence-in-depth: a string value containing literal "</script>" would
  // close the script tag prematurely. Escape the slash with the standard
  // / so the JSON parses identically but the closing tag never appears.
  // Same trick for "<!--" / "-->" sequences which can also break parsers.
  const safe = json
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/<!--/g, "<\\u0021--")
    .replace(/-->/g, "--\\u003e");
  return `<script type="application/ld+json">${safe}</script>`;
}

function organizationBlob(org: Org, siteUrl: string | undefined): JsonLdBlob {
  const blob: JsonLdBlob = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
  };
  if (siteUrl !== undefined) {
    blob.url = `${siteUrl}/`;
  } else {
    blob.url = "/";
  }
  const logoPath =
    typeof org.logo === "object" &&
    org.logo !== null &&
    typeof (org.logo as { path?: unknown }).path === "string"
      ? (org.logo as { path: string }).path
      : typeof org.logo === "string"
        ? org.logo
        : undefined;
  if (logoPath !== undefined && logoPath.length > 0) {
    blob.logo = absolutiseUrl(siteUrl, logoPath);
  }
  if (typeof org.tagline === "string" && org.tagline.length > 0) {
    blob.description = org.tagline;
  }
  if (typeof org.foundedYear === "number") {
    blob.foundingDate = String(org.foundedYear);
  }
  if (typeof org.email === "string" && org.email.length > 0) {
    blob.email = org.email;
  }
  if (typeof org.phone === "string" && org.phone.length > 0) {
    blob.telephone = org.phone;
  }
  if (typeof org.address === "string" && org.address.length > 0) {
    blob.address = {
      "@type": "PostalAddress",
      streetAddress: org.address,
    };
  }
  const social = org.social;
  if (Array.isArray(social) && social.length > 0) {
    const sameAs = social
      .map((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return undefined;
        const url = (entry as { url?: unknown }).url;
        return typeof url === "string" && url.length > 0 ? url : undefined;
      })
      .filter((u): u is string => u !== undefined);
    if (sameAs.length > 0) blob.sameAs = sameAs;
  }
  return blob;
}

function personBlobsFromTeamGrid(
  block: BlockEnvelope,
  siteUrl: string | undefined,
): JsonLdBlob[] {
  const data = block.data as { people?: unknown };
  if (!Array.isArray(data.people)) return [];
  const blobs: JsonLdBlob[] = [];
  for (const person of data.people as unknown[]) {
    if (typeof person !== "object" || person === null) continue;
    const m = person as Record<string, unknown>;
    if (typeof m.name !== "string" || m.name.length === 0) continue;
    const blob: JsonLdBlob = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: m.name,
    };
    if (typeof m.role === "string" && m.role.length > 0) {
      blob.jobTitle = m.role;
    }
    // Schema migrated `image: string` → `photo: AssetRef`. The renderable URL
    // lives at `photo.path`; schema.org's Person.image stays a single string.
    if (typeof m.photo === "object" && m.photo !== null) {
      const path = (m.photo as { path?: unknown }).path;
      if (typeof path === "string" && path.length > 0) {
        blob.image = absolutiseUrl(siteUrl, path);
      }
    }
    blobs.push(blob);
  }
  return blobs;
}

function eventBlobsFromEventList(
  block: BlockEnvelope,
  siteUrl: string | undefined,
): JsonLdBlob[] {
  const data = block.data as { events?: unknown };
  if (!Array.isArray(data.events)) return [];
  const blobs: JsonLdBlob[] = [];
  for (const event of data.events as unknown[]) {
    if (typeof event !== "object" || event === null) continue;
    const e = event as Record<string, unknown>;
    // Schema field names: `title` (not `name`), `startsAt` / `endsAt` (not
    // `startDate` / `endDate`). The output JSON-LD field names follow
    // schema.org's Event vocabulary (`name`, `startDate`, `endDate`).
    if (typeof e.title !== "string" || e.title.length === 0) continue;
    if (typeof e.startsAt !== "string" || e.startsAt.length === 0) continue;
    const blob: JsonLdBlob = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: e.title,
      startDate: e.startsAt,
    };
    if (typeof e.endsAt === "string" && e.endsAt.length > 0) {
      blob.endDate = e.endsAt;
    }
    if (typeof e.location === "string" && e.location.length > 0) {
      blob.location = {
        "@type": "Place",
        name: e.location,
      };
    }
    const eventImagePath =
      typeof e.image === "object" &&
      e.image !== null &&
      typeof (e.image as { path?: unknown }).path === "string"
        ? (e.image as { path: string }).path
        : typeof e.image === "string"
          ? e.image
          : undefined;
    if (eventImagePath !== undefined && eventImagePath.length > 0) {
      blob.image = absolutiseUrl(siteUrl, eventImagePath);
    }
    if (typeof e.description === "string" && e.description.length > 0) {
      blob.description = e.description;
    }
    blobs.push(blob);
  }
  return blobs;
}

function faqPageBlobFromFaq(block: BlockEnvelope): JsonLdBlob | undefined {
  const data = block.data as { items?: unknown };
  if (!Array.isArray(data.items) || data.items.length === 0) return undefined;
  const mainEntity: JsonLdBlob[] = [];
  for (const item of data.items as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const it = item as Record<string, unknown>;
    if (typeof it.question !== "string" || it.question.length === 0) continue;
    if (typeof it.answer !== "string" || it.answer.length === 0) continue;
    mainEntity.push({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.answer,
      },
    });
  }
  if (mainEntity.length === 0) return undefined;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

/**
 * BreadcrumbList for the active page. Emits two crumbs (home → active page)
 * when the active page's nav has more than one entry. Single-page sites and
 * the home page itself emit nothing — there's no breadcrumb depth to
 * advertise.
 *
 * Slugs are not nested in v1 (PRD § 195) so the breadcrumb is always
 * `home → page`. When #25 / a future feature introduces nesting, this
 * function gains intermediate crumbs without changing its callers.
 */
function breadcrumbListBlob(
  site: Site,
  page: Page,
  siteUrl: string | undefined,
): JsonLdBlob | undefined {
  const navPages = navPagesFor(site, page);
  if (navPages.length <= 1) return undefined;
  const activeHref = pagePath(site, page);
  // Find the language home (navOrder=0 in this language) for the first crumb.
  const home = navPages.find((p) => p.navOrder === 0) ?? navPages[0]!;
  const homeHref = pagePath(site, home);
  if (homeHref === activeHref) return undefined;
  const homeUrl = siteUrl === undefined ? homeHref : `${siteUrl}${homeHref}`;
  const activeUrl = siteUrl === undefined ? activeHref : `${siteUrl}${activeHref}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: home.navLabel,
        item: homeUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.navLabel,
        item: activeUrl,
      },
    ],
  };
}

/**
 * Resolve a possibly-relative reference (e.g. `assets/foo.jpg`) against the
 * site origin. Absolute URLs (`http:`, `https:`, `//`) are passed through
 * unchanged. When `siteUrl` is undefined the reference is returned verbatim
 * (relative-form fallback).
 */
function absolutiseUrl(siteUrl: string | undefined, ref: string): string {
  if (siteUrl === undefined) return ref;
  if (/^https?:\/\//i.test(ref) || ref.startsWith("//")) return ref;
  if (ref.startsWith("/")) return `${siteUrl}${ref}`;
  return `${siteUrl}/${ref}`;
}
