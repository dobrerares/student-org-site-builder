/**
 * Electron preload script.
 *
 * The preload runs in a privileged but isolated context: it has access to
 * Node's `require` and Electron's `contextBridge` / `ipcRenderer`, but the
 * renderer (which this preload bridges to) does not.
 *
 * The preload exposes EXACTLY the API surface declared by
 * `PRELOAD_API_METHODS` under `window.sosb`. Anything outside that list
 * is unavailable to the renderer, full stop. This is the documented
 * Electron pattern for safe contextBridge surfaces; see
 * https://www.electronjs.org/docs/latest/tutorial/context-isolation.
 */

import { contextBridge, ipcRenderer } from "electron";
import { PRELOAD_API_KEY, buildPreloadApi } from "./preload-surface.js";

const api = buildPreloadApi({
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});

contextBridge.exposeInMainWorld(PRELOAD_API_KEY, api);
