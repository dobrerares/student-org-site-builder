/**
 * Shared layout polish for real, user-facing themes.
 *
 * The stub theme remains a renderer sentinel and golden-test fixture. This
 * layer is composed only for production themes so generated sites get a
 * cleaner default layout across all blocks without changing the stub contract.
 */
export const PRODUCTION_SITE_BASE_CSS = `
:root {
  --site-max-width: 72rem;
  --site-wide-width: 84rem;
  --site-readable-width: 46rem;
}
main {
  display: block;
  overflow: hidden;
}
main > [data-block] {
  position: relative;
  box-sizing: border-box;
}
/*
 * Universal contrast-safe body links. Text color comes from --color-link (the
 * engine derives this to the accent where it clears WCAG AA on the bg, else the
 * dark brand primary), so link TEXT always meets AA in every theme and under any
 * user color override. The accent still does the work visually as the underline,
 * preserving theme identity. Hover thickens the underline rather than switching
 * the text to the (possibly low-contrast) accent, so contrast never drops.
 * Single source of truth: per-theme bare-anchor color rules now consume
 * --color-link too, so this wins; it is scoped to content links and leaves
 * nav/language-switcher link colors alone.
 */
[data-block] a {
  color: var(--color-link);
  text-decoration-line: underline;
  text-decoration-color: var(--color-accent);
  text-underline-offset: 0.15em;
}
[data-block] a:hover {
  text-decoration-thickness: 2px;
}
[data-block] > :is(
  .hero__inner,
  .ctaBanner__inner,
  .value-list__inner,
  .activities-list__inner,
  .contact-card__inner,
  .team-grid__inner,
  .faq__inner,
  .partner-logos__inner,
  .document-downloads__inner
) {
  width: min(100%, var(--site-max-width));
  margin-inline: auto;
}
[data-block="richText"] .rich-text,
[data-block="quote"] {
  width: min(100%, var(--site-readable-width));
  margin-inline: auto;
}
[data-block="event-list"] > :is(.event-list__title, .event-list__intro, .event-list__items),
[data-block="imageGallery"] > :is(.image-gallery__title, .image-gallery__grid) {
  width: min(100%, var(--site-max-width));
  margin-inline: auto;
}
[data-block] :is(
  .value-list__title,
  .activities-list__title,
  .contact-card__heading,
  .team-grid__title,
  .faq__title,
  .document-downloads__title,
  .event-list__title,
  .image-gallery__title,
  .partner-logos__title,
  .ctaBanner__title
) {
  line-height: 1.15;
}
[data-block] img {
  max-width: 100%;
}
[data-block="valueList"] .value-list__intro,
[data-block="activitiesList"] .activities-list__intro,
[data-block="teamGrid"] .team-grid__intro,
[data-block="documentDownloads"] .document-downloads__intro,
[data-block="event-list"] .event-list__intro {
  max-width: var(--site-readable-width);
}
/* Card-like blocks get a quiet surface tint (a faint shade of the bg) instead
 * of a hard slate border — soft and defined, no boxy outline. Content-only
 * blocks (value-list, team) stay borderless and lean on whitespace + grid gap;
 * faq keeps its hairline row dividers (stub). */
[data-block="activitiesList"] .activities-list__item,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="event-list"] .event-list__item article {
  background: var(--color-surface);
  border: 0;
  box-sizing: border-box;
}
[data-block="documentDownloads"] .document-downloads__item {
  padding: var(--space-md);
}
/* Real CSS grid honoring the author's column count, with incomplete rows
 * LEFT-aligned (no centred-orphan-row look) and a responsive collapse. */
[data-block="valueList"][data-layout="grid"] .value-list__items {
  display: grid;
  gap: var(--space-lg);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
}
[data-block="valueList"][data-layout="grid"][data-columns="1"] .value-list__items {
  grid-template-columns: 1fr;
}
[data-block="valueList"][data-layout="grid"][data-columns="2"] .value-list__items {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
[data-block="valueList"][data-layout="grid"][data-columns="4"] .value-list__items {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
@media (max-width: 60rem) {
  [data-block="valueList"][data-layout="grid"][data-columns="3"] .value-list__items,
  [data-block="valueList"][data-layout="grid"][data-columns="4"] .value-list__items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 40rem) {
  [data-block="valueList"][data-layout="grid"] .value-list__items {
    grid-template-columns: 1fr;
  }
}
[data-block="activitiesList"] .activities-list__body,
[data-block="event-list"] .event-list__item article {
  display: grid;
  gap: var(--space-sm);
}
[data-block="hero"] .hero__media img,
[data-block="activitiesList"] .activities-list__media img,
[data-block="event-list"] .event-list__item-media img,
[data-block="teamGrid"] .team-person__photo,
[data-block="imageGallery"] .image-gallery__trigger img,
[data-block="imageGallery"] .image-gallery__figure > img {
  display: block;
  width: 100%;
}
/* Compact circular avatar (photo or initials), not a full-width slab. */
[data-block="teamGrid"] .team-person__photo,
[data-block="teamGrid"] .team-person__avatar {
  width: 4.5rem;
  height: 4.5rem;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}
[data-block="teamGrid"] .team-person__avatar {
  color: var(--color-on-accent);
  font-size: 1.35rem;
}
[data-block="teamGrid"] .team-person__role {
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}
[data-block="teamGrid"] .team-person__bio {
  margin-top: var(--space-xs);
}
[data-block="teamGrid"] .team-person__social {
  display: inline-block;
  width: auto;
  height: auto;
  background: transparent;
  font-size: 0.8125rem;
}
[data-block="teamGrid"] .team-person__social::after {
  content: attr(data-platform);
}
[data-block="activitiesList"] .activities-list__media,
[data-block="event-list"] .event-list__item-media,
[data-block="imageGallery"] .image-gallery__figure {
  background: var(--color-muted);
}
[data-block="contactCard"] a,
[data-block="documentDownloads"] a,
[data-block="event-list"] a,
[data-block="activitiesList"] a {
  overflow-wrap: anywhere;
}
[data-block="partnerLogos"] .partner-logos__item {
  min-height: 5rem;
  padding: var(--space-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
[data-block="hero"] .hero__title,
[data-block] :is(
  .contact-card__heading,
  .value-list__title,
  .activities-list__title,
  .team-grid__title,
  .faq__title,
  .document-downloads__title,
  .event-list__title,
  .image-gallery__title,
  .partner-logos__title,
  .ctaBanner__title
) {
  overflow-wrap: anywhere;
  hyphens: auto;
}
[data-block] :is(.hero__subtitle, .rich-text, .quote) {
  overflow-wrap: anywhere;
}
[data-block="hero"] .hero__media img,
[data-block="imageGallery"] .image-gallery__figure > img,
[data-block="imageGallery"] .image-gallery__trigger img,
[data-block="activitiesList"] .activities-list__media img,
[data-block="event-list"] .event-list__item-media img {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  height: auto;
}
[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="hero"] .hero__title {
  font-size: var(--type-3xl);
  line-height: 1.08;
  color: var(--color-primary);
  max-width: var(--measure-title);
  margin: 0 0 var(--space-md);
}
[data-block="hero"] .hero__subtitle {
  font-size: var(--type-lg);
  line-height: 1.5;
  color: var(--color-fg);
  max-width: var(--measure-body);
  margin: 0;
}
[data-block="hero"].hero--has-image {
  position: relative;
  display: grid;
  align-items: end;
  min-height: clamp(20rem, 13rem + 32vw, 34rem);
  overflow: hidden;
  isolation: isolate;
}
[data-block="hero"].hero--has-image .hero__media {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  overflow: hidden;
}
[data-block="hero"].hero--has-image .hero__media img {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
  display: block;
}
[data-block="hero"].hero--has-image .hero__media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(var(--color-fg-rgb), 0.85) 0%,
    rgba(var(--color-fg-rgb), 0.5) 45%,
    rgba(var(--color-fg-rgb), 0.2) 100%
  );
}
[data-block="hero"].hero--has-image .hero__inner {
  position: relative;
  z-index: 1;
}
[data-block="hero"].hero--has-image .hero__title,
[data-block="hero"].hero--has-image .hero__subtitle {
  color: var(--color-on-image);
  text-shadow: 0 1px 3px rgba(var(--color-fg-rgb), 0.5);
}
@media (max-width: 640px) {
  [data-block] {
    padding-left: var(--space-md);
    padding-right: var(--space-md);
  }
  [data-block="imageGallery"] .image-gallery__grid,
  [data-block="imageGallery"][data-layout="masonry"] .image-gallery__grid,
  [data-block="teamGrid"] .team-grid__list {
    display: grid;
    grid-template-columns: 1fr;
    column-count: 1;
  }
}
`.trim();
