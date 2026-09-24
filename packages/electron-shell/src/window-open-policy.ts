/**
 * What the main process does when the renderer asks for a new window, or
 * tries to navigate the editor away from itself.
 *
 * Electron's default for `window.open` is to create a second BrowserWindow
 * that inherits the parent's `webPreferences` — the preload included, and
 * with it the `window.sosb` bridge to native dialogs and the file system.
 * The editor's preview opens *external* links exactly that way (a partner's
 * website, a social profile: URLs the author typed), and the interactive
 * preview (ADR 0046, ADR 0056) lets a Theme's script open more. None of
 * those pages may be handed the bridge, so no child window is ever created:
 * a web URL is passed to the operating system's browser and everything else
 * is dropped. Restricting `shell.openExternal` to `http(s)` is what keeps it
 * safe — a `file:` or custom-scheme URL could launch a program.
 *
 * The main window itself never navigates. The editor is one document, and a
 * navigation away from it (a dropped file, a stray link outside a preview
 * frame) would lose the session. The same document with another fragment or
 * query is a reload of the editor and stays allowed.
 */

export interface WindowOpenDecision {
  /** Never `allow`: a child window would inherit the preload. */
  readonly action: "deny";
  /** A web URL to hand to the system browser, or `null` to drop the request. */
  readonly openExternal: string | null;
}

export function decideWindowOpen(url: string): WindowOpenDecision {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { action: "deny", openExternal: null };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { action: "deny", openExternal: null };
  }
  return { action: "deny", openExternal: parsed.href };
}

/** Is `target` the editor document itself (fragment and query aside)? */
export function isEditorNavigation(target: string, editorUrl: string): boolean {
  let a: URL;
  let b: URL;
  try {
    a = new URL(target);
    b = new URL(editorUrl);
  } catch {
    return false;
  }
  return a.protocol === b.protocol && a.host === b.host && a.pathname === b.pathname;
}
