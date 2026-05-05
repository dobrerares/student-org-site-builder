/**
 * Auto-update orchestrator.
 *
 * Wires `electron-updater`'s `autoUpdater` events to the renderer over
 * the IPC bridge from #35. The orchestrator is a pure object factory
 * over an `AutoUpdaterLike` shim (and a `RendererSender`) so the entire
 * lifecycle is unit-testable in node — no real Electron runtime, no real
 * autoUpdater spawning a downloader.
 *
 * Lifecycle (PRD: "Auto-update for Electron via electron-updater against
 * GitHub Releases. Background check + auto-download + prompt to install.
 * Single stable channel for v1. Never auto-restarts mid-session."):
 *
 * 1. `start()` registers event listeners on the autoUpdater, fires an
 *    initial `checkForUpdates()`, and (if `autoCheckEnabled`) schedules a
 *    timer for every `AUTO_UPDATE_CHECK_INTERVAL_MS` (= 6 hours).
 * 2. `update-available` → forward to renderer (skipping declined versions).
 * 3. `download-progress` → forward to renderer.
 * 4. `update-downloaded` → forward to renderer (banner offers
 *    "Restart now / Later").
 * 5. `error` → log + forward to renderer; never throws out (the next
 *    interval call retries).
 * 6. `installAndRelaunch()` → calls `autoUpdater.quitAndInstall()`.
 * 7. `declineCurrent()` → persists the in-flight version to the declined
 *    list so the next launch skips notifying about it.
 * 8. `stop()` → clears the timer and removes the listeners.
 *
 * `autoInstallOnAppQuit` is set to FALSE on purpose: the PRD says "never
 * auto-restarts mid-session" and the user's "Later" choice should not
 * silently install on the next quit.
 */

import {
  AutoUpdateChannels,
  type DownloadProgressPayload,
  type UpdateErrorPayload,
  type UpdateInfoPayload,
} from "./auto-update-channels.js";
import {
  declineUpdateVersion,
  isVersionDeclined,
  type AutoUpdateSettingsStore,
} from "./auto-update-settings.js";

/** Six hours, expressed in milliseconds. */
export const AUTO_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** The autoUpdater event names we subscribe to. */
export type AutoUpdaterEventName =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "update-downloaded"
  | "download-progress"
  | "error";

/**
 * The slice of electron-updater's `autoUpdater` we actually use. The real
 * `autoUpdater` is a global singleton with side-effecting Node code; this
 * shim makes the orchestrator testable.
 */
export interface AutoUpdaterLike {
  /** Whether to auto-download once an update is available. */
  autoDownload: boolean;
  /** Whether to auto-install on app quit (always false in our shell). */
  autoInstallOnAppQuit: boolean;
  on(event: AutoUpdaterEventName, listener: (arg: unknown) => void): void;
  removeAllListeners(): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

/** A push channel that ferries main-side events to the renderer. */
export interface RendererSender {
  send(channel: string, payload: unknown): void;
}

/** A minimal logger surface — main.ts wires this to console at runtime. */
export interface OrchestratorLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface OrchestratorDeps {
  readonly autoUpdater: AutoUpdaterLike;
  readonly sender: RendererSender;
  readonly settingsStore: AutoUpdateSettingsStore;
  readonly logger: OrchestratorLogger;
}

export interface AutoUpdaterOrchestrator {
  /**
   * Wire listeners + run an initial check. Schedules the periodic check
   * if the user has `autoCheckEnabled = true` (the default).
   */
  start(): void;
  /** Tear down listeners and the periodic timer. */
  stop(): void;
  /**
   * Run a manual `checkForUpdates()`. Always runs, even when
   * `autoCheckEnabled = false` (Help → "Check for updates" path).
   */
  checkNow(): Promise<void>;
  /**
   * Tell the underlying autoUpdater to quit and install the downloaded
   * update. Wired to the "Restart now" button in the renderer.
   */
  installAndRelaunch(): void;
  /**
   * Persist a "Later" decision for the version currently being offered.
   * No-op if there's no in-flight update.
   */
  declineCurrent(): void;
}

interface RawUpdateInfo {
  version?: unknown;
  releaseNotes?: unknown;
  releaseName?: unknown;
  releaseDate?: unknown;
}

interface RawProgressInfo {
  bytesPerSecond?: unknown;
  percent?: unknown;
  total?: unknown;
  transferred?: unknown;
}

function toUpdateInfoPayload(raw: unknown): UpdateInfoPayload | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as RawUpdateInfo;
  if (typeof r.version !== "string") return null;
  return {
    version: r.version,
    ...(typeof r.releaseNotes === "string" ? { releaseNotes: r.releaseNotes } : {}),
    ...(typeof r.releaseName === "string" ? { releaseName: r.releaseName } : {}),
    ...(typeof r.releaseDate === "string" ? { releaseDate: r.releaseDate } : {}),
  };
}

function toProgressPayload(raw: unknown): DownloadProgressPayload | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as RawProgressInfo;
  if (
    typeof r.bytesPerSecond !== "number" ||
    typeof r.percent !== "number" ||
    typeof r.total !== "number" ||
    typeof r.transferred !== "number"
  ) {
    return null;
  }
  return {
    bytesPerSecond: r.bytesPerSecond,
    percent: r.percent,
    total: r.total,
    transferred: r.transferred,
  };
}

function toErrorPayload(raw: unknown): UpdateErrorPayload {
  if (raw instanceof Error) return { message: raw.message };
  if (typeof raw === "string") return { message: raw };
  return { message: "Unknown auto-update error" };
}

export function createAutoUpdaterOrchestrator(deps: OrchestratorDeps): AutoUpdaterOrchestrator {
  const { autoUpdater, sender, settingsStore, logger } = deps;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlightUpdate: UpdateInfoPayload | null = null;

  function safeSend(channel: string, payload: unknown): void {
    try {
      sender.send(channel, payload);
    } catch (err) {
      logger.error("[auto-update] failed to send to renderer:", err);
    }
  }

  function runCheck(): void {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      logger.error("[auto-update] checkForUpdates failed:", err);
      safeSend(AutoUpdateChannels.events.updateError, toErrorPayload(err));
    });
  }

  function attachListeners(): void {
    autoUpdater.on("checking-for-update", () => {
      logger.info("[auto-update] checking for update");
      safeSend(AutoUpdateChannels.events.checkingForUpdate, {});
    });

    autoUpdater.on("update-available", (raw) => {
      const info = toUpdateInfoPayload(raw);
      if (info === null) {
        logger.warn("[auto-update] update-available with unrecognised payload:", raw);
        return;
      }
      logger.info(`[auto-update] update available: ${info.version}`);
      inFlightUpdate = info;

      if (isVersionDeclined(settingsStore, info.version)) {
        logger.info(`[auto-update] version ${info.version} previously declined; not notifying`);
        return;
      }
      safeSend(AutoUpdateChannels.events.updateAvailable, info);
    });

    autoUpdater.on("update-not-available", (raw) => {
      const info = toUpdateInfoPayload(raw);
      logger.info("[auto-update] no update available");
      safeSend(AutoUpdateChannels.events.updateNotAvailable, info ?? {});
    });

    autoUpdater.on("download-progress", (raw) => {
      const progress = toProgressPayload(raw);
      if (progress === null) return;
      safeSend(AutoUpdateChannels.events.downloadProgress, progress);
    });

    autoUpdater.on("update-downloaded", (raw) => {
      const info = toUpdateInfoPayload(raw);
      logger.info("[auto-update] update downloaded; ready to install");
      safeSend(AutoUpdateChannels.events.updateDownloaded, info ?? inFlightUpdate ?? {});
    });

    autoUpdater.on("error", (raw) => {
      logger.error("[auto-update] error:", raw);
      safeSend(AutoUpdateChannels.events.updateError, toErrorPayload(raw));
    });
  }

  return {
    start() {
      // Per PRD: "Background check + auto-download + prompt to install.
      // Never auto-restarts mid-session." So we keep autoDownload on but
      // disable autoInstallOnAppQuit (the autoUpdater's quiet path).
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = false;

      attachListeners();

      const settings = settingsStore.read();
      if (!settings.autoCheckEnabled) {
        logger.info("[auto-update] auto-check disabled by user; skipping initial check + timer");
        return;
      }

      runCheck();
      timer = setInterval(runCheck, AUTO_UPDATE_CHECK_INTERVAL_MS);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      autoUpdater.removeAllListeners();
    },
    async checkNow() {
      try {
        await autoUpdater.checkForUpdates();
      } catch (err) {
        logger.error("[auto-update] manual checkForUpdates failed:", err);
        safeSend(AutoUpdateChannels.events.updateError, toErrorPayload(err));
      }
    },
    installAndRelaunch() {
      autoUpdater.quitAndInstall();
    },
    declineCurrent() {
      if (inFlightUpdate === null) return;
      declineUpdateVersion(settingsStore, inFlightUpdate.version);
      logger.info(`[auto-update] user declined version ${inFlightUpdate.version}`);
    },
  };
}
