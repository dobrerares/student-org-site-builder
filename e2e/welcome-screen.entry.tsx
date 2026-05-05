/**
 * Browser-side entry for the welcome-screen e2e specs.
 *
 * Bundled by esbuild in `welcome-screen.spec.ts` and injected into
 * headless Chromium via `page.addScriptTag`. Mounts a `<WelcomeScreen>`
 * with a small recents fixture and exposes `window.__sosbWelcome` so the
 * test can read which path the user clicked.
 */
import { render } from "preact";

import { WelcomeScreen, type RecentSite } from "../packages/editor-app/src/index.js";

interface WelcomeBridge {
  mount(opts: { recents: readonly RecentSite[] }, container: HTMLElement): void;
  /** The id of the path the user most recently activated. */
  lastPath: string | null;
  /** The key of the recent-site row the user most recently clicked. */
  lastRecent: string | null;
  /** The name of a dropped File, if any. */
  lastDroppedName: string | null;
}

declare global {
  interface Window {
    __sosbWelcome: WelcomeBridge;
  }
}

const bridge: WelcomeBridge = {
  lastPath: null,
  lastRecent: null,
  lastDroppedName: null,
  mount(opts, container) {
    render(
      <WelcomeScreen
        recents={opts.recents}
        onWizard={() => {
          bridge.lastPath = "wizard";
        }}
        onTemplate={() => {
          bridge.lastPath = "template";
        }}
        onImport={() => {
          bridge.lastPath = "import";
        }}
        onBlank={() => {
          bridge.lastPath = "blank";
        }}
        onImportFile={(file) => {
          bridge.lastDroppedName = file.name;
        }}
        onOpenRecent={(key) => {
          bridge.lastRecent = key;
        }}
      />,
      container,
    );
  },
};

window.__sosbWelcome = bridge;
