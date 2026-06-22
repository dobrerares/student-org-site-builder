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
html {
  min-height: 100%;
}
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
body > main {
  flex: 1 0 auto;
}
body > [data-block="siteFooter"] {
  flex: 0 0 auto;
}
main {
  display: block;
  overflow: hidden;
}
main > [data-block] {
  position: relative;
  box-sizing: border-box;
}
[data-site-nav] {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--color-bg);
}
[data-site-nav] .site-nav__inner {
  width: min(100%, var(--site-max-width));
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}
[data-site-nav] .site-nav__brand {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  text-decoration: none;
}
[data-site-nav] .site-nav__logo {
  display: block;
  width: 3rem;
  height: 3rem;
  object-fit: contain;
}
[data-site-nav] ul {
  margin: 0;
  padding: 0;
  justify-content: flex-end;
}
[data-site-nav] .site-nav__inner ul {
  max-width: none;
  margin-inline: 0;
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
  .document-downloads__inner,
  .site-footer__inner
) {
  width: min(100%, var(--site-max-width));
  margin-inline: auto;
}
[data-block="richText"] .rich-text,
[data-block="quote"] {
  width: min(100%, var(--site-readable-width));
  margin-inline: auto;
}
[data-block="richText"] .rich-text > :is(p, ul, ol, blockquote, h2, h3, h4) {
  max-width: none;
}
[data-block="richText"][data-title-align="left"] .rich-text :is(h2, h3, h4),
[data-block="richText"][data-paragraph-align="left"] .rich-text :is(p, ul, ol, blockquote) {
  text-align: left;
}
[data-block="richText"][data-title-align="center"] .rich-text :is(h2, h3, h4),
[data-block="richText"][data-paragraph-align="center"] .rich-text :is(p, ul, ol, blockquote) {
  text-align: center;
}
[data-block="richText"][data-title-align="right"] .rich-text :is(h2, h3, h4),
[data-block="richText"][data-paragraph-align="right"] .rich-text :is(p, ul, ol, blockquote) {
  text-align: right;
}
[data-block="richText"][data-title-align="justify"] .rich-text :is(h2, h3, h4),
[data-block="richText"][data-paragraph-align="justify"] .rich-text :is(p, ul, ol, blockquote) {
  text-align: justify;
  text-align-last: left;
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
  .site-footer__title,
  .site-footer__heading,
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
/* === Centered card grids ===
 * Multi-item blocks lay out as a flex-wrap that fills full rows edge-to-edge
 * but CENTERS an incomplete final row — so a leftover item is balanced under
 * the row above instead of stranded at the left (the orphan problem). Each
 * container declares its column count (--grid-cols, honoring the author's
 * choice), a gap, and a per-card minimum; the shared item rule derives the
 * flex-basis from them. The min inside max() lets columns gracefully reduce on
 * narrow viewports with no media queries — the grid adapts to the available
 * space AND the item count. */
[data-block="valueList"][data-layout="grid"] .value-list__items,
[data-block="teamGrid"] .team-grid__list,
[data-block="activitiesList"][data-layout="cards"] .activities-list__items,
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  --grid-cols: 3;
  --grid-gap: var(--space-lg);
  --grid-min: 14rem;
  gap: var(--grid-gap);
}
[data-block="valueList"][data-layout="grid"] .value-list__item,
[data-block="teamGrid"] .team-person,
[data-block="activitiesList"][data-layout="cards"] .activities-list__item,
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__item {
  flex: 0 1
    max(
      var(--grid-min),
      calc((100% - (var(--grid-cols) - 1) * var(--grid-gap)) / var(--grid-cols))
    );
  min-width: 0;
}
[data-block="valueList"][data-layout="grid"][data-columns="1"] .value-list__items {
  --grid-cols: 1;
}
[data-block="valueList"][data-layout="grid"][data-columns="2"] .value-list__items {
  --grid-cols: 2;
}
[data-block="valueList"][data-layout="grid"][data-columns="4"] .value-list__items {
  --grid-cols: 4;
}
[data-block="valueList"] .value-list__item {
  text-align: center;
}
[data-block="valueList"] .value-list__icon {
  display: flex;
  justify-content: center;
  margin-inline: auto;
}
[data-block="valueList"] .value-list__label {
  max-width: 18rem;
  margin-inline: auto;
  font-size: var(--type-md);
  line-height: 1.2;
  text-wrap: balance;
}
[data-block="valueList"] .value-list__description {
  margin-inline: auto;
  max-width: 18rem;
  text-align: center;
}
[data-block="teamGrid"] .team-grid__list {
  --grid-cols: var(--team-grid-columns, 3);
  --grid-min: 13rem;
}
[data-block="activitiesList"][data-layout="cards"] .activities-list__items {
  --grid-min: 16rem;
}
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list {
  --grid-gap: var(--space-md);
  --grid-min: 17rem;
}
[data-block="activitiesList"] .activities-list__body,
[data-block="event-list"] .event-list__item article {
  display: grid;
  gap: var(--space-sm);
  /* Pack content to the top so equal-height cards (a short 2-line title next to
   * a 3-line one) don't stretch their rows — which otherwise inflates a small
   * fixed item like the badge to fill the slack. Spare space sits at the bottom. */
  align-content: start;
}
[data-block="activitiesList"] .activities-list__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}
[data-block="activitiesList"] .activities-list__item-title {
  order: 1;
}
[data-block="activitiesList"] .activities-list__description {
  order: 2;
}
[data-block="activitiesList"] .activities-list__badge {
  order: 10;
  align-self: center;
  justify-self: center;
  margin-top: auto;
  text-align: center;
}
[data-block="activitiesList"] .activities-list__cta {
  order: 11;
  align-self: center;
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
  width: 7rem;
  height: 7rem;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}
[data-block="teamGrid"] .team-person__figure,
[data-block="teamGrid"] .team-person__caption {
  align-items: center;
  text-align: center;
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
[data-block="event-list"] .event-list__item-media {
  aspect-ratio: 16 / 9;
  background: var(--color-muted);
  overflow: hidden;
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
[data-block="partnerLogos"][data-presentation="footer"] {
  padding: var(--space-lg) var(--space-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
}
[data-block="partnerLogos"][data-presentation="footer"] .partner-logos__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-md) var(--space-lg);
}
[data-block="partnerLogos"][data-presentation="footer"] .partner-logos__title {
  margin: 0;
  color: var(--color-on-primary);
  font-size: var(--type-base);
}
[data-block="partnerLogos"][data-presentation="footer"] .partner-logos__grid {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-md);
}
[data-block="partnerLogos"][data-presentation="footer"] .partner-logos__item {
  min-height: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
}
[data-block="partnerLogos"][data-presentation="footer"] .partner-logos__logo {
  height: 2.5rem;
  filter: brightness(0) invert(1);
}
/* Contact card: map alongside an icon-chip channel list. Two columns when a map
 * actually renders, a single full-width column otherwise; stacks on narrow
 * viewports. Chips paint with the theme primary so they carry theme identity. */
[data-block="contactCard"] .contact-card__layout--with-map {
  /* fit-content caps the channel column so a long unbreakable value (e.g. the
   * JS-revealed email, a single space-less token) wraps via overflow-wrap
   * instead of blowing out the track and crushing/clipping the map. It still
   * shrinks to content when short, keeping the layout tight. */
  grid-template-columns: minmax(0, 1fr) fit-content(26rem);
  align-items: start;
  gap: var(--space-lg);
}
[data-block="contactCard"] .contact-card__channels {
  gap: var(--space-md);
}
[data-block="contactCard"] .contact-card__map {
  height: 100%;
}
[data-block="contactCard"] .contact-card__map iframe {
  min-height: 20rem;
  height: 100%;
}
[data-block="ctaBanner"].ctaBanner--solid {
  background: var(--color-bg);
  color: var(--color-fg);
}
[data-block="ctaBanner"].ctaBanner--solid .ctaBanner__title {
  color: var(--color-primary);
}
[data-block="ctaBanner"].ctaBanner--solid .ctaBanner__subtitle {
  color: var(--color-fg);
}
[data-block="ctaBanner"].ctaBanner--solid .ctaBanner__button--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
}
[data-block="ctaBanner"].ctaBanner--solid .ctaBanner__button--secondary {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
[data-block="siteFooter"] {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
[data-block="siteFooter"] .site-footer__inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-lg) var(--space-xl);
}
[data-block="siteFooter"] .site-footer__title,
[data-block="siteFooter"] .site-footer__heading {
  color: var(--color-on-primary);
}
[data-block="siteFooter"] .site-footer__title {
  grid-column: 1 / -1;
}
[data-block="siteFooter"] .site-footer__contact {
  min-width: min(100%, 26rem);
}
[data-block="siteFooter"] .site-footer__contact-list {
  justify-content: flex-start;
  gap: var(--space-xs) var(--space-md);
}
[data-block="siteFooter"] .site-footer__contact-item {
  min-width: 0;
}
[data-block="siteFooter"] .site-footer__contact-icon {
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-on-primary) 14%, transparent);
  color: var(--color-on-primary);
}
[data-block="siteFooter"] .site-footer__link,
[data-block="siteFooter"] .site-footer__membership-link {
  color: var(--color-on-primary);
  text-decoration-color: color-mix(in srgb, var(--color-on-primary) 65%, transparent);
}
[data-block="siteFooter"] .site-footer__address {
  color: var(--color-on-primary);
}
[data-block="siteFooter"] .site-footer__membership {
  margin-inline-start: auto;
  max-width: min(100%, 28rem);
  text-align: right;
}
[data-block="siteFooter"] .site-footer__membership-link {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-sm) var(--space-md);
}
[data-block="siteFooter"] .site-footer__membership-text {
  font-weight: 700;
  max-width: 16rem;
}
[data-block="siteFooter"] .site-footer__membership-logo {
  height: clamp(2.5rem, 5vw, 3.5rem);
}
@media (max-width: 48rem) {
  [data-block="contactCard"] .contact-card__layout--with-map {
    grid-template-columns: 1fr;
  }
  [data-block="contactCard"] .contact-card__map iframe {
    height: auto;
  }
  [data-block="siteFooter"] .site-footer__inner {
    grid-template-columns: 1fr;
  }
  [data-block="siteFooter"] .site-footer__membership-link,
  [data-block="siteFooter"] .site-footer__contact-list {
    justify-content: center;
    text-align: center;
  }
  [data-block="siteFooter"] .site-footer__membership {
    margin-inline-start: 0;
    max-width: 100%;
    text-align: center;
  }
  [data-block="siteFooter"] .site-footer__membership-text {
    max-width: 100%;
  }
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
  .site-footer__title,
  .site-footer__heading,
  .ctaBanner__title
) {
  overflow-wrap: anywhere;
  hyphens: auto;
}
[data-block] :is(.hero__subtitle, .rich-text, .quote) {
  overflow-wrap: anywhere;
}
[data-block="hero"] .hero__media img,
[data-block="activitiesList"] .activities-list__media img,
[data-block="event-list"] .event-list__item-media img {
  aspect-ratio: auto;
  object-fit: cover;
  height: 100%;
}
[data-block="imageGallery"] .image-gallery__trigger {
  overflow: hidden;
}
[data-block="imageGallery"] {
  text-align: center;
}
[data-block="imageGallery"] .image-gallery__caption {
  text-align: center;
}
[data-block="imageGallery"] .image-gallery__trigger img,
[data-block="imageGallery"] .image-gallery__figure > img {
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
  [data-site-nav] .site-nav__inner {
    justify-content: center;
    flex-wrap: wrap;
  }
  [data-site-nav] ul {
    justify-content: center;
  }
  [data-block] {
    padding-left: var(--space-md);
    padding-right: var(--space-md);
  }
  [data-block="imageGallery"] .image-gallery__grid,
  [data-block="imageGallery"][data-layout="masonry"] .image-gallery__grid {
    display: grid;
    grid-template-columns: 1fr;
    column-count: 1;
  }
}
`.trim();
