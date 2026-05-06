/**
 * UpdateBanner — Preact component that surfaces auto-update lifecycle
 * state (`updateAvailable`, `updateDownloaded`, `updateError`) as a
 * top-of-window banner.
 *
 * Decoupled from Electron via the `UpdateBridge` interface — in the
 * desktop shell the bridge is wired to `window.sosb.onUpdateEvent` /
 * `window.sosb.installUpdateAndRelaunch` etc.; in tests we pass a fake.
 *
 * Behaviour (PRD: "Background check + auto-download + prompt to install.
 * Never auto-restarts mid-session."):
 *
 * 1. `update-available` event → banner shows "Update available"
 *    (download is happening in the background; no Restart button yet).
 * 2. `update-downloaded` event → banner adds a "Restart now" + "Later"
 *    pair. "Restart now" calls `installAndRelaunch`. "Later" calls
 *    `declineUpdate` and dismisses the banner.
 * 3. `error` event → red error banner with the message; auto-dismiss
 *    button.
 *
 * The banner has no idle/empty state; if no event has fired the
 * component renders `null`.
 */

import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";

export interface UpdateInfo {
  readonly version: string;
  readonly releaseNotes?: string | undefined;
}

export interface UpdateError {
  readonly message: string;
}

/**
 * The shim the renderer talks to. The desktop wiring connects this to
 * `window.sosb`'s `onUpdateEvent` / `installUpdateAndRelaunch` etc.; the
 * browser SPA doesn't use the banner at all (auto-update is desktop-only).
 */
export interface UpdateBridge {
  onUpdateAvailable(listener: (info: UpdateInfo) => void): () => void;
  onUpdateDownloaded(listener: (info: UpdateInfo) => void): () => void;
  onUpdateError(listener: (err: UpdateError) => void): () => void;
  installAndRelaunch(): Promise<void> | void;
  declineUpdate(): Promise<void> | void;
}

type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "available"; readonly info: UpdateInfo }
  | { readonly kind: "downloaded"; readonly info: UpdateInfo }
  | { readonly kind: "error"; readonly err: UpdateError };

export interface UpdateBannerProps {
  readonly bridge: UpdateBridge;
}

export function UpdateBanner(props: UpdateBannerProps): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    const offAvail = props.bridge.onUpdateAvailable((info) => {
      setPhase({ kind: "available", info });
    });
    const offDl = props.bridge.onUpdateDownloaded((info) => {
      setPhase({ kind: "downloaded", info });
    });
    const offErr = props.bridge.onUpdateError((err) => {
      setPhase({ kind: "error", err });
    });
    return () => {
      offAvail();
      offDl();
      offErr();
    };
  }, [props.bridge]);

  if (phase.kind === "idle") return null;

  if (phase.kind === "error") {
    return (
      <aside data-testid="update-banner-error" role="alert">
        <span>Update failed: {phase.err.message}</span>
        <button
          type="button"
          data-testid="update-error-dismiss"
          onClick={() => setPhase({ kind: "idle" })}
        >
          Dismiss
        </button>
      </aside>
    );
  }

  // available or downloaded
  const info = phase.info;
  return (
    <aside data-testid="update-banner" role="status">
      <span data-testid="update-banner-message">
        {phase.kind === "downloaded"
          ? `Update ${info.version} ready to install.`
          : `Update ${info.version} available — downloading…`}
      </span>
      {phase.kind === "downloaded" ? (
        <button
          type="button"
          data-testid="update-restart"
          onClick={() => {
            void props.bridge.installAndRelaunch();
          }}
        >
          Restart now
        </button>
      ) : null}
      <button
        type="button"
        data-testid="update-later"
        onClick={() => {
          void props.bridge.declineUpdate();
          setPhase({ kind: "idle" });
        }}
      >
        Later
      </button>
    </aside>
  );
}
