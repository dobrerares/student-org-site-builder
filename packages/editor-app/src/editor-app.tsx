/**
 * EditorApp — the top-level Preact shell.
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
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  AssetRefLike,
  BlockEnvelope,
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
import { iframeSrcdoc } from "./iframe-srcdoc.js";
import { resolvePathToPageIndex } from "./preview-navigation.js";
// Side-effect import: registers the editor-app stylesheet on `document.head`
// once, before any component renders. Guarded for SSR / non-DOM tooling.
import "./editor-app-css.js";
import { PagesList } from "./pages-list.js";
import { addLanguageVersion, addPage, clonePage, deletePage, movePage } from "./pages-ops.js";
import { AddBlockDialog } from "./add-block-dialog.js";
import { BlockListEditor } from "./block-list-editor.js";
import { BlockForm } from "./block-form.js";
import { buildBlockCatalog } from "./block-catalog.js";
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
  downloadBlob,
  exportZipBasename,
  mergeAssetVfs,
  pickZipBlob,
  populateAssetDisplayUrls,
} from "./site-io.js";

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

const PREVIEW_VIEWPORT_OPTIONS: readonly {
  readonly id: PreviewViewport;
  readonly label: string;
  readonly size: string;
}[] = [
  { id: "fit", label: "Fit", size: "Auto" },
  { id: "desktop", label: "Desktop", size: "1440 x 900" },
  { id: "tablet", label: "Tablet", size: "768 x 1024" },
  { id: "phone", label: "Phone", size: "390 x 844" },
];

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
  | { readonly kind: "theme" };

type SaveStatus = "localOnly" | "saving" | "saved" | "error";

export function EditorApp(props: EditorAppProps): JSX.Element {
  const translatorRef = useRef<Translator>();
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

  const stateRef = useRef<EditorState>();
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
  const historyRef = useRef<HistoryStore<Site>>();
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

  // Iframe + preview-bridge wiring. The iframe ref is set when the iframe
  // mounts; on every snapshot change we (a) update the iframe's srcdoc
  // baseline and (b) post a `siteData` envelope through the bridge for any
  // future iframe-side message listener.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const host = createPreviewHost({ iframe });
    host.postSiteData(snapshot, snapshot.theme.id, safeActivePageIndex);
  }, [snapshot, safeActivePageIndex]);

  // Inbound preview events. The renderer's preview-only nav script prevents
  // normal iframe navigation and posts `{ type: "navigate", path }`; the
  // editor maps that path back onto `site.pages` and updates the active page.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const host = createPreviewHost({
      iframe,
      onPreviewEvent(message) {
        if (message.type !== "navigate") return;
        const nextIndex = resolvePathToPageIndex(snapshot, message.path);
        if (nextIndex === null || nextIndex === safeActivePageIndex) return;
        setActivePageIndex(nextIndex);
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
  const assetVfsRef = useRef<Vfs>();
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
  const displayUrlCacheRef = useRef<Map<string, string>>();
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
      if (cache === undefined) return;
      for (const url of cache.values()) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
      cache.clear();
    };
  }, []);

  useEffect(() => {
    void populateAssetDisplayUrls(assetVfsRef.current!, displayUrlCacheRef.current!);
  }, []);

  function displayUrlForAsset(ref: AssetRefLike): string | undefined {
    return displayUrlCacheRef.current!.get(ref.hash);
  }

  function displayUrlForAssetPath(path: string): string | undefined {
    if (!path.startsWith("assets/")) return undefined;
    const filename = path.slice("assets/".length);
    const dot = filename.lastIndexOf(".");
    const hash = dot >= 0 ? filename.slice(0, dot) : filename;
    return displayUrlCacheRef.current!.get(hash);
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
      }
    }
    if (nextDrill === null) nextDrill = { kind: "settings" };
    setDrillMode(nextDrill);
    pendingIssueRef.current = issue;
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
    const blob = await exportToZip(snapshot, assetVfsRef.current!);
    const basename = exportZipBasename(snapshot.org.name);
    downloadBlob(blob, `${basename}.zip`);
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
      for (const path of await vfs.list("assets/")) {
        await vfs.delete(path);
      }
      await mergeAssetVfs(imported.vfs, vfs);
      await populateAssetDisplayUrls(vfs, displayUrlCacheRef.current!);
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

  const pagesListNode = (
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
  );

  // Back-affordance shared by the two drilled views. Drills out to the
  // un-drilled `blocks` view, mirroring the Escape keyboard handler.
  const backToBlocksButton = (
    <button
      type="button"
      data-testid="drill-back"
      data-action="drill-back"
      onClick={() => setDrillMode({ kind: "blocks" })}
    >
      Back to page sections
    </button>
  );

  // The inspector's eyebrow + title use the same catalog as the
  // BlockListEditor row that drilled in, keeping visual register aligned.
  let editorPaneBody: JSX.Element;
  if (drillMode.kind === "settings") {
    editorPaneBody = (
      <div data-testid="inspector" data-inspector-mode="settings">
        {backToBlocksButton}
        <header data-testid="inspector-header">
          <span data-testid="inspector-eyebrow">Site</span>
          <h2>Site settings</h2>
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
        </header>
        <ThemeForm site={snapshot} onChange={applySite} />
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
        {dataSchema !== undefined ? (
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
        <button
          type="button"
          data-testid="site-settings-link"
          data-action="drill-settings"
          onClick={() => setDrillMode({ kind: "settings" })}
        >
          <span data-testid="site-settings-link-label">Site settings</span>
          <span data-testid="site-settings-link-hint">name, logo, languages</span>
        </button>
        <button
          type="button"
          data-testid="drill-in-theme"
          data-action="drill-theme"
          onClick={() => setDrillMode({ kind: "theme" })}
        >
          <span data-testid="drill-in-theme-label">Theme</span>
          <span data-testid="drill-in-theme-hint">colors and style</span>
        </button>
      </>
    );
  }

  const editorPane = (
    <section data-testid="editor-pane" aria-label={t("pane.editor.label")}>
      {pagesListNode}
      {editorPaneBody}
      <LocaleToggle />
    </section>
  );

  const previewSrcdoc = iframeSrcdoc(
    snapshot,
    snapshot.theme.id,
    safeActivePageIndex,
    displayUrlForAssetPath,
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
            <button
              key={option.id}
              type="button"
              data-testid="viewport-preview-option"
              data-viewport={option.id}
              data-active={previewViewport === option.id}
              aria-pressed={previewViewport === option.id}
              title={`${option.label} preview (${option.size})`}
              onClick={() => setPreviewViewport(option.id)}
            >
              <span data-testid="viewport-preview-label">{option.label}</span>
              <span data-testid="viewport-preview-size">{option.size}</span>
            </button>
          ))}
        </div>
      </div>
      <div data-testid="preview-canvas">
        <div data-testid="preview-frame-shell" data-preview-viewport={previewViewport}>
          {/* Scripts power renderer-owned preview interactions; same-origin keeps blob uploads visible. */}
          <iframe
            ref={iframeRef}
            title={t("pane.preview.label")}
            srcdoc={previewSrcdoc}
            sandbox="allow-scripts allow-same-origin"
          />
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
        onReset={props.onReset}
        onUndo={doUndo}
        onRedo={doRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        saveStatus={saveStatus}
      />
      {isNarrow ? (
        <div data-testid="layout-tabs">
          <div role="tablist">
            <button
              type="button"
              data-testid="layout-tab"
              data-active={activeTab === "editor"}
              onClick={() => setActiveTab("editor")}
            >
              {t("tabs.editor")}
            </button>
            <button
              type="button"
              data-testid="layout-tab"
              data-active={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
            >
              {t("tabs.preview")}
            </button>
          </div>
          {activeTab === "editor" ? editorPane : previewPane}
        </div>
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
      <p
        data-testid="save-status"
        data-status={props.saveStatus}
        aria-live="polite"
        role={props.saveStatus === "error" ? "alert" : "status"}
      >
        {t(saveStatusMessageKey(props.saveStatus))}
      </p>
      <button type="button" data-action="import" onClick={props.onImport}>
        {t("topbar.import")}
      </button>
      <button type="button" data-action="export" onClick={props.onExport}>
        {t("topbar.export")}
      </button>
      <button type="button" data-action="reset" onClick={props.onReset}>
        {t("topbar.reset")}
      </button>
      <button
        type="button"
        data-testid="undo-button"
        data-action="undo"
        aria-label="Undo (Ctrl+Z)"
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        data-testid="redo-button"
        data-action="redo"
        aria-label="Redo (Ctrl+Shift+Z)"
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        Redo
      </button>
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
