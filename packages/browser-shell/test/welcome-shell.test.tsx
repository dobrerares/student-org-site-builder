// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { Site } from "@sosb/schema";
import { loadAutosave, saveAutosave } from "@sosb/editor-state";
import { MemoryDriver } from "@sosb/vfs/memory";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { WelcomeShell } from "../src/welcome-shell.js";

const blankSite = minimal as unknown as Site;

describe("WelcomeShell", () => {
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (host !== null) {
      render(null, host);
      host.remove();
      host = null;
    }
  });

  function mount(node: Parameters<typeof render>[0]): HTMLElement {
    host = document.createElement("div");
    document.body.appendChild(host);
    render(node, host);
    return host;
  }

  test("renders the four PRD entry points and recent-sites section", () => {
    const container = mount(<WelcomeShell blankSite={blankSite} recentSites={["/sites/one"]} />);

    expect(container.querySelector('[data-testid="welcome-action-wizard"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="welcome-action-continue"]')).toBeNull();
    expect(container.querySelector('[data-testid="welcome-action-template"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="welcome-action-import"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="welcome-action-blank"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="welcome-recent-sites"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="welcome-recent-site"]')?.textContent).toContain(
      "/sites/one",
    );
    expect(
      container.querySelector<HTMLButtonElement>('[data-testid="welcome-action-import"]')!.disabled,
    ).toBe(true);
  });

  test("Start blank opens the editor with the blank-site seed", async () => {
    const container = mount(<WelcomeShell blankSite={blankSite} />);

    await act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="welcome-action-blank"]')!.click();
    });

    expect(container.querySelector('[data-testid="editor-app"]')).not.toBeNull();
  });

  test("Start blank stores the seed as the current draft", async () => {
    const draftVfs = new MemoryDriver();
    const container = mount(<WelcomeShell blankSite={blankSite} draftVfs={draftVfs} />);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="welcome-action-blank"]')!.click();
      await Promise.resolve();
    });

    const saved = await loadAutosave(draftVfs);
    expect(saved?.org.name).toBe(blankSite.org.name);
  });

  test("Start from template opens the editor with the curated template", async () => {
    const container = mount(<WelcomeShell blankSite={blankSite} />);

    await act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="welcome-action-template"]')!
        .click();
    });

    expect(container.querySelector('[data-testid="editor-app"]')).not.toBeNull();
  });

  test("Import opens the editor when the host supplies an import flow", async () => {
    const container = mount(
      <WelcomeShell blankSite={blankSite} onImportSite={async () => structuredClone(blankSite)} />,
    );
    const importButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="welcome-action-import"]',
    );
    expect(importButton!.disabled).toBe(false);

    await act(async () => {
      importButton!.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="editor-app"]')).not.toBeNull();
  });

  test("Continue draft opens the saved local draft", async () => {
    const draftVfs = new MemoryDriver();
    const draft = structuredClone(blankSite);
    draft.org.name = "Saved Draft Org";
    await saveAutosave(draftVfs, draft);

    const container = mount(<WelcomeShell blankSite={blankSite} draftVfs={draftVfs} />);
    const continueButton = await waitForElement<HTMLButtonElement>(
      container,
      '[data-testid="welcome-action-continue"]',
    );
    expect(continueButton).not.toBeNull();

    await act(async () => {
      continueButton!.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="editor-app"]')).not.toBeNull();
  });

  test("wizard can be launched and cancelled back to welcome", async () => {
    const container = mount(<WelcomeShell blankSite={blankSite} />);

    await act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="welcome-action-wizard"]')!.click();
    });
    expect(container.querySelector('[data-testid="wizard"]')).not.toBeNull();

    await act(() => {
      container.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    });
    expect(container.querySelector('[data-testid="welcome-screen"]')).not.toBeNull();
  });
});

async function waitForEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitForElement<T extends Element>(
  container: HTMLElement,
  selector: string,
): Promise<T | null> {
  for (let i = 0; i < 10; i++) {
    const element = container.querySelector<T>(selector);
    if (element !== null) return element;
    await waitForEffects();
  }
  return container.querySelector<T>(selector);
}
