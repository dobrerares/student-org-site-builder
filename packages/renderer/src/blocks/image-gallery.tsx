/** @jsxImportSource preact */
import type { ImageGalleryBlock } from "@sosb/schema";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

/**
 * imageGallery block — structural HTML only.
 *
 * Owns the *semantic* and *accessibility* shape of the gallery. Theme CSS
 * reads the `data-layout` attribute and the `--gallery-columns` custom
 * property to lay images out as a grid or masonry; the renderer emits no
 * layout opinions of its own.
 *
 * The lightbox dialog scaffold is rendered by `PageShell`, not here, so a
 * single dialog serves all galleries on a page (the shipped JS associates
 * each trigger with its parent gallery via `data-gallery`).
 *
 * Forward-compat: gallery data is consumed tolerantly (typeof checks). The
 * schema's `looseObject` carries unknown fields through round-trip.
 */
export function ImageGallery(props: {
  block: ImageGalleryBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  // Render only images that actually have an asset. The editor can momentarily
  // hold an image with no asset yet — a row added before its upload completes
  // (the schema makes `asset` mandatory, but it cannot be fabricated per ADR
  // 0044). The renderer drives the live preview, so it must tolerate that
  // in-flight state: skip such images instead of dereferencing
  // `image.asset.path` and crashing the whole preview.
  const images = (Array.isArray(data.images) ? data.images : []).filter((image) => {
    const asset = (image as { asset?: { path?: unknown } }).asset;
    return asset != null && typeof asset.path === "string" && asset.path.length > 0;
  });

  // Empty-state suppression: an imageGallery with no renderable image renders
  // nothing rather than an empty styled container. The page-shell's lightbox
  // scaffold is gated separately by `pageNeedsLightbox`; a suppressed, image-
  // less gallery contributes no triggers for that script regardless.
  if (images.length === 0) return null;

  const title = typeof data.title === "string" ? data.title : undefined;
  const layout = data.layout;
  const columns = data.columns;
  const lightbox = data.lightbox === true;

  const headerId = `${id}__title`;
  const labelledBy = title !== undefined ? headerId : undefined;
  const ariaLabel = title === undefined ? "Image gallery" : undefined;

  return (
    <section
      data-block="imageGallery"
      data-block-id={id}
      data-layout={layout}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      style={`--gallery-columns: ${columns}`}
    >
      {title !== undefined && (
        <h2 id={headerId} class="image-gallery__title">
          {title}
        </h2>
      )}
      <ul class="image-gallery__grid" role="list">
        {images.map((image, index) => {
          const asset = image.asset;
          const src = resolveAssetUrl(asset.path, props.assetUrlForPath);
          const alt = image.alt;
          const caption = typeof image.caption === "string" ? image.caption : undefined;
          const figureId = `${id}__fig_${index}`;
          const captionId = caption !== undefined ? `${figureId}__cap` : undefined;

          const img = (
            <img
              src={src}
              alt={alt}
              width={asset.width || undefined}
              height={asset.height || undefined}
              loading="lazy"
              decoding="async"
            />
          );

          return (
            <li class="image-gallery__item">
              <figure id={figureId} class="image-gallery__figure">
                {lightbox ? (
                  <button
                    type="button"
                    class="image-gallery__trigger"
                    data-sosb-lightbox-open
                    data-gallery={id}
                    data-index={index}
                    data-src={src}
                    data-alt={alt}
                    data-caption={caption ?? ""}
                    aria-label={
                      caption !== undefined
                        ? `Open image ${index + 1}: ${caption}`
                        : `Open image ${index + 1}`
                    }
                    aria-describedby={captionId}
                  >
                    {img}
                  </button>
                ) : (
                  img
                )}
                {caption !== undefined && (
                  <figcaption id={captionId} class="image-gallery__caption">
                    {caption}
                  </figcaption>
                )}
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
