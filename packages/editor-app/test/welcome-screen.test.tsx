// @vitest-environment jsdom
import { describe, expect, test, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";

import { WelcomeScreen } from "../src/welcome-screen.js";
import type { RecentSite } from "../src/recent-sites.js";

/**
 * AC for issue #32:
 *   - Welcome screen renders all four paths with appropriate affordances.
 *   - Wizard path opens the wizard (#33 implements wizard itself).
 *   - Template path creates a new site from the curated demo (#34 provides
 *     demo content) — here, fires the `onTemplate` callback.
 *   - Import drag-drop accepts zip and opens editor with imported site —
 *     here, the drop fires `onImportFile` with the dropped File.
 *   - Blank path creates a new site with a single page containing one hero
 *     block — here, fires the `onBlank` callback (the factory is unit-tested
 *     separately under `blank-site.test.ts`).
 *   - Recent sites list populated and clickable.
 *
 * The screen is intentionally a pure UI — it surfaces affordances and fires
 * callbacks. The host wires those callbacks to the actual flows.
 */

afterEach(() => {
  cleanup();
});

describe("WelcomeScreen — four paths", () => {
  test("renders four path affordances: wizard, template, import, blank", () => {
    const { container } = render(<WelcomeScreen recents={[]} />);
    const paths = container.querySelectorAll("[data-welcome-path]");
    const ids = Array.from(paths).map((el) => el.getAttribute("data-welcome-path"));
    expect(new Set(ids)).toEqual(new Set(["wizard", "template", "import", "blank"]));
    // All four are clickable buttons.
    for (const el of Array.from(paths)) {
      expect(el.tagName).toBe("BUTTON");
    }
  });

  test("clicking the wizard path fires onWizard", () => {
    const onWizard = vi.fn();
    const { container } = render(
      <WelcomeScreen recents={[]} onWizard={onWizard} />,
    );
    const button = container.querySelector('[data-welcome-path="wizard"]');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onWizard).toHaveBeenCalledTimes(1);
  });

  test("clicking the template path fires onTemplate", () => {
    const onTemplate = vi.fn();
    const { container } = render(
      <WelcomeScreen recents={[]} onTemplate={onTemplate} />,
    );
    const button = container.querySelector('[data-welcome-path="template"]');
    fireEvent.click(button!);
    expect(onTemplate).toHaveBeenCalledTimes(1);
  });

  test("clicking the import path fires onImport (file-picker delegate)", () => {
    const onImport = vi.fn();
    const { container } = render(
      <WelcomeScreen recents={[]} onImport={onImport} />,
    );
    const button = container.querySelector('[data-welcome-path="import"]');
    fireEvent.click(button!);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  test("clicking the blank path fires onBlank", () => {
    const onBlank = vi.fn();
    const { container } = render(
      <WelcomeScreen recents={[]} onBlank={onBlank} />,
    );
    const button = container.querySelector('[data-welcome-path="blank"]');
    fireEvent.click(button!);
    expect(onBlank).toHaveBeenCalledTimes(1);
  });

  test("path buttons that have no callback wired do not throw on click", () => {
    const { container } = render(<WelcomeScreen recents={[]} />);
    for (const id of ["wizard", "template", "import", "blank"]) {
      const button = container.querySelector(`[data-welcome-path="${id}"]`);
      expect(() => fireEvent.click(button!)).not.toThrow();
    }
  });
});

describe("WelcomeScreen — recent sites list", () => {
  test("renders nothing recent-related when the recents list is empty", () => {
    const { container } = render(<WelcomeScreen recents={[]} />);
    const list = container.querySelector('[data-testid="recent-sites-list"]');
    // When empty, the list is not rendered (the empty-state hint is, instead).
    expect(list).toBeNull();
    expect(
      container.querySelector('[data-testid="recent-sites-empty"]'),
    ).not.toBeNull();
  });

  test("renders one row per recent site, in the order given", () => {
    const recents: RecentSite[] = [
      { key: "a", label: "Site Alpha", lastModified: 1700000000000 },
      { key: "b", label: "Site Beta", lastModified: 1700000010000 },
    ];
    const { container } = render(<WelcomeScreen recents={recents} />);
    const items = container.querySelectorAll('[data-testid="recent-site"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("Site Alpha");
    expect(items[1]?.textContent).toContain("Site Beta");
  });

  test("clicking a recent-site row fires onOpenRecent with the row's key", () => {
    const onOpenRecent = vi.fn();
    const recents: RecentSite[] = [
      { key: "alpha-key", label: "Alpha", lastModified: 1 },
    ];
    const { container } = render(
      <WelcomeScreen recents={recents} onOpenRecent={onOpenRecent} />,
    );
    const item = container.querySelector('[data-testid="recent-site"]');
    fireEvent.click(item!);
    expect(onOpenRecent).toHaveBeenCalledTimes(1);
    expect(onOpenRecent).toHaveBeenCalledWith("alpha-key");
  });

  test("right-clicking a recent-site row fires onRevealRecent (Electron flow)", () => {
    const onRevealRecent = vi.fn();
    const recents: RecentSite[] = [
      { key: "alpha-key", label: "Alpha", lastModified: 1 },
    ];
    const { container } = render(
      <WelcomeScreen recents={recents} onRevealRecent={onRevealRecent} />,
    );
    const item = container.querySelector('[data-testid="recent-site"]');
    fireEvent.contextMenu(item!);
    expect(onRevealRecent).toHaveBeenCalledTimes(1);
    expect(onRevealRecent).toHaveBeenCalledWith("alpha-key");
  });

  test("right-clicking when no onRevealRecent is wired does not throw", () => {
    const recents: RecentSite[] = [
      { key: "alpha-key", label: "Alpha", lastModified: 1 },
    ];
    const { container } = render(<WelcomeScreen recents={recents} />);
    const item = container.querySelector('[data-testid="recent-site"]');
    expect(() => fireEvent.contextMenu(item!)).not.toThrow();
  });
});

describe("WelcomeScreen — drag-drop zip import", () => {
  function fakeZipFile(name = "site.zip"): File {
    return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], name, {
      type: "application/zip",
    });
  }

  test("the screen exposes a labelled drop-zone region", () => {
    const { container } = render(<WelcomeScreen recents={[]} />);
    const zone = container.querySelector('[data-testid="drop-zone"]');
    expect(zone).not.toBeNull();
  });

  test("dropping a zip file fires onImportFile with the dropped File", () => {
    const onImportFile = vi.fn();
    const { container } = render(
      <WelcomeScreen recents={[]} onImportFile={onImportFile} />,
    );
    const zone = container.querySelector('[data-testid="drop-zone"]');
    const file = fakeZipFile();

    fireEvent.drop(zone!, { dataTransfer: { files: [file] } });

    expect(onImportFile).toHaveBeenCalledTimes(1);
    expect(onImportFile).toHaveBeenCalledWith(file);
  });

  test("dragover on the drop zone toggles a drag-active state", () => {
    const { container } = render(<WelcomeScreen recents={[]} />);
    const zone = container.querySelector('[data-testid="drop-zone"]');
    expect(zone?.getAttribute("data-drag-active")).toBe("false");

    fireEvent.dragOver(zone!, { dataTransfer: { files: [] } });
    expect(
      container
        .querySelector('[data-testid="drop-zone"]')
        ?.getAttribute("data-drag-active"),
    ).toBe("true");

    fireEvent.dragLeave(zone!, { dataTransfer: { files: [] } });
    expect(
      container
        .querySelector('[data-testid="drop-zone"]')
        ?.getAttribute("data-drag-active"),
    ).toBe("false");
  });

  test("dropping no files (e.g. text drag) does NOT fire onImportFile", () => {
    const onImportFile = vi.fn();
    const { container } = render(
      <WelcomeScreen recents={[]} onImportFile={onImportFile} />,
    );
    const zone = container.querySelector('[data-testid="drop-zone"]');
    fireEvent.drop(zone!, { dataTransfer: { files: [] } });
    expect(onImportFile).not.toHaveBeenCalled();
  });
});
