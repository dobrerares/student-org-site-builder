/**
 * `@sosb/preview-bridge` — postMessage protocol between editor host and
 * preview iframe.
 *
 * The protocol is intentionally narrow:
 *
 * - Host → Iframe: `{ type: "siteData", siteData, themeId, pageIndex? }`.
 *   The iframe re-renders by calling `renderSite(...)` on the new payload.
 * - Iframe → Host: `{ type: "ready" }` once the iframe's bootstrapper has
 *   wired up its message listener; `{ type: "error", message }` if a render
 *   throws; `{ type: "navigate", path }` when a user clicks a nav or
 *   language-switcher link inside the preview iframe (the host swaps
 *   `activePageIndex` instead of letting the iframe navigate to a URL the
 *   editor's origin doesn't serve).
 *
 * Every message is wrapped in an envelope `{ channel, version, payload }`.
 * Decoders reject envelopes from a different channel (so the editor doesn't
 * react to an unrelated postMessage from the page) or from a future protocol
 * version (so a v2 iframe loaded into a v1 host fails closed).
 *
 * Tracking issue: #7. ADR 0005 records the design.
 */

import type { Site } from "@sosb/schema";

/** Stable channel identifier — namespaces our messages from page noise. */
export const PREVIEW_BRIDGE_CHANNEL = "sosb:preview" as const;
/** Bumped on incompatible payload changes. v1 ships with version 1. */
export const PREVIEW_BRIDGE_VERSION = 1 as const;

export type HostMessage = {
  readonly type: "siteData";
  readonly siteData: Site;
  readonly themeId: string;
  readonly pageIndex?: number;
};

export type PreviewMessage =
  | { readonly type: "ready" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "navigate"; readonly path: string };

/** The wire envelope. */
export interface BridgeEnvelope<T> {
  readonly channel: typeof PREVIEW_BRIDGE_CHANNEL;
  readonly version: typeof PREVIEW_BRIDGE_VERSION;
  readonly payload: T;
}

export function encodeHostMessage(msg: HostMessage): BridgeEnvelope<HostMessage> {
  return {
    channel: PREVIEW_BRIDGE_CHANNEL,
    version: PREVIEW_BRIDGE_VERSION,
    payload: msg,
  };
}

export function encodePreviewMessage(msg: PreviewMessage): BridgeEnvelope<PreviewMessage> {
  return {
    channel: PREVIEW_BRIDGE_CHANNEL,
    version: PREVIEW_BRIDGE_VERSION,
    payload: msg,
  };
}

export function decodeHostMessage(raw: unknown): HostMessage | null {
  const env = decodeEnvelope(raw);
  if (env === null) return null;
  const payload = env.payload as Partial<HostMessage>;
  if (payload.type !== "siteData") return null;
  if (typeof payload.themeId !== "string") return null;
  if (payload.siteData === undefined || payload.siteData === null) return null;
  const result: HostMessage = {
    type: "siteData",
    siteData: payload.siteData as Site,
    themeId: payload.themeId,
    ...(typeof payload.pageIndex === "number" ? { pageIndex: payload.pageIndex } : {}),
  };
  return result;
}

export function decodePreviewMessage(raw: unknown): PreviewMessage | null {
  const env = decodeEnvelope(raw);
  if (env === null) return null;
  const payload = env.payload as Partial<PreviewMessage>;
  if (payload.type === "ready") return { type: "ready" };
  if (payload.type === "error") {
    const errorPayload = payload as { type: "error"; message?: unknown };
    if (typeof errorPayload.message !== "string") return null;
    return { type: "error", message: errorPayload.message };
  }
  if (payload.type === "navigate") {
    const navPayload = payload as { type: "navigate"; path?: unknown };
    if (typeof navPayload.path !== "string" || navPayload.path.length === 0) return null;
    return { type: "navigate", path: navPayload.path };
  }
  return null;
}

function decodeEnvelope(raw: unknown): BridgeEnvelope<unknown> | null {
  if (raw === null || typeof raw !== "object") return null;
  const env = raw as Partial<BridgeEnvelope<unknown>>;
  if (env.channel !== PREVIEW_BRIDGE_CHANNEL) return null;
  if (env.version !== PREVIEW_BRIDGE_VERSION) return null;
  if (env.payload === undefined || env.payload === null || typeof env.payload !== "object") {
    return null;
  }
  return env as BridgeEnvelope<unknown>;
}

// ---------------------------------------------------------------------------
// Editor-host helper.
// ---------------------------------------------------------------------------

export interface PreviewHostOptions {
  /** The iframe element to post messages into. */
  readonly iframe: HTMLIFrameElement;
  /** Optional callback fired on every decoded preview message. */
  readonly onPreviewEvent?: (msg: PreviewMessage) => void;
}

export interface PreviewHost {
  /** Post a fresh siteData payload into the iframe. */
  postSiteData(siteData: Site, themeId: string, pageIndex?: number): void;
  /** Process an inbound `MessageEvent.data` (or any raw value). */
  handleIncomingMessage(raw: unknown): void;
}

/**
 * Build a tiny host-side helper that knows how to post a `siteData` payload
 * into the iframe and how to dispatch decoded preview events to a handler.
 *
 * The helper does NOT install a global `message` listener — the caller wires
 * `window.addEventListener("message", e => host.handleIncomingMessage(e.data))`
 * itself. This keeps the helper unit-testable (no global side effects) and
 * lets the caller scope the listener (e.g. a Preact `useEffect`'s cleanup).
 */
export function createPreviewHost(options: PreviewHostOptions): PreviewHost {
  const { iframe, onPreviewEvent } = options;
  return {
    postSiteData(siteData: Site, themeId: string, pageIndex?: number): void {
      const envelope = encodeHostMessage({
        type: "siteData",
        siteData,
        themeId,
        ...(typeof pageIndex === "number" ? { pageIndex } : {}),
      });
      // The iframe's contentWindow may be null if the iframe hasn't loaded
      // yet. We tolerate that — the next siteData edit will re-fire.
      iframe.contentWindow?.postMessage(envelope, "*");
    },
    handleIncomingMessage(raw: unknown): void {
      const decoded = decodePreviewMessage(raw);
      if (decoded === null) return;
      onPreviewEvent?.(decoded);
    },
  };
}
