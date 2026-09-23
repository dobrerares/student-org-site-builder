/** @jsxImportSource preact */
/**
 * Running a Theme's executable design and turning its output into markup.
 *
 * `theme-render.ts` owns the *contract* — the tree shape, what an element may
 * be, what an attribute may say. This module owns the *call*: what the design
 * is told about the Site, which helpers it gets, and what happens when it
 * fails.
 *
 * The split matters because the contract has no idea what a Site is and the
 * caller has no idea what a QuickJS handle is. Neither half can grow into the
 * other by accident.
 *
 * ## What a design is told
 *
 * Supplied Site content and nothing else (ADR 0046). A Block design receives
 * the Block envelope, the document it sits in, the organisation's identity and
 * the active Theme's settings. A shell design additionally receives the
 * builder-computed navigation, the language links and the page's title — the
 * same values the built-in shell renders from, so a Theme cannot compute a URL
 * differently from the builder that will export it.
 *
 * ## What happens when it fails
 *
 * Deploy mode rethrows, so `build()` stops (ADR 0045: a rendering failure is
 * not acknowledgeable). Preview mode reports the failure through
 * `onIssue` and renders a builder-owned error box in the Block's place, so an
 * author editing a page sees *which* Block broke rather than a blank preview
 * and no explanation.
 */

import type { BlockEnvelope, Site } from "@sosb/schema";
import { isKnownBlockType } from "@sosb/schema";
import { markdownToHtml } from "@sosb/markdown";
import { articleCopy, languageFamily, type ArticleCopyKey } from "./article-text.js";
import { assetRefAlt, assetRefPath } from "./asset-ref-path.js";
import type { AssetUrlForPath } from "./asset-url.js";
import { resolveAssetUrl } from "./asset-url.js";
import { articlePath, pagePath } from "./routing.js";
import type { ThemeBundle } from "./theme-bundle.js";
import { themeAssetPrefix } from "./theme-bundle.js";
import type { ThemeRenderHelpers, TreeContext } from "./theme-render.js";
import {
  ThemeRenderError,
  blockTreeToVNode,
  isThemeRenderError,
  richTextSentinel,
  shellTreeToVNode,
} from "./theme-render.js";

/** Which document a Block belongs to, for issue reporting. */
export interface RenderedDocumentRef {
  readonly kind: "page" | "article";
  /** `lang:slug` for a Page, the permanent id for an Article. */
  readonly id: string;
  readonly title: string;
  readonly lang: string;
}

/**
 * A Block the active Theme has no design for, dropped from the output.
 *
 * ADR 0045: a Custom Block with no design in the active Theme is *omitted*,
 * and the author acknowledges the omission before export. This is the record
 * `build()` hands the editor so it can ask.
 */
export interface OmittedBlock {
  readonly document: RenderedDocumentRef;
  readonly blockId: string;
  readonly blockType: string;
}

/** Everything `renderSite` reports about a Theme's executable design. */
export type ThemeRenderIssue =
  | { readonly kind: "omitted-block"; readonly omitted: OmittedBlock }
  | {
      readonly kind: "render-failed";
      readonly document: RenderedDocumentRef;
      readonly error: ThemeRenderError;
    };

/** The per-render state a design needs. Assembled once per document. */
export interface DesignContext {
  readonly site: Site;
  readonly bundle: ThemeBundle;
  readonly lang: string;
  readonly docRef: RenderedDocumentRef;
  readonly assetUrlForPath: AssetUrlForPath | undefined;
  readonly mode: "deploy" | "preview";
  readonly onIssue: ((issue: ThemeRenderIssue) => void) | undefined;
}

/** Does the active Theme supply a design for this Block type? */
export function themeDesignsBlockType(bundle: ThemeBundle, blockType: string): boolean {
  return bundle.render !== undefined && bundle.render.blockTypes.includes(blockType);
}

/**
 * Will this Block appear in the output at all?
 *
 * A built-in type always has a component; anything else needs a design from
 * the active Theme. This is the one predicate behind ADR 0045's omission rule
 * — the page shell consults it while rendering, and `omittedBlocksFor` consults
 * it before an export — so the editor's pre-flight list and what `build()`
 * actually drops cannot disagree.
 *
 * A built-in component that renders *nothing* for empty data (a site footer
 * with no contact details) is not an omission: the Block has a design, the
 * design chose to be silent.
 */
export function blockHasDesign(bundle: ThemeBundle | undefined, blockType: string): boolean {
  if (isKnownBlockType(blockType)) return true;
  return bundle !== undefined && themeDesignsBlockType(bundle, blockType);
}

/**
 * Every Block the public Site would omit for want of a design, in output
 * order: Pages first, then non-Draft Articles (Drafts are not published, so
 * their Blocks cannot be omitted from anything).
 *
 * Computed statically rather than by rendering, so the editor can ask before
 * it builds. `build()` reports the same Blocks through `onOmittedBlock` from
 * the real render, which is the ground truth; a test holds the two together.
 */
export function omittedBlocksFor(site: Site, bundle: ThemeBundle | undefined): OmittedBlock[] {
  const omitted: OmittedBlock[] = [];
  const collect = (blocks: readonly BlockEnvelope[], document: RenderedDocumentRef): void => {
    for (const block of blocks) {
      if (blockHasDesign(bundle, block.type)) continue;
      omitted.push({ document, blockId: block.id, blockType: block.type });
    }
  };
  for (const page of site.pages) {
    collect(page.blocks, {
      kind: "page",
      id: `${page.lang}:${page.slug}`,
      title:
        page.seo?.title !== undefined && page.seo.title.length > 0 ? page.seo.title : page.navLabel,
      lang: page.lang,
    });
  }
  for (const article of site.articles ?? []) {
    if (article.state === "draft") continue;
    collect(article.blocks, {
      kind: "article",
      id: article.id,
      title: article.title,
      lang: article.lang,
    });
  }
  return omitted;
}

/**
 * Per-call helper state.
 *
 * `trusted` collects every URL the builder itself produced during this call.
 * The tree validator accepts those by identity, which is what lets a preview's
 * `blob:` URL through a check that would otherwise (correctly) refuse it.
 */
class HelperScope {
  readonly trusted = new Set<string>();
  readonly rich: preact.JSX.Element[] = [];

  constructor(private readonly ctx: DesignContext) {}

  private trust(url: string): string {
    this.trusted.add(url);
    return url;
  }

  /** Mark a builder-produced URL as acceptable in this call's tree. */
  trustUrl(url: string): void {
    this.trusted.add(url);
  }

  helpers(): ThemeRenderHelpers {
    const { site, bundle, lang, assetUrlForPath } = this.ctx;
    return {
      asset: (path: string): string => {
        const clean = String(path).replace(/^\.?\//, "");
        return this.trust(resolveAssetUrl(themeAssetPrefix(bundle.id) + clean, assetUrlForPath));
      },
      mediaUrl: (ref: unknown): string | null => {
        const path = typeof ref === "string" ? ref : assetRefPath(ref);
        if (path === undefined || path.length === 0) return null;
        return this.trust(resolveAssetUrl(path, assetUrlForPath));
      },
      mediaAlt: (ref: unknown): string => (typeof ref === "string" ? "" : assetRefAlt(ref)),
      pageUrl: (pageId: string): string | null => {
        const page = site.pages.find((p) => `${p.lang}:${p.slug}` === pageId);
        if (page === undefined) return null;
        return this.trust(pagePath(site, page));
      },
      articleUrl: (articleId: string): string | null => {
        const article = (site.articles ?? []).find((a) => a.id === articleId);
        if (article === undefined) return null;
        return this.trust(articlePath(site, article));
      },
      richText: (doc: unknown): unknown => {
        const index = this.rich.length;
        this.rich.push(renderRichText(doc));
        return richTextSentinel(index);
      },
      t: (key: string): string => renderCopy(lang, key),
    };
  }

  treeContext(subject: string, blockType?: string): TreeContext {
    return {
      themeId: this.ctx.bundle.id,
      subject,
      blockType,
      trustedUrls: this.trusted,
      richText: this.rich,
    };
  }
}

/**
 * Builder-rendered prose for `helpers.richText`.
 *
 * Deliberately the *same* pipeline the Rich-text Block uses, so prose placed by
 * a Theme and prose placed by the author escape identically and gain
 * structured rich text (ADR 0048) at the same moment.
 */
function renderRichText(doc: unknown): preact.JSX.Element {
  const source = typeof doc === "string" ? doc : "";
  return <div class="rich-text" dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }} />;
}

/**
 * The page-shell copy a Theme design may ask `t()` for.
 *
 * A Theme's header needs a handful of visitor-facing words — "Menu" on a
 * navigation toggle, "Since" beside a founding year — and the Theme must not
 * hard-code them in one language, because the same Theme renders a Romanian
 * Page and its English counterpart. These follow the page language by the same
 * family rule as the Article copy. Deliberately small: a Theme that needs a
 * sentence has content, and content belongs in a Block (ADR 0046).
 */
const SHELL_COPY = {
  ro: {
    navigation: "Navigația site-ului",
    menu: "Meniu",
    close: "Închide",
    home: "Acasă",
    since: "Din",
    siteInfo: "Informații despre site",
    skipToContent: "Sari la conținut",
  },
  en: {
    navigation: "Site navigation",
    menu: "Menu",
    close: "Close",
    home: "Home",
    since: "Since",
    siteInfo: "Site information",
    skipToContent: "Skip to content",
  },
} as const;

export type ShellCopyKey = keyof (typeof SHELL_COPY)["en"];

/** Every key `t()` answers, for the documentation and its test. */
export const THEME_COPY_KEYS: readonly string[] = [
  ...(Object.keys(SHELL_COPY.en) as ShellCopyKey[]),
  "emptyList",
  "relatedTitle",
  "tagsLabel",
  "languageLabel",
  "publishedOn",
  "movedHeading",
  "movedLink",
];

/** Renderer-owned visitor copy. Unknown keys return the key, never `undefined`. */
function renderCopy(lang: string, key: string): string {
  const shell = SHELL_COPY[languageFamily(lang)];
  if (Object.hasOwn(shell, key)) return shell[key as ShellCopyKey];
  const article: readonly ArticleCopyKey[] = [
    "emptyList",
    "relatedTitle",
    "tagsLabel",
    "languageLabel",
    "publishedOn",
    "movedHeading",
    "movedLink",
  ];
  return article.includes(key as ArticleCopyKey) ? articleCopy(lang, key as ArticleCopyKey) : key;
}

// ---------------------------------------------------------------------------
// Input construction
// ---------------------------------------------------------------------------

function orgInput(site: Site): Record<string, unknown> {
  const { org } = site;
  const logoPath = assetRefPath(org.logo);
  return {
    name: org.name,
    tagline: org.tagline ?? null,
    foundedYear: org.foundedYear ?? null,
    email: org.email ?? null,
    phone: org.phone ?? null,
    address: org.address ?? null,
    social: (org.social ?? []).map((link) => ({ platform: link.platform, url: link.url })),
    logo:
      logoPath === undefined
        ? null
        : {
            path: logoPath,
            alt:
              typeof org.logoAlt === "string" && org.logoAlt.length > 0
                ? org.logoAlt
                : assetRefAlt(org.logo),
            width: org.logo?.width ?? 0,
            height: org.logo?.height ?? 0,
          },
  };
}

function themeInput(ctx: DesignContext, shellVariant: string | undefined): Record<string, unknown> {
  const tokens = (ctx.site.theme.tokens ?? {}) as Record<string, unknown>;
  return {
    id: ctx.bundle.id,
    version: ctx.bundle.version,
    shellVariant: shellVariant ?? null,
    tokens: { ...tokens },
  };
}

/** The envelope-plus-surroundings record a Block design receives. */
function blockInput(
  block: BlockEnvelope,
  ctx: DesignContext,
  variant: string | undefined,
  shellVariant: string | undefined,
): Record<string, unknown> {
  return {
    id: block.id,
    type: block.type,
    version: block.version,
    data: block.data,
    variant: variant ?? null,
    lang: ctx.lang,
    document: { ...ctx.docRef },
    org: orgInput(ctx.site),
    theme: themeInput(ctx, shellVariant),
  };
}

/** What a shell design receives on top of the Block input's common fields. */
export interface ShellInputParts {
  readonly title: string;
  readonly description: string | undefined;
  /** The builder-computed href of this language's home Page, for the brand link. */
  readonly homeHref: string;
  readonly nav: readonly {
    readonly id: string;
    readonly label: string;
    readonly href: string;
    readonly isActive: boolean;
  }[];
  readonly languages: readonly {
    readonly lang: string;
    readonly nativeName: string;
    readonly href: string;
    readonly isActive: boolean;
  }[];
  readonly shellVariant: string | undefined;
}

// ---------------------------------------------------------------------------
// Running a design
// ---------------------------------------------------------------------------

/**
 * Turn whatever the module threw into a `ThemeRenderError`.
 *
 * The sandbox already raises `ThemeRenderError` for its own failures (budget
 * exhausted, guest exception). Anything else reaching here is a builder bug or
 * a helper throwing, and is reported with the same shape so the editor has one
 * thing to display.
 */
function asRenderError(
  cause: unknown,
  bundle: ThemeBundle,
  subject: string,
  blockType: string | undefined,
): ThemeRenderError {
  // Re-stamped rather than passed through: the sandbox knows the Block *type*
  // it was asked to render but not which Block instance, and "the partners
  // Block failed" is a much worse message on a page with four of them than
  // "block p3 (org.example/partners) failed".
  if (isThemeRenderError(cause)) {
    return new ThemeRenderError({
      code: cause.code,
      themeId: cause.themeId,
      subject,
      blockType,
      detail: cause.detail,
    });
  }
  return new ThemeRenderError({
    code: "threw",
    themeId: bundle.id,
    subject,
    blockType,
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

/**
 * The builder-owned failure box.
 *
 * Preview only, and deliberately not styled by the Theme: a Theme whose code
 * just crashed is not the thing to ask for a presentation of the crash. The
 * inline style is the builder's own and is the one place in the output where
 * that is true.
 */
function ThemeErrorBox(props: { message: string }): preact.JSX.Element {
  return (
    <div
      {...{ "data-sosb-theme-error": "" }}
      role="alert"
      style="margin:1rem;padding:1rem;border:2px solid #b3261e;border-radius:4px;background:#fff;color:#410e0b;font:14px/1.5 system-ui,sans-serif"
    >
      <strong style="display:block;margin-bottom:.25rem">
        This Theme could not render this part of the page.
      </strong>
      {props.message}
    </div>
  );
}

/**
 * Render one Block through the active Theme's design.
 *
 * Returns `null` when the design deliberately rendered nothing. Throws in
 * deploy mode; returns an error box in preview mode.
 */
export function renderDesignedBlock(
  block: BlockEnvelope,
  ctx: DesignContext,
  variant: string | undefined,
  shellVariant: string | undefined,
): preact.JSX.Element | null {
  const module = ctx.bundle.render;
  if (module === undefined) return null;
  const scope = new HelperScope(ctx);
  try {
    const tree = module.renderBlock(
      block.type,
      blockInput(block, ctx, variant, shellVariant),
      scope.helpers(),
    );
    return blockTreeToVNode(tree, scope.treeContext(block.id, block.type), {
      blockType: block.type,
      blockId: block.id,
      variant,
    });
  } catch (cause) {
    const error = asRenderError(cause, ctx.bundle, block.id, block.type);
    ctx.onIssue?.({ kind: "render-failed", document: ctx.docRef, error });
    if (ctx.mode === "deploy") throw error;
    return <ThemeErrorBox message={error.message} />;
  }
}

/**
 * Render the visible page shell through the active Theme's design.
 *
 * Returns `undefined` when the Theme supplies no shell design, or when a shell
 * design failed in preview mode — in which case the caller falls back to the
 * builder's own shell and shows the error box above the content, because a
 * page with no header is still an editable page and a blank one is not.
 */
export function renderDesignedShell(
  ctx: DesignContext,
  parts: ShellInputParts,
  slotContent: preact.JSX.Element,
):
  | { body: preact.JSX.Element; error?: undefined }
  | { body?: undefined; error: ThemeRenderError }
  | undefined {
  const module = ctx.bundle.render;
  if (module === undefined || !module.hasShell) return undefined;
  const scope = new HelperScope(ctx);
  try {
    const input = {
      kind: ctx.docRef.kind,
      lang: ctx.lang,
      title: parts.title,
      description: parts.description ?? null,
      document: { ...ctx.docRef },
      homeHref: parts.homeHref,
      nav: parts.nav.map((entry) => ({ ...entry })),
      languages: parts.languages.map((entry) => ({ ...entry })),
      org: orgInput(ctx.site),
      theme: themeInput(ctx, parts.shellVariant),
    };
    // The home href is builder-computed, exactly like a `pageUrl()` result, so
    // it passes the tree's URL check by identity rather than by pattern.
    scope.trustUrl(parts.homeHref);
    const tree = module.renderShell(input, scope.helpers());
    return {
      body: shellTreeToVNode(tree, { ...scope.treeContext("shell"), slotContent }),
    };
  } catch (cause) {
    const error = asRenderError(cause, ctx.bundle, "shell", undefined);
    ctx.onIssue?.({ kind: "render-failed", document: ctx.docRef, error });
    if (ctx.mode === "deploy") throw error;
    return { error };
  }
}

/** The preview-mode error box, for the shell-failure fallback path. */
export function themeErrorBox(message: string): preact.JSX.Element {
  return <ThemeErrorBox message={message} />;
}
