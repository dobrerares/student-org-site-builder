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
 */
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { Site } from "@sosb/schema";
import { Button, Segmented } from "@sosb/ui";
import { createPreviewHost } from "@sosb/preview-bridge";

import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";

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
  /** Hidden rather than unmounted on phones, so the iframe is not rebuilt. */
  readonly hidden?: boolean;
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
  const bootHtmlRef = useRef<string>(props.html);
  const reloadKeyRef = useRef<string>(props.reloadKey);
  const readyRef = useRef<boolean>(false);
  const pendingHtmlRef = useRef<string | null>(null);
  if (reloadKeyRef.current !== props.reloadKey) {
    reloadKeyRef.current = props.reloadKey;
    bootHtmlRef.current = props.html;
    readyRef.current = false;
    pendingHtmlRef.current = null;
  }

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;
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
  }, [props.html, props.siteData, props.activePageIndex]);

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
          if (pending !== null) host.postPreviewHtml(pending);
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
      data-hidden={props.hidden === true ? "true" : "false"}
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
      </div>

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
            {/* Scripts power renderer-owned preview interactions; same-origin keeps blob uploads visible. */}
            <iframe
              // Remounting on the reload key gives the new target a fresh
              // document; every other edit is applied in place over the
              // bridge, so this element is deliberately stable across
              // keystrokes.
              key={props.reloadKey}
              ref={iframeRef}
              title={t("pane.preview.label")}
              srcDoc={bootHtmlRef.current}
              // `allow-popups` lets the preview-nav interceptor open external
              // links (a partner site, a social profile) in a new tab instead
              // of replacing the preview document.
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
