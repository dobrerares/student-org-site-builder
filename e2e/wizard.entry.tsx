/**
 * Browser-side entry for the wizard e2e specs.
 *
 * Bundled by esbuild in `wizard.spec.ts` and injected into headless
 * Chromium via `page.addScriptTag`. Mounts a `<Wizard>` and exposes
 * `window.__sosbWizard` so the test can read the captured Site after
 * the user completes the flow.
 */
import { render } from "preact";
import type { Site } from "@sosb/schema";

import { Wizard } from "../packages/wizard/src/index.js";
import type { WizardState } from "../packages/wizard/src/state-machine.js";

interface WizardBridge {
  mount(opts: { initial?: WizardState }, container: HTMLElement): void;
  /** The most recent state observed via onProgress. */
  lastProgress: WizardState | null;
  /** The Site emitted via onComplete. */
  completed: Site | null;
  /** Whether onCancel fired. */
  cancelled: boolean;
}

declare global {
  interface Window {
    __sosbWizard: WizardBridge;
  }
}

const bridge: WizardBridge = {
  lastProgress: null,
  completed: null,
  cancelled: false,
  mount(opts, container) {
    render(
      <Wizard
        initial={opts.initial}
        onProgress={(state) => {
          bridge.lastProgress = state;
        }}
        onComplete={(site) => {
          bridge.completed = site;
        }}
        onCancel={() => {
          bridge.cancelled = true;
        }}
      />,
      container,
    );
  },
};

window.__sosbWizard = bridge;
