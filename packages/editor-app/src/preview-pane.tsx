/** @jsxImportSource react */
/**
 * PreviewPane — the live preview beside the editing workspace.
 *
 * Carries PR #116's behaviour verbatim: one iframe document is kept alive for
 * as long as it shows the same target, each edit is rendered host-side with
 * the real renderer and posted over the preview bridge, and only a change of
 * document (target, language, theme) forces a `srcdoc` reload. Reassigning
 * `srcdoc` rebuilds the document, which scrolls the preview back to the top
 * and closes anything the author had opened — on a long page that meant the
 * section being edited jumped out of view on every keystroke.
 *
 * What issue #102 adds is the pane bar: what you are currently looking at, a
 * way back to the content you are editing when preview navigation has taken
 * you elsewhere, and the explicit "Edit this Page / Edit this Article" action.
 * Clicks inside the preview behave like the public website — the renderer's
 * preview-only nav script posts them out as `navigate` messages — so the
 * author can click through their own site and then decide to edit whatever
 * they landed on.
 *
 * Interactive preview (ADR 0046, ADR 0056). The document is static unless the
 * author switches the Theme's public-site script on. The interactive document
 * boots in a *different* iframe: an opaque-origin sandbox that cannot reach
 * the editor, with every asset inlined as a `data:` URL because that origin
 * cannot load the editor's `blob:` URLs. Turning the mode on or off is a
 * document change like any other (it joins the reload key), and while it is
 * on, edits reload the document rather than morph it — the Theme's script
 * owns whatever it changed in the live DOM, and a diff against freshly
 * rendered markup would revert those changes on every keystroke.
 */
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { Site } from "@sosb/schema";
import { Button, Segmented } from "@sosb/ui";
import { createPreviewHost } from "@sosb/preview-bridge";

import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";
import { INTERACTIVE_PREVIEW_SANDBOX, STATIC_PREVIEW_SANDBOX } from "./interactive-preview.js";

export type PreviewViewport = "fit" | "desktop" | "tablet" | "phone";

/**
 * The device presets the preview toolbar offers.
 *
 * `width`/`height` are CSS pixels of the *simulated* viewport — the layout
 * size the previewed page is told it has. They are not the size the frame
 * occupies on screen: the frame is scaled down to fit the pane (see
 * `previewScale`). Before that scaling existed the 1440px desktop frame simply
 * overflowed the pane on any normal laptop, so the "Desktop" preset showed a
 * horizontally-clipped page rather than a desktop viewport.
 *
 * `fit` has no fixed size — the frame fills the pane and the page lays out at
 * whatever width that is.
 */
export const PREVIEW_VIEWPORT_OPTIONS: readonly {
  readonly id: PreviewViewport;
  readonly width: number | null;
  readonly height: number | null;
}[] = [
  { id: "fit", width: null, height: null },
  { id: "desktop", width: 1440, height: 900 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "phone", width: 390, height: 844 },
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

export interface PreviewPaneProps {
  /** Rendered HTML for whatever is currently previewed. */
  readonly html: string;
  /**
   * Changes exactly when the preview must boot a *new* document rather than
   * morph the current one — a different target, language or theme. Morphing
   * across those would carry over state that no longer means anything.
   */
  readonly reloadKey: string;
  /** The Site snapshot, posted over the documented ADR 0005 extension point. */
  readonly siteData: Site;
  /** Index the bridge reports alongside the snapshot. */
  readonly activePageIndex: number;
  /** A link was followed inside the preview. */
  readonly onNavigate: (path: string) => void;
  /** Title of whatever is being previewed right now. */
  readonly previewedTitle: string;
  readonly previewedKind: "page" | "article";
  /** True when the preview has wandered away from the content being edited. */
  readonly canReturnToTarget: boolean;
  readonly onReturnToTarget: () => void;
  /** Open the previewed destination for editing. */
  readonly onEditPreviewed: () => void;
  /**
   * Interactive preview (ADR 0046, ADR 0056). `off` shows the static
   * document; `preparing` means the author switched it on and the uploads
   * are still being encoded; `on` means `html` carries the Theme's public
   * script and boots in the opaque-origin frame. Defaults to `off`.
   */
  readonly interactive?: "off" | "preparing" | "on" | undefined;
  /**
   * Why the last request could not be prepared (the uploads could not be
   * read). Shown as an alert in place of the status line while the mode is
   * off, until the author switches again.
   */
  readonly interactiveError?: string | null | undefined;
  readonly onInteractiveChange?: ((on: boolean) => void) | undefined;
  /**
   * What the active Theme declared about its public-site script. The
   * control is only rendered when this is given: a Theme without a script
   * has nothing to switch on, and a disabled switch on every built-in Theme
   * would be noise for the authors who will never need it.
   */
  readonly publicScript?:
    | { readonly network: readonly string[]; readonly offline: string | undefined }
    | undefined;
}

export function PreviewPane(props: PreviewPaneProps): JSX.Element {
  const t = useTranslator();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<PreviewViewport>("fit");
  const [previewScale, setPreviewScale] = useState<number>(1);

  const option = PREVIEW_VIEWPORT_OPTIONS.find((o) => o.id === viewport);
  const viewportWidth = option?.width ?? null;
  const viewportHeight = option?.height ?? null;

  /**
   * Device-simulation scaling.
   *
   * A preset frame is laid out at its true viewport size (1440x900 and
   * friends) and then transform-scaled to fit the pane. Scaling the frame
   * rather than shrinking it is what makes the preset honest: the page inside
   * still believes it has 1440 CSS pixels, so media queries, clamp() type
   * scales and grid breakpoints all resolve the way they will for a real
   * desktop visitor.
   */
  useEffect(() => {
    if (viewportWidth === null || viewportHeight === null) {
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
          { width: viewportWidth!, height: viewportHeight! },
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
  }, [viewportWidth, viewportHeight]);

  // The document the iframe boots with. Only replaced on a reload, so the
  // `srcDoc` prop stays referentially stable across edits and React never
  // reassigns it. Derived during render (rather than in an effect) so a
  // freshly-keyed iframe boots with matching HTML on its very first paint.
  //
  // The interactive mode joins the key: its document has a different sandbox
  // attribute, and a sandbox only takes effect on the next navigation, so the
  // switch has to be a fresh element rather than an edit of the current one.
  const interactiveMode = props.interactive ?? "off";
  const interactiveOn = interactiveMode === "on";
  const documentKey = `${props.reloadKey}\u0000${interactiveOn ? "interactive" : "static"}`;
  const bootHtmlRef = useRef<string>(props.html);
  const reloadKeyRef = useRef<string>(documentKey);
  const readyRef = useRef<boolean>(false);
  const pendingHtmlRef = useRef<string | null>(null);
  if (reloadKeyRef.current !== documentKey) {
    reloadKeyRef.current = documentKey;
    bootHtmlRef.current = props.html;
    readyRef.current = false;
    pendingHtmlRef.current = null;
  }
  // Interactive documents reload rather than morph (ADR 0056): keeping
  // `srcDoc` equal to the latest render makes React reassign it, which is a
  // full reload — the same thing a visitor's refresh does, and the only way
  // to leave the Theme's script in charge of the live DOM. The posting
  // effect below steps aside entirely while the mode is on.
  if (interactiveOn) bootHtmlRef.current = props.html;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    // The interactive document receives nothing from the host. Its script
    // is the Theme's, and the Site snapshot below carries what the published
    // Site never shows it — Draft Articles, editor-only settings — while an
    // opaque origin stops the script reading the editor, not reading what
    // the editor posts to it (ADR 0056 §5). Edits reload that document, so
    // there is nothing to morph into it either.
    if (interactiveOn) return;
    const host = createPreviewHost({ iframe });
    // The documented ADR 0005 extension point. Nothing renders from it today
    // (rendering stays host-side, so there is one renderer code path), but it
    // is the surface iframe-side consumers are told to listen on.
    host.postSiteData(props.siteData, props.siteData.theme.id, props.activePageIndex);
    // The boot document already *is* this HTML — posting it would be a no-op
    // diff, and on first mount the morph script has not booted yet anyway.
    if (props.html === bootHtmlRef.current) return;
    if (!readyRef.current) {
      // The morph script has not announced itself yet. Hold the newest render
      // — posting now would land before any listener exists and the edit
      // would be silently lost.
      pendingHtmlRef.current = props.html;
      return;
    }
    host.postPreviewHtml(props.html);
  }, [props.html, props.siteData, props.activePageIndex, interactiveOn]);

  // Inbound preview events. The renderer's preview-only nav script prevents
  // normal iframe navigation and posts `{ type: "navigate", path }`; the morph
  // script posts `{ type: "ready" }` once its listener is wired.
  const onNavigateRef = useRef(props.onNavigate);
  onNavigateRef.current = props.onNavigate;
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
    const host = createPreviewHost({
      iframe,
      onPreviewEvent(message) {
        if (message.type === "ready") {
          readyRef.current = true;
          const pending = pendingHtmlRef.current;
          pendingHtmlRef.current = null;
          // Post into the iframe mounted *now*. A reload key change remounts
          // the element, and the one this effect captured at mount is by then
          // detached — an edit typed while the new document was booting
          // would be posted into nothing and silently lost.
          const current = iframeRef.current;
          if (pending !== null && current !== null) {
            createPreviewHost({ iframe: current }).postPreviewHtml(pending);
          }
          return;
        }
        if (message.type !== "navigate") return;
        onNavigateRef.current(message.path);
      },
    });
    function onMessage(event: MessageEvent): void {
      host.handleIncomingMessage(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const viewportLabel: Record<PreviewViewport, string> = {
    fit: t("preview.viewport.fit"),
    desktop: t("preview.viewport.desktop"),
    tablet: t("preview.viewport.tablet"),
    phone: t("preview.viewport.phone"),
  };

  return (
    <section
      data-testid="preview-pane"
      data-preview-viewport={viewport}
      aria-label={t("pane.preview.label")}
    >
      <div data-testid="preview-toolbar" data-pane-bar>
        <span data-pane-kicker>
          {t("preview.title")}
          <InfoHint label={t("preview.title")} text={t("preview.info")} testId="preview-info" />
        </span>
        <span data-preview-title data-truncate data-testid="preview-target-title">
          {props.previewedTitle}
        </span>
        <span data-pane-spacer />
        {props.canReturnToTarget && (
          <Button
            type="button"
            size="sm"
            data-testid="preview-return"
            onClick={props.onReturnToTarget}
          >
            {props.previewedKind === "page" ? t("preview.back.page") : t("preview.back.article")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="primary"
          data-testid="preview-edit-this"
          onClick={props.onEditPreviewed}
        >
          {props.previewedKind === "page" ? t("preview.edit.page") : t("preview.edit.article")}
        </Button>
      </div>

      <div data-preview-devices>
        <Segmented
          ariaLabel={t("preview.viewport.label")}
          size="sm"
          value={viewport}
          onValueChange={setViewport}
          data-testid="viewport-preview-controls"
          options={PREVIEW_VIEWPORT_OPTIONS.map((o) => ({
            value: o.id,
            label: viewportLabel[o.id],
            detail: previewViewportSizeLabel(o),
            testId: "viewport-preview-option",
            data: { "data-viewport": o.id },
          }))}
        />
        {props.publicScript !== undefined && (
          <span data-preview-interactive data-testid="preview-interactive">
            <label data-toggle>
              <input
                type="checkbox"
                data-testid="preview-interactive-toggle"
                checked={interactiveMode !== "off"}
                onChange={(event) => props.onInteractiveChange?.(event.currentTarget.checked)}
              />
              {t("preview.interactive.label")}
            </label>
            <InfoHint
              label={t("preview.interactive.label")}
              text={t("preview.interactive.info")}
              testId="preview-interactive-info"
            />
          </span>
        )}
      </div>

      {props.publicScript !== undefined && interactiveMode === "off" && props.interactiveError && (
        <p
          data-preview-interactive-status
          data-state="failed"
          data-testid="preview-interactive-status"
          role="alert"
        >
          {t("preview.interactive.failed", { message: props.interactiveError })}
        </p>
      )}

      {props.publicScript !== undefined && interactiveMode !== "off" && (
        <p
          data-preview-interactive-status
          data-state={interactiveMode}
          data-testid="preview-interactive-status"
          role="status"
        >
          {interactiveMode === "preparing" ? (
            t("preview.interactive.preparing")
          ) : (
            <strong>{t("preview.interactive.on")}</strong>
          )}
        </p>
      )}

      {props.publicScript !== undefined && (
        // Disclose the manifest before opt-in, and keep it visible while
        // preparing or running the script (ADR 0056 §1).
        <p data-preview-interactive-status data-testid="preview-interactive-declaration">
          <span data-testid="preview-interactive-network">
            {props.publicScript.network.length === 0
              ? t("preview.interactive.network.none")
              : t("preview.interactive.network", {
                  hosts: props.publicScript.network.join(", "),
                })}
          </span>
          {/* Show optional offline notes even for self-contained scripts. */}
          {props.publicScript.offline !== undefined && (
            <>
              {" "}
              <span data-testid="preview-interactive-offline">
                {t("preview.interactive.offline", { note: props.publicScript.offline })}
              </span>
            </>
          )}
        </p>
      )}

      <div data-testid="preview-canvas" ref={previewCanvasRef}>
        {/* The sizer occupies the frame's *scaled* footprint, so the canvas
         * scrolls and centres around what is actually visible rather than
         * around the frame's full unscaled size. */}
        <div
          data-testid="preview-frame-sizer"
          data-preview-viewport={viewport}
          style={
            viewportWidth === null || viewportHeight === null
              ? undefined
              : {
                  width: `${viewportWidth * previewScale}px`,
                  height: `${viewportHeight * previewScale}px`,
                }
          }
        >
          <div
            data-testid="preview-frame-shell"
            data-preview-viewport={viewport}
            data-preview-scaled={previewScale < 1 ? "true" : "false"}
            style={
              viewportWidth === null || viewportHeight === null
                ? undefined
                : {
                    width: `${viewportWidth}px`,
                    height: `${viewportHeight}px`,
                    transform: `scale(${previewScale})`,
                  }
            }
          >
            {/* Static: same-origin so the editor's blob: uploads and fonts
             * load; only the builder's own scripts run. Interactive: an
             * opaque origin that cannot reach the editor, with every asset
             * inlined. The two sandboxes are documented where they are
             * defined (`interactive-preview.ts`) and in ADR 0056. */}
            <iframe
              // Remounting on the document key gives the new target (or the
              // other mode) a fresh document; every other edit is applied in
              // place over the bridge, so this element is deliberately
              // stable across keystrokes.
              key={documentKey}
              ref={iframeRef}
              title={t("pane.preview.label")}
              srcDoc={bootHtmlRef.current}
              data-preview-mode={interactiveOn ? "interactive" : "static"}
              // `allow-popups` (both modes) lets the preview-nav interceptor
              // open external links (a partner site, a social profile) in a
              // new tab instead of replacing the preview document.
              sandbox={interactiveOn ? INTERACTIVE_PREVIEW_SANDBOX : STATIC_PREVIEW_SANDBOX}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
