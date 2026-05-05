/** @jsxImportSource preact */
import type { CtaBannerBlock } from "@sosb/schema";

/**
 * `ctaBanner` block — structural HTML only.
 *
 * Like the hero (#46), this component owns *semantic* and *accessibility*
 * shape, not visual treatment. Theme CSS targets `[data-block="ctaBanner"]`
 * and the BEM-ish class hooks (`ctaBanner__inner`, `ctaBanner__media`,
 * `ctaBanner__button--primary` / `--secondary`). Per the PRD, ctaBanner uses
 * a *shared* template across themes (only blocks where layout meaningfully
 * varies per theme — hero — get per-theme variants).
 *
 * Forward-compat: data is consumed tolerantly. Optional fields are
 * conditionally rendered; unknown extra fields on `data` are ignored at
 * render time and preserved by the schema's looseObject for round-trip.
 */
export function CtaBanner(props: { block: CtaBannerBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const title = data.title;
  const subtitle = typeof data.subtitle === "string" ? data.subtitle : undefined;
  const button = data.button;
  const backgroundImage = data.backgroundImage;

  // Class hook so theme CSS can branch between "image background" and
  // "solid colour fallback" without inline styles. The fallback is the
  // theme's job (it pulls from --color-primary / --color-accent tokens).
  const sectionClasses = ["ctaBanner"];
  if (backgroundImage === undefined) sectionClasses.push("ctaBanner--solid");

  // Style class on the button. Schema validates `style` is "primary" or
  // "secondary"; we still default conservatively to primary to keep render
  // output well-formed even when called with looseObject extras.
  const buttonStyle = button.style === "secondary" ? "secondary" : "primary";

  return (
    <section
      data-block="ctaBanner"
      data-block-id={id}
      class={sectionClasses.join(" ")}
      aria-labelledby={`${id}__title`}
    >
      <div class="ctaBanner__inner">
        <div class="ctaBanner__copy">
          <h2 id={`${id}__title`} class="ctaBanner__title">
            {title}
          </h2>
          {subtitle !== undefined && <p class="ctaBanner__subtitle">{subtitle}</p>}
        </div>
        <div class="ctaBanner__actions">
          <a class={`ctaBanner__button ctaBanner__button--${buttonStyle}`} href={button.url}>
            {button.label}
          </a>
        </div>
        {backgroundImage !== undefined && (
          <div class="ctaBanner__media">
            <img src={backgroundImage.path} alt={backgroundImage.alt} loading="lazy" />
          </div>
        )}
      </div>
    </section>
  );
}
