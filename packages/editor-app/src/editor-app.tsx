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
 * Editor responsibilities:
 *
 * - Hold an `EditorState` whose initial site is the prop `initial`.
 * - Walk `SiteSchema` once via `fieldsFromSchema` and pass the field tree
 *   to `<SpineForm>`.
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
import type { Site, ValidationIssue, ValidationResult } from "@sosb/schema";
import { SiteSchema, validate } from "@sosb/schema";
import {
  createTranslator,
  enCatalog,
  roCatalog,
  DEFAULT_LOCALE,
  type Translator,
} from "@sosb/i18n";

import { fieldsFromSchema } from "./form-generator.js";
import { SpineForm, applyPatch } from "./spine-form.js";
import { iframeSrcdoc } from "./iframe-srcdoc.js";
import { PagesList } from "./pages-list.js";
import { addLanguageVersion, addPage, clonePage, deletePage, movePage } from "./pages-ops.js";
import { AddBlockDialog } from "./add-block-dialog.js";
import { BlockListEditor } from "./block-list-editor.js";
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

const MOBILE_BREAKPOINT_PX = 768;

export interface EditorAppProps {
  /** Initial site loaded into the editor. */
  readonly initial: Site;
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
    stateRef.current = createEditorState({ initial: props.initial });
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
  useEffect(() => state.subscribe(setSnapshot), [state]);

  const fields = useMemo(() => fieldsFromSchema(SiteSchema), []);

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

  // The page index currently surfaced in the spine form + preview. Defaults
  // to the home (page 0); reorder/clone/delete update this so the editor
  // never lands on a deleted page, and a brand-new add jumps to it.
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  // Clamp the active index whenever pages mutate.
  const safeActivePageIndex = Math.min(activePageIndex, Math.max(snapshot.pages.length - 1, 0));
  // Slug of the currently-active page. Block-editing helpers receive this
  // explicitly so they stay un-coupled from index assumptions.
  const activePageSlug = snapshot.pages[safeActivePageIndex]?.slug ?? "";

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

  function handleJump(issue: ValidationIssue): void {
    const root = rootRef.current ?? document;
    navigateToIssue(root, issue);
  }

  function handleExportClick(): void {
    const result = validationResult;
    if (result.errors.length === 0 && result.warnings.length === 0) {
      // Clean: export immediately.
      props.onExport?.(snapshot);
      return;
    }
    // Open the confirmation dialog.
    setExportDialog(result);
  }

  function handleExportConfirm(): void {
    setExportDialog(null);
    props.onExport?.(snapshot);
  }

  function handleExportCancel(): void {
    setExportDialog(null);
  }

  const editorPane = (
    <section data-testid="editor-pane" aria-label={t("pane.editor.label")}>
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
      <SpineForm fields={fields} site={snapshot} onPatch={patch} />
      {activePageSlug !== "" ? (
        <BlockListEditor
          site={snapshot}
          pageSlug={activePageSlug}
          onMove={onMoveBlock}
          onRemove={onRemoveBlock}
          onAddBlock={() => setPickerOpen(true)}
        />
      ) : null}
      <LocaleToggle />
    </section>
  );

  const previewSrcdoc = iframeSrcdoc(snapshot, snapshot.theme.id, safeActivePageIndex);
  const previewPane = (
    <section data-testid="preview-pane" aria-label={t("pane.preview.label")}>
      <iframe
        ref={iframeRef}
        title={t("pane.preview.label")}
        srcdoc={previewSrcdoc}
        sandbox="allow-same-origin"
      />
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
        onImport={props.onImport}
        onExport={handleExportClick}
        onReset={props.onReset}
        onUndo={doUndo}
        onRedo={doRedo}
        canUndo={canUndo}
        canRedo={canRedo}
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

      {panelOpen ? (
        <SiteHealthPanel result={validationResult} onJump={handleJump} />
      ) : null}

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
}

function TopBar(props: TopBarProps): JSX.Element {
  const t = useTranslator();
  return (
    <header data-testid="top-bar">
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
