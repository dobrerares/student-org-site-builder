/** @jsxImportSource preact */
import type { PartnerLogosBlock } from "@sosb/schema";

/**
 * partnerLogos block — structural HTML only.
 *
 * Tracks issue #17. Like the hero block, this component owns the *semantic*
 * and *accessibility* shape of the partner-logos grid, not its visual
 * treatment. Layout-only CSS lives in the stub theme; per-theme variants
 * (Academic #47, others #28-#31) override only as needed.
 *
 * Accessibility contract:
 *  - Each logo `<img>` has an `alt` text drawn from the partner's
 *    `logo.alt` (mandatory in the schema).
 *  - When `url` is set the logo is wrapped in an anchor with
 *    `aria-label = partner.name` and `rel="noopener noreferrer"` for the
 *    outbound-link security baseline.
 *  - The optional block `title` becomes a heading (`<h2>`) inside the
 *    section so the grid integrates into the page document outline.
 *
 * Forward-compat: the data is consumed tolerantly. Optional fields are
 * conditionally rendered. Unknown extra fields on `data` or per-partner
 * objects are ignored without throwing — the schema's preserve-unknown-keys
 * carries them through to round-trip persistence.
 */
export function PartnerLogos(props: { block: PartnerLogosBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const title = typeof data.title === "string" && data.title.length > 0 ? data.title : undefined;
  const partners = data.partners;

  return (
    <section
      data-block="partnerLogos"
      data-block-id={id}
      aria-labelledby={title !== undefined ? `${id}__title` : undefined}
    >
      <div class="partner-logos__inner">
        {title !== undefined && (
          <h2 id={`${id}__title`} class="partner-logos__title">
            {title}
          </h2>
        )}
        <ul class="partner-logos__grid">
          {partners.map((partner, index) => {
            const name = partner.name;
            const logo = partner.logo;
            const logoSrc = logo.path;
            const logoAlt = logo.alt;
            const url =
              typeof partner.url === "string" && partner.url.length > 0 ? partner.url : undefined;

            const img = (
              <img
                class="partner-logos__logo"
                src={logoSrc}
                alt={logoAlt}
                loading="lazy"
                width={logo.width > 0 ? logo.width : undefined}
                height={logo.height > 0 ? logo.height : undefined}
              />
            );

            return (
              <li key={`${id}__item__${index}`} class="partner-logos__item">
                {url !== undefined ? (
                  <a
                    class="partner-logos__link"
                    href={url}
                    aria-label={name}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {img}
                  </a>
                ) : (
                  img
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
