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
 * NOTE: this component intentionally has no module-level effects. It only
 * looks at `window.innerWidth` inside its own effect, which keeps it
 * trivially renderable in a vitest jsdom environment AND in SSR.
 */
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Site, ValidationIssue, ValidationResult } from "@sosb/schema";
import { SiteSchema, validate } from "@sosb/schema";

import { fieldsFromSchema } from "./form-generator.js";
import { SpineForm, applyPatch } from "./spine-form.js";
import { iframeSrcdoc } from "./iframe-srcdoc.js";
import { PagesList } from "./pages-list.js";
import { addLanguageVersion, addPage, clonePage, deletePage, movePage } from "./pages-ops.js";
import { createPreviewHost } from "@sosb/preview-bridge";
import { createEditorState, type EditorState } from "@sosb/editor-state";
import { SiteHealthPanel } from "./site-health.js";
import { HealthFooter } from "./health-footer.js";
import { ExportConfirmDialog } from "./export-confirm.js";
import { navigateToIssue } from "./issue-navigate.js";

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
}

type TabName = "editor" | "preview";

export function EditorApp(props: EditorAppProps): JSX.Element {
  const stateRef = useRef<EditorState>();
  if (stateRef.current === undefined) {
    stateRef.current = createEditorState({ initial: props.initial });
  }
  const state = stateRef.current;

  const [snapshot, setSnapshot] = useState<Site>(state.getSnapshot());
  useEffect(() => state.subscribe(setSnapshot), [state]);

  const fields = useMemo(() => fieldsFromSchema(SiteSchema), []);

  // Validation result is recomputed on every snapshot change. `validate()`
  // is pure / cheap — running it inline keeps the panel and footer
  // perfectly in sync without a separate event channel.
  const validationResult = useMemo<ValidationResult>(() => validate(snapshot), [snapshot]);

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
    <section data-testid="editor-pane">
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
    </section>
  );

  const previewSrcdoc = iframeSrcdoc(snapshot, snapshot.theme.id, safeActivePageIndex);
  const previewPane = (
    <section data-testid="preview-pane">
      <iframe
        ref={iframeRef}
        title="Site preview"
        srcdoc={previewSrcdoc}
        sandbox="allow-same-origin"
      />
    </section>
  );

  return (
    <div data-testid="editor-app" ref={rootRef}>
      <TopBar
        onImport={props.onImport}
        onExport={handleExportClick}
        onReset={props.onReset}
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
              Editor
            </button>
            <button
              type="button"
              data-testid="layout-tab"
              data-active={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
            >
              Preview
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
    </div>
  );
}

interface TopBarProps {
  readonly onImport: (() => void) | undefined;
  readonly onExport: (() => void) | undefined;
  readonly onReset: (() => void) | undefined;
}

function TopBar(props: TopBarProps): JSX.Element {
  return (
    <header data-testid="top-bar">
      <button type="button" data-action="import" onClick={props.onImport}>
        Import
      </button>
      <button type="button" data-action="export" onClick={props.onExport}>
        Export
      </button>
      <button type="button" data-action="reset" onClick={props.onReset}>
        Reset
      </button>
    </header>
  );
}
