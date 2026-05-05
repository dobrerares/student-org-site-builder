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
 *
 * NOTE: this component intentionally has no module-level effects. It only
 * looks at `window.innerWidth` inside its own effect, which keeps it
 * trivially renderable in a vitest jsdom environment AND in SSR.
 */
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Site } from "@sosb/schema";
import { SiteSchema } from "@sosb/schema";

import { fieldsFromSchema } from "./form-generator.js";
import { SpineForm, applyPatch } from "./spine-form.js";
import { iframeSrcdoc } from "./iframe-srcdoc.js";
import { createPreviewHost } from "@sosb/preview-bridge";
import { createEditorState, type EditorState } from "@sosb/editor-state";

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

  // Iframe + preview-bridge wiring. The iframe ref is set when the iframe
  // mounts; on every snapshot change we (a) update the iframe's srcdoc
  // baseline and (b) post a `siteData` envelope through the bridge for any
  // future iframe-side message listener.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const host = createPreviewHost({ iframe });
    host.postSiteData(snapshot, snapshot.theme.id);
  }, [snapshot]);

  function patch(path: readonly (string | number)[], value: unknown): void {
    state.update((draft) => {
      Object.assign(draft, applyPatch(draft, path, value));
    });
  }

  const editorPane = (
    <section data-testid="editor-pane">
      <SpineForm fields={fields} site={snapshot} onPatch={patch} />
    </section>
  );

  const previewSrcdoc = iframeSrcdoc(snapshot, snapshot.theme.id);
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
    <div data-testid="editor-app">
      <TopBar
        onImport={props.onImport}
        onExport={() => props.onExport?.(snapshot)}
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
