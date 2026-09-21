/**
 * Test helpers for the live-preview bridge.
 *
 * The preview no longer refreshes by reassigning the iframe's `srcdoc` — that
 * rebuilt the document on every keystroke and threw away the user's scroll
 * position and open disclosures. `srcdoc` is now only the *boot* document for
 * the current page/theme/language; edits travel to the iframe as
 * `previewHtml` messages over the preview bridge.
 *
 * So a test that wants to know "what does the preview show now?" reads the
 * posted messages, not the attribute. Two wrinkles these helpers absorb:
 *
 *  - jsdom does not execute scripts inside a `srcdoc` iframe, so the
 *    renderer's morph script never boots and never announces itself. The host
 *    holds edits back until it sees that `ready`, so a test must fake it.
 *  - The host posts into `iframe.contentWindow`, which jsdom leaves inert;
 *    `capturePreviewMessages` replaces it with a recording stub.
 */
import { encodePreviewMessage } from "@sosb/preview-bridge";

export interface PreviewCapture {
  /** Every envelope the host has posted into the iframe, in order. */
  readonly envelopes: { channel: string; payload: { type: string; [k: string]: unknown } }[];
  /** The HTML of the most recent `previewHtml` message, if any. */
  latestHtml(): string | undefined;
  /** Payloads of a given type, in order. */
  payloadsOfType(type: string): { type: string; [k: string]: unknown }[];
}

/** Record everything the host posts into this iframe. */
export function capturePreviewMessages(iframe: HTMLIFrameElement): PreviewCapture {
  const envelopes: PreviewCapture["envelopes"] = [];
  Object.defineProperty(iframe, "contentWindow", {
    configurable: true,
    get: () => ({
      postMessage: (data: unknown) => {
        envelopes.push(data as PreviewCapture["envelopes"][number]);
      },
    }),
  });
  return {
    envelopes,
    latestHtml() {
      for (let i = envelopes.length - 1; i >= 0; i--) {
        const payload = envelopes[i]!.payload;
        if (payload.type === "previewHtml") return payload["html"] as string;
      }
      return undefined;
    },
    payloadsOfType(type: string) {
      return envelopes.filter((e) => e.payload.type === type).map((e) => e.payload);
    },
  };
}

/**
 * Stand in for the iframe's morph script announcing that its message listener
 * is wired. Until the host sees this, it buffers edits rather than posting
 * them into a document that cannot yet hear them.
 */
export function announcePreviewReady(): void {
  window.dispatchEvent(
    new MessageEvent("message", { data: encodePreviewMessage({ type: "ready" }) }),
  );
}
