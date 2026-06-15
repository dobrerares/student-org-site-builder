/**
 * Stub theme.
 *
 * A deliberately empty theme used to exercise the renderer framework without
 * making any design decisions. It contributes:
 *
 *  - layout-only CSS that uses `var(--token)` exclusively (never raw colours)
 *  - no per-theme hero variant — the structural hero from the renderer is used
 *
 * The production themes (see `themes/academic.ts`, etc.) ship curated palettes
 * and typography. The hero composition is now shared: every production theme
 * uses the universal hero overlay from `production-base.ts`, contributing only
 * palette and type — there are no per-theme hero variants.
 */

export const STUB_THEME_ID = "stub" as const;

/**
 * Layout-only CSS for the stub theme. Every value MUST be `var(--token)` or a
 * unitless number / structural primitive — the test suite asserts there is
 * no hex / rgb leakage outside of `:root`.
 */
export const STUB_THEME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-body);
  line-height: 1.5;
}
main { display: block; }
[data-block="hero"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="hero"] h1 {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="hero"] .hero__subtitle {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-fg);
}
[data-block="hero"] .hero__media {
  margin-top: var(--space-md);
  border-radius: var(--radius-md);
  overflow: hidden;
}
[data-block="hero"] .hero__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
[data-block="ctaBanner"] {
  padding: var(--space-xl) var(--space-md);
  background: var(--color-primary);
  color: var(--color-bg);
}
[data-block="ctaBanner"] .ctaBanner__inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  flex-wrap: wrap;
}
[data-block="ctaBanner"] .ctaBanner__copy {
  flex: 1 1 auto;
  min-width: 0;
}
[data-block="ctaBanner"] .ctaBanner__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-bg);
}
[data-block="ctaBanner"] .ctaBanner__subtitle {
  margin: 0;
  color: var(--color-bg);
}
[data-block="ctaBanner"] .ctaBanner__actions {
  flex: 0 0 auto;
}
[data-block="ctaBanner"] .ctaBanner__media {
  flex: 1 1 100%;
  margin-top: var(--space-md);
  border-radius: var(--radius-md);
  overflow: hidden;
}
[data-block="ctaBanner"] .ctaBanner__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
[data-block="ctaBanner"] .ctaBanner__button {
  display: inline-block;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-family: var(--font-body);
  font-weight: 600;
}
[data-block="ctaBanner"] .ctaBanner__button--primary {
  background: var(--color-accent);
  color: var(--color-fg);
  border: 2px solid var(--color-accent);
}
[data-block="ctaBanner"] .ctaBanner__button--secondary {
  background: transparent;
  color: var(--color-bg);
  border: 2px solid var(--color-bg);
}
[data-block="ctaBanner"].ctaBanner--solid {
  background: var(--color-primary);
}
@media (max-width: 640px) {
  [data-block="ctaBanner"] .ctaBanner__inner {
    flex-direction: column;
    align-items: flex-start;
  }
  [data-block="ctaBanner"] .ctaBanner__actions {
    width: 100%;
  }
  [data-block="ctaBanner"] .ctaBanner__button {
    display: block;
    text-align: center;
  }
}
[data-block="valueList"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="valueList"] .value-list__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-primary);
}
[data-block="valueList"] .value-list__intro {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-muted);
}
[data-block="valueList"] .value-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-md);
}
[data-block="valueList"][data-layout="grid"][data-columns="1"] .value-list__items {
  grid-template-columns: 1fr;
}
[data-block="valueList"][data-layout="grid"][data-columns="2"] .value-list__items {
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}
[data-block="valueList"][data-layout="grid"][data-columns="3"] .value-list__items {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}
[data-block="valueList"][data-layout="grid"][data-columns="4"] .value-list__items {
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
[data-block="valueList"][data-layout="list"] .value-list__items {
  grid-template-columns: 1fr;
}
[data-block="valueList"] .value-list__item {
  display: block;
}
[data-block="valueList"] .value-list__icon {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  margin-bottom: var(--space-sm);
  color: var(--color-accent);
}
[data-block="valueList"] .value-list__icon svg {
  width: 100%;
  height: 100%;
}
[data-block="valueList"] .value-list__label {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-primary);
}
[data-block="valueList"] .value-list__description {
  margin: 0;
  color: var(--color-fg);
}
@media (max-width: 600px) {
  [data-block="valueList"] .value-list__items {
    grid-template-columns: 1fr;
  }
}
[data-block="contactCard"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="contactCard"] .contact-card__heading {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="contactCard"] .contact-card__address {
  font-style: normal;
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-fg);
}
[data-block="contactCard"] .contact-card__email-row,
[data-block="contactCard"] .contact-card__phone-row {
  margin: 0 0 var(--space-sm) 0;
}
[data-block="contactCard"] .contact-card__socials {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
[data-block="contactCard"] .contact-card__map {
  margin-top: var(--space-md);
  border-radius: var(--radius-md);
  overflow: hidden;
}
[data-block="contactCard"] .contact-card__map iframe {
  display: block;
  width: 100%;
  min-height: 300px;
  border: 0;
}
[data-block="contactCard"] .contact-card__map-notice {
  margin: 0 0 var(--space-sm) 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}
[data-block="embed"] {
  margin: var(--space-lg) 0;
  padding: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-muted);
}
[data-block="embed"].embed--lazy {
  width: 100%;
  position: relative;
}
[data-block="embed"] iframe {
  border: 0;
  width: 100%;
  height: 100%;
  display: block;
}
[data-block="embed"] .embed__placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-muted);
}
[data-block="embed"].embed--blockquote {
  background: var(--color-bg);
  border: 1px solid var(--color-muted);
  padding: var(--space-md);
}
[data-block="embed"] .embed__title {
  margin: 0 0 var(--space-sm) 0;
  font-family: var(--font-headline);
  color: var(--color-primary);
}
[data-block="embed"] .embed__link a {
  color: var(--color-link);
  text-decoration: underline;
}
[data-block="activitiesList"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="activitiesList"] .activities-list__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="activitiesList"] .activities-list__intro {
  margin: 0 0 var(--space-lg) 0;
  color: var(--color-fg);
}
[data-block="activitiesList"] .activities-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-md);
}
[data-block="activitiesList"][data-layout="cards"] .activities-list__items {
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}
[data-block="activitiesList"][data-layout="list"] .activities-list__items {
  grid-template-columns: 1fr;
}
[data-block="activitiesList"][data-layout="alternating"] .activities-list__items {
  grid-template-columns: 1fr;
}
[data-block="activitiesList"][data-layout="alternating"] .activities-list__item:nth-child(even) {
  direction: rtl;
}
[data-block="activitiesList"][data-layout="alternating"] .activities-list__item:nth-child(even) .activities-list__body {
  direction: ltr;
}
[data-block="activitiesList"] .activities-list__item {
  display: grid;
  gap: var(--space-sm);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}
[data-block="activitiesList"] .activities-list__media {
  border-radius: var(--radius-sm);
  overflow: hidden;
}
[data-block="activitiesList"] .activities-list__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
[data-block="activitiesList"] .activities-list__item-title {
  font-family: var(--font-headline);
  margin: 0;
  color: var(--color-primary);
}
[data-block="activitiesList"] .activities-list__description {
  margin: 0;
  color: var(--color-fg);
}
[data-block="activitiesList"] .activities-list__badge {
  display: inline-block;
  justify-self: start;
  width: fit-content;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-lg);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
[data-block="activitiesList"] .activities-list__cta {
  color: var(--color-primary);
  text-decoration: underline;
  font-family: var(--font-body);
}
[data-block="activitiesList"] .activities-list__cta-chevron {
  display: inline-block;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
[data-block="teamGrid"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="teamGrid"] .team-grid__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="teamGrid"] .team-grid__intro {
  margin: 0 0 var(--space-lg) 0;
  color: var(--color-fg);
}
[data-block="teamGrid"] .team-grid__group {
  margin-bottom: var(--space-lg);
}
[data-block="teamGrid"] .team-grid__group-heading {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="teamGrid"] .team-grid__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(var(--team-grid-columns, 3), 1fr);
  gap: var(--space-md);
}
[data-block="teamGrid"] .team-person {
  margin: 0;
}
[data-block="teamGrid"] .team-person__figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
[data-block="teamGrid"] .team-person__photo {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  object-fit: cover;
}
[data-block="teamGrid"] .team-person__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-bg);
  font-family: var(--font-headline);
  font-size: 2rem;
  font-weight: 700;
}
[data-block="teamGrid"] .team-person__caption {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
[data-block="teamGrid"] .team-person__name {
  margin: 0;
  font-family: var(--font-headline);
  color: var(--color-primary);
  font-weight: 700;
}
[data-block="teamGrid"] .team-person__role {
  margin: 0;
  color: var(--color-muted);
}
[data-block="teamGrid"] .team-person__bio {
  margin: 0;
  color: var(--color-fg);
}
[data-block="teamGrid"] .team-person__socials {
  list-style: none;
  margin: var(--space-xs) 0 0 0;
  padding: 0;
  display: flex;
  gap: var(--space-sm);
}
[data-block="teamGrid"] .team-person__social {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-sm);
  background: var(--color-muted);
}
@media (max-width: 640px) {
  [data-block="teamGrid"] .team-grid__list {
    grid-template-columns: 1fr;
  }
}
[data-block="richText"] {
  padding: var(--space-lg) var(--space-md);
}
[data-block="richText"] .rich-text h2,
[data-block="richText"] .rich-text h3,
[data-block="richText"] .rich-text h4 {
  font-family: var(--font-headline);
  color: var(--color-primary);
  margin: var(--space-md) 0 var(--space-sm) 0;
}
[data-block="richText"] .rich-text p,
[data-block="richText"] .rich-text ul,
[data-block="richText"] .rich-text ol,
[data-block="richText"] .rich-text blockquote {
  margin: 0 0 var(--space-md) 0;
}
[data-block="richText"] .rich-text blockquote {
  padding-left: var(--space-md);
  border-left: 4px solid var(--color-accent);
  color: var(--color-muted);
}
[data-block="richText"] .rich-text a {
  color: var(--color-primary);
  text-decoration: underline;
}
[data-block="richText"] .rich-text code {
  font-family: var(--font-body);
  background: var(--color-bg);
  padding: 0 var(--space-xs);
  border-radius: var(--radius-sm);
}
[data-block="quote"] {
  margin: 0;
  padding: var(--space-lg) var(--space-md);
}
[data-block="quote"] .quote__text {
  margin: 0 0 var(--space-md) 0;
  padding-left: var(--space-md);
  border-left: 4px solid var(--color-accent);
  font-family: var(--font-headline);
  color: var(--color-fg);
}
[data-block="quote"] .quote__text p {
  margin: 0;
}
[data-block="quote"] .quote__attribution {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-muted);
}
[data-block="quote"] .quote__photo {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  object-fit: cover;
  display: block;
}
[data-block="quote"] .quote__author {
  font-style: normal;
  font-weight: 600;
  color: var(--color-primary);
}
[data-block="quote"] .quote__role {
  font-size: 0.875rem;
}
[data-block="faq"] {
  padding: var(--space-lg) var(--space-md);
}
[data-block="faq"] .faq__title {
  font-family: var(--font-headline);
  color: var(--color-primary);
  margin: 0 0 var(--space-md) 0;
}
[data-block="faq"] .faq__list {
  display: block;
}
[data-block="faq"] .faq__item {
  border-top: 1px solid var(--color-muted);
  padding: var(--space-sm) 0;
}
[data-block="faq"] .faq__item:last-child {
  border-bottom: 1px solid var(--color-muted);
}
[data-block="faq"] .faq__question {
  font-family: var(--font-headline);
  color: var(--color-primary);
  cursor: pointer;
  padding: var(--space-sm) 0;
  list-style: none;
}
[data-block="faq"] .faq__question::-webkit-details-marker {
  display: none;
}
[data-block="faq"] .faq__question::before {
  content: "+";
  display: inline-block;
  width: var(--space-md);
  color: var(--color-accent);
}
[data-block="faq"] .faq__item[open] > .faq__question::before {
  content: "−";
}
[data-block="faq"] .faq__question:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
[data-block="faq"] .faq__answer {
  padding: 0 0 var(--space-sm) var(--space-md);
}
[data-block="faq"] .faq__answer p,
[data-block="faq"] .faq__answer ul,
[data-block="faq"] .faq__answer ol {
  margin: 0 0 var(--space-sm) 0;
}
[data-block="faq"] .faq__answer a {
  color: var(--color-primary);
  text-decoration: underline;
}
[data-block="partnerLogos"] {
  padding: var(--space-xl) var(--space-md);
}
[data-block="partnerLogos"] .partner-logos__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
.partner-logos__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-md);
  list-style: none;
  margin: 0;
  padding: 0;
}
.partner-logos__item {
  display: flex;
  align-items: center;
  justify-content: center;
}
.partner-logos__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.partner-logos__logo {
  display: block;
  height: var(--space-xl);
  width: auto;
  max-width: 100%;
  object-fit: contain;
}
[data-block="imageGallery"] {
  padding: var(--space-lg) var(--space-md);
}
[data-block="imageGallery"] .image-gallery__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-md) 0;
  color: var(--color-primary);
}
[data-block="imageGallery"] .image-gallery__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-md);
  grid-template-columns: repeat(var(--gallery-columns), minmax(0, 1fr));
}
[data-block="imageGallery"][data-layout="masonry"] .image-gallery__grid {
  display: block;
  column-count: var(--gallery-columns);
  column-gap: var(--space-md);
}
[data-block="imageGallery"][data-layout="masonry"] .image-gallery__item {
  break-inside: avoid;
  margin-bottom: var(--space-md);
}
[data-block="imageGallery"] .image-gallery__figure {
  margin: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
[data-block="imageGallery"] .image-gallery__trigger {
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  width: 100%;
}
[data-block="imageGallery"] .image-gallery__trigger img,
[data-block="imageGallery"] .image-gallery__figure > img {
  display: block;
  width: 100%;
  height: auto;
}
[data-block="imageGallery"] .image-gallery__caption {
  font-size: 0.875rem;
  color: var(--color-muted);
  margin-top: var(--space-sm);
}
[data-sosb-lightbox] {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--color-fg);
  z-index: 1000;
}
[data-sosb-lightbox][hidden] { display: none; }
[data-sosb-lightbox] .sosb-lightbox__backdrop {
  position: absolute;
  inset: 0;
  background: var(--color-fg);
  opacity: 0.92;
}
[data-sosb-lightbox] .sosb-lightbox__panel {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  max-width: 90vw;
  max-height: 90vh;
}
[data-sosb-lightbox] .sosb-lightbox__figure {
  margin: 0;
  display: grid;
  gap: var(--space-sm);
  text-align: center;
}
[data-sosb-lightbox] .sosb-lightbox__figure img {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  height: auto;
  margin: 0 auto;
  border-radius: var(--radius-md);
}
[data-sosb-lightbox] .sosb-lightbox__caption {
  color: var(--color-bg);
  font-size: 0.875rem;
}
[data-sosb-lightbox] .sosb-lightbox__btn {
  background: transparent;
  color: var(--color-bg);
  border: 1px solid var(--color-bg);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 1.5rem;
  line-height: 1;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
}
[data-sosb-lightbox] .sosb-lightbox__btn--close {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
}
[data-block="documentDownloads"] {
  padding: var(--space-lg) var(--space-md);
}
[data-block="documentDownloads"] .document-downloads__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-primary);
}
[data-block="documentDownloads"] .document-downloads__intro {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-fg);
}
[data-block="documentDownloads"] .document-downloads__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-sm);
}
[data-block="documentDownloads"][data-layout="cards"] .document-downloads__list {
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-md);
}
[data-block="documentDownloads"] .document-downloads__item {
  border: 1px solid var(--color-muted);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
}
[data-block="documentDownloads"] .document-downloads__link {
  display: flex;
  flex-direction: column;
  color: var(--color-primary);
  text-decoration: none;
}
[data-block="documentDownloads"] .document-downloads__label {
  font-weight: 600;
}
[data-block="documentDownloads"] .document-downloads__meta {
  font-size: 0.875rem;
  color: var(--color-muted);
}
[data-block="documentDownloads"] .document-downloads__description {
  margin: var(--space-xs) 0 0 0;
  color: var(--color-fg);
  font-size: 0.9375rem;
}
[data-block="event-list"] {
  padding: var(--space-lg) var(--space-md);
}
[data-block="event-list"] .event-list__title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-sm) 0;
  color: var(--color-primary);
}
[data-block="event-list"] .event-list__intro {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-fg);
}
[data-block="event-list"] .event-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-md);
}
[data-block="event-list"] .event-list__item article {
  display: block;
  padding: var(--space-md);
  border-radius: var(--radius-sm);
}
[data-block="event-list"] .event-list__item-title {
  font-family: var(--font-headline);
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-primary);
}
[data-block="event-list"] .event-list__item-time {
  display: block;
  color: var(--color-muted);
  margin: 0 0 var(--space-xs) 0;
}
[data-block="event-list"] .event-list__item-location,
[data-block="event-list"] .event-list__item-description {
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-fg);
}
[data-block="event-list"] .event-list__item-media img {
  display: block;
  max-width: 100%;
  height: auto;
}
[data-block="event-list"] .event-list__item-link {
  color: var(--color-accent);
}
[data-block="event-list"] [data-event-id].is-past {
  opacity: 0.55;
}
[data-site-nav] {
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-muted);
}
[data-site-nav] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}
[data-site-nav] a {
  color: var(--color-primary);
  text-decoration: none;
  font-family: var(--font-headline);
}
[data-site-nav] a:hover {
  text-decoration: underline;
}
[data-site-nav] a[data-active="true"] {
  color: var(--color-accent);
  font-weight: 600;
}
[data-language-switcher] {
  padding: var(--space-sm) var(--space-md);
}
[data-language-switcher] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: var(--space-sm);
}
[data-language-switcher] a {
  color: var(--color-muted);
  text-decoration: none;
  font-size: 0.875rem;
}
[data-language-switcher] a[data-active="true"] {
  color: var(--color-fg);
  font-weight: 600;
}
`.trim();
