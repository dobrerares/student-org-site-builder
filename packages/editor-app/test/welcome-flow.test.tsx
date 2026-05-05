// @vitest-environment jsdom
import { describe, expect, test, afterEach, beforeAll } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { useEffect, useState } from "preact/hooks";
import type { JSX } from "preact";

import { MemoryDriver } from "@sosb/vfs";
import { exportToZip, importFromZip } from "@sosb/zip";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { WelcomeScreen } from "../src/welcome-screen.js";
import {
  loadRecentSites,
  recordRecentSite,
  type RecentSite,
} from "../src/recent-sites.js";
import { createBlankSite } from "../src/blank-site.js";

const baseSite = minimal as unknown as Site;

// Polyfill Blob.arrayBuffer / File.arrayBuffer for older jsdom versions.
// `importFromZip` calls `blob.arrayBuffer()` and our test reads File bytes
// the same way; we add a polyfill that defers to FileReader.
beforeAll(() => {
  function polyfill(target: typeof Blob.prototype | typeof File.prototype): void {
    if (typeof target.arrayBuffer === "function") return;
    Object.defineProperty(target, "arrayBuffer", {
      configurable: true,
      writable: true,
      value(this: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = (): void => reject(reader.error);
          reader.onload = (): void =>
            resolve(reader.result as ArrayBuffer);
          reader.readAsArrayBuffer(this);
        });
      },
    });
  }
  polyfill(Blob.prototype);
  polyfill(File.prototype);
});

afterEach(() => {
  cleanup();
});

/**
 * Glue test: walk through the welcome → editor handoff for each path.
 *
 * The welcome screen is purely UI; the host owns the actual flow. These
 * tests bind the welcome screen to a tiny host harness and assert that
 * the host receives the right pieces back. This is what the editor's
 * boot path will look like — driven by callbacks the screen surfaces.
 */
interface HostState {
  readonly path: "wizard" | "template" | "import" | "blank" | null;
  readonly site: Site | null;
}

function HostHarness(props: {
  recents: readonly RecentSite[];
  onState: (state: HostState) => void;
  importFile?: File;
  recentsVfs?: MemoryDriver;
}): JSX.Element {
  const [state, setState] = useState<HostState>({ path: null, site: null });

  // Surface the latest state to the test on every change.
  useEffect(() => {
    props.onState(state);
  }, [state, props]);

  return (
    <WelcomeScreen
      recents={props.recents}
      onWizard={() => setState({ path: "wizard", site: null })}
      onTemplate={() => setState({ path: "template", site: null })}
      onImport={() => {
        // In the real host this opens an OS file picker; in the test
        // it is a deterministic re-entry via the drop path below.
        setState({ path: "import", site: null });
      }}
      onBlank={() => setState({ path: "blank", site: createBlankSite() })}
      onImportFile={async (file) => {
        // A `File` is a `Blob` — importFromZip reads via .arrayBuffer().
        const result = await importFromZip(file);
        setState({ path: "import", site: result.siteData });
        if (props.recentsVfs !== undefined) {
          await recordRecentSite(props.recentsVfs, {
            key: file.name,
            label: result.siteData.org.name,
            lastModified: Date.now(),
          });
        }
      }}
    />
  );
}

describe("welcome → editor handoff (integration)", () => {
  test("clicking 'Start blank' hands the host a valid blank site with a hero block", async () => {
    let captured: HostState = { path: null, site: null };
    const { container } = render(
      <HostHarness recents={[]} onState={(s) => (captured = s)} />,
    );

    const button = container.querySelector('[data-welcome-path="blank"]');
    fireEvent.click(button!);

    expect(captured.path).toBe("blank");
    expect(captured.site).not.toBeNull();
    expect(captured.site!.pages).toHaveLength(1);
    const block = captured.site!.pages[0]!.blocks[0]!;
    expect(block.type).toBe("hero");
  });

  test("dropping a real zip on the welcome screen hands the host the imported site", async () => {
    // Build a valid zip from the fixture so importFromZip succeeds.
    const blob = await exportToZip(baseSite, new MemoryDriver());
    const buf = await blob.arrayBuffer();
    const file = new File([new Uint8Array(buf)], "stub-site.zip", {
      type: "application/zip",
    });

    const recentsVfs = new MemoryDriver();
    let captured: HostState = { path: null, site: null };
    const { container } = render(
      <HostHarness
        recents={[]}
        onState={(s) => (captured = s)}
        recentsVfs={recentsVfs}
      />,
    );

    const zone = container.querySelector('[data-testid="drop-zone"]');
    fireEvent.drop(zone!, { dataTransfer: { files: [file] } });

    // Poll for the async importFromZip + setState chain. importFromZip
    // chains a few microtasks (arrayBuffer → JSON.parse → migrate → assets),
    // which is why we wait rather than yielding once.
    for (let attempt = 0; attempt < 50 && captured.path !== "import"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(captured.path).toBe("import");
    expect(captured.site).not.toBeNull();
    expect(captured.site!.org.name).toBe("Stub Org");
    // The host wired recordRecentSite — verify it persisted.
    const recents = await loadRecentSites(recentsVfs);
    expect(recents).toHaveLength(1);
    expect(recents[0]?.key).toBe("stub-site.zip");
    expect(recents[0]?.label).toBe("Stub Org");
  });

  test("clicking a recent-site row signals the host with the row's key", () => {
    const recents: RecentSite[] = [
      { key: "/path/to/site-a.zip", label: "Site A", lastModified: 1 },
    ];

    let openedKey: string | null = null;
    const { container } = render(
      <WelcomeScreen
        recents={recents}
        onOpenRecent={(key) => {
          openedKey = key;
        }}
      />,
    );
    fireEvent.click(container.querySelector('[data-testid="recent-site"]')!);
    expect(openedKey).toBe("/path/to/site-a.zip");
  });
});
