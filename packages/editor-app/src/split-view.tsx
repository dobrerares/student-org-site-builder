/** @jsxImportSource react */
/**
 * SplitView — an editing pane beside a preview, or one at a time on phones.
 *
 * Issue #102 puts editing and preview side by side on larger screens and one
 * at a time on small ones. Three destinations need exactly that shape — the
 * Page / Article workspace, Theme, and Site settings — and the phone switch
 * has to look and behave identically in all three, so it is one component
 * rather than three copies of the same grid that would drift the first time
 * one of them was touched.
 *
 * The pane that is not showing is hidden, not unmounted. The preview holds a
 * live iframe document, and unmounting it on every switch would rebuild that
 * document and throw away the scroll position and open disclosures PR #116
 * went to some trouble to keep. The editor side is kept for the mirror-image
 * reason: an Inspector the author drilled into should still be there when
 * they switch back.
 */
import type { JSX, ReactNode } from "react";
import { Segmented } from "@sosb/ui";

import { useTranslator } from "./i18n-context.js";

export type SplitPane = "edit" | "preview";

export interface SplitViewProps {
  /** `data-testid` for the root, so specs can tell the three destinations apart. */
  readonly testId: string;
  /** Phone layout: editing and preview are shown one at a time. */
  readonly isNarrow: boolean;
  readonly pane: SplitPane;
  readonly onPaneChange: (pane: SplitPane) => void;
  readonly editor: ReactNode;
  readonly preview: ReactNode;
}

export function SplitView(props: SplitViewProps): JSX.Element {
  const t = useTranslator();
  const showEditor = !props.isNarrow || props.pane === "edit";
  const showPreview = !props.isNarrow || props.pane === "preview";

  return (
    <div data-testid={props.testId} data-split>
      {props.isNarrow && (
        <div data-split-tabs>
          <Segmented
            data-testid="layout-tabs"
            ariaLabel={t("workspace.tabs.label")}
            value={props.pane}
            onValueChange={props.onPaneChange}
            options={[
              { value: "edit", label: t("workspace.tab.edit"), testId: "workspace-tab-edit" },
              {
                value: "preview",
                label: t("workspace.tab.preview"),
                testId: "workspace-tab-preview",
              },
            ]}
          />
        </div>
      )}

      <section
        data-testid="editor-pane"
        data-hidden={showEditor ? "false" : "true"}
        hidden={!showEditor}
        aria-label={t("pane.editor.label")}
      >
        {props.editor}
      </section>

      <div data-split-preview data-hidden={showPreview ? "false" : "true"} hidden={!showPreview}>
        {props.preview}
      </div>
    </div>
  );
}
