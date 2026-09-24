/** @jsxImportSource react */
/**
 * EditorApp — the top-level React shell.
 *
 * Shape (issue #102, ADR 0053):
 *
 * - A top bar: menu button (phone), brand, local save status with its
 *   "downloaded copy" line, undo/redo, Open, Start over, **Save project** and
 *   **Export website**.
 * - Persistent main navigation (`MainNav`) over five destinations — Overview,
 *   Pages, Articles, Theme, Site settings — plus Create Page / Create Article
 *   and the content-language picker. A rail on wide windows, a drawer on
 *   phones.
 * - A main area showing the current `Destination` (`builder-navigation.ts`):
 *   the Overview, the Pages or Articles list, or a focused `Workspace` for one
 *   Page or Article. Theme and Site settings are site-wide forms that keep an
 *   adjacent preview. Every preview-bearing destination is a `SplitView`:
 *   editing beside preview on wide windows, one at a time on phones.
 * - Inside a workspace, ADR 0042's drill-in is preserved as `WorkspaceDrill`:
 *   the outline, or a focused Inspector for one Block, the content's settings,
 *   or Related Articles. Escape drills out one level; it never leaves the
 *   workspace.
 * - Export website opens the readiness panel (`ExportReadinessPanel`); Save
 *   project writes the editable archive and is never gated by validation.
 *
 * What the preview shows (`previewTarget`) is separate from what is being
 * edited: clicks inside the preview behave like the public website, and
 * "Edit this Page / Article" makes the previewed thing the edited thing.
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
 * - Re-run `validate()` on every snapshot change so the Overview's Site
 *   Health card and the export readiness panel stay current.
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
  CustomBlockDeclaration,
  CustomBlockFailedPackageSource,
  CustomBlockPackageSource,
  DocumentAssetRef,
  RemovedCustomBlockContent,
  Site,
  ValidationIssue,
  ValidationResult,
} from "@sosb/schema";
import {
  SiteSchema,
  adaptSiteToDeclarations,
  buildCustomBlockRegistry,
  customBlockAvailabilityFor,
  validate,
} from "@sosb/schema";
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

import { SPINE_FIELD_METADATA } from "./field-metadata.js";
import { applyAltSyncPatches, expandAltSyncPatches } from "./alt-sync.js";
import { fieldsFromSchema } from "./form-generator.js";
import { getAtPath, setAtPath } from "./get-set-path.js";
import { MEDIA_PICKER_RENDERERS } from "./media-picker-renderers.js";
import { SpineForm, applyPatch } from "./spine-form.js";
import { ThemeForm } from "./theme-form.js";
import { iframeSrcdoc, iframeSrcdocForArticle } from "./iframe-srcdoc.js";
import {
  clearThemeDataUrls,
  interactiveAssetUrlForPath,
  prepareInteractiveAssetUrls,
} from "./interactive-preview.js";
import { resolvePreviewTarget } from "./preview-navigation.js";
import type { PreviewTarget } from "./preview-navigation.js";
// Side-effect import: registers the editor-app stylesheet on `document.head`
// once, before any component renders. Guarded for SSR / non-DOM tooling.
import "./editor-app-css.js";
import { rebaseElement } from "./rebase-element.js";
import { IconClose, IconLayout, IconMenu, IconRedo, IconUndo } from "./icons.js";
import { InfoHint } from "./info-hint.js";
import { addLanguageVersion, addPage, clonePage, deletePage, movePage } from "./pages-ops.js";
import { AddBlockDialog } from "./add-block-dialog.js";
import { ArticlesScreen } from "./articles-screen.js";
import { SplitView, type SplitPane } from "./split-view.js";
import { defaultBlockFor } from "./block-defaults.js";
import {
  addBlockToPage,
  createEditorState,
  createHistoryStore,
  moveBlockInPage,
  removeBlockFromPage,
  type EditorState,
  type HistoryStore,
} from "@sosb/editor-state";
import { navigateToIssue } from "./issue-navigate.js";
import { I18nProvider, useTranslator } from "./i18n-context.js";
import { LocaleToggle } from "./locale-toggle.js";
import { MainNav } from "./main-nav.js";
import { OverviewScreen } from "./overview-screen.js";
import { PagesScreen } from "./pages-screen.js";
import { PreviewPane } from "./preview-pane.js";
import { ExportReadinessPanel } from "./export-readiness.js";
import { PackageUpdateDialog } from "./package-update-dialog.js";
import type { ThemeRecoveryEntry } from "./theme-packages-panel.js";
import { Workspace, type WorkspaceTarget } from "./workspace.js";
import {
  INITIAL_DESTINATION,
  OUTLINE_DRILL,
  backDestination,
  destinationForSection,
  reconcileDestination,
  reconcileDrill,
  sectionOf,
  type Destination,
  type WorkspaceDrill,
} from "./builder-navigation.js";
import { createArticle, slugifyTitle, uniqueArticleSlug, updateArticle } from "./articles-ops.js";
import { exportToZip, importFromZip, ZipImportError } from "@sosb/zip";
import {
  SITE_VFS_PREFIXES,
  assetHashFromPath,
  downloadBlob,
  exportZipBasename,
  mergeAssetVfs,
  pickZipBlob,
  populateAssetDisplayUrls,
} from "./site-io.js";
import { fontBlobUrlForPath, revokeFontBlobUrls } from "./font-blobs.js";
import { revokeThemeBlobUrls, themeBlobUrlForPath } from "./theme-blobs.js";
import { setBlockVariant } from "./theme-switch.js";
import {
  discardThemeRecoveryCopy,
  exportInstalledThemePackage,
  initThemeSandbox,
  installThemePackageIntoVfs,
  loadInstalledThemePackages,
  loadThemePackage,
  loadThemePackageFromVfs,
  loadThemePackageFromZip,
  readThemeRecoveryCopy,
  restoreRecoveredBlocks,
  themeRecoveryIds,
  uninstallThemePackageFromVfs,
  type LoadedThemePackage,
} from "@sosb/theme-package";
import { omittedBlocksFor, resolveThemeBundle, type ThemeBundle } from "@sosb/renderer";
import { Button } from "@sosb/ui";

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

/**
 * The preview's device presets and scaling now live with the pane that owns
 * them. Re-exported here because they were part of this module's public
 * surface before the split, and callers should not have to care that the
 * preview grew its own file.
 */
export {
  PREVIEW_VIEWPORT_OPTIONS,
  fitPreviewScale,
  previewViewportSizeLabel,
  type PreviewViewport,
} from "./preview-pane.js";

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

/**
 * Wall-clock label for the save status line ("14:32").
 *
 * Deliberately time-only: the project is saved in *this* browser session, so a
 * date would imply a permanence the local draft does not have.
 */
function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  /**
   * Local save status, shown in the top bar.
   *
   * Two separate facts, because conflating them is what makes people lose
   * work: `savedAt` is the editable project kept in this browser, and
   * `downloadedAt` is the last time a copy left the machine. An author who
   * sees only "Saved" can reasonably believe they have a file somewhere.
   */
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
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
          if (seq !== saveStatusSeqRef.current) return;
          setSaveStatus("saved");
          setSavedAt(nowLabel());
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
      // Inside rich-text editing, Ctrl/Cmd+Z belongs to the local typing
      // history (issue #100). ProseMirror's own history plugin handles the
      // keystroke; stealing it here would undo a whole editing visit when
      // the author meant to undo a word.
      const target = event.target;
      if (target instanceof Element && target.closest("[data-rich-text-surface]") !== null) {
        return;
      }
      // Inside a modal dialog (the link or image dialog, the export gate),
      // Ctrl/Cmd+Z is the focused input's own undo. Rewinding Site history
      // underneath an open dialog would desynchronise whatever the dialog
      // is about to commit — and, for the rich-text dialogs, the mounted
      // editor too.
      if (target instanceof Element && target.closest('[aria-modal="true"]') !== null) {
        return;
      }
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
  // Phone layout: editing and preview are shown one at a time inside a
  // workspace, and the main navigation collapses into a drawer.
  const [workspacePane, setWorkspacePane] = useState<SplitPane>("edit");
  const [drawerOpen, setDrawerOpen] = useState(false);

  /**
   * The last page and Article the user had open.
   *
   * Theme and Site settings are site-wide destinations that still show a
   * preview, and the preview has to be *of* something. Remembering the last
   * content the author looked at means changing a theme previews the page they
   * were just working on rather than always snapping back to the home page.
   */
  const lastPageIndexRef = useRef<number>(0);
  const lastArticleIdRef = useRef<string | null>(null);
  // Bumped whenever the asset display-URL cache gains entries. The cache is a
  // ref (it is filled asynchronously), so the memoised preview render has no
  // other way to learn that a just-uploaded image now has a blob URL.
  const [assetEpoch, setAssetEpoch] = useState<number>(0);

  /**
   * Where the builder is. Opening a Site lands on the content Overview
   * (issue #102, round four); the two content destinations each open a
   * focused workspace.
   */
  const [destination, setDestination] = useState<Destination>(INITIAL_DESTINATION);
  /** Drill state *within* a workspace — ADR 0042's Inspector, preserved. */
  const [drill, setDrill] = useState<WorkspaceDrill>(OUTLINE_DRILL);
  // Which workspace the preview was last pointed at (see the preview-target
  // sync below). Reset by `go` so entering a workspace always re-points it.
  const previewSyncKeyRef = useRef<string>("");
  // When a Site Health issue is clicked we may need to drill into the
  // right inspector before the target field exists in the DOM. The pending
  // issue is stashed here and consumed by an effect that runs after the
  // drill state's re-render flushes.
  const pendingIssueRef = useRef<ValidationIssue | null>(null);

  // Drop a destination whose target has gone (the page was deleted, a
  // different project was imported). Done during render rather than in an
  // effect so we never paint a workspace bound to nothing; `reconcile*`
  // returns the same object when nothing changed, so this is a cheap no-op
  // in the overwhelmingly common case.
  const reconciled = reconcileDestination(destination, snapshot);
  if (reconciled !== destination) setDestination(reconciled);

  const activePageIndex =
    reconciled.kind === "pageWorkspace" ? reconciled.pageIndex : lastPageIndexRef.current;
  const safeActivePageIndex = Math.min(activePageIndex, Math.max(snapshot.pages.length - 1, 0));
  lastPageIndexRef.current = safeActivePageIndex;
  const activePage = snapshot.pages[safeActivePageIndex];
  const activePageSlug = activePage?.slug ?? "";

  const activeArticleId =
    reconciled.kind === "articleWorkspace" ? reconciled.articleId : lastArticleIdRef.current;
  const articleIndex = (snapshot.articles ?? []).findIndex((a) => a.id === activeArticleId);
  const activeArticle = articleIndex >= 0 ? snapshot.articles?.[articleIndex] : undefined;
  if (reconciled.kind === "articleWorkspace") lastArticleIdRef.current = reconciled.articleId;

  // Blocks of whatever the workspace is editing, for the drill reconcile.
  const workspaceBlocks: readonly BlockEnvelope[] =
    reconciled.kind === "articleWorkspace"
      ? ((activeArticle?.blocks ?? []) as readonly BlockEnvelope[])
      : ((activePage?.blocks ?? []) as readonly BlockEnvelope[]);
  const reconciledDrill = reconcileDrill(
    drill,
    workspaceBlocks.map((b) => b.id),
  );
  if (reconciledDrill !== drill) setDrill(reconciledDrill);

  // Escape backs out one level: from an Inspector to the outline. It does not
  // leave the workspace — that is what the back button is for, and an Escape
  // that threw away the whole editing context would be a nasty surprise.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      // An open dialog or (i) popover owns this Escape: it closes, and the
      // Inspector underneath must not vanish with it. Base UI normally stops
      // the event before it reaches the window, but a popup that lets it
      // bubble — or a host that mounts its own — must not lose the drill.
      if (event.defaultPrevented || document.querySelector('[role="dialog"]') !== null) return;
      setDrill((current) => (current.kind === "outline" ? current : OUTLINE_DRILL));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /** Navigate, closing the phone drawer and resetting the drill. */
  function go(next: Destination): void {
    setDestination(next);
    setDrill(OUTLINE_DRILL);
    setDrawerOpen(false);
    setWorkspacePane("edit");
    // Entering a workspace re-points the preview at it (ADR 0053 §2) — also
    // when it is the same content again after a detour through Theme that
    // left the preview on some page the author had clicked through to.
    previewSyncKeyRef.current = "";
    // A repair the author walked away from must not fire later, when an
    // unrelated form happens to mount a field at the same path.
    pendingIssueRef.current = null;
  }

  // Export readiness panel disclosure.
  const [exportOpen, setExportOpen] = useState<boolean>(false);

  /**
   * The language new content is created in. Defaults to the Site's own
   * default and is switched from the navigation, so Create Article in
   * Romanian produces a Romanian Draft.
   */
  const [contentLanguage, setContentLanguage] = useState<string>(snapshot.defaultLanguage);
  // Importing a different project, or removing a language in Site settings,
  // can leave the chosen language undeclared. Fall back to the Site's default
  // rather than creating content in a language the Site does not have.
  const effectiveContentLanguage = snapshot.languages.includes(contentLanguage)
    ? contentLanguage
    : snapshot.defaultLanguage;

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

  // Theme packages installed in this Site, loaded from the same VFS the zip
  // round trip carries (`themes/<id>/...`). Holding them in editor state — not
  // re-reading the VFS per render — keeps `renderSite` synchronous, which the
  // srcdoc preview depends on.
  const [installedThemes, setInstalledThemes] = useState<readonly ThemeBundle[]>([]);
  // Packages under `themes/` that would not load, with the Custom Block types
  // they point at (ADR 0055): a Block of one of those types is unavailable
  // *because of that package*, and the message should say so.
  const [packageFailures, setPackageFailures] = useState<readonly CustomBlockFailedPackageSource[]>(
    [],
  );
  // Packages whose previous version the last update kept back (ADR 0055).
  const [recoveries, setRecoveries] = useState<readonly ThemeRecoveryEntry[]>([]);
  // Until the first read of `themes/` completes, nothing is known about the
  // Site's packages; treating every Custom Block as missing for that moment
  // would flash a blocking error on open. Custom Block rules wait for it.
  const [packagesReady, setPackagesReady] = useState<boolean>(false);

  /**
   * The Custom Block types this Site can use (ADR 0055): the union of what
   * the installed packages declare, plus what the failed ones point at.
   * Handed to validation, the Add Block dialog, the Inspector and the export
   * readiness panel, so the four cannot disagree about which types exist.
   */
  const customBlockRegistry = useMemo(() => {
    const loaded: CustomBlockPackageSource[] = installedThemes.map((bundle) => ({
      packageId: bundle.id,
      packageVersion: bundle.version,
      declarations: bundle.customBlocks ?? [],
    }));
    return buildCustomBlockRegistry(loaded, packageFailures);
  }, [installedThemes, packageFailures]);

  // Validation result is recomputed on every snapshot change. `validate()`
  // is pure / cheap — running it inline keeps the panel and footer
  // perfectly in sync without a separate event channel.
  //
  // `assetPathExists` closes the one gap the Site data cannot fill: an asset
  // reference is structurally complete even when the file behind it is gone,
  // and ADR 0048 makes a missing rich-text image a non-overridable public-
  // export blocker. The display-URL cache is the synchronous view of what the
  // project VFS holds — it is keyed by content hash, which is the last path
  // segment of every `assets/<hash>.<ext>` — so it answers the question
  // without turning validation async.
  //
  // `assetEpoch` is a dependency because the cache is filled after mount and
  // after every upload; without it the panel would keep reporting the state
  // the project had before its files finished loading.
  const validationResult = useMemo<ValidationResult>(
    () =>
      validate(snapshot, {
        assetPathExists: (path) => displayUrlCacheRef.current?.has(assetHashFromPath(path)) ?? true,
        ...(packagesReady ? { customBlocks: customBlockRegistry } : {}),
      }),
    [snapshot, assetEpoch, customBlockRegistry, packagesReady],
  );
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
      clearThemeDataUrls();
    };
  }, []);

  useEffect(() => {
    void populateAssetDisplayUrls(assetVfsRef.current!, displayUrlCacheRef.current!).then(() => {
      setAssetEpoch((n) => n + 1);
    });
  }, []);

  // A Theme package with a `render.js` holds a sandbox realm (ADR 0054).
  // Release the realms of bundles that have left the installed list — after
  // commit, so nothing still rendering through the old bundle sees a disposed
  // module — and every remaining one on unmount.
  const previousThemesRef = useRef<readonly ThemeBundle[]>([]);
  useEffect(() => {
    const previous = previousThemesRef.current;
    previousThemesRef.current = installedThemes;
    for (const outgoing of previous) {
      if (!installedThemes.includes(outgoing)) outgoing.render?.dispose();
    }
  }, [installedThemes]);
  useEffect(() => {
    return () => {
      for (const bundle of previousThemesRef.current) bundle.render?.dispose();
    };
  }, []);

  async function reloadInstalledThemes(): Promise<void> {
    const vfs = assetVfsRef.current!;
    const bundles: ThemeBundle[] = [];
    const failures: CustomBlockFailedPackageSource[] = [];
    for (const report of await loadInstalledThemePackages(vfs)) {
      if (report.loaded !== undefined) {
        bundles.push(report.loaded.bundle);
        continue;
      }
      // A damaged package must not stop the Site from opening (ADR 0051).
      // It does not appear as installed, so `themeReferenceIssue` reports it
      // and the Theme form offers the repair — and the Custom Block types it
      // points at are unavailable with its reason attached (ADR 0055).
      failures.push({
        packageId: report.id,
        errorCode: report.error.code,
        message: report.error.message,
        declaredTypes: report.declaredBlockTypes,
      });
    }
    const kept: ThemeRecoveryEntry[] = [];
    for (const id of await themeRecoveryIds(vfs)) {
      const copy = await readThemeRecoveryCopy(vfs, id);
      if (copy !== undefined) kept.push({ id, version: copy.version });
    }
    setInstalledThemes(bundles);
    setPackageFailures(failures);
    setRecoveries(kept);
    setPackagesReady(true);
  }

  // Mount-only: the Site's installed Themes are read once from the VFS, and
  // every later change goes through the import/remove handlers, which refresh
  // this list themselves.
  useEffect(() => {
    void reloadInstalledThemes();
  }, []);

  /**
   * An update waiting for the author's decision (ADR 0055): the incoming
   * package, the Site adapted to its declarations, and the content that
   * adaptation would remove. Nothing has been written yet.
   */
  const [pendingUpdate, setPendingUpdate] = useState<
    | {
        readonly loaded: LoadedThemePackage;
        readonly adapted: Site;
        readonly removed: readonly RemovedCustomBlockContent[];
      }
    | undefined
  >(undefined);

  /**
   * Write an imported package into the Site.
   *
   * When the same id is already installed, the saved data has been adapted to
   * the incoming declarations (`adaptSiteToDeclarations`) by the caller; if
   * that changed any Block — data or version — the outgoing package and the
   * affected Block envelopes are kept as the recovery copy before anything is
   * written. An update that changes no Block (an appearance-only release,
   * even of a package that declares Blocks) keeps whatever copy an earlier
   * update left, which may still be the one the author wants back. Only the
   * `adapted` Site the caller already reviewed is applied.
   */
  async function installPackage(loaded: LoadedThemePackage, adapted: Site): Promise<void> {
    const vfs = assetVfsRef.current!;
    const previous = installedThemes.find((bundle) => bundle.id === loaded.bundle.id);
    if (previous !== undefined && adapted !== snapshot) {
      const types = new Set([
        ...providedDeclarations(previous.id, previous.customBlocks).map((d) => d.type),
        ...providedDeclarations(loaded.bundle.id, loaded.bundle.customBlocks).map((d) => d.type),
      ]);
      const affected: BlockEnvelope[] = [];
      for (const page of snapshot.pages) {
        for (const block of page.blocks) if (types.has(block.type)) affected.push(block);
      }
      for (const article of snapshot.articles ?? []) {
        for (const block of article.blocks) if (types.has(block.type)) affected.push(block);
      }
      // The recovery copy is the *installed* files, re-read from the VFS, so
      // it is exactly what the archive carried — not a re-serialisation. If
      // they cannot be loaded the update stops here, before anything is
      // written: the plan promises the previous version stays recoverable.
      const installedCopy = await loadThemePackageFromVfs(vfs, previous.id);
      try {
        // Commit the package and its recovery point together: a failed
        // install must retain both the working package and any earlier copy.
        await installThemePackageIntoVfs(vfs, loaded, {
          previous: installedCopy,
          blocks: affected,
        });
      } finally {
        installedCopy.bundle.render?.dispose();
      }
    } else {
      await installThemePackageIntoVfs(vfs, loaded);
    }
    // The reload below compiles the installed copy afresh; this validation
    // load's sandbox realm has done its job.
    loaded.bundle.render?.dispose();
    if (adapted !== snapshot) applySite(adapted);
    // Re-importing the same id and version with different bytes is the normal
    // rhythm of authoring a Theme, so both URL caches (keyed on id + version)
    // have to be dropped before and after the installed bundles reload.
    dropThemePreviewUrls();
    await reloadInstalledThemes();
    dropThemePreviewUrls();
  }

  /**
   * The declarations of a package that the registry would actually consult
   * once it is installed. When another installed package with a smaller id
   * declares the same type, that one stays the provider (the deterministic
   * rule of `buildCustomBlockRegistry`), and adapting Blocks to a declaration
   * nobody consults would only stamp them with a foreign data version — and
   * make them `data-newer` under the declaration that does govern them.
   */
  function providedDeclarations(
    packageId: string,
    declarations: readonly CustomBlockDeclaration[] | undefined,
  ): CustomBlockDeclaration[] {
    const others = installedThemes.filter((bundle) => bundle.id !== packageId);
    return (declarations ?? []).filter(
      (declaration) =>
        !others.some(
          (bundle) =>
            bundle.id < packageId &&
            (bundle.customBlocks ?? []).some((other) => other.type === declaration.type),
        ),
    );
  }

  /**
   * Drop every preview URL minted for Theme files — the static `blob:` cache
   * and the interactive `data:` cache. Called *before* a reload of the
   * installed Themes so the memory goes early, and *after* it because a
   * render that happens while the reload is pending (a keystroke, an upload
   * finishing) rebuilds both caches from the outgoing bundle; re-importing
   * the same id and version with new bytes would then keep serving the old
   * bytes. Nothing minted after the reload can be stale: by then the
   * installed list already holds the new bundles.
   */
  function dropThemePreviewUrls(): void {
    revokeThemeBlobUrls();
    clearThemeDataUrls();
  }

  async function importThemePackage(file: File): Promise<void> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Load (and therefore fully validate) before writing anything: a rejected
    // package must leave the Site exactly as it found it.
    const loaded = await loadThemePackageFromZip(bytes);
    const previous = installedThemes.find((bundle) => bundle.id === loaded.bundle.id);
    // A new winning package may take a type over from another installed
    // provider. Its declaration is not an update of that provider: preserve
    // the complete saved envelopes, including their versions, and let the
    // new registry validate them. Otherwise a first-import version stamp
    // would claim foreign data had been migrated, without a recovery path.
    const declarations = providedDeclarations(loaded.bundle.id, loaded.bundle.customBlocks).filter(
      (declaration) => {
        const outgoing = customBlockRegistry.lookup(declaration.type);
        return outgoing?.status !== "available" || outgoing.packageId === loaded.bundle.id;
      },
    );
    const { site: adapted, removed } = adaptSiteToDeclarations(
      snapshot,
      declarations,
      providedDeclarations(loaded.bundle.id, previous?.customBlocks),
    );
    if (removed.length > 0) {
      // Content would be removed: the author sees it and decides (issue-106
      // plan). The dialog's cancel releases the realm and changes nothing.
      setPendingUpdate({ loaded, adapted, removed });
      return;
    }
    await installPackage(loaded, adapted);
  }

  async function confirmPendingUpdate(): Promise<void> {
    const pending = pendingUpdate;
    if (pending === undefined) return;
    setPendingUpdate(undefined);
    await installPackage(pending.loaded, pending.adapted);
  }

  function cancelPendingUpdate(): void {
    pendingUpdate?.loaded.bundle.render?.dispose();
    setPendingUpdate(undefined);
  }

  /**
   * Put a package's previous version back, with the Block content saved
   * alongside it (ADR 0055). The copy is validated by loading it before
   * anything is written, exactly like an import.
   */
  async function restoreThemePackage(themeId: string): Promise<void> {
    const vfs = assetVfsRef.current!;
    const copy = await readThemeRecoveryCopy(vfs, themeId);
    if (copy === undefined) return;
    await initThemeSandbox();
    const loaded = loadThemePackage(copy.files);
    await installThemePackageIntoVfs(vfs, loaded);
    loaded.bundle.render?.dispose();
    const restored = restoreRecoveredBlocks(snapshot, copy);
    if (restored !== snapshot) applySite(restored);
    await discardThemeRecoveryCopy(vfs, themeId);
    dropThemePreviewUrls();
    await reloadInstalledThemes();
    dropThemePreviewUrls();
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
    // Drop the preview URLs minted for this Theme. Without this, removing and
    // re-importing an edited Theme at the same version would keep serving the
    // old bytes from the caches, and the author would conclude their edits
    // had not taken.
    dropThemePreviewUrls();
    await reloadInstalledThemes();
    dropThemePreviewUrls();
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
  // ADR 0045: Blocks the active Theme has no design for are left out of the
  // published Site, and the author acknowledges the list before exporting.
  // Computed statically from the same predicate `build()` renders with, so
  // the readiness panel and the export cannot disagree (ADR 0054).
  //
  // An *unavailable* Custom Block is not an omission (ADR 0055): its package
  // is missing, or its data is newer than the installed declaration, so
  // validation blocks the export outright and the panel lists it among the
  // blockers — listing it here too would ask the author to acknowledge
  // something they cannot acknowledge away. Availability is per envelope
  // (the data version counts), so each omitted Block is looked up in place.
  const omittedBlocks = useMemo(() => {
    const omitted = omittedBlocksFor(snapshot, activeThemeBundle);
    if (omitted.length === 0) return omitted;
    const envelopes = new Map<string, BlockEnvelope>();
    for (const page of snapshot.pages) {
      for (const block of page.blocks)
        envelopes.set(`page:${page.lang}:${page.slug}:${block.id}`, block);
    }
    for (const article of snapshot.articles ?? []) {
      for (const block of article.blocks) envelopes.set(`article:${article.id}:${block.id}`, block);
    }
    return omitted.filter((entry) => {
      const key =
        entry.document.kind === "page"
          ? `page:${entry.document.id}:${entry.blockId}`
          : `article:${entry.document.id}:${entry.blockId}`;
      const block = envelopes.get(key);
      const availability =
        block === undefined
          ? customBlockRegistry.lookup(entry.blockType)
          : customBlockAvailabilityFor(customBlockRegistry, block);
      return availability?.status !== "unavailable";
    });
  }, [snapshot, activeThemeBundle, customBlockRegistry]);

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

  /**
   * What the preview is showing.
   *
   * Not the same thing as what is being edited. Clicks inside the preview
   * behave like the public website (issue #102), so the author can follow a
   * link from the page they are editing into an Article and keep reading. The
   * preview target therefore has its own state, and the pane offers a way back
   * to the content being edited plus the explicit "Edit this Page / Article"
   * action that makes the previewed thing the edited thing.
   */
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>({ kind: "page", index: 0 });

  /**
   * Interactive preview (ADR 0046, ADR 0056): the Theme's public-site script
   * runs in the preview only while the author has this switched on. Shell
   * state, per session — never part of the Site — and reset when another
   * project is imported. Before the mode takes effect the uploads are
   * re-encoded as `data:` URLs, because the interactive frame's opaque
   * origin cannot load the editor's `blob:` URLs (`interactive-preview.ts`).
   *
   * The request is keyed to the Theme it was made for. ADR 0046 says a
   * script runs only when *explicitly* enabled, and the status line is where
   * the author reads a Theme's `network` hosts before anything is contacted;
   * so selecting or importing a different Theme while the mode is on must
   * not run that Theme's script on the spot. Derived during render rather
   * than reset in an effect, so no document carrying the other Theme's
   * script is ever committed. Re-importing the same Theme (same id) keeps
   * the mode on — that is the authoring loop the mode exists for.
   */
  const [interactiveThemeId, setInteractiveThemeId] = useState<string | null>(null);
  const activeThemeId = activeThemeBundle?.id;
  const interactiveRequested = interactiveThemeId !== null && interactiveThemeId === activeThemeId;
  const [interactiveError, setInteractiveError] = useState<string | null>(null);
  function setInteractiveRequested(on: boolean): void {
    setInteractiveError(null);
    setInteractiveThemeId(on ? (activeThemeId ?? null) : null);
  }
  useEffect(() => {
    // Switching Themes turns the mode off for good, not merely while the
    // other Theme is active: coming back to the first Theme has to be an
    // explicit choice again, and the encoded uploads are released meanwhile.
    if (interactiveThemeId !== null && interactiveThemeId !== activeThemeId) {
      setInteractiveThemeId(null);
    }
  }, [interactiveThemeId, activeThemeId]);
  const interactiveUploadsRef = useRef<Map<string, string> | null>(null);
  const [interactiveEpoch, setInteractiveEpoch] = useState(0);
  const activePublicScript = activeThemeBundle?.publicScript;
  useEffect(() => {
    if (!interactiveRequested) {
      // Free the encoded uploads as soon as the mode is off: a `data:` URL
      // is a third larger than the bytes it carries.
      interactiveUploadsRef.current = null;
      return;
    }
    let cancelled = false;
    prepareInteractiveAssetUrls(assetVfsRef.current!).then(
      (urls) => {
        if (cancelled) return;
        interactiveUploadsRef.current = urls;
        setInteractiveEpoch((n) => n + 1);
      },
      (error: unknown) => {
        if (cancelled) return;
        // The document must not boot with half its images missing (ADR 0056
        // §3), and "Preparing…" forever would say nothing. Fall back to the
        // static preview and let the status line say why.
        setInteractiveError(error instanceof Error ? error.message : String(error));
        setInteractiveThemeId(null);
      },
    );
    return () => {
      cancelled = true;
    };
    // `assetEpoch`: an upload made while the mode is on must reach the
    // document, so the map is rebuilt from the VFS whenever the cache grows.
  }, [interactiveRequested, assetEpoch]);
  const interactiveMode: "off" | "preparing" | "on" =
    !interactiveRequested || activePublicScript === undefined
      ? "off"
      : interactiveUploadsRef.current === null
        ? "preparing"
        : "on";
  const interactiveOn = interactiveMode === "on";

  function interactiveUrlForAssetPath(path: string): string | undefined {
    return interactiveAssetUrlForPath(path, activeThemeBundle, interactiveUploadsRef.current);
  }

  // Entering a workspace points the preview at the content being edited. A
  // site-wide destination (Theme, Site settings) leaves it where it was, so
  // changing a theme previews the page the author was last working on.
  const previewSyncKey =
    reconciled.kind === "pageWorkspace"
      ? `page:${reconciled.pageIndex}`
      : reconciled.kind === "articleWorkspace"
        ? `article:${reconciled.articleId}`
        : previewSyncKeyRef.current;
  if (previewSyncKeyRef.current !== previewSyncKey) {
    previewSyncKeyRef.current = previewSyncKey;
    if (reconciled.kind === "pageWorkspace") {
      setPreviewTarget({ kind: "page", index: reconciled.pageIndex });
    } else if (reconciled.kind === "articleWorkspace" && articleIndex >= 0) {
      setPreviewTarget({ kind: "article", index: articleIndex });
    }
  }

  // Keep the target addressable after a structural edit: `PreviewTarget`
  // holds an index, and deleting content shifts every later one.
  const previewTargetExists =
    previewTarget.kind === "article"
      ? (snapshot.articles ?? [])[previewTarget.index] !== undefined
      : snapshot.pages[previewTarget.index] !== undefined;
  const safePreviewTarget: PreviewTarget = previewTargetExists
    ? previewTarget
    : { kind: "page", index: safeActivePageIndex };

  /**
   * Live preview wiring.
   *
   * The preview keeps ONE iframe document alive for as long as it is showing
   * the same target, in the same language, under the same theme. Each edit is
   * rendered host-side with the real renderer (there is still exactly one
   * renderer code path — ADR 0005) and posted over the preview bridge; the
   * renderer's preview-morph script diffs the new markup onto the live
   * document.
   *
   * Recomputing the HTML and feeding it back as `srcdoc` would rebuild the
   * document from scratch, so every keystroke would scroll the preview back to
   * the top, collapse any FAQ the user had opened and close the lightbox — on
   * a long page the section being edited jumped out of view on every
   * character. `PreviewPane` owns that morph-vs-reload decision; this memo
   * only produces the markup.
   */
  const previewHtml = useMemo(
    () => {
      // The interactive document is the same render with two differences:
      // the Theme's public script is emitted (the seam ADR 0054 left), and
      // every asset is delivered as a `data:` URL because the frame's opaque
      // origin cannot load the editor's `blob:` URLs (ADR 0056).
      const resolver = interactiveOn ? interactiveUrlForAssetPath : displayUrlForAssetPath;
      const options = interactiveOn ? { includePublicScript: true } : undefined;
      // An Article preview goes through the same renderer call the export
      // makes, so what the author sees is what ships.
      return safePreviewTarget.kind === "article"
        ? iframeSrcdocForArticle(
            snapshot,
            snapshot.theme.id,
            safePreviewTarget.index,
            resolver,
            activeThemeBundle,
            options,
          )
        : iframeSrcdoc(
            snapshot,
            snapshot.theme.id,
            safePreviewTarget.index,
            resolver,
            activeThemeBundle,
            options,
          );
    },
    // `displayUrlForAssetPath` reads a ref-held cache rather than state, so it
    // is deliberately not a dependency; `assetEpoch` is what actually changes
    // when that cache gains an entry — and `interactiveEpoch` plays the same
    // role for the interactive resolver's upload map.
    //
    // `activeThemeBundle` *is* a dependency: importing or removing a Theme
    // package changes the bundle without touching the Site snapshot, and
    // without this the preview would keep rendering the previous design.
    [snapshot, safePreviewTarget, assetEpoch, activeThemeBundle, interactiveOn, interactiveEpoch],
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
  const previewedArticle =
    safePreviewTarget.kind === "article"
      ? (snapshot.articles ?? [])[safePreviewTarget.index]
      : undefined;
  const previewReloadKey = [
    snapshot.theme.id,
    // An imported Theme's version, so re-importing an edited package boots a
    // fresh document. Morphing would update the `<style>` text but keep the
    // old document's already-resolved `blob:` font URLs, which the import
    // revoked — the page would render the new CSS with no fonts.
    activeThemeBundle?.origin === "package" ? activeThemeBundle.version : "",
    safePreviewTarget.kind,
    safePreviewTarget.index,
    safePreviewTarget.kind === "article"
      ? (previewedArticle?.lang ?? "")
      : (snapshot.pages[safePreviewTarget.index]?.lang ?? ""),
  ].join("\u0000");

  const previewedTitle =
    safePreviewTarget.kind === "article"
      ? previewedArticle === undefined || previewedArticle.title.trim() === ""
        ? t("articles.untitled")
        : previewedArticle.title
      : (snapshot.pages[safePreviewTarget.index]?.navLabel ?? "");

  /**
   * A link was followed inside the preview. Resolve it the way the public
   * website would — including links into Articles and links a retired slug
   * would redirect — and move the preview there, leaving the editing pane on
   * whatever the author was working on. That split is the whole point of
   * "preview clicks behave like the public site": browsing is not editing.
   */
  function handlePreviewNavigate(path: string): void {
    const target = resolvePreviewTarget(snapshot, path, safePreviewTarget);
    if (target === null) return;
    setPreviewTarget(target);
  }

  /** "Edit this Page / Article" — make the previewed thing the edited thing. */
  function handleEditPreviewed(): void {
    if (safePreviewTarget.kind === "article") {
      const article = (snapshot.articles ?? [])[safePreviewTarget.index];
      if (article === undefined) return;
      go({ kind: "articleWorkspace", articleId: article.id });
      return;
    }
    go({ kind: "pageWorkspace", pageIndex: safePreviewTarget.index });
  }

  /** True when the preview still shows the content being edited. */
  const previewMatchesTarget =
    reconciled.kind === "articleWorkspace"
      ? safePreviewTarget.kind === "article" && safePreviewTarget.index === articleIndex
      : reconciled.kind === "pageWorkspace"
        ? safePreviewTarget.kind === "page" && safePreviewTarget.index === reconciled.pageIndex
        : true;

  /** Point the preview back at whatever the workspace is editing. */
  function handleReturnPreviewToTarget(): void {
    if (reconciled.kind === "articleWorkspace" && articleIndex >= 0) {
      setPreviewTarget({ kind: "article", index: articleIndex });
      return;
    }
    if (reconciled.kind === "pageWorkspace") {
      setPreviewTarget({ kind: "page", index: reconciled.pageIndex });
    }
  }

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
      // The epoch is what tells the interactive preview to re-encode the
      // uploads (ADR 0056 §3); a document is an upload like any other.
      setAssetEpoch((n) => n + 1);
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

  /**
   * Whether the workspace is editing an Article rather than a Page.
   *
   * Every Block operation below branches on this one predicate rather than on
   * a separate "which kind of content" flag, so the two can never disagree
   * about what is open — which is exactly what went wrong with the temporary
   * `contentKind` switch this replaces.
   */
  const editingArticle = reconciled.kind === "articleWorkspace" && articleIndex >= 0;

  function onPickBlockType(type: string): void {
    if (editingArticle) {
      const block = defaultBlockFor(type, customBlockRegistry);
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
    const block = defaultBlockFor(type, customBlockRegistry);
    const next = addBlockToPage(snapshot, activePageSlug, block);
    applySite(next);
    setPickerOpen(false);
  }

  function onMoveBlock(from: number, to: number): void {
    if (editingArticle) {
      onMoveArticleBlock(from, to);
      return;
    }
    if (activePageSlug === "") return;
    if (from === to) return;
    const next = moveBlockInPage(snapshot, activePageSlug, from, to);
    applySite(next);
  }

  function onRemoveBlock(blockId: string): void {
    if (editingArticle) {
      onRemoveArticleBlock(blockId);
      return;
    }
    if (activePageSlug === "") return;
    const next = removeBlockFromPage(snapshot, activePageSlug, blockId);
    applySite(next);
  }

  /** Route a Block-data patch to whichever container holds the Block. */
  function onPatchWorkspaceBlockData(
    blockIndex: number,
    subpath: readonly (string | number)[],
    value: unknown,
  ): void {
    if (editingArticle) patchArticleBlockData(blockIndex, subpath, value);
    else patchBlockData(safeActivePageIndex, blockIndex, subpath, value);
  }

  function onArrayChangeWorkspaceBlockData(
    blockIndex: number,
    subpath: readonly (string | number)[],
    next: readonly unknown[],
  ): void {
    if (editingArticle) arrayChangeArticleBlockData(blockIndex, subpath, next);
    else arrayChangeBlockData(safeActivePageIndex, blockIndex, subpath, [...next]);
  }

  /** Replace a Block's whole `data` object — the customHTML form edits it wholesale. */
  /**
   * Patch Block data *without* pushing a Site-history entry.
   *
   * The rich-text editor's history contract (issue #100) is one Site-history
   * entry per editing visit, not one per keystroke — but the content must
   * still reach preview, validation and export immediately. Splitting the
   * write from the snapshot is how those two coexist: this does the write,
   * and `commitRichTextVisit` below does the snapshot, once, when the visit
   * ends. Rich text writes the whole `doc` in one go, so a single-key
   * subpath is all this needs.
   */
  function onPatchWorkspaceBlockDataQuiet(
    blockIndex: number,
    subpath: readonly (string | number)[],
    value: unknown,
  ): void {
    const key = subpath[0];
    if (subpath.length !== 1 || typeof key !== "string") {
      throw new Error(
        `onPatchWorkspaceBlockDataQuiet: expected a single string key, got ${subpath.join(".")}`,
      );
    }
    const dataPath: (string | number)[] = editingArticle
      ? ["articles", articleIndex, "blocks", blockIndex, "data"]
      : ["pages", safeActivePageIndex, "blocks", blockIndex, "data"];
    state.update((draft) => {
      const blockData = getAtPath(draft, dataPath) as Record<string, unknown>;
      setAtPath(draft as unknown as Record<string, unknown>, dataPath, {
        ...blockData,
        [key]: value,
      });
    });
  }

  /**
   * End a rich-text editing visit: one Site-history entry that restores the
   * content as it was when the author arrived.
   */
  function commitRichTextVisit(): void {
    pushHistory(state.getSnapshot());
  }

  function onReplaceWorkspaceBlockData(blockIndex: number, data: unknown): void {
    if (editingArticle) {
      patchArticleBlockData(blockIndex, [], data);
      return;
    }
    patch(["pages", safeActivePageIndex, "blocks", blockIndex, "data"], data);
  }

  /**
   * Rename the content being edited: a Page's menu label, an Article's title.
   *
   * A new Article opens with an empty title (issue #102), so its address
   * cannot be derived at creation the way the old title-first dialog did.
   * While the Article is still a Draft with no slug history and an address
   * that is still the one derived from its title, the address keeps following
   * the title. The moment the author edits the address, publishes, or a rename
   * has minted history, it stops — a live URL must never change under them.
   */
  function onWorkspaceTitleChange(value: string): void {
    if (editingArticle) {
      applyArticleChange((site) => {
        const article = (site.articles ?? [])[articleIndex];
        if (article === undefined) return site;
        const derived = slugifyTitle(article.title);
        const follows =
          article.state === "draft" &&
          (article.slugHistory ?? []).length === 0 &&
          (article.slug === derived || /^-\d+$/.test(article.slug.slice(derived.length))) &&
          article.slug.startsWith(derived);
        const renamed = updateArticle(site, articleIndex, { title: value });
        if (!follows) return renamed;
        return updateArticle(renamed, articleIndex, {
          slug: uniqueArticleSlug(renamed, article.lang, slugifyTitle(value), article.id),
        });
      });
      return;
    }
    patch(["pages", safeActivePageIndex, "navLabel"], value);
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

  /**
   * Create a page and open its workspace.
   *
   * The redesign's Create Page is a one-click action from the navigation and
   * the Overview rather than a slug form, so the slug is derived and the
   * author renames it in Page settings if they care. `addPage` appends, so
   * the new page is always last. Like Create Article, it creates in the
   * navigation's content language — that picker would be a lie otherwise.
   */
  function handleCreatePage(): void {
    const lang = effectiveContentLanguage;
    const existing = new Set(snapshot.pages.filter((p) => p.lang === lang).map((p) => p.slug));
    let slug = "new-page";
    let counter = 2;
    while (existing.has(slug)) {
      slug = `new-page-${counter}`;
      counter += 1;
    }
    const nextIndex = snapshot.pages.length;
    state.update((draft) => {
      Object.assign(draft, addPage(draft, slug, lang));
    });
    pushHistory(state.getSnapshot());
    go({ kind: "pageWorkspace", pageIndex: nextIndex });
  }

  function handleClonePage(index: number, slug: string): void {
    state.update((draft) => {
      Object.assign(draft, clonePage(draft, index, slug));
    });
    pushHistory(state.getSnapshot());
  }

  function handleDeletePage(index: number): void {
    state.update((draft) => {
      Object.assign(draft, deletePage(draft, index));
    });
    pushHistory(state.getSnapshot());
    // `reconcileDestination` handles the case where the deleted page was the
    // one being edited, so there is nothing to clamp here.
  }

  function handleMovePage(index: number, direction: "up" | "down"): void {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= snapshot.pages.length) return;
    state.update((draft) => {
      Object.assign(draft, movePage(draft, index, direction));
    });
    pushHistory(state.getSnapshot());
    // Pages are addressed by index, so a swap must be followed by everything
    // that remembers one: the list's "last open" marker and the preview that
    // Theme and Site settings keep. Otherwise both silently point at whatever
    // page now occupies the old index. (The Pages list is only shown when no
    // workspace is open, so the destination itself never needs following.)
    const follow = (i: number): number => (i === index ? target : i === target ? index : i);
    lastPageIndexRef.current = follow(lastPageIndexRef.current);
    setPreviewTarget((current) =>
      current.kind === "page" ? { kind: "page", index: follow(current.index) } : current,
    );
  }

  function handleAddLanguageVersion(index: number, targetLang: string): void {
    const nextIndex = snapshot.pages.length;
    state.update((draft) => {
      Object.assign(draft, addLanguageVersion(draft, index, targetLang));
    });
    pushHistory(state.getSnapshot());
    // Jump to the newly-added counterpart (always last in pages[]).
    go({ kind: "pageWorkspace", pageIndex: nextIndex });
  }

  /**
   * Create a Draft Article in the current content language and open it.
   *
   * Issue #102's second round: creating an Article opens it immediately as a
   * Draft with a title field and an initial Block, rather than asking for a
   * title in a dialog first. Nothing is published by creating it.
   */
  function handleCreateArticle(): void {
    let createdId = "";
    applyArticleChange((site) => {
      const result = createArticle(site, {
        title: "",
        lang: effectiveContentLanguage,
        today: todayIso(),
      });
      createdId = result.articleId;
      return result.site;
    });
    if (createdId !== "") go({ kind: "articleWorkspace", articleId: createdId });
  }

  /**
   * Open the destination that owns a validation issue, ready to repair it.
   *
   * Path-shape routing, now over destinations as well as drill state:
   *
   *   ["pages", N, "blocks", M, "data", ...]     page workspace, Block Inspector
   *   ["pages", N, ...]                          page workspace, settings Inspector
   *   ["articles", N, "blocks", M, "data", ...]  article workspace, Block Inspector
   *   ["articles", N, ...]                       article workspace, settings Inspector
   *   ["theme", ...]                             Theme destination
   *   anything else                              Site settings destination
   *
   * The focused issue's path is re-rooted onto the form that will mount, so
   * `navigateToIssue` can find the field by its `data-field` attribute.
   */
  function handleJump(issue: ValidationIssue): void {
    const path = issue.path;
    let focusIssue: ValidationIssue = issue;
    setExportOpen(false);

    if (path[0] === "articles" && typeof path[1] === "number") {
      const article = (snapshot.articles ?? [])[path[1]];
      if (article !== undefined) {
        const isBlock =
          path.length >= 5 &&
          path[2] === "blocks" &&
          typeof path[3] === "number" &&
          path[4] === "data";
        const targetBlock = isBlock ? article.blocks?.[path[3] as number] : undefined;
        go({ kind: "articleWorkspace", articleId: article.id });
        if (targetBlock !== undefined) {
          setDrill({ kind: "block", blockId: targetBlock.id });
          focusIssue = { ...issue, path: path.slice(5) };
        } else if (path[2] === "title") {
          // The title is edited on the outline, not in Article settings.
          setDrill(OUTLINE_DRILL);
        } else {
          // The settings form tags its inputs with full `articles.N.…` paths.
          setDrill({ kind: "settings" });
        }
        pendingIssueRef.current = focusIssue;
        return;
      }
    }

    if (path[0] === "pages" && typeof path[1] === "number") {
      const pageIndex = path[1];
      const targetPage = snapshot.pages[pageIndex];
      if (targetPage !== undefined) {
        const isBlock =
          path.length >= 5 &&
          path[2] === "blocks" &&
          typeof path[3] === "number" &&
          path[4] === "data";
        const targetBlock = isBlock ? targetPage.blocks?.[path[3] as number] : undefined;
        go({ kind: "pageWorkspace", pageIndex });
        if (targetBlock !== undefined) {
          setDrill({ kind: "block", blockId: targetBlock.id });
          focusIssue = { ...issue, path: path.slice(5) };
        } else {
          // A page-level issue (menu label, link name, SEO) → page settings.
          setDrill({ kind: "settings" });
        }
        pendingIssueRef.current = focusIssue;
        return;
      }
    }

    go(path[0] === "theme" ? { kind: "theme" } : { kind: "settings" });
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

  /**
   * `publicSite` is `"required"` for Export website and `"when-buildable"`
   * for Save project: a missing Theme package or Custom Block package stops
   * a website export (the readiness panel already said so) but must never
   * stop an author from keeping their work (issue-106 plan, ADR 0051).
   */
  async function performExport(
    publicSite: "required" | "when-buildable" = "required",
  ): Promise<void> {
    if (props.onExport !== undefined) {
      props.onExport(snapshot);
      return;
    }
    try {
      const blob = await exportToZip(snapshot, assetVfsRef.current!, { publicSite });
      const basename = exportZipBasename(snapshot.org.name);
      downloadBlob(blob, `${basename}.zip`);
    } catch (err) {
      // `build()` refuses to export a Site whose Theme package is not
      // installed (ADR 0051) — the one failure a normal author can actually
      // hit here. Without this catch the promise rejected unhandled: the
      // Download button did nothing at all, with no clue why, which is the
      // worst possible reading of "the export is blocked".
      window.alert(
        t("builder.export.failed", { reason: err instanceof Error ? err.message : "" }).trim(),
      );
    }
  }

  /**
   * Export website always opens the readiness panel.
   *
   * The old flow exported straight away on a clean Site and only showed a
   * dialog when something was wrong, which made the dialog read as a telling-
   * off. The accepted design makes the panel the export surface itself: it is
   * where the author learns that exporting does not update the live site, so
   * it has to appear even when there is nothing to fix.
   */
  function handleExportClick(): void {
    setExportOpen(true);
  }

  function handleExportConfirm(): void {
    setExportOpen(false);
    setDownloadedAt(nowLabel());
    void performExport();
  }

  /**
   * Save project — write the editable archive, Drafts included.
   *
   * Deliberately distinct from Export website, and never gated by validation:
   * an author must always be able to keep their work, whatever state it is in
   * (ADR 0016, and issue #102's third round).
   */
  function handleSaveProject(): void {
    if (props.autosaveVfs === undefined) {
      // No host persistence (the archival single-file build, an embedded
      // editor): the only way to keep the work is the downloaded archive, and
      // that must never be gated by validation, so it skips the readiness
      // panel entirely — and is written even when the public Site inside it
      // cannot be built.
      setDownloadedAt(nowLabel());
      void performExport("when-buildable");
      return;
    }
    const seq = ++saveStatusSeqRef.current;
    setSaveStatus("saving");
    void state
      .flush()
      .then(() => {
        if (seq !== saveStatusSeqRef.current) return;
        setSaveStatus("saved");
        setSavedAt(nowLabel());
      })
      .catch(() => {
        if (seq === saveStatusSeqRef.current) setSaveStatus("error");
      });
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
      dropThemePreviewUrls();
      await reloadInstalledThemes();
      dropThemePreviewUrls();
      // The interactive preview is a fact about this editing session, not
      // about a project: another project starts static (ADR 0046).
      setInteractiveThemeId(null);
      setAssetEpoch((n) => n + 1);
      historyRef.current = createHistoryStore<Site>({
        initial: structuredClone(imported.siteData),
      });
      setHistoryVersion((v) => v + 1);
      applySite(imported.siteData);
      // A different project entirely — land on its Overview rather than on a
      // workspace addressing content that no longer exists.
      go(INITIAL_DESTINATION);
      setPreviewTarget({ kind: "page", index: 0 });
    } catch (err) {
      const message =
        err instanceof ZipImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("builder.import.failed");
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

  function handleResetClick(): void {
    if (props.onReset !== undefined) {
      props.onReset();
      return;
    }
    // No host-provided reset: the browser shell keeps the draft in this
    // browser, so going back to the start screen is safe and reversible
    // ("Continue draft" brings it back).
    if (typeof window !== "undefined" && window.confirm(t("builder.reset.confirm"))) {
      window.location.reload();
    }
  }

  const [tipDismissed, setTipDismissed] = useState<boolean>(() => readTipDismissed());
  function dismissTip(): void {
    setTipDismissed(true);
    writeTipDismissed();
  }

  // Per-page settings form: the `pages.[]` element node from the spine walk,
  // rebased onto the active page index so `data-field` paths read
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

  // historyVersion participates in the closure so the disabled state
  // re-renders alongside the undo/redo capabilities. Without referencing it
  // the linter sees an "unused" state setter.
  void historyVersion;
  const canUndo = history.canUndo();
  const canRedo = history.canRedo();

  const blockingCount = validationResult.errors.filter((i) => i.blocking === true).length;

  const previewPane = (
    <PreviewPane
      html={previewHtml}
      reloadKey={previewReloadKey}
      siteData={snapshot}
      activePageIndex={safeActivePageIndex}
      onNavigate={handlePreviewNavigate}
      previewedTitle={previewedTitle}
      previewedKind={safePreviewTarget.kind}
      canReturnToTarget={!previewMatchesTarget}
      onReturnToTarget={handleReturnPreviewToTarget}
      onEditPreviewed={handleEditPreviewed}
      interactive={interactiveMode}
      interactiveError={interactiveError}
      onInteractiveChange={setInteractiveRequested}
      publicScript={
        activePublicScript === undefined
          ? undefined
          : { network: activePublicScript.network, offline: activePublicScript.offline }
      }
    />
  );

  /** The workspace target, when a workspace destination is open. */
  const workspaceTarget: WorkspaceTarget | null =
    reconciled.kind === "pageWorkspace"
      ? { kind: "page", pageIndex: safeActivePageIndex }
      : reconciled.kind === "articleWorkspace"
        ? { kind: "article", articleId: reconciled.articleId }
        : null;

  let main: JSX.Element;
  if (workspaceTarget !== null) {
    main = (
      <Workspace
        site={snapshot}
        target={workspaceTarget}
        drill={reconciledDrill}
        onDrillChange={setDrill}
        isNarrow={isNarrow}
        theme={activeThemeBundle}
        customBlocks={packagesReady ? customBlockRegistry : undefined}
        validation={validationResult}
        onBack={() => go(backDestination(reconciled))}
        onTitleChange={onWorkspaceTitleChange}
        onAddBlock={() => setPickerOpen(true)}
        onMoveBlock={onMoveBlock}
        onRemoveBlock={onRemoveBlock}
        onSetBlockVariant={(blockId, variant) =>
          applySite(setBlockVariant(snapshot, blockId, variant))
        }
        onPatchBlockData={onPatchWorkspaceBlockData}
        onPatchBlockDataQuiet={onPatchWorkspaceBlockDataQuiet}
        onCommitRichTextVisit={commitRichTextVisit}
        onArrayChangeBlockData={onArrayChangeWorkspaceBlockData}
        onReplaceBlockData={onReplaceWorkspaceBlockData}
        pageSettingsFields={pageSettingsFields}
        onPatchSite={patch}
        onApplySite={applyArticleChange}
        today={todayIso()}
        onOpenArticle={(articleId) => go({ kind: "articleWorkspace", articleId })}
        uploader={uploadAssetForPicker}
        documentUploader={uploadDocumentForPicker}
        displayUrlFor={displayUrlForAsset}
        preview={previewPane}
        pane={workspacePane}
        onPaneChange={setWorkspacePane}
      />
    );
  } else if (reconciled.kind === "overview") {
    main = (
      <OverviewScreen
        site={snapshot}
        validation={validationResult}
        onOpenPage={(pageIndex) => go({ kind: "pageWorkspace", pageIndex })}
        onOpenArticle={(articleId) => go({ kind: "articleWorkspace", articleId })}
        onNavigate={(section) => go(destinationForSection(section))}
        onCreatePage={handleCreatePage}
        onCreateArticle={handleCreateArticle}
        onFix={handleJump}
      />
    );
  } else if (reconciled.kind === "pages") {
    main = (
      <PagesScreen
        site={snapshot}
        activeIndex={safeActivePageIndex}
        onOpen={(pageIndex) => go({ kind: "pageWorkspace", pageIndex })}
        onCreatePage={handleCreatePage}
        onClone={handleClonePage}
        onDelete={handleDeletePage}
        onMove={handleMovePage}
        onAddLanguageVersion={handleAddLanguageVersion}
      />
    );
  } else if (reconciled.kind === "articles") {
    main = (
      <ArticlesScreen
        site={snapshot}
        onApply={applyArticleChange}
        onOpen={(articleId) => go({ kind: "articleWorkspace", articleId })}
        onCreate={handleCreateArticle}
        {...(activeArticle === undefined ? {} : { activeArticleId: activeArticle.id })}
      />
    );
  } else if (reconciled.kind === "theme") {
    // Theme and Site settings keep an adjacent preview even though they are
    // not content destinations: both change every page at once, and judging
    // a theme without seeing it is exactly the problem the live preview
    // exists to solve.
    main = (
      <SplitView
        testId="theme-screen"
        isNarrow={isNarrow}
        pane={workspacePane}
        onPaneChange={setWorkspacePane}
        editor={
          <div data-pane-body>
            <div data-screen>
              <header data-screen-head>
                <h1>
                  {t("builder.nav.theme")}
                  <InfoHint
                    label={t("builder.nav.theme")}
                    text={t("theme.info")}
                    testId="theme-screen-info"
                  />
                </h1>
              </header>
              <ThemeForm
                site={snapshot}
                onChange={applySite}
                activeTheme={activeThemeBundle}
                installedThemes={installedThemes}
                onImportTheme={importThemePackage}
                onExportTheme={exportThemePackageFile}
                onRemoveTheme={removeThemePackage}
                recoveries={recoveries}
                onRestoreTheme={restoreThemePackage}
              />
            </div>
          </div>
        }
        preview={previewPane}
      />
    );
  } else {
    main = (
      <SplitView
        testId="settings-screen"
        isNarrow={isNarrow}
        pane={workspacePane}
        onPaneChange={setWorkspacePane}
        editor={
          <div data-pane-body>
            <div data-screen>
              <header data-screen-head>
                <h1>
                  {t("builder.nav.settings")}
                  <InfoHint
                    label={t("builder.nav.settings")}
                    text={t("settings.info")}
                    testId="settings-screen-info"
                  />
                </h1>
              </header>
              <SpineForm
                fields={fields}
                site={snapshot}
                onPatch={patch}
                uploader={uploadAssetForPicker}
                documentUploader={uploadDocumentForPicker}
                displayUrlFor={displayUrlForAsset}
              />
              <LocaleToggle />
            </div>
          </div>
        }
        preview={previewPane}
      />
    );
  }

  return (
    <div data-testid="editor-app" ref={rootRef} data-narrow={isNarrow ? "true" : "false"}>
      <TopBar
        onImport={handleImportClick}
        onExport={handleExportClick}
        onReset={handleResetClick}
        onSave={handleSaveProject}
        onUndo={doUndo}
        onRedo={doRedo}
        onOpenDrawer={() => setDrawerOpen(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        saveStatus={saveStatus}
        savedAt={savedAt}
        downloadedAt={downloadedAt}
        blockingCount={blockingCount}
      />

      <div data-builder-body>
        <MainNav
          active={sectionOf(reconciled)}
          onNavigate={(section) => go(destinationForSection(section))}
          onCreatePage={handleCreatePage}
          onCreateArticle={handleCreateArticle}
          pageCount={snapshot.pages.length}
          articleCount={(snapshot.articles ?? []).length}
          languages={snapshot.languages}
          contentLanguage={effectiveContentLanguage}
          onContentLanguageChange={setContentLanguage}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          projectActions={
            isNarrow
              ? {
                  onImport: () => {
                    setDrawerOpen(false);
                    handleImportClick();
                  },
                  onReset: () => {
                    setDrawerOpen(false);
                    handleResetClick();
                  },
                }
              : undefined
          }
        />
        <main data-builder-main>{main}</main>
      </div>

      {!tipDismissed && reconciled.kind === "overview" ? (
        <aside data-testid="getting-started-tip" data-tip>
          <span data-tip-icon>
            <IconLayout size={18} />
          </span>
          <div data-tip-body>
            <strong>{t("builder.tip.title")}</strong>
            <p>{t("builder.tip.body", { action: t("builder.action.export") })}</p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            data-testid="getting-started-dismiss"
            aria-label={t("builder.tip.dismiss")}
            title={t("builder.tip.dismiss")}
            onClick={dismissTip}
          >
            <IconClose size={16} />
          </Button>
        </aside>
      ) : null}

      <ExportReadinessPanel
        open={exportOpen}
        result={validationResult}
        omittedBlocks={omittedBlocks}
        onClose={() => setExportOpen(false)}
        onExport={handleExportConfirm}
        onFix={handleJump}
      />

      <AddBlockDialog
        open={pickerOpen}
        onPick={onPickBlockType}
        onClose={() => setPickerOpen(false)}
        excludeTypes={editingArticle ? ARTICLE_BODY_EXCLUDED_BLOCKS : undefined}
        customBlocks={customBlockRegistry}
      />

      <PackageUpdateDialog
        open={pendingUpdate !== undefined}
        packageName={pendingUpdate?.loaded.bundle.name ?? ""}
        version={pendingUpdate?.loaded.bundle.version ?? ""}
        removed={pendingUpdate?.removed ?? []}
        onCancel={cancelPendingUpdate}
        onConfirm={() => void confirmPendingUpdate()}
      />
    </div>
  );
}

interface TopBarProps {
  readonly onImport: (() => void) | undefined;
  readonly onExport: (() => void) | undefined;
  readonly onReset: (() => void) | undefined;
  readonly onSave: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onOpenDrawer: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly saveStatus: SaveStatus;
  readonly savedAt: string | null;
  readonly downloadedAt: string | null;
  /** Problems that hard-block the export, surfaced on the button itself. */
  readonly blockingCount: number;
}

function TopBar(props: TopBarProps): JSX.Element {
  const t = useTranslator();

  // Two facts, deliberately not merged: where the editable project lives, and
  // whether a copy has ever left this machine. An author who reads only
  // "Saved" can reasonably conclude they have a file somewhere they do not.
  const savedLine =
    props.saveStatus === "saving"
      ? t("saveStatus.saving")
      : props.saveStatus === "error"
        ? t("saveStatus.error")
        : props.saveStatus === "localOnly"
          ? t("saveStatus.localOnly")
          : props.savedAt !== null
            ? `${t("saveStatus.saved")} · ${props.savedAt}`
            : t("builder.save.never");

  return (
    <header data-testid="top-bar">
      <Button
        type="button"
        size="icon"
        // Utility classes rather than the editor sheet: the shared Button's
        // own display utility outranks a `display: none` there.
        className="max-md:h-8 max-md:w-8 md:hidden"
        data-testid="nav-drawer-open"
        data-drawer-button
        aria-label={t("builder.nav.open")}
        title={t("builder.nav.open")}
        onClick={props.onOpenDrawer}
      >
        <IconMenu size={18} />
      </Button>
      <div data-brand>
        <span data-brand-mark aria-hidden="true">
          <IconLayout size={18} />
        </span>
        <span data-brand-name>{t("builder.brand")}</span>
      </div>

      <span data-topbar-spacer />

      <p
        data-testid="save-status"
        data-status={props.saveStatus}
        aria-live="polite"
        role={props.saveStatus === "error" ? "alert" : "status"}
      >
        <span data-save-status-text>{savedLine}</span>
        <span data-save-status-secondary>
          {t("builder.save.downloaded", {
            when: props.downloadedAt ?? t("builder.save.downloaded.never"),
          })}
          <InfoHint
            label={t("builder.save.info.label")}
            text={t("builder.save.info")}
            testId="save-status-info"
          />
        </span>
      </p>

      <div data-topbar-actions>
        <span data-button-group role="group" aria-label={t("builder.history")}>
          <Button
            type="button"
            size="icon"
            className="max-md:h-8 max-md:w-8"
            data-testid="undo-button"
            data-action="undo"
            data-icon-button
            aria-label={t("builder.undo")}
            title={t("builder.undo")}
            disabled={!props.canUndo}
            onClick={props.onUndo}
          >
            <IconUndo size={16} />
          </Button>
          <Button
            type="button"
            size="icon"
            className="max-md:h-8 max-md:w-8"
            data-testid="redo-button"
            data-action="redo"
            data-icon-button
            aria-label={t("builder.redo")}
            title={t("builder.redo")}
            disabled={!props.canRedo}
            onClick={props.onRedo}
          >
            <IconRedo size={16} />
          </Button>
        </span>
        {/* On phones these two move into the navigation drawer. */}
        <Button
          type="button"
          className="max-md:hidden"
          data-action="import"
          title={t("builder.import.title")}
          onClick={props.onImport}
        >
          {t("topbar.import")}
        </Button>
        <Button
          type="button"
          className="max-md:hidden"
          data-action="reset"
          title={t("builder.reset.title")}
          onClick={props.onReset}
        >
          {t("topbar.reset")}
        </Button>
        <Button
          type="button"
          className="max-md:h-8 max-md:px-2.5 max-md:text-(length:--sosb-text-sm)"
          data-testid="save-project"
          data-action="save"
          onClick={props.onSave}
        >
          {t("builder.action.save")}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="max-md:h-8 max-md:px-2.5 max-md:text-(length:--sosb-text-sm)"
          data-action="export"
          data-variant="primary"
          onClick={props.onExport}
        >
          {props.blockingCount > 0
            ? t("builder.action.export.count", { count: props.blockingCount })
            : t("builder.action.export")}
        </Button>
      </div>
    </header>
  );
}

/**
 * Message key for a save state.
 *
 * Kept as a total switch over the union so adding a state is a compile error
 * here rather than a silently untranslated status line.
 */
export function saveStatusMessageKey(status: SaveStatus): string {
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
