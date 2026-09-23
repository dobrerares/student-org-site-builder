/**
 * Practice — the executable design (`render.js`, ADR 0053).
 *
 * This module runs inside the builder's sandbox at preview and export time.
 * It never touches HTML: every function returns an *element tree* — arrays of
 * `[tag, attributes, ...children]` — which the builder validates and renders.
 * There is no `fetch`, no `Date`, no `Math.random` and no `console` in here,
 * and the builder enforces that rather than trusting this comment.
 *
 * Two things are designed here:
 *
 *  - `shell(input)` — the visible page chrome: a sticky header with the
 *    organisation's wordmark and navigation, the language switcher, and a
 *    quiet colophon under the author's footer Block. Exactly one `["slot"]`
 *    marks where the builder places the page's Blocks, in the author's order.
 *  - `blocks.hero(input)` — overrides the built-in hero. The "spotlight"
 *    variant gains a decorative ring motif and stepped title; every other
 *    variant reproduces the built-in markup so `theme.css`'s existing rules
 *    keep working unchanged.
 *
 * Everything visible comes from `input`: Site content the author edits, the
 * builder's computed navigation and URLs, and the Theme's own settings. This
 * file holds no editable text of its own (ADR 0046) — the only words it
 * contributes are looked up through `input.t()` in the page's language.
 */

const NAV_LIST_ID = "site-nav-list";

/** Join class names, dropping the falsy ones. */
function classes(...names) {
  return names.filter((name) => typeof name === "string" && name.length > 0).join(" ");
}

/** A non-empty string, or `null` so the node is skipped. */
function text(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/* ------------------------------------------------------------------ shell */

function brand(input) {
  const { org } = input;
  const logo = org.logo;
  return [
    "a",
    { class: "site-nav__brand", href: input.homeHref, "aria-label": org.name },
    logo
      ? [
          "img",
          {
            class: "site-nav__logo",
            src: input.mediaUrl(logo.path),
            alt: logo.alt,
            width: logo.width > 0 ? logo.width : null,
            height: logo.height > 0 ? logo.height : null,
          },
        ]
      : null,
    ["span", { class: "site-nav__wordmark" }, org.name],
  ];
}

/**
 * The phone-width menu button.
 *
 * Shipped `hidden`: without JavaScript the navigation list is simply visible
 * and wraps, so every destination stays reachable. `public.js` reveals the
 * button, marks the header `data-nav-enhanced`, and from then on the list
 * collapses behind it at phone widths. The enhancement is additive — a page
 * whose script failed to load looks exactly like phase one did.
 */
function navToggle(input) {
  return [
    "button",
    {
      class: "site-nav__toggle",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": NAV_LIST_ID,
      hidden: true,
    },
    [
      "span",
      { class: "site-nav__toggle-bars", "aria-hidden": "true" },
      ["span"],
      ["span"],
      ["span"],
    ],
    ["span", { class: "site-nav__toggle-label" }, input.t("menu")],
  ];
}

function navItem(entry) {
  return [
    "li",
    null,
    [
      "a",
      {
        href: entry.href,
        "data-active": entry.isActive ? "true" : "false",
        "aria-current": entry.isActive ? "page" : null,
      },
      entry.label,
    ],
  ];
}

function languageSwitcher(input) {
  if (input.languages.length === 0) return null;
  return [
    "nav",
    { "data-language-switcher": "", "aria-label": input.t("languageLabel") },
    [
      "ul",
      null,
      ...input.languages.map((entry) => [
        "li",
        null,
        [
          "a",
          {
            href: entry.href,
            lang: entry.lang,
            hreflang: entry.lang,
            "data-active": entry.isActive ? "true" : "false",
            "aria-current": entry.isActive ? "true" : null,
          },
          entry.nativeName,
        ],
      ]),
    ],
  ];
}

/**
 * The strip under the author's footer Block: wordmark, tagline, the site's
 * navigation once more, and a "since" line from the founding year.
 *
 * A labelled `<section>`, not a `<footer>`: the author's site-footer Block is
 * already the page's contentinfo landmark and two of those is an accessibility
 * defect, while content outside every landmark is another. The label comes
 * from `t()` rather than the organisation's name, because a hero titled with
 * that same name is a region with that same name, and two identically named
 * landmarks is a third defect. No copyright year, either — a design cannot
 * read the clock (ADR 0046), and a year baked in at export would be wrong by
 * the time anyone noticed.
 */
function colophon(input) {
  const { org, nav } = input;
  const founded = typeof org.foundedYear === "number" ? org.foundedYear : null;
  return [
    "section",
    { class: "site-colophon", "aria-label": input.t("siteInfo") },
    [
      "div",
      { class: "site-colophon__inner" },
      [
        "div",
        { class: "site-colophon__identity" },
        ["p", { class: "site-colophon__brand" }, org.name],
        text(org.tagline) ? ["p", { class: "site-colophon__tagline" }, org.tagline] : null,
      ],
      nav.length > 1
        ? [
            "ul",
            { class: "site-colophon__nav" },
            ...nav.map((entry) => ["li", null, ["a", { href: entry.href }, entry.label]]),
          ]
        : null,
      [
        "p",
        { class: "site-colophon__meta" },
        founded !== null ? `${input.t("since")} ${founded}` : org.name,
      ],
    ],
  ];
}

function shell(input) {
  const showNav = input.nav.length > 1;
  return [
    [
      "header",
      { class: "site-header", "data-site-nav": "" },
      [
        "div",
        { class: "site-nav__inner" },
        brand(input),
        showNav ? navToggle(input) : null,
        showNav
          ? [
              "nav",
              { "aria-label": input.t("navigation") },
              ["ul", { id: NAV_LIST_ID, class: "site-nav__list" }, ...input.nav.map(navItem)],
            ]
          : null,
        languageSwitcher(input),
      ],
    ],
    ["slot"],
    colophon(input),
  ];
}

/* ------------------------------------------------------------------- hero */

/** Decorative concentric rings behind the spotlight title. */
function spotlightRings() {
  const ring = (r, opacity) => [
    "circle",
    {
      cx: 600,
      cy: 300,
      r,
      fill: "none",
      stroke: "currentColor",
      "stroke-opacity": opacity,
      "stroke-width": 1.5,
      "vector-effect": "non-scaling-stroke",
    },
  ];
  return [
    "svg",
    {
      class: "hero__rings",
      viewBox: "0 0 1200 600",
      preserveAspectRatio: "xMidYMid slice",
      "aria-hidden": "true",
      focusable: "false",
    },
    ring(180, 0.32),
    ring(300, 0.2),
    ring(430, 0.12),
    ring(570, 0.06),
  ];
}

/**
 * The built-in hero's markup, reproduced. The default and "split" variants
 * render exactly this, so the phase-one stylesheet needs no changes for them.
 */
function heroBody(input, extraClass, decoration) {
  const { data, id } = input;
  const src = input.mediaUrl(data.backgroundImage);
  const alt = text(data.backgroundAlt) ?? input.mediaAlt(data.backgroundImage);
  const hasImage = src !== null;
  const titleId = `${id}__title`;
  const subtitle = text(data.subtitle);
  return [
    "section",
    {
      class: classes("hero", extraClass, hasImage ? "hero--has-image" : null),
      "aria-labelledby": titleId,
    },
    decoration,
    hasImage ? ["div", { class: "hero__media" }, ["img", { src, alt, loading: "lazy" }]] : null,
    [
      "div",
      { class: "hero__inner" },
      ["h1", { id: titleId, class: "hero__title" }, ...heroTitle(input)],
      subtitle !== null ? ["p", { class: "hero__subtitle" }, subtitle] : null,
      extraClass === "hero--spotlight"
        ? ["span", { class: "hero__rule", "aria-hidden": "true" }]
        : null,
    ],
  ];
}

/**
 * The title's words, each in its own span for the spotlight variant so the
 * stylesheet can step them. Plain text for every other variant. Spans around
 * words change nothing about reading order or the accessible name.
 */
function heroTitle(input) {
  const title = text(input.data.title) ?? "";
  if (input.variant !== "spotlight") return [title];
  const words = title.split(/\s+/).filter((word) => word.length > 0);
  const out = [];
  words.forEach((word, index) => {
    if (index > 0) out.push(" ");
    out.push(["span", { class: "hero__word" }, word]);
  });
  return out;
}

function hero(input) {
  if (input.variant === "spotlight") {
    return heroBody(input, "hero--spotlight", spotlightRings());
  }
  return heroBody(input, null, null);
}

export default {
  shell,
  blocks: {
    hero,
  },
};
