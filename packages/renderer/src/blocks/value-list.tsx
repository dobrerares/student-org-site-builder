/** @jsxImportSource preact */
import type { ValueListBlock, ValueListItem } from "@sosb/schema";
import { VALUE_LIST_ICON_PATHS } from "./value-list-icons.js";

/**
 * valueList block - structural HTML only.
 *
 * Mirrors the hero block's pattern: this component owns the *semantic* and
 * *accessibility* shape; theme-specific styling lives in the theme's CSS.
 *
 * Key shape decisions:
 *
 *  - The block is a `<section>`. When the data carries a `title`, we render
 *    an `<h2>` with `id="<blockId>__title"` and tag the `<section>` with
 *    `aria-labelledby` so screen readers announce the section name. With
 *    no title, the section is unlabelled (which is fine - it sits inside
 *    `<main>` and the page's structural landmarks).
 *  - Items are a `<ul>` of `<li>`s. Each `<li>` carries an `<h3>` for the
 *    label (so the document outline is h1 page -> h2 valueList ->
 *    h3 value), an optional inline `<svg>` for the icon (rendered
 *    `aria-hidden="true"` because the label conveys meaning), and an
 *    optional `<p>` for the description.
 *  - `data-layout` and `data-columns` are encoded as attributes so themes
 *    can hook into them via CSS attribute selectors.
 *
 * Forward-compat: data is consumed tolerantly - unknown icon names render
 * with no SVG (the label still appears), unknown extra fields are ignored
 * (preserved at the schema layer), and `items` is iterated even if it
 * contains entries that pass the loose schema but lack expected shape.
 *
 * SECURITY NOTE on the icon SVG span: the inner HTML is composed from
 * (a) a renderer-owned, hard-coded `<svg>` opener with attribute values
 * derived only from the `iconName` (which has been validated against the
 * curated enum at parse time, see `VALUE_LIST_ICON_NAMES`), and
 * (b) the `VALUE_LIST_ICON_PATHS` table, which is a renderer-owned constant
 * (see `value-list-icons.ts`). No user-controlled content reaches the
 * markup string. This is the same pattern the page shell uses for the
 * unknown-block placeholder comment.
 */
export function ValueList(props: { block: ValueListBlock }): preact.JSX.Element {
  const { id, data } = props.block;
  const title = typeof data.title === "string" ? data.title : undefined;
  const intro = typeof data.intro === "string" ? data.intro : undefined;
  const layout = data.layout;
  const columns = data.columns;

  const titleId = `${id}__title`;
  // Conditionally attach aria-labelledby only when there is a title heading
  // to point at. The hero block uses the same pattern.
  const ariaLabelledBy = title !== undefined ? titleId : undefined;

  return (
    <section
      data-block="valueList"
      data-block-id={id}
      data-layout={layout}
      data-columns={String(columns)}
      aria-labelledby={ariaLabelledBy}
    >
      <div class="value-list__inner">
        {title !== undefined && (
          <h2 id={titleId} class="value-list__title">
            {title}
          </h2>
        )}
        {intro !== undefined && <p class="value-list__intro">{intro}</p>}
        <ul class="value-list__items">
          {data.items.map((item, idx) => (
            <Item key={`${id}__item__${idx}`} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Item(props: { item: ValueListItem }): preact.JSX.Element {
  const { item } = props;
  const label = item.label;
  const description = typeof item.description === "string" ? item.description : undefined;
  const iconName = typeof item.icon === "string" ? item.icon : undefined;
  const iconSvg = iconName !== undefined ? renderIconSvg(iconName) : undefined;

  return (
    <li class="value-list__item">
      {iconSvg !== undefined && (
        <span class="value-list__icon" dangerouslySetInnerHTML={{ __html: iconSvg }} />
      )}
      <h3 class="value-list__label">{label}</h3>
      {description !== undefined && <p class="value-list__description">{description}</p>}
    </li>
  );
}

/**
 * Compose the inline SVG for a curated icon name. Returns `undefined` when
 * the name is not in the renderer-owned table - older renderers therefore
 * tolerate forward-added icon names from a future editor by silently
 * skipping the icon (the label still renders).
 */
function renderIconSvg(iconName: string): string | undefined {
  const paths = VALUE_LIST_ICON_PATHS[iconName];
  if (paths === undefined) return undefined;
  // The attributes here are fixed renderer constants apart from
  // `data-icon`, which has been validated against the curated enum at
  // parse time (the runtime check above gates against unknown future
  // names). The path body is a renderer-owned constant.
  return [
    `<svg data-icon="${iconName}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"`,
    ` width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"`,
    ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    paths,
    `</svg>`,
  ].join("");
}
