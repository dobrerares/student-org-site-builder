/** @jsxImportSource preact */
import type { HeroBlock } from "@sosb/schema";
import { assetRefAlt, assetRefPath } from "../asset-ref-path.js";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

/**
 * Hero block — structural HTML only.
 *
 * This component owns the *semantic* and *accessibility* shape of the hero,
 * not its visual treatment. Theme-specific styling lives in the theme's CSS;
 * per-theme hero variants (per the PRD: only blocks with meaningful per-theme
 * layout differences get variants) land in the themes package later.
 *
 * Forward-compat: hero data is consumed tolerantly. Optional fields are
 * conditionally rendered. Unknown extra fields on `data` are ignored without
 * throwing — the schema's preserve-unknown-keys carries them through to
 * round-trip persistence; the renderer just doesn't surface them.
 */
export function Hero(props: {
  block: HeroBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { id, data } = props.block;
  const eyebrow = typeof data.eyebrow === "string" ? data.eyebrow : undefined;
  const title = data.title;
  const subtitle = typeof data.subtitle === "string" ? data.subtitle : undefined;
  const backgroundImagePath = assetRefPath(data.backgroundImage);
  const backgroundImage =
    backgroundImagePath !== undefined
      ? resolveAssetUrl(backgroundImagePath, props.assetUrlForPath)
      : undefined;
  const backgroundAlt =
    typeof data.backgroundAlt === "string" && data.backgroundAlt.length > 0
      ? data.backgroundAlt
      : assetRefAlt(data.backgroundImage);

  return (
    <section data-block="hero" data-block-id={id} aria-labelledby={`${id}__title`}>
      <div class="hero__inner">
        {eyebrow !== undefined && <p class="hero__eyebrow">{eyebrow}</p>}
        <h1 id={`${id}__title`} class="hero__title">
          {title}
        </h1>
        {subtitle !== undefined && <p class="hero__subtitle">{subtitle}</p>}
        {backgroundImage !== undefined && (
          <div class="hero__media">
            <img src={backgroundImage} alt={backgroundAlt} loading="lazy" />
          </div>
        )}
      </div>
    </section>
  );
}
