// @vitest-environment jsdom
import { describe, expect, test, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";

import { MemoryDriver } from "@sosb/vfs";
import { validate } from "@sosb/schema";
import type { Site } from "@sosb/schema";

import { Wizard } from "../src/wizard.js";
import { loadWizardProgress, saveWizardProgress } from "../src/persistence.js";
import type { WizardState } from "../src/state-machine.js";

/**
 * Integration: Wizard + persistence end-to-end.
 *
 * The host wires the Wizard's `onProgress` callback to
 * `saveWizardProgress`, and on remount calls `loadWizardProgress` to seed
 * `initial`. This is what the editor's boot path will look like — driven
 * by the same VFS pattern editor-state and recent-sites already use.
 */

afterEach(() => {
  cleanup();
});

interface HostHarnessProps {
  vfs: MemoryDriver;
  initial: WizardState | null;
  onComplete: (site: Site) => void;
}

function HostHarness(props: HostHarnessProps): JSX.Element {
  const [progress, setProgress] = useState<WizardState | null>(props.initial);

  useEffect(() => {
    if (progress === null) return;
    void saveWizardProgress(props.vfs, progress);
  }, [progress, props.vfs]);

  if (props.initial !== null) {
    return (
      <Wizard initial={props.initial} onProgress={setProgress} onComplete={props.onComplete} />
    );
  }
  return <Wizard onProgress={setProgress} onComplete={props.onComplete} />;
}

describe("Wizard + persistence — resume flow", () => {
  test("a partial run is saved to VFS and restored after a remount", async () => {
    const vfs = new MemoryDriver();

    // Initial mount: walk through basics + identity.
    const { container, unmount } = render(
      <HostHarness
        vfs={vfs}
        initial={null}
        onComplete={() => {
          /* no-op for partial */
        }}
      />,
    );

    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "HISTORIPOL" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!); // identity

    // Wait one microtask + a re-render so onProgress -> setState -> useEffect fires.
    await new Promise((r) => setTimeout(r, 0));

    const saved = await loadWizardProgress(vfs);
    expect(saved).not.toBeNull();
    expect(saved?.step).toBe("identity");
    expect(saved?.data.basics?.name).toBe("HISTORIPOL");

    unmount();

    // Second mount: reload from saved state.
    const restored = await loadWizardProgress(vfs);
    const second = render(<HostHarness vfs={vfs} initial={restored} onComplete={() => {}} />);
    expect(second.container.querySelector('[data-wizard-step="identity"]')).not.toBeNull();

    // Going back shows the org name we entered before.
    fireEvent.click(second.container.querySelector('[data-action="back"]')!);
    const restoredInput = second.container.querySelector(
      '[data-field="basics.name"]',
    ) as HTMLInputElement;
    expect(restoredInput.value).toBe("HISTORIPOL");
  });

  test("completing the wizard yields a valid Site (passes @sosb/schema validate)", async () => {
    const vfs = new MemoryDriver();
    let createdSite: Site | null = null;

    const { container } = render(
      <HostHarness
        vfs={vfs}
        initial={null}
        onComplete={(site) => {
          createdSite = site;
        }}
      />,
    );

    // Go through every step then create.
    const input = container.querySelector('[data-field="basics.name"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Test Org" } });
    fireEvent.click(container.querySelector('[data-action="next"]')!); // identity
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // sections
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // content
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // languages
    fireEvent.click(container.querySelector('[data-action="skip"]')!); // confirm
    fireEvent.click(container.querySelector('[data-action="create"]')!);

    expect(createdSite).not.toBeNull();
    const result = validate(createdSite!);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
