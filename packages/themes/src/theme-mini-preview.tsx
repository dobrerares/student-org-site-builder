/** @jsxImportSource react */
/**
 * `<ThemeMiniPreview>` — a scaled-down live render of a theme.
 *
 * Shared by the editor's theme picker and the wizard's identity step, for the
 * same reason the theme catalog lives here: both UIs need it, and neither may
 * depend on the other.
 *
 * Accessibility: the miniature is decorative. It is a picture of a layout the
 * user cannot reach or interact with, and everything it conveys is also said
 * in the option's own label and description. So it is `aria-hidden`, its
 * iframe is removed from the tab order, and pointer events pass straight
 * through to the radio the caller wraps it in — clicking the picture selects
 * the theme, as a user would expect.
 *
 * Cost: the HTML is memoised per theme by `themePreviewHtml`, mounting is
 * deferred until the option scrolls into view, and only one miniature boots at
 * a time (a picker showing six themes must not start six document parses at
 * once on a low-end laptop).
 */
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

import type { ThemeBundle } from "@sosb/renderer";

import {
  THEME_PREVIEW_VIEWPORT_HEIGHT,
  THEME_PREVIEW_VIEWPORT_WIDTH,
  themePreviewHtml,
} from "./theme-preview-html.js";

/**
 * Serialises miniature boots across every mounted instance.
 *
 * Each waiter is admitted only once the previous one has finished loading (or
 * has taken too long — a stuck iframe must not block the rest of the list
 * forever).
 */
const BOOT_TIMEOUT_MS = 2000;

let bootBusy = false;
const bootQueue: (() => void)[] = [];

function requestBootSlot(start: () => void): () => void {
  let cancelled = false;
  const task = (): void => {
    if (cancelled) {
      releaseBootSlot();
      return;
    }
    start();
  };
  if (bootBusy) {
    bootQueue.push(task);
  } else {
    bootBusy = true;
    task();
  }
  return () => {
    cancelled = true;
    const idx = bootQueue.indexOf(task);
    if (idx >= 0) bootQueue.splice(idx, 1);
  };
}

function releaseBootSlot(): void {
  const next = bootQueue.shift();
  if (next === undefined) {
    bootBusy = false;
    return;
  }
  next();
}

/** Reset the boot queue. Test-only — mounts and unmounts manage it otherwise. */
export function resetThemeMiniPreviewQueue(): void {
  bootQueue.length = 0;
  bootBusy = false;
}

export interface ThemeMiniPreviewProps {
  readonly themeId: string;
  /**
   * An imported Theme package's resolved bundle, for ids the renderer does not
   * have compiled in. Omit for built-in themes.
   */
  readonly bundle?: ThemeBundle | undefined;
  /**
   * Width the miniature occupies, in CSS pixels. The render happens at the
   * full `THEME_PREVIEW_VIEWPORT_WIDTH` and is transform-scaled down to this,
   * so the theme's desktop composition is what gets shown — shrinking the
   * viewport instead would show its mobile layout.
   */
  readonly width?: number;
  /** Height the miniature occupies, in CSS pixels. Content below is cropped. */
  readonly height?: number;
}

export function ThemeMiniPreview(props: ThemeMiniPreviewProps): JSX.Element {
  const width = props.width ?? 168;
  const height = props.height ?? 112;
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [html, setHtml] = useState<string | undefined>(undefined);

  // Defer until the option is actually on screen. Without an
  // IntersectionObserver (jsdom, older engines) fall back to mounting
  // immediately — a correct picture beats a clever one that never appears.
  useEffect(() => {
    const node = rootRef.current;
    if (node === null) return;
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  // `props.bundle` is a dependency, not just an argument: re-importing an
  // edited Theme package hands down a new bundle at the same id, and without
  // it the miniature would keep showing the replaced design.
  const bundle = props.bundle;
  useEffect(() => {
    if (!visible) return;
    return requestBootSlot(() => {
      setHtml(themePreviewHtml(props.themeId, bundle));
    });
  }, [visible, props.themeId, bundle]);

  // Release the slot once this miniature has painted, so the next one starts.
  useEffect(() => {
    if (html === undefined) return;
    const timer = setTimeout(releaseBootSlot, BOOT_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [html]);

  const scale = width / THEME_PREVIEW_VIEWPORT_WIDTH;

  return (
    <span
      ref={rootRef}
      data-theme-mini-preview
      data-theme-id={props.themeId}
      data-loaded={html === undefined ? "false" : "true"}
      aria-hidden="true"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {html === undefined ? null : (
        <iframe
          data-theme-mini-preview-frame
          title=""
          tabIndex={-1}
          scrolling="no"
          // No `allow-scripts`: a miniature is a still picture. The sample
          // site is ours, but there is no reason to run anything in it.
          sandbox=""
          srcDoc={html}
          onLoad={releaseBootSlot}
          style={{
            width: `${THEME_PREVIEW_VIEWPORT_WIDTH}px`,
            height: `${THEME_PREVIEW_VIEWPORT_HEIGHT}px`,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </span>
  );
}
