/** @jsxImportSource preact */
import type { ActivitiesListBlock, ActivityItem } from "@sosb/schema";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";

/**
 * `activitiesList` block — structural HTML only.
 *
 * Like the hero block, this component owns the *semantic* and *accessibility*
 * shape of the activities list, not its visual treatment. The three layouts
 * (`cards`, `list`, `alternating`) share the same DOM and differ only via
 * `data-layout` so theme CSS can target each layout independently — no
 * per-layout component fork.
 *
 * Forward-compat: data is consumed tolerantly. Optional fields are
 * conditionally rendered. Unknown extra fields on `data` or each item are
 * ignored without throwing — schema's preserve-unknown-keys carries them
 * through to round-trip persistence.
 *
 * Accessibility:
 * - The block uses `aria-labelledby` pointing at the section heading.
 * - Each item is a `<li>` inside a `<ul>` for cards/list, kept structurally
 *   simple and screen-reader-friendly.
 * - When an item has a link without a label, the renderer derives an
 *   accessible name from the item title via `aria-label`. This keeps the
 *   anchor focusable and announceable even when the visible text is empty.
 * - Item images carry the alt text from the schema (mandatory non-empty).
 */
export function ActivitiesList(props: {
  block: ActivitiesListBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const { id, data } = props.block;
  const intro = typeof data.intro === "string" ? data.intro : undefined;
  const layout = data.layout;
  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <section
      data-block="activitiesList"
      data-block-id={id}
      data-layout={layout}
      aria-labelledby={`${id}__title`}
    >
      <div class="activities-list__inner">
        <h2 id={`${id}__title`} class="activities-list__title">
          {data.title}
        </h2>
        {intro !== undefined && <p class="activities-list__intro">{intro}</p>}
        <ul class="activities-list__items" role="list">
          {items.map((item, idx) => (
            <ActivityItemView
              key={`${id}__item_${idx}`}
              parentId={id}
              index={idx}
              item={item}
              assetUrlForPath={props.assetUrlForPath}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface ActivityItemViewProps {
  readonly parentId: string;
  readonly index: number;
  readonly item: ActivityItem;
  readonly assetUrlForPath: AssetUrlForPath | undefined;
}

function ActivityItemView(props: ActivityItemViewProps): preact.JSX.Element {
  const { parentId, index, item } = props;
  const itemId = `${parentId}__item_${index}`;
  const description = typeof item.description === "string" ? item.description : undefined;
  const image = item.image;
  const link = item.link;
  const badge = typeof item.badge === "string" && item.badge.length > 0 ? item.badge : undefined;

  return (
    <li class="activities-list__item" data-item-index={index}>
      {image !== undefined && (
        <div class="activities-list__media">
          <img
            src={resolveAssetUrl(image.path, props.assetUrlForPath)}
            alt={image.alt}
            width={image.width || undefined}
            height={image.height || undefined}
            loading="lazy"
          />
        </div>
      )}
      <div class="activities-list__body">
        <h3 id={`${itemId}__title`} class="activities-list__item-title">
          {item.title}
        </h3>
        {badge !== undefined && (
          <span class="activities-list__badge" data-badge={badge}>
            {badge}
          </span>
        )}
        {description !== undefined && <p class="activities-list__description">{description}</p>}
        {link !== undefined && (
          <ActivityLinkView itemId={itemId} itemTitle={item.title} link={link} />
        )}
      </div>
    </li>
  );
}

interface ActivityLinkViewProps {
  readonly itemId: string;
  readonly itemTitle: string;
  readonly link: { href: string; label?: string | undefined };
}

function ActivityLinkView(props: ActivityLinkViewProps): preact.JSX.Element {
  const { itemId, itemTitle, link } = props;
  const label = typeof link.label === "string" && link.label.length > 0 ? link.label : undefined;

  // When no label is given, derive an accessible name from the item title.
  // The anchor stays focusable and screen-reader-announceable; the visible
  // text falls back to a small chevron rendered via theme CSS.
  if (label === undefined) {
    return (
      <a
        href={link.href}
        class="activities-list__cta"
        data-cta="implicit"
        aria-label={itemTitle}
        aria-describedby={`${itemId}__title`}
      >
        <span class="activities-list__cta-chevron" aria-hidden="true">
          →
        </span>
      </a>
    );
  }

  return (
    <a href={link.href} class="activities-list__cta" data-cta="explicit">
      {label}
    </a>
  );
}
