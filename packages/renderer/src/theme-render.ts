/**
 * The executable Theme rendering contract (ADR 0053).
 *
 * A Theme package may ship a `render.js` module that designs Block markup and
 * the visible page shell. That module does not produce HTML. It produces
 * **data** — an `ElementTree` — which this module validates and then hands to
 * Preact, exactly like a built-in Block component's vnode.
 *
 * Data rather than markup is the whole design. Three properties fall out of it
 * that a string-returning contract cannot have:
 *
 *  - **There is no raw-HTML injection surface.** A Theme cannot emit a
 *    `<script>`, an `on*` handler or a `javascript:` URL, because it never
 *    emits characters at all — it emits a tag name that must be on an allow
 *    list and attributes that must survive a whitelist.
 *  - **Preview and export are byte-identical mechanically.** Both go through
 *    `preact-render-to-string`, the same escaping, the same attribute order.
 *    ADR 0052's parity property extends to Custom Themes for free.
 *  - **Failures are locatable.** A rejected tree names the Theme, the Block and
 *    the offending node, instead of producing HTML that looks fine until a
 *    browser parses it.
 *
 * This module is deliberately ignorant of *how* the Theme's code ran. It takes
 * a `ThemeRenderModule` — an interface with synchronous methods — so the
 * renderer never imports a JavaScript engine. `@sosb/theme-package` supplies
 * the QuickJS-backed implementation at load time (ADR 0053 § Sandbox).
 */

import { Fragment, h } from "preact";
import { isAcceptableLinkUrl } from "@sosb/schema";

/**
 * A node the Theme's module produced.
 *
 * Two spellings, because the two read well in different places: the array form
 * (`["p", { class: "lede" }, text]`) is compact for deep trees, and the object
 * form (`{ tag: "p", attrs: …, children: … }`) is clearer when a design builds
 * a node conditionally. Both normalise to the same thing.
 */
export type ElementTree =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly ElementTree[]
  | { readonly tag: string; readonly attrs?: unknown; readonly children?: unknown };

/** What went wrong, as a stable code the editor can branch on. */
export type ThemeRenderErrorCode =
  /** The module's function threw. */
  | "threw"
  /** The module exceeded its instruction budget — a runaway loop. */
  | "timeout"
  /** The module exceeded its heap ceiling — an allocation that never stops. */
  | "memory"
  /** The module returned something that is not a valid `ElementTree`. */
  | "invalid-tree"
  /** A shell tree with zero or several content slots. */
  | "slot-count"
  /** The module itself would not load (syntax error, no default export). */
  | "module-invalid";

/**
 * A rendering failure attributable to a Theme's `render.js`.
 *
 * ADR 0045: a rendering failure stops the export and cannot be acknowledged
 * away, unlike a deliberately omitted Block. So this is an error type, not a
 * warning shape — `build()` lets it escape and the editor shows it.
 */
export class ThemeRenderError extends Error {
  public override readonly name = "ThemeRenderError";
  public readonly code: ThemeRenderErrorCode;
  /** The Theme whose code failed. */
  public readonly themeId: string;
  /** `"shell"`, or the failing Block's id. */
  public readonly subject: string;
  /** The failing Block's type, absent for the shell. */
  public readonly blockType: string | undefined;
  /** The message without the "Theme X failed to render Y" preamble. */
  public readonly detail: string;

  constructor(args: {
    code: ThemeRenderErrorCode;
    themeId: string;
    subject: string;
    blockType?: string | undefined;
    detail: string;
  }) {
    const where =
      args.blockType === undefined
        ? args.subject
        : `block ${args.subject} (${args.blockType})`;
    super(`Theme "${args.themeId}" failed to render ${where}: ${args.detail}`);
    this.code = args.code;
    this.themeId = args.themeId;
    this.subject = args.subject;
    this.blockType = args.blockType;
    this.detail = args.detail;
  }
}

/** Narrowing helper for call sites that catch broadly. */
export function isThemeRenderError(value: unknown): value is ThemeRenderError {
  return value instanceof ThemeRenderError;
}

/**
 * The documented helpers a design receives on its `input`.
 *
 * Every one of them exists because the alternative is a Theme hand-rolling
 * something the builder already owns and getting it subtly wrong: an asset
 * path that works in export and 404s in preview, a Page URL that does not
 * follow a slug rename, prose that escapes differently from the Rich-text
 * Block next to it.
 */
export interface ThemeRenderHelpers {
  /** A file inside the Theme package (`assets/x.svg`) → its canonical URL. */
  asset(path: string): string;
  /**
   * A Site asset — an `AssetRef` out of Block data, or its bare path — to the
   * URL that resolves in this render target. `null` when the slot is empty,
   * which is the common case a design has to handle.
   */
  mediaUrl(ref: unknown): string | null;
  /** The screen-reader description stored on a Site asset, or `""`. */
  mediaAlt(ref: unknown): string;
  /** A Page's id (its `lang:slug` key) → the builder-computed href. */
  pageUrl(pageId: string): string | null;
  /** An Article's permanent id → the builder-computed href. */
  articleUrl(articleId: string): string | null;
  /**
   * Builder-rendered, sanitised prose.
   *
   * Returns an opaque sentinel, not an HTML string. The design places the
   * sentinel in its tree and the builder substitutes its own already-rendered
   * nodes — which is what keeps "no raw HTML from the module" absolute rather
   * than "no raw HTML except through this one helper".
   */
  richText(doc: unknown): unknown;
  /** A renderer-owned visitor-facing string, in the page's language. */
  t(key: string): string;
}

/**
 * A loaded, executable Theme design.
 *
 * Synchronous by construction: `renderSite` and `build()` are synchronous
 * (ADR 0052) and the editor's `srcdoc` preview depends on it. Anything that
 * needed to be asynchronous — instantiating the engine — happens once, at
 * package load time, where the I/O already lives.
 */
export interface ThemeRenderModule {
  /** Block types this design covers, sorted. Built-in types may appear. */
  readonly blockTypes: readonly string[];
  /** Does the design override the visible page shell? */
  readonly hasShell: boolean;
  /** Run the design for one Block. Returns raw tree data, or throws. */
  renderBlock(blockType: string, input: unknown, helpers: ThemeRenderHelpers): unknown;
  /** Run the shell design. Returns raw tree data, or throws. */
  renderShell(input: unknown, helpers: ThemeRenderHelpers): unknown;
  /** Release the engine resources held for this Theme. */
  dispose(): void;
}

/**
 * The public-site script a Theme ships (ADR 0046).
 *
 * `network` and `offline` are not documentation — the loader refuses a package
 * whose script exists without a `network` declaration, and refuses a non-empty
 * `network` without an `offline` note. ADR 0046 requires each extension to
 * document its external dependencies and what stops working offline; a field
 * the builder does not check is a field that goes stale.
 */
export interface ThemePublicScript {
  /** Package-relative filename, e.g. `public.js`. */
  readonly file: string;
  readonly bytes: Uint8Array;
  /** Hosts the script may contact on the published Site. Often empty. */
  readonly network: readonly string[];
  /** What is unavailable offline. Required when `network` is non-empty. */
  readonly offline: string | undefined;
}

// ---------------------------------------------------------------------------
// Tree validation
// ---------------------------------------------------------------------------

/**
 * Tags a Theme design may emit.
 *
 * Curated rather than derived: "every tag except the dangerous ones" is a list
 * that grows silently as the HTML spec does, and the next dangerous element is
 * exactly the one nobody thought to exclude. The cost of the conservative side
 * is an author asking for one more tag, which is a pull request.
 *
 * Deliberately absent, beyond the obvious `script` / `iframe` / `object` /
 * `embed` / `base` / `link` / `meta`:
 *
 *  - `html`, `head`, `body` — the builder owns the document (ADR 0046).
 *  - `style` — a Theme has a stylesheet, and that stylesheet goes through the
 *    offline scanner (ADR 0050). A `<style>` element here would be CSS that
 *    skipped the scanner.
 *  - `form`, `input`, `select`, `textarea` — a form's `action` is a network
 *    dependency the builder cannot police at render time. Left for a later
 *    decision; a `button` driven by `public.js` covers the interactive cases.
 *  - `slot` is reserved: it marks the content slot and is never emitted.
 */
const ALLOWED_HTML_TAGS: ReadonlySet<string> = new Set([
  "a",
  "abbr",
  "address",
  "article",
  "aside",
  "audio",
  "b",
  "blockquote",
  "br",
  "button",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "label",
  "li",
  "main",
  "mark",
  "nav",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "s",
  "samp",
  "section",
  "small",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
]);

/**
 * Inline SVG, minus every element that can reach outside the document.
 *
 * `use`, `image` and `foreignObject` are excluded on purpose: the first two
 * take a URL, the third re-opens the whole HTML surface inside a tag the
 * HTML allow list would otherwise have gated.
 */
const ALLOWED_SVG_TAGS: ReadonlySet<string> = new Set([
  "svg",
  "circle",
  "desc",
  "ellipse",
  "g",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "title",
]);

/** Attributes allowed on any element. */
const GLOBAL_ATTRS: ReadonlySet<string> = new Set([
  "class",
  "id",
  "dir",
  "hidden",
  "lang",
  "role",
  "tabindex",
  "title",
  "translate",
]);

/** Per-element attributes, keyed by tag. */
const TAG_ATTRS: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "download", "hreflang", "rel", "target", "type"],
  audio: ["controls", "loop", "muted", "preload", "src"],
  button: ["disabled", "name", "type", "value"],
  col: ["span"],
  colgroup: ["span"],
  details: ["open", "name"],
  img: ["alt", "decoding", "height", "loading", "sizes", "src", "srcset", "width"],
  ins: ["datetime"],
  del: ["datetime"],
  label: ["for"],
  ol: ["reversed", "start", "type"],
  q: ["cite"],
  blockquote: ["cite"],
  source: ["height", "media", "sizes", "src", "srcset", "type", "width"],
  td: ["colspan", "headers", "rowspan"],
  th: ["abbr", "colspan", "headers", "rowspan", "scope"],
  time: ["datetime"],
  track: ["default", "kind", "label", "src", "srclang"],
  video: ["controls", "height", "loop", "muted", "playsinline", "poster", "preload", "src", "width"],
};

/**
 * SVG presentation and geometry attributes. Flat rather than per-element: the
 * SVG element set here is small and decorative, and the risk in an SVG
 * attribute is the URL-valued ones, which are handled by the URL check.
 */
const SVG_ATTRS: ReadonlySet<string> = new Set([
  "clip-rule",
  "cx",
  "cy",
  "d",
  "fill",
  "fill-opacity",
  "fill-rule",
  "focusable",
  "height",
  "opacity",
  "points",
  "preserveAspectRatio",
  "r",
  "rx",
  "ry",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "stroke-width",
  "transform",
  "vector-effect",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
]);

/** Attributes whose value is a URL and therefore needs the URL check. */
const URL_ATTRS: ReadonlySet<string> = new Set(["href", "src", "poster", "cite", "srcset"]);

/**
 * Attributes the *builder* owns on a Block's root element.
 *
 * A design that sets them is rejected rather than silently overwritten. The
 * quiet version of this rule produces a Theme whose own `[data-variant]`
 * selectors mysteriously do not match, which is a much worse afternoon than an
 * import-time error naming the attribute.
 */
const BUILDER_OWNED_ATTRS: ReadonlySet<string> = new Set([
  "data-block",
  "data-block-id",
  "data-variant",
  "data-shell-variant",
]);

/** The reserved tag marking where the builder inserts the Blocks. */
export const CONTENT_SLOT_TAG = "slot";

interface NormalisedNode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly children: readonly unknown[];
}

/** Recognise both spellings of a node, or return `undefined`. */
function asNode(value: unknown): NormalisedNode | undefined {
  if (Array.isArray(value)) {
    const [tag, attrs, ...children] = value as readonly unknown[];
    if (typeof tag !== "string") return undefined;
    return {
      tag,
      attrs: isPlainRecord(attrs) ? attrs : {},
      children: attrs === null || attrs === undefined || isPlainRecord(attrs) ? children : [attrs, ...children],
    };
  }
  if (isPlainRecord(value) && typeof value["tag"] === "string") {
    const raw = value["children"];
    return {
      tag: value["tag"],
      attrs: isPlainRecord(value["attrs"]) ? value["attrs"] : {},
      children: Array.isArray(raw) ? raw : raw === undefined ? [] : [raw],
    };
  }
  return undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The sentinel `helpers.richText` returns. */
const RICH_TEXT_SENTINEL = "$sosbRichText";

/** Build the sentinel for index `n` in the host's rendered-prose table. */
export function richTextSentinel(index: number): Record<string, number> {
  return { [RICH_TEXT_SENTINEL]: index };
}

function richTextIndexOf(value: unknown): number | undefined {
  if (!isPlainRecord(value)) return undefined;
  const index = value[RICH_TEXT_SENTINEL];
  return typeof index === "number" && Number.isInteger(index) && index >= 0 ? index : undefined;
}

/**
 * Everything the converter needs that is not the tree itself.
 *
 * `trustedUrls` is the set of strings the builder's own helpers produced during
 * this render. A `blob:` URL from the preview's asset resolver is not something
 * `isAcceptableLinkUrl` would ever accept, and rightly so — but the builder
 * minted it, so it is trusted here by identity rather than by pattern.
 */
export interface TreeContext {
  readonly themeId: string;
  readonly subject: string;
  readonly blockType?: string | undefined;
  readonly trustedUrls: ReadonlySet<string>;
  /** Builder-rendered prose, indexed by the sentinel's number. */
  readonly richText: readonly preact.JSX.Element[];
  /** Replacement nodes for the content slot. `undefined` forbids a slot. */
  readonly slotContent?: preact.JSX.Element | undefined;
}

function reject(ctx: TreeContext, detail: string): never {
  throw new ThemeRenderError({
    code: "invalid-tree",
    themeId: ctx.themeId,
    subject: ctx.subject,
    blockType: ctx.blockType,
    detail,
  });
}

/**
 * Is this href/src value one a published static page may carry?
 *
 * Helper-produced values pass by identity. Everything else must be either a
 * package-relative path (no scheme, no protocol-relative `//host`) or a URL
 * `isAcceptableLinkUrl` accepts — which is `http`, `https`, `mailto`, `tel`
 * and nothing else, so `javascript:` and `data:` are out by construction.
 */
function isSafeTreeUrl(value: string, trusted: ReadonlySet<string>): boolean {
  if (trusted.has(value)) return true;
  if (value.length === 0) return true;
  if (value.startsWith("#")) return true;
  if (value.startsWith("//")) return false;
  // A scheme-less reference is a relative path. Reject control characters and
  // whitespace, which are the classic way to smuggle a scheme past a check.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return !/[ - "'<>\\]/.test(value);
  }
  return isAcceptableLinkUrl(value);
}

function attrIsAllowed(tag: string, name: string, svg: boolean): boolean {
  if (name.startsWith("data-") || name.startsWith("aria-")) return true;
  if (GLOBAL_ATTRS.has(name)) return true;
  if (svg) return SVG_ATTRS.has(name);
  return (TAG_ATTRS[tag] ?? []).includes(name);
}

/**
 * Convert one validated node's attributes into Preact props.
 *
 * `false`, `null` and `undefined` drop the attribute (the same convention the
 * built-in components rely on), numbers and booleans pass through, and
 * everything else must be a string.
 */
function convertAttrs(
  node: NormalisedNode,
  ctx: TreeContext,
  svg: boolean,
  extra: Readonly<Record<string, string | undefined>>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const name of Object.keys(node.attrs).sort()) {
    if (/^on/i.test(name)) {
      reject(ctx, `<${node.tag}> carries the event handler attribute "${name}". Behaviour belongs in public.js.`);
    }
    if (name === "style") {
      reject(
        ctx,
        `<${node.tag}> carries a "style" attribute. Put the rules in the Theme stylesheet, which the offline scanner checks.`,
      );
    }
    if (BUILDER_OWNED_ATTRS.has(name)) {
      reject(ctx, `<${node.tag}> sets "${name}", which the builder places itself.`);
    }
    if (!attrIsAllowed(node.tag, name, svg)) {
      reject(ctx, `<${node.tag}> carries the unsupported attribute "${name}".`);
    }

    const value = node.attrs[name];
    if (value === false || value === null || value === undefined) continue;
    if (value === true) {
      props[name] = true;
      continue;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) reject(ctx, `<${node.tag}> attribute "${name}" is not a finite number.`);
      props[name] = value;
      continue;
    }
    if (typeof value !== "string") {
      reject(ctx, `<${node.tag}> attribute "${name}" must be a string, number or boolean.`);
    }
    if (URL_ATTRS.has(name) && !isSafeTreeUrl(value, ctx.trustedUrls)) {
      reject(
        ctx,
        `<${node.tag}> attribute "${name}" is not an acceptable URL ("${value.slice(0, 60)}"). ` +
          `Use input.asset(), input.pageUrl() or input.articleUrl(), or a plain http(s)/mailto/tel URL.`,
      );
    }
    props[name] = value;
  }

  // Anchors that open a new tab get `noopener noreferrer`. The builder owns
  // this: an author picking a Theme is not choosing to hand `window.opener` to
  // whatever the Theme links out to.
  if (node.tag === "a" && props["target"] === "_blank") {
    const rel = typeof props["rel"] === "string" ? props["rel"] : "";
    const parts = new Set(rel.split(/\s+/).filter((p) => p.length > 0));
    parts.add("noopener");
    parts.add("noreferrer");
    props["rel"] = [...parts].sort().join(" ");
  }

  for (const [name, value] of Object.entries(extra)) {
    if (value !== undefined) props[name] = value;
  }
  return props;
}

/**
 * Convert a validated `ElementTree` into a Preact vnode.
 *
 * `depth` and the node budget exist because a design that returns a
 * ten-thousand-deep tree is indistinguishable, from here, from one that
 * returned a runaway loop's output — and the failure mode without a limit is a
 * stack overflow inside `preact-render-to-string`, which reports nothing
 * useful about which Theme caused it.
 */
const MAX_TREE_DEPTH = 64;
const MAX_TREE_NODES = 20000;

interface ConvertState {
  nodes: number;
}

function convert(
  value: unknown,
  ctx: TreeContext,
  state: ConvertState,
  depth: number,
  svg: boolean,
): preact.ComponentChild {
  if (value === null || value === undefined || value === false || value === true) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reject(ctx, "a tree node is a non-finite number.");
    return String(value);
  }
  if (depth > MAX_TREE_DEPTH) {
    reject(ctx, `the tree is deeper than ${MAX_TREE_DEPTH} levels.`);
  }
  if (++state.nodes > MAX_TREE_NODES) {
    reject(ctx, `the tree has more than ${MAX_TREE_NODES} nodes.`);
  }

  const rich = richTextIndexOf(value);
  if (rich !== undefined) {
    const rendered = ctx.richText[rich];
    if (rendered === undefined) reject(ctx, "a richText() result was used in a different render pass.");
    return rendered;
  }

  if (Array.isArray(value)) {
    const node = asNode(value);
    if (node === undefined) {
      // A bare array of children is a fragment.
      return (value as readonly unknown[]).map((child) => convert(child, ctx, state, depth + 1, svg));
    }
    return convertNode(node, ctx, state, depth, svg);
  }

  const node = asNode(value);
  if (node === undefined) {
    reject(ctx, "a tree node is neither text, an array, nor an object with a string `tag`.");
  }
  return convertNode(node, ctx, state, depth, svg);
}

function convertNode(
  node: NormalisedNode,
  ctx: TreeContext,
  state: ConvertState,
  depth: number,
  svg: boolean,
): preact.ComponentChild {
  if (node.tag === CONTENT_SLOT_TAG) {
    if (ctx.slotContent === undefined) {
      reject(ctx, "a content slot may only appear in a shell design.");
    }
    return ctx.slotContent;
  }

  const inSvg = svg || node.tag === "svg";
  const known = inSvg ? ALLOWED_SVG_TAGS.has(node.tag) : ALLOWED_HTML_TAGS.has(node.tag);
  if (!known) {
    reject(ctx, `<${node.tag}> is not an element a Theme design may emit.`);
  }

  const props = convertAttrs(node, ctx, inSvg, {});
  const children = node.children.map((child) => convert(child, ctx, state, depth + 1, inSvg));
  return h(node.tag, props, ...children);
}

/**
 * Validate and convert a Block design's output.
 *
 * The root must be a single element, because the builder stamps `data-block`,
 * `data-block-id` and `data-variant` onto it. Those attributes are the entire
 * addressing scheme ADR 0050 documents for Theme CSS; letting a design return
 * a fragment would mean a Block whose own stylesheet cannot select it.
 */
export function blockTreeToVNode(
  tree: unknown,
  ctx: TreeContext,
  root: { blockType: string; blockId: string; variant: string | undefined },
): preact.JSX.Element | null {
  if (tree === null || tree === undefined || tree === false) return null;
  const node = asNode(tree);
  if (node === undefined) {
    reject(ctx, "a Block design must return a single element, or null to render nothing.");
  }
  if (node.tag === CONTENT_SLOT_TAG) {
    reject(ctx, "a content slot may only appear in a shell design.");
  }
  const inSvg = node.tag === "svg";
  if (!(inSvg ? ALLOWED_SVG_TAGS : ALLOWED_HTML_TAGS).has(node.tag)) {
    reject(ctx, `<${node.tag}> is not an element a Theme design may emit.`);
  }
  const state: ConvertState = { nodes: 1 };
  const props = convertAttrs(node, ctx, inSvg, {
    "data-block": root.blockType,
    "data-block-id": root.blockId,
    "data-variant": root.variant,
  });
  const children = node.children.map((child) => convert(child, ctx, state, 1, inSvg));
  return h(node.tag, props, ...children);
}

/**
 * Validate and convert a shell design's output.
 *
 * Exactly one content slot. Zero means the author's Blocks would vanish;
 * several means the reading order is no longer the one the author created,
 * which ADR 0046 forbids outright. Both are render errors rather than
 * best-effort repairs: a shell that silently drops the page body is the
 * failure mode a student would publish without noticing.
 */
export function shellTreeToVNode(
  tree: unknown,
  ctx: TreeContext & { slotContent: preact.JSX.Element },
): preact.JSX.Element {
  const slots = countSlots(tree, 0);
  if (slots !== 1) {
    throw new ThemeRenderError({
      code: "slot-count",
      themeId: ctx.themeId,
      subject: ctx.subject,
      detail:
        slots === 0
          ? `the shell contains no ["${CONTENT_SLOT_TAG}"] node, so the page's Blocks would have nowhere to go.`
          : `the shell contains ${slots} ["${CONTENT_SLOT_TAG}"] nodes; exactly one is allowed so the Block reading order is unambiguous.`,
    });
  }
  const state: ConvertState = { nodes: 0 };
  const converted = convert(tree, ctx, state, 0, false);
  // A Fragment, not a wrapper element: the shell design owns the body's
  // markup, and a builder-inserted <div> around it would be one more box for
  // every Theme's CSS to work around.
  return h(Fragment, null, converted) as preact.JSX.Element;
}

/** Count content slots without validating anything else. */
function countSlots(value: unknown, depth: number): number {
  if (depth > MAX_TREE_DEPTH) return 0;
  if (Array.isArray(value)) {
    const node = asNode(value);
    if (node === undefined) {
      return (value as readonly unknown[]).reduce<number>((sum, child) => sum + countSlots(child, depth + 1), 0);
    }
    if (node.tag === CONTENT_SLOT_TAG) return 1;
    return node.children.reduce<number>((sum, child) => sum + countSlots(child, depth + 1), 0);
  }
  const node = asNode(value);
  if (node === undefined) return 0;
  if (node.tag === CONTENT_SLOT_TAG) return 1;
  return node.children.reduce<number>((sum, child) => sum + countSlots(child, depth + 1), 0);
}
