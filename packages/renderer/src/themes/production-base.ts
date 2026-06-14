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
[data-block="valueList"] .value-list__item,
[data-block="activitiesList"] .activities-list__item,
[data-block="teamGrid"] .team-person__figure,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="event-list"] .event-list__item article,
[data-block="faq"] .faq__item {
  border: 1px solid var(--color-muted);
  background: var(--color-bg);
  box-sizing: border-box;
}
[data-block="valueList"] .value-list__item,
[data-block="documentDownloads"] .document-downloads__item,
[data-block="faq"] .faq__item {
  padding: var(--space-md);
}
[data-block="valueList"][data-layout="grid"] .value-list__items {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
}
[data-block="valueList"][data-layout="grid"] .value-list__item {
  flex: 0 1 var(--value-list-item-width, 100%);
  width: var(--value-list-item-width, 100%);
  max-width: var(--value-list-item-width, 100%);
  min-width: min(100%, var(--value-list-item-min, 12rem));
}
[data-block="valueList"][data-layout="grid"][data-columns="1"] .value-list__item {
  --value-list-item-width: 100%;
  --value-list-item-min: 100%;
}
[data-block="valueList"][data-layout="grid"][data-columns="2"] .value-list__item {
  --value-list-item-width: calc(50% - var(--space-md));
  --value-list-item-min: 16rem;
}
[data-block="valueList"][data-layout="grid"][data-columns="3"] .value-list__item {
  --value-list-item-width: calc(33.333% - var(--space-lg));
  --value-list-item-min: 9.75rem;
}
[data-block="valueList"][data-layout="grid"][data-columns="4"] .value-list__item {
  --value-list-item-width: calc(25% - var(--space-lg));
  --value-list-item-min: 9.5rem;
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
[data-block="teamGrid"] .team-person__photo,
[data-block="teamGrid"] .team-person__avatar {
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
[data-block="teamGrid"] .team-person__role {
  display: inline-flex;
  align-self: flex-start;
  width: fit-content;
  max-width: 100%;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--color-muted);
  border-radius: 999px;
  color: var(--color-primary);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.2;
}
[data-block="teamGrid"] .team-person__bio {
  margin-top: var(--space-xs);
}
[data-block="teamGrid"] .team-person__social {
  width: auto;
  height: auto;
  min-height: 1.5rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--color-muted);
  border-radius: 999px;
  background: transparent;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  text-transform: uppercase;
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
  border: 1px solid var(--color-muted);
  padding: var(--space-md);
  background: var(--color-bg);
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
[data-block="hero"] .hero__inner {
  width: min(100%, var(--site-max-width));
  margin-inline: auto;
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
  padding: var(--space-xl) var(--space-md);
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
    rgba(var(--color-fg-rgb), 0.8) 0%,
    rgba(var(--color-fg-rgb), 0.45) 40%,
    rgba(var(--color-fg-rgb), 0.05) 100%
  );
}
[data-block="hero"].hero--has-image .hero__inner {
  position: relative;
  z-index: 1;
  align-self: end;
}
[data-block="hero"].hero--has-image .hero__title,
[data-block="hero"].hero--has-image .hero__subtitle {
  color: var(--color-on-image);
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
  [data-block="valueList"][data-layout="grid"] .value-list__item {
    flex: 0 1 100%;
    width: 100%;
    max-width: 100%;
    min-width: 100%;
  }
}
`.trim();
