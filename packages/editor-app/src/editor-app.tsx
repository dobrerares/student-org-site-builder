/** @jsxImportSource react */
/**
 * EditorApp — the top-level React shell.
 *
 * Layout responsibilities:
 *
 * - At ≥768px: side-by-side editor pane (forms) and preview pane (iframe).
 * - At <768px: a tab strip with `Editor` and `Preview` tabs swapping the
 *   single visible pane.
 * - A top bar with `Import`, `Export`, `Reset` buttons (wired to the
 *   `onImport`, `onExport`, `onReset` callbacks).
 * - A health footer (always visible) showing aggregate validation counts.
 *   Clicking the footer toggles the Site Health panel.
 * - A pre-export confirmation dialog shown when the user clicks Export
 *   and the current snapshot has any errors or warnings.
 *
 * Editor pane shape (ADR 0042 — drill-in inspector):
 *
 * The editor pane is no longer a flat stack of forms. It has three view
 * branches gated on a discriminated `DrillMode`:
 *
 * - `{ kind: "blocks" }` (default): PagesList, BlockListEditor (rows expose
 *   a click target that drills in), Site settings affordance, LocaleToggle.
 * - `{ kind: "block", blockId }`:    PagesList, back-to-blocks, BlockForm
 *   for the active block, LocaleToggle.
 * - `{ kind: "settings" }`:          PagesList, back-to-blocks, SpineForm,
 *   LocaleToggle.
 *
 * Drill-in is triggered by clicking a block row's primary affordance or
 * the Site settings link; drill-out by clicking the back affordance or
 * pressing Escape. Switching pages while drilled into a block drills you
 * back out (the previously-active block isn't on the new page).
 *
 * Editor responsibilities:
 *
 * - Hold an `EditorState` whose initial site is the prop `initial`.
 * - Walk `SiteSchema` once via `fieldsFromSchema` and pass the field tree
 *   to `<SpineForm>`.
 * - For each known block type, mount `<BlockForm>` against
 *   `KnownBlockSchemas[type].shape.data`; patches are composed at path
 *   `["pages", i, "blocks", j, "data", ...]` and routed through the same
 *   `applyPatch` pipeline the spine form uses.
 * - On every `EditorState.update`, post the new siteData to the iframe via
 *   the preview-bridge. The iframe also receives a `srcdoc` rewrite for
 *   the structural baseline (so the preview is correct from frame 0, even
 *   before the iframe's hypothetical message listener boots).
 * - Re-run `validate()` on every snapshot change so the panel + footer
 *   stay current.
 *
 * i18n:
 *
 * - Every user-visible string is looked up via `useTranslator()` (#42).
 * - The optional `translator` prop overrides the default (English) and
 *   makes the wider host shell's locale choice flow through. It is wrapped
 *   in `<I18nProvider>` so descendant components see the same translator.
 *
 * NOTE: this component intentionally has no module-level effects. It only
 * looks at `window.innerWidth` inside its own effect, which keeps it
 * trivially renderable in a vitest jsdom environment AND in SSR.
 */
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AssetRefLike,
  BlockEnvelope,
  CustomHtmlBlock,
  DocumentAssetRef,
  Site,
  ValidationIssue,
  ValidationResult,
} from "@sosb/schema";
import { KnownBlockSchemas, SiteSchema, validate } from "@sosb/schema";
import type { ZodType } from "zod";
// Import browser-safe subpaths directly. `@sosb/assets`'s package
// `index.ts` re-exports `createSharpImageProcessor` (a Node-only,
// sharp-backed processor) which transitively reaches `node:fs`,
// `node:child_process` and friends — esbuild's eager static analyser
// chokes on that when bundling for the archival browser build.
// Similarly, `@sosb/vfs`'s `index.ts` re-exports `FsDriver`, which
// imports `node:fs`. Bundling from each module's deep entrypoints
// avoids the Node chain entirely without hiding the dep tree.
import { CanvasImageProcessor } from "@sosb/assets/src/canvas-processor.js";
import { uploadAsset } from "@sosb/assets/src/pipeline.js";
import { uploadDocument } from "@sosb/assets/src/document-pipeline.js";
import { MemoryDriver } from "@sosb/vfs/memory";
import type { Vfs } from "@sosb/vfs/vfs";
import {
  createTranslator,
  enCatalog,
  roCatalog,
  DEFAULT_LOCALE,
  type Translator,
} from "@sosb/i18n";

import { BLOCK_FIELD_METADATA, SPINE_FIELD_METADATA } from "./field-metadata.js";
import { applyAltSyncPatches, expandAltSyncPatches } from "./alt-sync.js";
import { fieldsFromSchema } from "./form-generator.js";
import { getAtPath, setAtPath } from "./get-set-path.js";
import { MEDIA_PICKER_RENDERERS } from "./media-picker-renderers.js";
import { SpineForm, applyPatch } from "./spine-form.js";
import { ThemeForm } from "./theme-form.js";
import { iframeSrcdoc, iframeSrcdocForArticle } from "./iframe-srcdoc.js";
import { resolvePreviewTarget } from "./preview-navigation.js";
import type { PreviewTarget } from "./preview-navigation.js";
// Side-effect import: registers the editor-app stylesheet on `document.head`
// once, before any component renders. Guarded for SSR / non-DOM tooling.
import "./editor-app-css.js";
import { PagesList } from "./pages-list.js";
import { rebaseElement } from "./rebase-element.js";
import {
  IconArrowLeft,
  IconChevronRight,
  IconClose,
  IconGlobe,
  IconLayout,
  IconPalette,
  IconRedo,
  IconSettings,
  IconUndo,
} from "./icons.js";
import { addLanguageVersion, addPage, clonePage, deletePage, movePage } from "./pages-ops.js";
import { AddBlockDialog } from "./add-block-dialog.js";
import { ArticlesPanel } from "./articles-panel.js";
import { ArticleWorkspace } from "./article-workspace.js";
import { ArticleListInspector } from "./article-list-inspector.js";
import { BlockListEditor } from "./block-list-editor.js";
import { BlockForm } from "./block-form.js";
import { buildBlockCatalog } from "./block-catalog.js";
import { defaultArrayItemForBlock } from "./block-array-defaults.js";
import { CustomHtmlBlockForm } from "./custom-html-form.js";
import { defaultBlockFor } from "./block-defaults.js";
import { createPreviewHost } from "@sosb/preview-bridge";
import {
  addBlockToPage,
  createEditorState,
  createHistoryStore,
  moveBlockInPage,
  removeBlockFromPage,
  type EditorState,
  type HistoryStore,
} from "@sosb/editor-state";
import { SiteHealthPanel } from "./site-health.js";
import { HealthFooter } from "./health-footer.js";
import { ExportConfirmDialog } from "./export-confirm.js";
import { navigateToIssue } from "./issue-navigate.js";
import { I18nProvider, useTranslator } from "./i18n-context.js";
import { LocaleToggle } from "./locale-toggle.js";
import { exportToZip, importFromZip, ZipImportError } from "@sosb/zip";
import {
  SITE_VFS_PREFIXES,
  downloadBlob,
  exportZipBasename,
  mergeAssetVfs,
  pickZipBlob,
  populateAssetDisplayUrls,
} from "./site-io.js";
import { fontBlobUrlForPath, revokeFontBlobUrls } from "./font-blobs.js";
import { revokeThemeBlobUrls, themeBlobUrlForPath } from "./theme-blobs.js";
import { BlockVariantControl } from "./block-variant-control.js";
import { setBlockVariant } from "./theme-switch.js";
import {
  exportInstalledThemePackage,
  installThemePackageIntoVfs,
  installedThemeIds,
  loadThemePackageFromVfs,
  loadThemePackageFromZip,
  uninstallThemePackageFromVfs,
} from "@sosb/theme-package";
import { resolveThemeBundle, type ThemeBundle } from "@sosb/renderer";
import { Button, Tabs } from "@sosb/ui";

const MOBILE_BREAKPOINT_PX = 768;

export interface EditorAppProps {
  /** Initial site loaded into the editor. */
  readonly initial: Site;
  /**
   * Optional asset store seeded by a host shell. Used when a parent shell
   * imports a full site zip before mounting the editor.
   */
  readonly initialAssetVfs?: Vfs;
  /** Optional VFS used by `@sosb/editor-state` for debounced draft autosave. */
  readonly autosaveVfs?: Vfs;
  /** Optional — fired when the user clicks the Import button. */
  readonly onImport?: () => void;
  /** Optional — fired when the user clicks the Export button. */
  readonly onExport?: (siteData: Site) => void;
  /** Optional — fired when the user clicks the Reset button. */
  readonly onReset?: () => void;
  /**
   * Optional translator. The host shell builds this once (with the user's
   * detected / persisted locale) and passes it in; descendants pick it up
   * via the i18n context. Falls back to a fresh English translator when
   * omitted, which keeps existing call sites and tests working unchanged.
   */
  readonly translator?: Translator;
}

type TabName = "editor" | "preview";
type PreviewViewport = "fit" | "desktop" | "tablet" | "phone";

/**
 * The device presets the preview toolbar offers.
 *
 * `width`/`height` are CSS pixels of the *simulated* viewport — the layout
 * size the previewed page is told it has. They are not the size the frame
 * occupies on screen: the frame is scaled down to fit the preview pane (see
 * `previewScale`). Before that scaling existed the 1440px desktop frame simply
 * overflowed the pane on any normal laptop, so the "Desktop" preset showed a
 * horizontally-clipped page rather than a desktop viewport.
 *
 * `fit` has no fixed size — the frame fills the pane and the page lays out at
 * whatever width that is.
 */
const PREVIEW_VIEWPORT_OPTIONS: readonly {
  readonly id: PreviewViewport;
  readonly label: string;
  readonly width: number | null;
  readonly height: number | null;
}[] = [
  { id: "fit", label: "Fit", width: null, height: null },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "phone", label: "Phone", width: 390, height: 844 },
];

/** Human-readable size for a preset, e.g. `1440 x 900` or `Auto`. */
export function previewViewportSizeLabel(option: {
  readonly width: number | null;
  readonly height: number | null;
}): string {
  if (option.width === null || option.height === null) return "Auto";
  return `${option.width} x ${option.height}`;
}

/**
 * Scale that fits a `width x height` simulated viewport inside the available
 * pane, never enlarging past 1:1. Returns 1 when the pane has not been
 * measured yet (jsdom, first paint) so the frame renders at its true size
 * rather than collapsing to zero.
 */
export function fitPreviewScale(
  available: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): number {
  if (available.width <= 0 || available.height <= 0) return 1;
  if (viewport.width <= 0 || viewport.height <= 0) return 1;
  return Math.min(1, available.width / viewport.width, available.height / viewport.height);
}

/**
 * Discriminated drill state for the editor pane.
 *
 * - `{ kind: "blocks" }`         the un-drilled default — pages list, block
 *                                list, site-settings affordance, locale.
 * - `{ kind: "block", blockId }` per-block inspector for the active page's
 *                                block whose id matches.
 * - `{ kind: "settings" }`       the site-spine inspector (SpineForm).
 * - `{ kind: "theme" }`          the theme inspector (ThemeForm) —
 *                                ADR 0042 / ADR 0043: theme id picker
 *                                (Phase 1) and tokens (Phase 3).
 *
 * The state is intentionally local to the editor pane; the preview pane
 * and tab strip are unaffected. Switching pages drills you back out (the
 * previously-active block isn't on the new page) — see the page-switch
 * effect below. Site-level inspectors (`settings`, `theme`) stay drilled
 * on page switch.
 */
type DrillMode =
  | { readonly kind: "blocks" }
  | { readonly kind: "block"; readonly blockId: string }
  | { readonly kind: "settings" }
  | { readonly kind: "theme" }
  | { readonly kind: "page" };

/**
 * Today's date as `YYYY-MM-DD`, for seeding a new Article's publication date.
 *
 * The clock lives here rather than in `articles-ops` so those helpers stay pure
 * and their tests stay date-independent. Uses local calendar parts rather than
 * `toISOString`, which would roll an evening in Bucharest back to the previous
 * day in UTC.
 */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Block types an Article's main content cannot hold.
 *
 * `articleList`: issue #97 puts an Article's own list behind the Related
 * Articles setting at the end of the Article, "rather than allowing such
 * lists anywhere in its main content". Offering it in the body picker would
 * hand the author a second, unspecified place to put one.
 *
 * `siteFooter`: an Article inherits its language's footer, and `ArticleShell`
 * filters any footer Block out of the body — so adding one here would look
 * like it worked and then render nothing.
 */
const ARTICLE_BODY_EXCLUDED_BLOCKS: readonly string[] = ["articleList", "siteFooter"];

/** localStorage key remembering that the getting-started tip was dismissed. */
const TIP_DISMISSED_KEY = "sosb.editor.tipDismissed";

function readTipDismissed(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(TIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeTipDismissed(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(TIP_DISMISSED_KEY, "1");
  } catch {
    /* private mode / quota — the tip simply shows again next time */
  }
}

type SaveStatus = "localOnly" | "saving" | "saved" | "error";

export function EditorApp(props: EditorAppProps): JSX.Element {
  const translatorRef = useRef<Translator | undefined>(undefined);
  if (translatorRef.current === undefined) {
    translatorRef.current =
      props.translator ??
      createTranslator({
        catalogs: { en: enCatalog, ro: roCatalog },
        defaultLocale: DEFAULT_LOCALE,
        locale: DEFAULT_LOCALE,
      });
  }
  const translator = props.translator ?? translatorRef.current;

  return (
    <I18nProvider value={translator}>
      <EditorAppInner {...props} />
    </I18nProvider>
  );
}

function EditorAppInner(props: EditorAppProps): JSX.Element {
  const t = useTranslator();

  const stateRef = useRef<EditorState | undefined>(undefined);
  if (stateRef.current === undefined) {
    stateRef.current =
      props.autosaveVfs === undefined
        ? createEditorState({ initial: props.initial })
        : createEditorState({ initial: props.initial, vfs: props.autosaveVfs });
  }
  const state = stateRef.current;

  // History store layered over the editor state. Every discrete user action
  // (add block, remove block, reorder block, edit field) pushes the post-
  // change snapshot. Undo/redo set the editor state back to that snapshot.
  // The history store is created lazily so the initial snapshot lines up
  // with the editor's first `getSnapshot()`.
  const historyRef = useRef<HistoryStore<Site> | undefined>(undefined);
  if (historyRef.current === undefined) {
    historyRef.current = createHistoryStore<Site>({
      initial: state.getSnapshot(),
    });
  }
  const history = historyRef.current;

  const [snapshot, setSnapshot] = useState<Site>(state.getSnapshot());
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    props.autosaveVfs === undefined ? "localOnly" : "saved",
  );
  const saveStatusSeqRef = useRef(0);
  useEffect(() => state.subscribe(setSnapshot), [state]);

  useEffect(() => {
    if (props.autosaveVfs === undefined) {
      setSaveStatus("localOnly");
      return;
    }

    const seq = ++saveStatusSeqRef.current;
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      void state
        .flush()
        .then(() => {
          if (seq === saveStatusSeqRef.current) setSaveStatus("saved");
        })
        .catch(() => {
          if (seq === saveStatusSeqRef.current) setSaveStatus("error");
        });
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [snapshot, state, props.autosaveVfs]);

  // Pass the spine-field metadata so the walker attaches tier/label
  // metadata onto each FieldNode. SpineForm reads `node.tier` to honour
  // the "Show advanced" toggle (ADR 0043).
  const fields = useMemo(
    () =>
      fieldsFromSchema(SiteSchema, {
        overrides: SPINE_FIELD_METADATA,
        schemaRenderers: MEDIA_PICKER_RENDERERS,
      }),
    [],
  );
  // Block catalog memo — used both by the un-drilled block list (indirectly,
  // through its own `buildBlockCatalog()` call) and by the inspector
  // header. Lifted to the top of the component so it lives outside the
  // conditional render branches.
  const blockCatalog = useMemo(() => buildBlockCatalog(), []);

  // Validation result is recomputed on every snapshot change. `validate()`
  // is pure / cheap — running it inline keeps the panel and footer
  // perfectly in sync without a separate event channel.
  const validationResult = useMemo<ValidationResult>(() => validate(snapshot), [snapshot]);

  /**
   * Push the current snapshot onto the history stack. Called after a
   * discrete user action (block add/remove/reorder, form edit committed via
   * a click-out etc.). Form-level keystroke edits still flow through
   * `state.update` directly without an immediate history push — debounced
   * snapshots collapse a stream of typing into a single history entry.
   * That batching policy is documented in the ADR.
   */
  function pushHistory(next: Site): void {
    history.push(next);
    setHistoryVersion((v) => v + 1);
  }

  function applySite(next: Site): void {
    state.update((draft) => {
      Object.assign(draft, next);
    });
    pushHistory(next);
  }

  function doUndo(): void {
    const restored = history.undo();
    if (restored === null) return;
    state.update((draft) => {
      Object.assign(draft, restored);
    });
    setHistoryVersion((v) => v + 1);
  }

  function doRedo(): void {
    const restored = history.redo();
    if (restored === null) return;
    state.update((draft) => {
      Object.assign(draft, restored);
    });
    setHistoryVersion((v) => v + 1);
  }

  // Keyboard shortcuts: Ctrl+Z / Cmd+Z for undo, Ctrl+Shift+Z /
  // Cmd+Shift+Z for redo. We ignore key events whose target is an input
  // currently holding text composition focus only when the modifier is not
  // pressed — with Ctrl/Cmd we always honour the shortcut, matching how
  // VS Code and Figma behave.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "z" && event.key !== "Z") return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      event.preventDefault();
      if (event.shiftKey) {
        doRedo();
      } else {
        doUndo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
    // doUndo/doRedo close over refs (state, history) that are stable for
    // the lifetime of the component, so an empty deps array is safe.
  }, []);

  // Track viewport for the layout switch. Default to 1200 in non-DOM
  // environments so SSR / tests render the two-pane layout by default.
  const initialWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const [viewportWidth, setViewportWidth] = useState<number>(initialWidth);
  useEffect(() => {
    const onResize = (): void => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const isNarrow = viewportWidth < MOBILE_BREAKPOINT_PX;
  const [activeTab, setActiveTab] = useState<TabName>("editor");
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("fit");
  // Bumped whenever the asset display-URL cache gains entries. The cache is a
  // ref (it is filled asynchronously), so the memoised preview render has no
  // other way to learn that a just-uploaded image now has a blob URL.
  const [assetEpoch, setAssetEpoch] = useState<number>(0);

  // The page index currently surfaced in the spine form + preview. Defaults
  // to the home (page 0); reorder/clone/delete update this so the editor
  // never lands on a deleted page, and a brand-new add jumps to it.
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  // Clamp the active index whenever pages mutate.
  const safeActivePageIndex = Math.min(activePageIndex, Math.max(snapshot.pages.length - 1, 0));
  // Slug of the currently-active page. Block-editing helpers receive this
  // explicitly so they stay un-coupled from index assumptions.
  const activePageSlug = snapshot.pages[safeActivePageIndex]?.slug ?? "";

  // Drill state. Defaults to `blocks` on first mount and resets to it
  // whenever the user switches pages — the previously-active block isn't
  // on the new page, so the inspector would dangle. See the
  // `prevPageRef`-driven effect below.
  const [drillMode, setDrillMode] = useState<DrillMode>({ kind: "blocks" });

  // Which half of the left pane is showing. Articles get their own destination
  // rather than sharing the Pages list: issue #102 keeps them separate because
  // they are a different kind of thing with a different lifecycle, and mixing
  // them in one list makes both harder to scan. The navigation redesign will
  // re-home this switch; the components it toggles are built to survive that.
  const [contentKind, setContentKind] = useState<"pages" | "articles">("pages");
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const articleIndex = (snapshot.articles ?? []).findIndex((a) => a.id === activeArticleId);
  const activeArticle = articleIndex >= 0 ? snapshot.articles?.[articleIndex] : undefined;
  // Drop a stale selection when the article is deleted underneath us.
  useEffect(() => {
    if (activeArticleId !== null && articleIndex < 0) setActiveArticleId(null);
  }, [activeArticleId, articleIndex]);
  const prevPageIndexRef = useRef<number>(safeActivePageIndex);
  useEffect(() => {
    if (prevPageIndexRef.current === safeActivePageIndex) return;
    prevPageIndexRef.current = safeActivePageIndex;
    // Page switched while drilled into a block — drill back out so the
    // user lands on the new page's block list instead of staring at a
    // mounted form whose block is no longer in scope.
    setDrillMode((current) => (current.kind === "block" ? { kind: "blocks" } : current));
  }, [safeActivePageIndex]);

  // Escape from a drilled view returns to the un-drilled list. Only the
  // `block` and `settings` modes consume Escape; the `blocks` (default)
  // mode lets it bubble normally.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      setDrillMode((current) => {
        if (current.kind === "blocks") return current;
        return { kind: "blocks" };
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // The block currently mounted in the inspector, or null if not in
  // `block` drill mode (or the id has gone stale after a structural edit).
  // The lookup is intentionally cheap — block lists are short.
  const activePage = snapshot.pages[safeActivePageIndex];
  const activeBlockIndex =
    drillMode.kind === "block"
      ? (activePage?.blocks ?? []).findIndex((b) => b.id === drillMode.blockId)
      : -1;
  const activeBlock: BlockEnvelope | undefined =
    drillMode.kind === "block" && activeBlockIndex >= 0
      ? activePage?.blocks?.[activeBlockIndex]
      : undefined;
  // If the user removed the block they were drilled into (via the row's
  // Remove control on a previous render), fall back to the un-drilled
  // view rather than rendering an empty inspector.
  useEffect(() => {
    if (drillMode.kind === "block" && activeBlock === undefined) {
      setDrillMode({ kind: "blocks" });
    }
  }, [drillMode, activeBlock]);

  // Site Health panel disclosure + export-confirm dialog state.
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [exportDialog, setExportDialog] = useState<ValidationResult | null>(null);

  /**
   * Device-simulation scaling.
   *
   * A preset frame is laid out at its true viewport size (1440x900 and
   * friends) and then transform-scaled to fit the preview pane. Scaling the
   * frame rather than shrinking it is what makes the preset honest: the page
   * inside still believes it has 1440 CSS pixels, so media queries, clamp()
   * type scales and grid breakpoints all resolve the way they will for a real
   * desktop visitor.
   */
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const previewViewportOption = PREVIEW_VIEWPORT_OPTIONS.find((o) => o.id === previewViewport);
  const previewViewportWidth = previewViewportOption?.width ?? null;
  const previewViewportHeight = previewViewportOption?.height ?? null;

  useEffect(() => {
    if (previewViewportWidth === null || previewViewportHeight === null) {
      setPreviewScale(1);
      return;
    }
    const canvas = previewCanvasRef.current;
    if (canvas === null) return;

    function measure(): void {
      const node = previewCanvasRef.current;
      if (node === null) return;
      const style = typeof getComputedStyle === "function" ? getComputedStyle(node) : undefined;
      const padX =
        (Number.parseFloat(style?.paddingLeft ?? "0") || 0) +
        (Number.parseFloat(style?.paddingRight ?? "0") || 0);
      const padY =
        (Number.parseFloat(style?.paddingTop ?? "0") || 0) +
        (Number.parseFloat(style?.paddingBottom ?? "0") || 0);
      setPreviewScale(
        fitPreviewScale(
          { width: node.clientWidth - padX, height: node.clientHeight - padY },
          { width: previewViewportWidth!, height: previewViewportHeight! },
        ),
      );
    }

    measure();
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("resize", measure);
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [previewViewportWidth, previewViewportHeight]);

  // Root ref so issue-navigation queries land in the editor's own DOM
  // tree (and not whatever the host page might have rendered).
  const rootRef = useRef<HTMLDivElement | null>(null);

  function patch(path: readonly (string | number)[], value: unknown): void {
    state.update((draft) => {
      Object.assign(draft, applyPatch(draft, path, value));
    });
    // Push a history snapshot after every form patch. The form's `onInput`
    // already produces one patch per keystroke, so this is "one history
    // entry per keystroke" — coarser batching can be added later without
    // changing the public API. The bounded history capacity keeps memory
    // cost predictable.
    pushHistory(state.getSnapshot());
  }

  /**
   * Compose a block-data patch path. The `BlockForm` emits paths *inside*
   * the block's data (e.g. `["title"]`); we re-root them under the
   * page-and-block scope: `["pages", pageIndex, "blocks", blockIndex,
   * "data", ...sub]`. Same `applyPatch` plumbing as the spine form, just
   * with a longer prefix.
   */
  function patchBlockData(
    pageIndex: number,
    blockIndex: number,
    subpath: readonly (string | number)[],
    value: unknown,
  ): void {
    state.update((draft) => {
      const dataPath: (string | number)[] = ["pages", pageIndex, "blocks", blockIndex, "data"];
      const blockData = getAtPath(draft, dataPath) as Record<string, unknown>;
      const nextData = applyAltSyncPatches(
        blockData,
        expandAltSyncPatches(blockData, subpath, value),
      );
      setAtPath(draft as unknown as Record<string, unknown>, dataPath, nextData);
    });
    pushHistory(state.getSnapshot());
  }

  /**
   * Replace an entire array inside a block's data — used by `BlockForm`'s
   * add/remove/reorder controls (the add-item button, etc.). Goes through
   * the same patch pipeline so the history stack and validation flow stay
   * consistent with leaf edits.
   */
  function arrayChangeBlockData(
    pageIndex: number,
    blockIndex: number,
    subpath: readonly (string | number)[],
    next: unknown[],
  ): void {
    patch(["pages", pageIndex, "blocks", blockIndex, "data", ...subpath], next);
  }

  // Asset pipeline plumbing — a stable in-memory VFS plus the shared
  // Canvas-based `ImageProcessor` (exported as an object singleton, not
  // a class) so every `<AssetPicker>` in every `<BlockForm>` writes
  // through the same store. The browser shell will lift this to a
  // persistent driver (IndexedDB, #35) by passing the VFS in as a prop
  // in a later round; today's MemoryDriver pairs with the ephemeral SPA
  // session and the round-trip zip export path already handles
  // persistence-by-zip.
  const assetVfsRef = useRef<Vfs | undefined>(undefined);
  if (assetVfsRef.current === undefined) {
    assetVfsRef.current = props.initialAssetVfs ?? new MemoryDriver();
  }

  // Display-URL cache for the picker thumbnails.
  //
  // Why this exists: the canonical `AssetRef.path` written by the asset
  // pipeline is a VFS path of the form `assets/<hash>.<ext>` — the
  // exported zip carries it, the renderer reads it, the round-trip is
  // built on it. The browser, however, cannot fetch that path through
  // HTTP in the live editor (no server backs the MemoryDriver), so a
  // raw `<img src={ref.path}>` 404s and the picker bounces into its
  // MISSING state.
  //
  // Fix: when we upload bytes, mint a `blob:` URL pointing at those
  // bytes and cache it keyed by content hash. The picker reads the
  // cache through the `displayUrlFor` prop and uses the blob URL for
  // its `<img src>` while leaving the canonical AssetRef.path
  // untouched in the snapshot. This preserves export/round-trip
  // semantics while making thumbnails actually load.
  //
  // Keying by HASH (not by path) is deliberate: content identity is
  // what dedupes — if the same bytes get uploaded twice they hash to
  // the same value and reuse the same blob URL. This mirrors the
  // pipeline's own dedup property (same bytes → same path).
  //
  // The same cache backs picker thumbnails and the live preview iframe:
  // pickers resolve by AssetRef hash, while the preview resolves canonical
  // `assets/...` paths by extracting the same content hash.
  const displayUrlCacheRef = useRef<Map<string, string> | undefined>(undefined);
  if (displayUrlCacheRef.current === undefined) {
    displayUrlCacheRef.current = new Map();
  }
  // Revoke all minted blob URLs on unmount so we don't leak object-URL
  // entries past the editor's lifetime. `URL.revokeObjectURL` is a
  // no-op for non-blob URLs, but we guard anyway since the cache is
  // strictly blob-only at the moment.
  useEffect(() => {
    return () => {
      const cache = displayUrlCacheRef.current;
      if (cache !== undefined) {
        for (const url of cache.values()) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        }
        cache.clear();
      }
      // Renderer-owned font blobs are minted in a module-level singleton
      // (shared, session-static) rather than this per-mount cache; revoke
      // them here too so a clean unmount leaves no leaked object URLs.
      revokeFontBlobUrls();
      revokeThemeBlobUrls();
    };
  }, []);

  useEffect(() => {
    void populateAssetDisplayUrls(assetVfsRef.current!, displayUrlCacheRef.current!).then(() => {
      setAssetEpoch((n) => n + 1);
    });
  }, []);

  // Theme packages installed in this Site, loaded from the same VFS the zip
  // round trip carries (`themes/<id>/...`). Holding them in editor state — not
  // re-reading the VFS per render — keeps `renderSite` synchronous, which the
  // srcdoc preview depends on.
  const [installedThemes, setInstalledThemes] = useState<readonly ThemeBundle[]>([]);

  async function reloadInstalledThemes(): Promise<void> {
    const vfs = assetVfsRef.current!;
    const bundles: ThemeBundle[] = [];
    for (const id of await installedThemeIds(vfs)) {
      try {
        bundles.push((await loadThemePackageFromVfs(vfs, id)).bundle);
      } catch {
        // A damaged package must not stop the Site from opening (ADR 0051).
        // It simply does not appear as installed, so `themeReferenceIssue`
        // reports it and the Theme form offers the repair.
        continue;
      }
    }
    setInstalledThemes(bundles);
  }

  // Mount-only: the Site's installed Themes are read once from the VFS, and
  // every later change goes through the import/remove handlers, which refresh
  // this list themselves.
  useEffect(() => {
    void reloadInstalledThemes();
  }, []);

  async function importThemePackage(file: File): Promise<void> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Load (and therefore fully validate) before writing anything: a rejected
    // package must leave the Site exactly as it found it.
    const loaded = await loadThemePackageFromZip(bytes);
    await installThemePackageIntoVfs(assetVfsRef.current!, loaded);
    // Re-importing the same id and version with different bytes is the normal
    // rhythm of authoring a Theme, so the blob cache (keyed on id + version)
    // has to be dropped on every import rather than trusted to notice.
    revokeThemeBlobUrls();
    await reloadInstalledThemes();
  }

  async function exportThemePackageFile(themeId: string): Promise<void> {
    const { bytes, filename } = await exportInstalledThemePackage(assetVfsRef.current!, themeId);
    // Reuse the Site export's download helper rather than hand-rolling an
    // anchor: it attaches the element to the document before clicking, which
    // Firefox requires and a detached anchor silently skips.
    downloadBlob(new Blob([bytes], { type: "application/zip" }), filename);
  }

  async function removeThemePackage(themeId: string): Promise<void> {
    await uninstallThemePackageFromVfs(assetVfsRef.current!, themeId);
    // Drop the preview blob URLs minted for this Theme. Without this, removing
    // and re-importing an edited Theme at the same version would keep serving
    // the old bytes from the blob cache, and the author would conclude their
    // edits had not taken.
    revokeThemeBlobUrls();
    await reloadInstalledThemes();
  }

  /**
   * The Theme the Site currently names, resolved against the built-ins and the
   * installed packages. `undefined` when the Site names a package that is not
   * installed — the Theme form then leads with the repair action rather than
   * rendering as if nothing were wrong.
   */
  function resolveActiveTheme(themeId: string): ThemeBundle | undefined {
    const installed = installedThemes.find((bundle) => bundle.id === themeId);
    if (installed !== undefined) return installed;
    const builtin = resolveThemeBundle(themeId);
    return builtin.id === themeId ? builtin : undefined;
  }

  const activeThemeBundle = resolveActiveTheme(snapshot.theme.id);

  function displayUrlForAsset(ref: AssetRefLike): string | undefined {
    return displayUrlCacheRef.current!.get(ref.hash);
  }

  function displayUrlForAssetPath(path: string): string | undefined {
    if (!path.startsWith("assets/")) return undefined;
    // Renderer-owned self-hosted fonts (`assets/fonts/<file>.woff2`) resolve
    // to session-static blob URLs minted from the bundled woff2 base64. These
    // are not user uploads, so they never live in the hash-keyed cache below.
    const fontUrl = fontBlobUrlForPath(path);
    if (fontUrl !== undefined) return fontUrl;
    // An imported Theme's own fonts and decorative files, at the same
    // `assets/theme/<id>/...` paths the build writes. Same bundle, same paths,
    // different resolution — that is the whole of preview/export parity.
    const themeUrl = themeBlobUrlForPath(path, activeThemeBundle);
    if (themeUrl !== undefined) return themeUrl;
    const filename = path.slice("assets/".length);
    const dot = filename.lastIndexOf(".");
    const hash = dot >= 0 ? filename.slice(0, dot) : filename;
    return displayUrlCacheRef.current!.get(hash);
  }

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * Live preview wiring.
   *
   * The preview keeps ONE iframe document alive for as long as it is showing
   * the same page, in the same language, under the same theme. Each edit is
   * rendered host-side with the real renderer (there is still exactly one
   * renderer code path — ADR 0005) and posted over the preview bridge; the
   * renderer's preview-morph script diffs the new markup onto the live
   * document.
   *
   * The previous implementation recomputed the HTML on every React render and
   * fed it back in as `srcdoc`. Reassigning `srcdoc` rebuilds the document
   * from scratch, so every keystroke scrolled the preview back to the top,
   * collapsed any FAQ the user had opened and closed the lightbox — on a long
   * page the section being edited jumped out of view on every character.
   */
  const previewHtml = useMemo(
    () =>
      // An Article preview goes through the same renderer call the export
      // makes, so what the author sees is what ships.
      contentKind === "articles" && articleIndex >= 0
        ? iframeSrcdocForArticle(
            snapshot,
            snapshot.theme.id,
            articleIndex,
            displayUrlForAssetPath,
            activeThemeBundle,
          )
        : iframeSrcdoc(
            snapshot,
            snapshot.theme.id,
            safeActivePageIndex,
            displayUrlForAssetPath,
            activeThemeBundle,
          ),
    // `displayUrlForAssetPath` reads a ref-held cache rather than state, so it
    // is deliberately not a dependency; `assetEpoch` is what actually changes
    // when that cache gains an entry.
    //
    // `activeThemeBundle` *is* a dependency: importing or removing a Theme
    // package changes the bundle without touching the Site snapshot, and
    // without this the preview would keep rendering the previous design.
    [snapshot, safeActivePageIndex, assetEpoch, activeThemeBundle, contentKind, articleIndex],
  );

  /**
   * What makes the preview a *different document* rather than an edit of the
   * current one. Morphing across any of these would carry over state that no
   * longer means anything — a scroll offset into the page the user just left,
   * or a disclosure open in a theme that styles it completely differently —
   * so these force a full `srcdoc` reload instead.
   */
  // Moving between a Page and an Article, or between two Articles, is a
  // different document for exactly the same reasons — so both join the key.
  const previewingArticle = contentKind === "articles" && articleIndex >= 0;
  const previewReloadKey = [
    snapshot.theme.id,
    // An imported Theme's version, so re-importing an edited package boots a
    // fresh document. Morphing would update the `<style>` text but keep the
    // old document's already-resolved `blob:` font URLs, which the import
    // revoked — the page would render the new CSS with no fonts.
    activeThemeBundle?.origin === "package" ? activeThemeBundle.version : "",
    previewingArticle ? "article" : "page",
    previewingArticle ? articleIndex : safeActivePageIndex,
    previewingArticle
      ? ((snapshot.articles ?? [])[articleIndex]?.lang ?? "")
      : (snapshot.pages[safeActivePageIndex]?.lang ?? ""),
  ].join("\u0000");

  // The document the iframe boots with. Only replaced on a reload, so the
  // `srcDoc` prop stays referentially stable across edits and React never
  // reassigns it. Derived during render (rather than in an effect) so the
  // freshly-keyed iframe boots with matching HTML on its very first paint.
  const previewBootHtmlRef = useRef<string>(previewHtml);
  const previewReloadKeyRef = useRef<string>(previewReloadKey);
  const previewReadyRef = useRef<boolean>(false);
  const previewPendingHtmlRef = useRef<string | null>(null);
  if (previewReloadKeyRef.current !== previewReloadKey) {
    previewReloadKeyRef.current = previewReloadKey;
    previewBootHtmlRef.current = previewHtml;
    previewReadyRef.current = false;
    previewPendingHtmlRef.current = null;
  }

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const host = createPreviewHost({ iframe });
    // The documented ADR 0005 extension point. Nothing renders from it today
    // (rendering stays host-side, so there is one renderer code path), but it
    // is the surface iframe-side consumers are told to listen on.
    host.postSiteData(snapshot, snapshot.theme.id, safeActivePageIndex);
    // The boot document already *is* this HTML — posting it would be a no-op
    // diff, and on first mount the morph script has not booted yet anyway.
    if (previewHtml === previewBootHtmlRef.current) return;
    if (!previewReadyRef.current) {
      // The morph script has not announced itself yet. Hold the newest render
      // — posting now would land before any listener exists and the edit
      // would be silently lost.
      previewPendingHtmlRef.current = previewHtml;
      return;
    }
    host.postPreviewHtml(previewHtml);
  }, [previewHtml, snapshot, safeActivePageIndex]);

  // Inbound preview events. The renderer's preview-only nav script prevents
  // normal iframe navigation and posts `{ type: "navigate", path }`; the
  // editor maps that path back onto `site.pages` and updates the active page.
  // The morph script posts `{ type: "ready" }` once its listener is wired.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const host = createPreviewHost({
      iframe,
      onPreviewEvent(message) {
        if (message.type === "ready") {
          previewReadyRef.current = true;
          const pending = previewPendingHtmlRef.current;
          previewPendingHtmlRef.current = null;
          if (pending !== null) host.postPreviewHtml(pending);
          return;
        }
        if (message.type !== "navigate") return;
        // Clicking a link in the preview behaves like the public website
        // (issue #102), including links into Articles and links a retired
        // slug would redirect. Relative hrefs resolve against whatever is
        // currently previewed, which may itself be an Article.
        const from: PreviewTarget =
          contentKind === "articles" && articleIndex >= 0
            ? { kind: "article", index: articleIndex }
            : { kind: "page", index: safeActivePageIndex };
        const target = resolvePreviewTarget(snapshot, message.path, from);
        if (target === null) return;
        if (target.kind === "article") {
          const article = (snapshot.articles ?? [])[target.index];
          if (article === undefined) return;
          setContentKind("articles");
          setActiveArticleId(article.id);
          return;
        }
        setContentKind("pages");
        if (target.index === safeActivePageIndex && contentKind === "pages") return;
        setActivePageIndex(target.index);
      },
    });
    function onMessage(event: MessageEvent): void {
      host.handleIncomingMessage(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [snapshot, safeActivePageIndex]);

  /**
   * Production uploader fed into every mounted `<AssetPicker>` via
   * `<BlockForm uploader={...}>`. Wraps `uploadAsset` so the picker only
   * has to surface a `File`. The `alt` field is mandatory at upload time
   * — the asset pipeline rejects empty alt — and the file name is a
   * sensible non-empty default the user can revise once the upload
   * resolves. Once we drill in to per-image alt editing (later issue),
   * the picker can thread the existing AssetRef's alt back through
   * `uploader` so re-uploads preserve it; the public callback shape
   * stays `(file) => Promise<AssetRefLike>`.
   */
  async function uploadAssetForPicker(file: File, suggestedAlt?: string): Promise<AssetRefLike> {
    const vfs = assetVfsRef.current!;
    const alt =
      suggestedAlt !== undefined && suggestedAlt.trim().length > 0
        ? suggestedAlt.trim()
        : file.name;
    const ref = await uploadAsset({ kind: "file", file, alt }, vfs, {
      processor: CanvasImageProcessor,
    });
    // Mint a display URL for the picker's thumbnail. Reads the freshly-
    // written bytes back out of the VFS (rather than reusing the input
    // file blob) so the cache reflects what was actually stored —
    // matters for raster uploads, which the pipeline re-encodes (a
    // 12MB JPEG → a re-encoded smaller WebP). Skipped if a URL for
    // this hash is already cached (re-uploading identical bytes hits
    // the dedup path and we already have a usable URL).
    const cache = displayUrlCacheRef.current!;
    if (!cache.has(ref.hash)) {
      const bytes = await vfs.read(ref.path);
      const blob = new Blob([new Uint8Array(bytes)], { type: ref.mime });
      cache.set(ref.hash, URL.createObjectURL(blob));
      setAssetEpoch((n) => n + 1);
    }
    // `@sosb/assets`'s runtime `AssetRef` interface is structurally a
    // subset of `@sosb/schema`'s `z.looseObject`-derived `AssetRefLike`
    // (the latter has an `[x: string]: unknown` index signature for
    // forward-compat). The values are byte-equivalent; the cast bridges
    // the two parallel type declarations (ADR 0040: schema can't depend
    // on `@sosb/assets`).
    return ref as unknown as AssetRefLike;
  }

  /**
   * Production uploader fed into every mounted `<DocumentPicker>` via
   * `<BlockForm documentUploader={...}>`. Mirrors `uploadAssetForPicker`
   * for the document pipeline: wraps `uploadDocument` so the picker
   * only has to surface a `File`. The `label` is mandatory at upload
   * time — the document pipeline rejects empty label — and the file
   * name is a sensible non-empty default the user can revise once the
   * upload resolves through the editor's `label` field. The shared
   * `assetVfsRef` is reused; the VFS holds both image and document
   * bytes side-by-side under `assets/<hash>.<ext>`.
   */
  async function uploadDocumentForPicker(file: File): Promise<DocumentAssetRef> {
    const vfs = assetVfsRef.current!;
    const ref = await uploadDocument({ kind: "file", file, label: file.name }, vfs);
    const cache = displayUrlCacheRef.current!;
    if (!cache.has(ref.hash)) {
      const bytes = await vfs.read(ref.path);
      const blob = new Blob([new Uint8Array(bytes)], { type: ref.mime });
      cache.set(ref.hash, URL.createObjectURL(blob));
    }
    // `@sosb/assets`'s runtime `DocumentRef` interface uses the closed
    // `SupportedDocumentMime` enum for `mime`; the schema's
    // `DocumentAssetRef` widens it to `z.string()` for forward-compat.
    // The values are byte-equivalent; the cast bridges the two parallel
    // type declarations (ADR 0040: schema can't depend on
    // `@sosb/assets`).
    return ref as unknown as DocumentAssetRef;
  }

  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  function onPickBlockType(type: string): void {
    if (contentKind === "articles") {
      if (articleIndex < 0) return;
      const block = defaultBlockFor(type);
      applyArticleChange((site) => {
        const articles = (site.articles ?? []).slice();
        const article = articles[articleIndex];
        if (article === undefined) return site;
        articles[articleIndex] = { ...article, blocks: [...article.blocks, block] };
        return { ...site, articles };
      });
      setPickerOpen(false);
      return;
    }
    if (activePageSlug === "") return;
    const block = defaultBlockFor(type);
    const next = addBlockToPage(snapshot, activePageSlug, block);
    applySite(next);
    setPickerOpen(false);
  }

  function onMoveBlock(from: number, to: number): void {
    if (activePageSlug === "") return;
    if (from === to) return;
    const next = moveBlockInPage(snapshot, activePageSlug, from, to);
    applySite(next);
  }

  function onRemoveBlock(blockId: string): void {
    if (activePageSlug === "") return;
    const next = removeBlockFromPage(snapshot, activePageSlug, blockId);
    applySite(next);
  }

  /**
   * Apply a pure Site transform from one of the Articles components.
   *
   * They are written as `Site -> Site` functions so they stay testable without
   * the editor; this is the single place that feeds them into the undoable
   * snapshot, so Articles editing gets undo/redo for free.
   */
  function applyArticleChange(mutate: (site: Site) => Site): void {
    state.update((draft) => {
      Object.assign(draft, mutate(draft));
    });
    pushHistory(state.getSnapshot());
  }

  function patchArticleBlockData(
    blockIndex: number,
    subpath: readonly (string | number)[],
    value: unknown,
  ): void {
    if (articleIndex < 0) return;
    state.update((draft) => {
      const dataPath: (string | number)[] = [
        "articles",
        articleIndex,
        "blocks",
        blockIndex,
        "data",
      ];
      if (subpath.length === 0) {
        setAtPath(draft as unknown as Record<string, unknown>, dataPath, value);
        return;
      }
      const blockData = getAtPath(draft, dataPath) as Record<string, unknown>;
      const nextData = applyAltSyncPatches(
        blockData,
        expandAltSyncPatches(blockData, subpath, value),
      );
      setAtPath(draft as unknown as Record<string, unknown>, dataPath, nextData);
    });
    pushHistory(state.getSnapshot());
  }

  function arrayChangeArticleBlockData(
    blockIndex: number,
    subpath: readonly (string | number)[],
    next: readonly unknown[],
  ): void {
    if (articleIndex < 0) return;
    state.update((draft) => {
      const dataPath: (string | number)[] = [
        "articles",
        articleIndex,
        "blocks",
        blockIndex,
        "data",
        ...subpath,
      ];
      setAtPath(draft as unknown as Record<string, unknown>, dataPath, [...next]);
    });
    pushHistory(state.getSnapshot());
  }

  function onMoveArticleBlock(from: number, to: number): void {
    if (articleIndex < 0 || from === to) return;
    applyArticleChange((site) => {
      const articles = (site.articles ?? []).slice();
      const article = articles[articleIndex];
      if (article === undefined) return site;
      const blocks = article.blocks.slice();
      const [moved] = blocks.splice(from, 1);
      if (moved === undefined) return site;
      blocks.splice(to, 0, moved);
      articles[articleIndex] = { ...article, blocks };
      return { ...site, articles };
    });
  }

  function onRemoveArticleBlock(blockId: string): void {
    if (articleIndex < 0) return;
    applyArticleChange((site) => {
      const articles = (site.articles ?? []).slice();
      const article = articles[articleIndex];
      if (article === undefined) return site;
      articles[articleIndex] = {
        ...article,
        blocks: article.blocks.filter((b) => b.id !== blockId),
      };
      return { ...site, articles };
    });
  }

  function handleAddPage(slug: string): void {
    state.update((draft) => {
      Object.assign(draft, addPage(draft, slug));
    });
    // Jump to the newly-added page (last in pages[]).
    setActivePageIndex(snapshot.pages.length); // index of new last page
  }

  function handleClonePage(index: number, slug: string): void {
    state.update((draft) => {
      Object.assign(draft, clonePage(draft, index, slug));
    });
    setActivePageIndex(index + 1);
  }

  function handleDeletePage(index: number): void {
    state.update((draft) => {
      Object.assign(draft, deletePage(draft, index));
    });
    if (index <= activePageIndex && activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
    }
  }

  function handleMovePage(index: number, direction: "up" | "down"): void {
    state.update((draft) => {
      Object.assign(draft, movePage(draft, index, direction));
    });
    const target = direction === "up" ? index - 1 : index + 1;
    if (activePageIndex === index) setActivePageIndex(target);
    else if (activePageIndex === target) setActivePageIndex(index);
  }

  function handleAddLanguageVersion(index: number, targetLang: string): void {
    state.update((draft) => {
      Object.assign(draft, addLanguageVersion(draft, index, targetLang));
    });
    // Jump to the newly-added counterpart (always last in pages[]).
    setActivePageIndex(snapshot.pages.length);
  }

  // When a Site Health issue is clicked we may need to drill into the
  // right inspector before the target field exists in the DOM. The pending
  // issue is stashed here and consumed by an effect that runs after the
  // drill state's re-render flushes.
  const pendingIssueRef = useRef<ValidationIssue | null>(null);

  function handleJump(issue: ValidationIssue): void {
    // Path-shape routing:
    //   ["pages", N, "blocks", M, "data", ...] → drill into that block.
    //   anything else (org.*, theme.*, defaultLanguage, pages summary) →
    //                                            drill into Site settings.
    const path = issue.path;
    let nextDrill: DrillMode | null = null;
    let focusIssue: ValidationIssue = issue;
    if (
      path.length >= 5 &&
      path[0] === "pages" &&
      typeof path[1] === "number" &&
      path[2] === "blocks" &&
      typeof path[3] === "number" &&
      path[4] === "data"
    ) {
      const pageIndex = path[1];
      const blockIndex = path[3];
      const targetPage = snapshot.pages[pageIndex];
      const targetBlock = targetPage?.blocks?.[blockIndex];
      if (targetBlock !== undefined) {
        if (pageIndex !== safeActivePageIndex) setActivePageIndex(pageIndex);
        nextDrill = { kind: "block", blockId: targetBlock.id };
        focusIssue = { ...issue, path: path.slice(5) };
      }
    }
    if (
      nextDrill === null &&
      path.length >= 2 &&
      path[0] === "pages" &&
      typeof path[1] === "number" &&
      snapshot.pages[path[1]] !== undefined
    ) {
      // A page-level issue (menu label, link name, SEO) → per-page settings.
      if (path[1] !== safeActivePageIndex) setActivePageIndex(path[1]);
      nextDrill = { kind: "page" };
    }
    if (nextDrill === null) {
      nextDrill = path[0] === "theme" ? { kind: "theme" } : { kind: "settings" };
    }
    setDrillMode(nextDrill);
    pendingIssueRef.current = focusIssue;
  }

  // After drill mode settles, attempt the deferred navigation. Runs every
  // render so the queued issue resolves once the corresponding form has
  // mounted and emitted its `[data-field="..."]` inputs.
  useEffect(() => {
    if (pendingIssueRef.current === null) return;
    const issue = pendingIssueRef.current;
    const root = rootRef.current ?? document;
    if (navigateToIssue(root, issue)) {
      pendingIssueRef.current = null;
    }
  });

  async function performExport(): Promise<void> {
    if (props.onExport !== undefined) {
      props.onExport(snapshot);
      return;
    }
    try {
      const blob = await exportToZip(snapshot, assetVfsRef.current!);
      const basename = exportZipBasename(snapshot.org.name);
      downloadBlob(blob, `${basename}.zip`);
    } catch (err) {
      // `build()` refuses to export a Site whose Theme package is not
      // installed (ADR 0051) — the one failure a normal author can actually
      // hit here. Without this catch the promise rejected unhandled: the
      // Download button did nothing at all, with no clue why, which is the
      // worst possible reading of "the export is blocked".
      window.alert(
        err instanceof Error
          ? `Your site could not be downloaded. ${err.message}`
          : "Your site could not be downloaded.",
      );
    }
  }

  function handleExportClick(): void {
    const result = validationResult;
    if (result.errors.length === 0 && result.warnings.length === 0) {
      void performExport();
      return;
    }
    setExportDialog(result);
  }

  function handleExportConfirm(): void {
    setExportDialog(null);
    void performExport();
  }

  async function handleBuiltinImport(): Promise<void> {
    const blob = await pickZipBlob();
    if (blob === null) return;
    try {
      const imported = await importFromZip(blob);
      const vfs = assetVfsRef.current!;
      // Clear every subtree the archive owns, not just `assets/`. Leaving the
      // outgoing Site's `themes/` behind would carry its Theme packages into
      // an unrelated project, where they would show up as installed.
      for (const prefix of SITE_VFS_PREFIXES) {
        for (const path of await vfs.list(prefix)) {
          await vfs.delete(path);
        }
      }
      await mergeAssetVfs(imported.vfs, vfs);
      await populateAssetDisplayUrls(vfs, displayUrlCacheRef.current!);
      // The incoming archive's Theme packages are only *installed* once this
      // list is rebuilt; without it the Site would render as if its own Theme
      // were missing until the editor was reloaded.
      revokeThemeBlobUrls();
      await reloadInstalledThemes();
      setAssetEpoch((n) => n + 1);
      historyRef.current = createHistoryStore<Site>({
        initial: structuredClone(imported.siteData),
      });
      setHistoryVersion((v) => v + 1);
      applySite(imported.siteData);
      setActivePageIndex(0);
      setDrillMode({ kind: "blocks" });
    } catch (err) {
      const message =
        err instanceof ZipImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import failed.";
      window.alert(message);
    }
  }

  function handleImportClick(): void {
    if (props.onImport !== undefined) {
      props.onImport();
      return;
    }
    void handleBuiltinImport();
  }

  function handleExportCancel(): void {
    setExportDialog(null);
  }

  function handleResetClick(): void {
    if (props.onReset !== undefined) {
      props.onReset();
      return;
    }
    // No host-provided reset: the browser shell keeps the draft in this
    // browser, so going back to the start screen is safe and reversible
    // ("Continue draft" brings it back).
    if (
      typeof window !== "undefined" &&
      window.confirm(
        "Go back to the start screen? Your work stays saved in this browser and you can continue it later.",
      )
    ) {
      window.location.reload();
    }
  }

  const [tipDismissed, setTipDismissed] = useState<boolean>(() => readTipDismissed());
  function dismissTip(): void {
    setTipDismissed(true);
    writeTipDismissed();
  }

  // Minimal, usable wiring: a two-button switch above the list. Issue #102's
  // accepted design gives Pages and Articles separate destinations in a
  // persistent navigation; that redesign lands separately, and this switch is
  // the smallest thing that makes the Articles components reachable today.
  const contentSwitcher = (
    <div data-testid="content-kind-switch" role="group" aria-label={t("articles.panel.title")}>
      <Button
        type="button"
        variant={contentKind === "pages" ? "primary" : "ghost"}
        aria-pressed={contentKind === "pages"}
        onClick={() => setContentKind("pages")}
        data-testid="content-kind-pages"
      >
        {t("articles.nav.pages")}
      </Button>
      <Button
        type="button"
        variant={contentKind === "articles" ? "primary" : "ghost"}
        aria-pressed={contentKind === "articles"}
        onClick={() => setContentKind("articles")}
        data-testid="content-kind-articles"
      >
        {t("articles.nav.articles")}
      </Button>
    </div>
  );

  const pagesListNode = (
    <>
      {contentSwitcher}
      {contentKind === "pages" ? (
        <PagesList
          site={snapshot}
          activeIndex={safeActivePageIndex}
          onSelect={setActivePageIndex}
          onAdd={handleAddPage}
          onClone={handleClonePage}
          onDelete={handleDeletePage}
          onMove={handleMovePage}
          onAddLanguageVersion={handleAddLanguageVersion}
        />
      ) : (
        <ArticlesPanel
          site={snapshot}
          onApply={applyArticleChange}
          onSelect={setActiveArticleId}
          contentLanguage={activePage?.lang ?? snapshot.defaultLanguage}
          today={todayIso()}
          activeArticleId={activeArticleId ?? undefined}
        />
      )}
    </>
  );

  // Back-affordance shared by the two drilled views. Drills out to the
  // un-drilled `blocks` view, mirroring the Escape keyboard handler.
  const backToBlocksButton = (
    <Button
      type="button"
      data-testid="drill-back"
      data-action="drill-back"
      onClick={() => setDrillMode({ kind: "blocks" })}
    >
      <IconArrowLeft size={16} />
      <span>Back to page sections</span>
    </Button>
  );

  // Per-page settings form: the `pages.[]` element node from the spine
  // walk, rebased onto the active page index so `data-field` paths read
  // `pages.<n>.navLabel` etc. (issue navigation relies on that).
  const pagesArrayNode = fields.find((node) => node.name === "pages");
  const pageSettingsNode =
    pagesArrayNode !== undefined && pagesArrayNode.kind === "array"
      ? rebaseElement(pagesArrayNode.element, ["pages", safeActivePageIndex])
      : undefined;
  const pageSettingsFields =
    pageSettingsNode !== undefined && pageSettingsNode.kind === "object"
      ? pageSettingsNode.fields
      : [];

  // The inspector's eyebrow + title use the same catalog as the
  // BlockListEditor row that drilled in, keeping visual register aligned.
  let editorPaneBody: JSX.Element;
  if (contentKind === "articles") {
    editorPaneBody =
      activeArticle !== undefined && articleIndex >= 0 ? (
        <ArticleWorkspace
          site={snapshot}
          articleIndex={articleIndex}
          onApply={applyArticleChange}
          onBack={() => setActiveArticleId(null)}
          onOpenArticle={setActiveArticleId}
          today={todayIso()}
          theme={activeThemeBundle}
          onSetBlockVariant={(blockId, variant) =>
            applySite(setBlockVariant(snapshot, blockId, variant))
          }
          onPatchBlockData={patchArticleBlockData}
          onArrayChangeBlockData={arrayChangeArticleBlockData}
          onMoveBlock={onMoveArticleBlock}
          onRemoveBlock={onRemoveArticleBlock}
          onAddBlock={() => setPickerOpen(true)}
          uploader={uploadAssetForPicker}
          documentUploader={uploadDocumentForPicker}
          displayUrlFor={displayUrlForAsset}
        />
      ) : (
        <p data-testid="articles-no-selection">{t("articles.empty")}</p>
      );
  } else if (drillMode.kind === "page" && activePage !== undefined) {
    editorPaneBody = (
      <div data-testid="inspector" data-inspector-mode="page" data-page-index={safeActivePageIndex}>
        {backToBlocksButton}
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">Page settings</span>
          <h2>{activePage.navLabel}</h2>
          <p data-inspector-lead>
            How this page appears in the menu and in search results. The sections themselves are
            edited from the page sections list.
          </p>
        </header>
        <SpineForm
          fields={pageSettingsFields}
          site={snapshot}
          onPatch={patch}
          uploader={uploadAssetForPicker}
          documentUploader={uploadDocumentForPicker}
          displayUrlFor={displayUrlForAsset}
        />
      </div>
    );
  } else if (drillMode.kind === "settings") {
    editorPaneBody = (
      <div data-testid="inspector" data-inspector-mode="settings">
        {backToBlocksButton}
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">Site</span>
          <h2>Site settings</h2>
          <p data-inspector-lead>
            Your organisation’s details, shown across every page, plus the languages the site
            offers.
          </p>
        </header>
        <SpineForm
          fields={fields}
          site={snapshot}
          onPatch={patch}
          uploader={uploadAssetForPicker}
          documentUploader={uploadDocumentForPicker}
          displayUrlFor={displayUrlForAsset}
        />
      </div>
    );
  } else if (drillMode.kind === "theme") {
    editorPaneBody = (
      <div data-testid="inspector" data-inspector-mode="theme">
        {backToBlocksButton}
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">Site</span>
          <h2>Theme</h2>
          <p data-inspector-lead>
            The look of the whole site. Changes show in the preview right away.
          </p>
        </header>
        <ThemeForm
          site={snapshot}
          onChange={applySite}
          activeTheme={activeThemeBundle}
          installedThemes={installedThemes}
          onImportTheme={importThemePackage}
          onExportTheme={exportThemePackageFile}
          onRemoveTheme={removeThemePackage}
        />
      </div>
    );
  } else if (drillMode.kind === "block" && activeBlock !== undefined && activeBlockIndex >= 0) {
    const envelope = KnownBlockSchemas[activeBlock.type as keyof typeof KnownBlockSchemas];
    // The envelope is `{ id, type, version, data: <DataSchema> }`. The
    // generic form generator wants the data schema directly so it walks
    // only the user-editable payload.
    const dataSchema =
      envelope !== undefined
        ? ((envelope as unknown as { shape: { data: ZodType } }).shape.data ?? envelope)
        : undefined;
    const entry = blockCatalog.entryFor(activeBlock.type);
    const blockTitle =
      typeof (activeBlock.data as { title?: unknown })?.title === "string"
        ? (activeBlock.data as { title: string }).title
        : entry.label;
    editorPaneBody = (
      <div
        data-testid="inspector"
        data-inspector-mode="block"
        data-block-id={activeBlock.id}
        data-block-type={activeBlock.type}
      >
        {backToBlocksButton}
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">{entry.label}</span>
          <h2>{blockTitle}</h2>
        </header>
        <BlockVariantControl
          block={activeBlock}
          theme={activeThemeBundle}
          onChange={(variant) => applySite(setBlockVariant(snapshot, activeBlock.id, variant))}
        />
        {activeBlock.type === "articleList" ? (
          // Hand-coded rather than schema-generated: a generated form would
          // render `articleIds` and `tags` as arrays of raw ids, which ADR 0044
          // puts off-limits outright.
          <ArticleListInspector
            site={snapshot}
            value={activeBlock.data}
            containerLang={activePage?.lang ?? snapshot.defaultLanguage}
            showTextFields
            onApply={applyArticleChange}
            onPatch={(articleListPatch) => {
              for (const [key, value] of Object.entries(articleListPatch)) {
                patchBlockData(safeActivePageIndex, activeBlockIndex, [key], value);
              }
            }}
          />
        ) : activeBlock.type === "customHTML" ? (
          <CustomHtmlBlockForm
            block={activeBlock as CustomHtmlBlock}
            onChange={(nextBlock) => {
              patch(
                ["pages", safeActivePageIndex, "blocks", activeBlockIndex, "data"],
                nextBlock.data,
              );
            }}
          />
        ) : dataSchema !== undefined ? (
          <BlockForm
            schema={dataSchema}
            data={activeBlock.data}
            onPatch={(subpath, value) =>
              patchBlockData(safeActivePageIndex, activeBlockIndex, subpath, value)
            }
            onArrayChange={(subpath, next) =>
              arrayChangeBlockData(safeActivePageIndex, activeBlockIndex, subpath, next)
            }
            uploader={uploadAssetForPicker}
            documentUploader={uploadDocumentForPicker}
            displayUrlFor={displayUrlForAsset}
            newItem={(subpath) => defaultArrayItemForBlock(activeBlock.type, subpath)}
            overrides={
              BLOCK_FIELD_METADATA[activeBlock.type as keyof typeof BLOCK_FIELD_METADATA] ?? []
            }
          />
        ) : (
          // Unknown block type — surface a soft hint rather than crashing.
          // Future blocks land in `KnownBlockSchemas` and this branch
          // disappears for them.
          <p data-testid="inspector-unknown-type">
            No editor available for block type "{activeBlock.type}".
          </p>
        )}
      </div>
    );
  } else {
    editorPaneBody = (
      <>
        {activePageSlug !== "" ? (
          <BlockListEditor
            site={snapshot}
            pageSlug={activePageSlug}
            onMove={onMoveBlock}
            onRemove={onRemoveBlock}
            onAddBlock={() => setPickerOpen(true)}
            onSelect={(blockId) => setDrillMode({ kind: "block", blockId })}
          />
        ) : null}
        <nav data-testid="drill-links" aria-label="More settings">
          {activePage !== undefined ? (
            <Button
              type="button"
              data-testid="page-settings-link"
              data-action="drill-page"
              onClick={() => setDrillMode({ kind: "page" })}
            >
              <span data-drill-icon>
                <IconLayout size={18} />
              </span>
              <span data-drill-text>
                <span data-testid="page-settings-link-label">Page settings</span>
                <span data-testid="page-settings-link-hint">
                  “{activePage.navLabel}” — menu label, link, search preview
                </span>
              </span>
              <IconChevronRight size={16} />
            </Button>
          ) : null}
          <Button
            type="button"
            data-testid="site-settings-link"
            data-action="drill-settings"
            onClick={() => setDrillMode({ kind: "settings" })}
          >
            <span data-drill-icon>
              <IconSettings size={18} />
            </span>
            <span data-drill-text>
              <span data-testid="site-settings-link-label">Site settings</span>
              <span data-testid="site-settings-link-hint">
                Organisation name, logo, contact details, languages
              </span>
            </span>
            <IconChevronRight size={16} />
          </Button>
          <Button
            type="button"
            data-testid="drill-in-theme"
            data-action="drill-theme"
            onClick={() => setDrillMode({ kind: "theme" })}
          >
            <span data-drill-icon>
              <IconPalette size={18} />
            </span>
            <span data-drill-text>
              <span data-testid="drill-in-theme-label">Theme</span>
              <span data-testid="drill-in-theme-hint">Look, colours, fonts and spacing</span>
            </span>
            <IconChevronRight size={16} />
          </Button>
        </nav>
      </>
    );
  }

  const editorPane = (
    <section data-testid="editor-pane" aria-label={t("pane.editor.label")}>
      {!tipDismissed ? (
        <aside data-testid="getting-started-tip" data-tip>
          <span data-tip-icon>
            <IconGlobe size={18} />
          </span>
          <div data-tip-body>
            <strong>How this works</strong>
            <p>
              Pick a page, then click a section to change its text and images. The preview on the
              right updates as you type. When you are happy, use <b>Download copy</b> to get your
              site as a folder ready to publish.
            </p>
          </div>
          <Button
            type="button"
            data-icon-button
            data-testid="getting-started-dismiss"
            aria-label="Hide this tip"
            title="Hide this tip"
            onClick={dismissTip}
          >
            <IconClose size={16} />
          </Button>
        </aside>
      ) : null}
      {pagesListNode}
      {editorPaneBody}
      <LocaleToggle />
    </section>
  );

  const previewPane = (
    <section
      data-testid="preview-pane"
      data-preview-viewport={previewViewport}
      aria-label={t("pane.preview.label")}
    >
      <div data-testid="preview-toolbar">
        <div
          data-testid="viewport-preview-controls"
          role="group"
          aria-label="Preview viewport size"
        >
          {PREVIEW_VIEWPORT_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              data-testid="viewport-preview-option"
              data-viewport={option.id}
              data-active={previewViewport === option.id}
              aria-pressed={previewViewport === option.id}
              title={`${option.label} preview (${previewViewportSizeLabel(option)})`}
              onClick={() => setPreviewViewport(option.id)}
            >
              <span data-testid="viewport-preview-label">{option.label}</span>
              <span data-testid="viewport-preview-size">{previewViewportSizeLabel(option)}</span>
            </Button>
          ))}
        </div>
      </div>
      <div data-testid="preview-canvas" ref={previewCanvasRef}>
        {/* The sizer occupies the frame's *scaled* footprint, so the canvas
         * scrolls and centres around what is actually visible rather than
         * around the frame's full unscaled size. */}
        <div
          data-testid="preview-frame-sizer"
          data-preview-viewport={previewViewport}
          style={
            previewViewportWidth === null || previewViewportHeight === null
              ? undefined
              : {
                  width: `${previewViewportWidth * previewScale}px`,
                  height: `${previewViewportHeight * previewScale}px`,
                }
          }
        >
          <div
            data-testid="preview-frame-shell"
            data-preview-viewport={previewViewport}
            data-preview-scaled={previewScale < 1 ? "true" : "false"}
            style={
              previewViewportWidth === null || previewViewportHeight === null
                ? undefined
                : {
                    width: `${previewViewportWidth}px`,
                    height: `${previewViewportHeight}px`,
                    transform: `scale(${previewScale})`,
                  }
            }
          >
            {/* Scripts power renderer-owned preview interactions; same-origin keeps blob uploads visible. */}
            <iframe
              // Remounting on the reload key gives the new page/theme/language a
              // fresh document; every other edit is applied in place over the
              // bridge, so this element is deliberately stable across keystrokes.
              key={previewReloadKey}
              ref={iframeRef}
              title={t("pane.preview.label")}
              srcDoc={previewBootHtmlRef.current}
              // `allow-popups` lets the preview-nav interceptor open external
              // links (a partner site, a social profile) in a new tab instead of
              // replacing the preview document.
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      </div>
    </section>
  );

  // historyVersion participates in the closure so the disabled state
  // re-renders alongside the undo/redo capabilities. Without referencing
  // it the linter sees an "unused" state setter.
  void historyVersion;
  const canUndo = history.canUndo();
  const canRedo = history.canRedo();

  return (
    <div data-testid="editor-app" ref={rootRef}>
      <TopBar
        onImport={handleImportClick}
        onExport={handleExportClick}
        onReset={handleResetClick}
        onUndo={doUndo}
        onRedo={doRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        saveStatus={saveStatus}
      />
      {isNarrow ? (
        // Narrow layout: real tabs from `@sosb/ui` (Base UI). The previous
        // markup was a `role="tablist"` wrapper around two plain buttons —
        // no `role="tab"`, no `aria-selected`, no panel association and no
        // arrow-key travel. The shared primitive supplies all four; the
        // `data-testid` / `data-active` hooks the stylesheet and tests use
        // are preserved.
        <Tabs.Root
          data-testid="layout-tabs"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabName)}
        >
          <Tabs.List>
            <Tabs.Tab value="editor" data-testid="layout-tab" data-active={activeTab === "editor"}>
              {t("tabs.editor")}
            </Tabs.Tab>
            <Tabs.Tab
              value="preview"
              data-testid="layout-tab"
              data-active={activeTab === "preview"}
            >
              {t("tabs.preview")}
            </Tabs.Tab>
          </Tabs.List>
          {/* Only the active pane is mounted: the preview iframe is
              expensive, and mounting both would double the renderer work
              on every edit. */}
          <Tabs.Panel value={activeTab}>
            {activeTab === "editor" ? editorPane : previewPane}
          </Tabs.Panel>
        </Tabs.Root>
      ) : (
        <div data-testid="layout-two-pane">
          {editorPane}
          {previewPane}
        </div>
      )}

      {panelOpen ? <SiteHealthPanel result={validationResult} onJump={handleJump} /> : null}

      <HealthFooter
        result={validationResult}
        onToggle={() => setPanelOpen((open) => !open)}
        expanded={panelOpen}
      />

      {exportDialog !== null ? (
        <ExportConfirmDialog
          result={exportDialog}
          onConfirm={handleExportConfirm}
          onCancel={handleExportCancel}
        />
      ) : null}

      <AddBlockDialog
        open={pickerOpen}
        onPick={onPickBlockType}
        onClose={() => setPickerOpen(false)}
        excludeTypes={contentKind === "articles" ? ARTICLE_BODY_EXCLUDED_BLOCKS : undefined}
      />
    </div>
  );
}

interface TopBarProps {
  readonly onImport: (() => void) | undefined;
  readonly onExport: (() => void) | undefined;
  readonly onReset: (() => void) | undefined;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly saveStatus: SaveStatus;
}

function TopBar(props: TopBarProps): JSX.Element {
  const t = useTranslator();
  return (
    <header data-testid="top-bar">
      <div data-brand>
        <span data-brand-mark aria-hidden="true">
          <IconLayout size={18} />
        </span>
        <span data-brand-name>Site Builder</span>
      </div>
      <p
        data-testid="save-status"
        data-status={props.saveStatus}
        aria-live="polite"
        role={props.saveStatus === "error" ? "alert" : "status"}
        title={t(saveStatusMessageKey(props.saveStatus))}
      >
        <span data-save-status-text>{t(saveStatusMessageKey(props.saveStatus))}</span>
      </p>
      <div data-topbar-actions>
        <span data-button-group role="group" aria-label="History">
          <Button
            type="button"
            data-testid="undo-button"
            data-action="undo"
            data-icon-button
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            disabled={!props.canUndo}
            onClick={props.onUndo}
          >
            <IconUndo size={16} />
          </Button>
          <Button
            type="button"
            data-testid="redo-button"
            data-action="redo"
            data-icon-button
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!props.canRedo}
            onClick={props.onRedo}
          >
            <IconRedo size={16} />
          </Button>
        </span>
        <Button
          type="button"
          data-action="import"
          title="Open a .zip you downloaded earlier"
          onClick={props.onImport}
        >
          {t("topbar.import")}
        </Button>
        <Button
          type="button"
          data-action="reset"
          title="Go back to the start screen"
          onClick={props.onReset}
        >
          {t("topbar.reset")}
        </Button>
        <Button
          type="button"
          data-action="export"
          data-variant="primary"
          title="Download your site as a .zip"
          onClick={props.onExport}
        >
          {t("topbar.export")}
        </Button>
      </div>
    </header>
  );
}

function saveStatusMessageKey(status: SaveStatus): string {
  switch (status) {
    case "localOnly":
      return "saveStatus.localOnly";
    case "saving":
      return "saveStatus.saving";
    case "saved":
      return "saveStatus.saved";
    case "error":
      return "saveStatus.error";
  }
}
