/** @jsxImportSource react */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { AssetRefLike, RichTextDocument, Site } from "@sosb/schema";
import minimalSite from "./fixtures/minimal-site.json" with { type: "json" };
import { RichTextField, type RichTextFieldContext } from "../src/rich-text/rich-text-field.js";
import { expectNoAxeViolations } from "./helpers/axe.js";

afterEach(cleanup);

const site = minimalSite as unknown as Site;

function contextWith(overrides: Partial<RichTextFieldContext> = {}): RichTextFieldContext {
  return {
    site,
    lang: site.defaultLanguage,
    onApplySite: vi.fn(),
    uploader: vi.fn<(file: File, alt?: string) => Promise<AssetRefLike>>(() =>
      Promise.reject(new Error("uploader not expected to fire in this test")),
    ),
    displayUrlFor: () => undefined,
    onCommitVisit: vi.fn(),
    ...overrides,
  };
}

function doc(...content: unknown[]): RichTextDocument {
  return { version: 1, content } as unknown as RichTextDocument;
}

function para(text: string): unknown {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

async function renderField(
  value: RichTextDocument,
  context: RichTextFieldContext = contextWith(),
  onChange: (next: RichTextDocument) => void = vi.fn(),
) {
  const view = render(<RichTextField value={value} onChange={onChange} context={context} />);
  // Tiptap 3 defers its first render by a frame (`immediatelyRender: false`),
  // so the surface is not in the DOM synchronously.
  await waitFor(() =>
    expect(view.container.querySelector('[data-testid="rich-text-surface"]')).not.toBeNull(),
  );
  return view;
}

describe("RichTextField — editing surface", () => {
  test("mounts a labelled multi-line textbox", async () => {
    const { container } = await renderField(doc(para("Salut.")));
    const surface = container.querySelector('[data-testid="rich-text-surface"]')!;
    expect(surface.getAttribute("role")).toBe("textbox");
    expect(surface.getAttribute("aria-multiline")).toBe("true");
    expect(surface.getAttribute("aria-label")).toBeTruthy();
    expect(surface.textContent).toContain("Salut.");
  });

  test("carries the marker the global undo handler looks for", async () => {
    // Without this attribute the editor shell's Ctrl+Z would undo a whole
    // editing visit when the author meant to undo a word (issue #100).
    const { container } = await renderField(doc(para("x")));
    expect(container.querySelector("[data-rich-text-surface]")).not.toBeNull();
  });

  test("renders the stored document's structure, not its JSON", async () => {
    const { container } = await renderField(
      doc(
        { type: "heading", level: 3, content: [{ type: "text", text: "Titlu" }] },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [para("unu")] }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "gros", marks: [{ type: "bold" }] }],
        },
      ),
    );
    const surface = container.querySelector('[data-testid="rich-text-surface"]')!;
    expect(surface.querySelector("h3")?.textContent).toBe("Titlu");
    expect(surface.querySelector("ul li")?.textContent).toContain("unu");
    expect(surface.querySelector("strong")?.textContent).toBe("gros");
  });

  test("an internal link is visibly a link but carries no resolved href", async () => {
    // The Renderer resolves a target to a URL; duplicating that here would
    // give the resolver a second home to drift from.
    const { container } = await renderField(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "vezi",
            marks: [{ type: "link", target: { kind: "page", pageId: "page_1" } }],
          },
        ],
      }),
    );
    const anchor = container.querySelector('[data-testid="rich-text-surface"] a')!;
    expect(anchor.getAttribute("data-link-kind")).toBe("page");
    expect(anchor.getAttribute("href")).toBe("#");
  });
});

describe("RichTextField — toolbar", () => {
  test("exposes one tab stop with arrow-key roving focus", async () => {
    const { container } = await renderField(doc(para("x")));
    const toolbar = container.querySelector('[role="toolbar"]')!;
    const buttons = Array.from(toolbar.querySelectorAll("button"));
    // Exactly one button is reachable by Tab; the rest by arrow keys. A
    // fourteen-stop toolbar between the author and their text is not
    // keyboard access, it is an obstacle.
    expect(buttons.filter((b) => b.getAttribute("tabindex") === "0")).toHaveLength(1);

    const first = buttons[0]!;
    first.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowRight" });
    expect(document.activeElement).not.toBe(first);
  });

  test("every control has an accessible name", async () => {
    const { container } = await renderField(doc(para("x")));
    for (const button of container.querySelectorAll('[role="toolbar"] button')) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
  });

  test("formatting buttons report their pressed state", async () => {
    const { container } = await renderField(doc(para("x")));
    const bold = container.querySelector('[data-testid="rich-text-bold"]')!;
    expect(bold.getAttribute("aria-pressed")).toBe("false");
  });

  test("remove-link is offered only inside a link", async () => {
    const plain = await renderField(doc(para("x")));
    expect(
      plain.container.querySelector('[data-testid="rich-text-unlink"]')?.hasAttribute("disabled"),
    ).toBe(true);
  });

  test("undo is unavailable until something has been typed", async () => {
    const { container } = await renderField(doc(para("x")));
    expect(
      container.querySelector('[data-testid="rich-text-undo"]')?.hasAttribute("disabled"),
    ).toBe(true);
  });

  test("the toolbar has no axe violations", async () => {
    const { container } = await renderField(doc(para("x")));
    await expectNoAxeViolations(container);
  });
});

describe("RichTextField — unsupported content", () => {
  const unreadable = doc({ type: "futureCallout", content: [para("Atenție.")] });

  test("does not mount the editor at all", async () => {
    const { container } = render(
      <RichTextField value={unreadable} onChange={vi.fn()} context={contextWith()} />,
    );
    expect(container.querySelector('[data-testid="rich-text-surface"]')).toBeNull();
    expect(container.querySelector('[data-testid="rich-text-unsupported"]')).not.toBeNull();
  });

  test("names what it could not read, and explains rather than blames", async () => {
    const { container } = render(
      <RichTextField value={unreadable} onChange={vi.fn()} context={contextWith()} />,
    );
    expect(
      container.querySelector('[data-testid="rich-text-unsupported-types"]')?.textContent,
    ).toBe("futureCallout");
  });

  test("never calls onChange, so the document cannot be simplified by opening it", async () => {
    // ADR 0048's hardest rule: preserved content stays preserved. A single
    // stray onChange here would silently rewrite the Block to whatever this
    // version *can* express.
    const onChange = vi.fn();
    render(<RichTextField value={unreadable} onChange={onChange} context={contextWith()} />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("the notice has no axe violations", async () => {
    const { container } = render(
      <RichTextField value={unreadable} onChange={vi.fn()} context={contextWith()} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("RichTextField — editing visits", () => {
  test("blurring out of the field without editing commits nothing", async () => {
    const onCommitVisit = vi.fn();
    const { container } = await renderField(doc(para("x")), contextWith({ onCommitVisit }));
    fireEvent.blur(container.querySelector('[data-testid="rich-text-field"]')!, {
      relatedTarget: document.body,
    });
    expect(onCommitVisit).not.toHaveBeenCalled();
  });

  test("unmounting without editing commits nothing either", async () => {
    const onCommitVisit = vi.fn();
    const view = await renderField(doc(para("x")), contextWith({ onCommitVisit }));
    view.unmount();
    expect(onCommitVisit).not.toHaveBeenCalled();
  });
});
