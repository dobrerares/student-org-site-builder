/** @jsxImportSource preact */
import type { CtaBannerBlock } from "@sosb/schema";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

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
interface RenderableButton {
  label: string;
  url: string;
  style: string | undefined;
}

/**
 * Normalise the button for rendering. Returns `undefined` when the button is
 * missing or carries no actionable content (no label or no href) — an empty
 * "button" with nothing to click is not actionable and does not count toward
 * the block being non-empty. Both `label` and `url` are required by the schema
 * (`z.string().min(1)`); this guards the loose-data tolerance path.
 */
function readButton(raw: unknown): RenderableButton | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const b = raw as { label?: unknown; url?: unknown; style?: unknown };
  const label = typeof b.label === "string" && b.label.length > 0 ? b.label : undefined;
  const url = typeof b.url === "string" && b.url.length > 0 ? b.url : undefined;
  if (label === undefined || url === undefined) return undefined;
  return { label, url, style: typeof b.style === "string" ? b.style : undefined };
}

export function CtaBanner(props: {
  block: CtaBannerBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  const title = typeof data.title === "string" && data.title.length > 0 ? data.title : undefined;
  const subtitle =
    typeof data.subtitle === "string" && data.subtitle.length > 0 ? data.subtitle : undefined;
  const button = readButton(data.button);
  const backgroundImage = data.backgroundImage;

  // Empty-state suppression: a ctaBanner with no heading, no supporting copy,
  // and no actionable button has nothing visible/actionable to show, so render
  // nothing rather than an empty styled band. (title + button are required by
  // the schema; this guards the loose-data tolerance path.)
  if (title === undefined && subtitle === undefined && button === undefined) {
    return null;
  }

  // Class hook so theme CSS can branch between "image background" and
  // "solid colour fallback" without inline styles. The fallback is the
  // theme's job (it pulls from --color-primary / --color-accent tokens).
  const sectionClasses = ["ctaBanner"];
  if (backgroundImage === undefined) sectionClasses.push("ctaBanner--solid");

  return (
    <section
      data-block="ctaBanner"
      data-block-id={id}
      class={sectionClasses.join(" ")}
      aria-labelledby={title !== undefined ? `${id}__title` : undefined}
    >
      <div class="ctaBanner__inner">
        <div class="ctaBanner__copy">
          {title !== undefined && (
            <h2 id={`${id}__title`} class="ctaBanner__title">
              {title}
            </h2>
          )}
          {subtitle !== undefined && <p class="ctaBanner__subtitle">{subtitle}</p>}
        </div>
        {button !== undefined && (
          <div class="ctaBanner__actions">
            <a
              class={`ctaBanner__button ctaBanner__button--${button.style === "secondary" ? "secondary" : "primary"}`}
              href={button.url}
            >
              {button.label}
            </a>
          </div>
        )}
        {backgroundImage !== undefined && (
          <div class="ctaBanner__media">
            <img
              src={resolveAssetUrl(backgroundImage.path, props.assetUrlForPath)}
              alt={backgroundImage.alt}
              loading="lazy"
            />
          </div>
        )}
      </div>
    </section>
  );
}
