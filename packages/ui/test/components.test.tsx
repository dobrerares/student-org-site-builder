/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Shared-control contract tests.
 *
 * Two things are being pinned here:
 *
 *  1. The DOM contract. The editor, Wizard and welcome shells identify
 *     controls by `data-*` attributes and their hand-written stylesheets
 *     hang off the same attributes. A shared control that swallowed or
 *     renamed a forwarded prop would silently break those surfaces, so
 *     every wrapper is asserted to render the native element and pass
 *     everything through.
 *  2. The behaviour the builder gained by moving to Base UI: focus entry
 *     into a dialog, focus return to the trigger on close, Escape
 *     dismissal, and arrow-key travel across a tab list. Issue #101's
 *     evidence list asks for exactly these.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Button } from "../src/components/button.js";
import { Input, NativeSelect, Textarea } from "../src/components/input.js";
import { Hint, Label } from "../src/components/label.js";
import { Dialog } from "../src/components/dialog.js";
import { Popover } from "../src/components/popover.js";
import { Tabs } from "../src/components/tabs.js";

afterEach(cleanup);

describe("Button", () => {
  test("renders a native button and forwards data attributes", () => {
    const { container } = render(
      <Button data-testid="save" data-action="save" aria-label="Save site">
        Save
      </Button>,
    );
    const button = container.querySelector<HTMLButtonElement>('[data-testid="save"]');
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.getAttribute("data-action")).toBe("save");
    expect(button?.getAttribute("aria-label")).toBe("Save site");
  });

  test("defaults to type=button so it never submits a surrounding form", () => {
    const { container } = render(<Button>Add</Button>);
    expect(container.querySelector("button")?.type).toBe("button");
  });

  test("an explicit type wins", () => {
    const { container } = render(<Button type="submit">Go</Button>);
    expect(container.querySelector("button")?.type).toBe("submit");
  });

  test("caller classes survive the variant classes", () => {
    const { container } = render(<Button className="editor-primary">Go</Button>);
    expect(container.querySelector("button")?.className).toContain("editor-primary");
  });

  test("carries the data-sosb-ui reset marker", () => {
    const { container } = render(<Button>Go</Button>);
    expect(container.querySelector("button")?.hasAttribute("data-sosb-ui")).toBe(true);
  });
});

describe("text controls", () => {
  test("Input renders a native input and forwards value/onInput", () => {
    const seen: string[] = [];
    const { container } = render(
      <Input
        data-testid="org-name"
        value="Acme"
        onInput={(event) => seen.push(event.currentTarget.value)}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('[data-testid="org-name"]')!;
    expect(input.tagName).toBe("INPUT");
    expect(input.value).toBe("Acme");
    fireEvent.input(input, { target: { value: "Acme Society" } });
    expect(seen).toEqual(["Acme Society"]);
  });

  test("file inputs stay native", () => {
    const { container } = render(<Input type="file" accept="image/*" />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe("image/*");
  });

  // Text chrome on a checkbox stretches it across the form and pads it into
  // the wrong place. Only text entry gets the box.
  const TEXT_CHROME = ["w-full", "border", "px-2.5", "bg-card"];

  test.each([["text"], ["search"], ["number"], ["email"], ["url"], ["tel"]])(
    "type=%s gets the text-field chrome",
    (type) => {
      const { container } = render(<Input type={type} />);
      const className = container.querySelector("input")!.className;
      for (const cls of TEXT_CHROME) {
        expect(className.split(" ")).toContain(cls);
      }
    },
  );

  test("an input with no type is treated as text", () => {
    const { container } = render(<Input />);
    expect(container.querySelector("input")!.className.split(" ")).toContain("w-full");
  });

  test.each([["checkbox"], ["radio"], ["color"], ["file"], ["range"]])(
    "type=%s gets none of the text-field chrome",
    (type) => {
      const { container } = render(<Input type={type} />);
      const classes = container.querySelector("input")!.className.split(" ");
      for (const cls of TEXT_CHROME) {
        expect(classes).not.toContain(cls);
      }
      // The shared disabled treatment still applies everywhere.
      expect(classes).toContain("disabled:cursor-not-allowed");
    },
  );

  test.each([["checkbox"], ["radio"]])("type=%s is tinted with the accent colour", (type) => {
    const { container } = render(<Input type={type} />);
    expect(container.querySelector("input")!.className.split(" ")).toContain("accent-primary");
  });

  test("a caller class still lands on a non-text input", () => {
    const { container } = render(<Input type="color" className="color-picker__swatch" />);
    expect(container.querySelector("input")!.className).toContain("color-picker__swatch");
  });

  test("Textarea renders a native textarea", () => {
    const { container } = render(<Textarea rows={4} defaultValue="hello" />);
    const area = container.querySelector("textarea")!;
    expect(area.rows).toBe(4);
    expect(area.value).toBe("hello");
  });

  test("NativeSelect renders a native select driven by change", () => {
    const seen: string[] = [];
    const { container } = render(
      <NativeSelect value="a" onChange={(event) => seen.push(event.currentTarget.value)}>
        <option value="a">A</option>
        <option value="b">B</option>
      </NativeSelect>,
    );
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "b" } });
    expect(seen).toEqual(["b"]);
  });

  test("Label keeps htmlFor wiring and Hint renders a paragraph", () => {
    const { container } = render(
      <>
        <Label htmlFor="field-1">Name</Label>
        <Input id="field-1" />
        <Hint className="field-hint">Keep it short.</Hint>
      </>,
    );
    expect(container.querySelector("label")?.htmlFor).toBe("field-1");
    const hint = container.querySelector("p")!;
    expect(hint.className).toContain("field-hint");
  });
});

function TestDialog(): React.ReactElement {
  return (
    <Dialog.Root>
      <Dialog.Trigger data-testid="open">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Add a page section</Dialog.Title>
          <Dialog.Description>Pick a section.</Dialog.Description>
          <input data-testid="search" />
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

describe("Dialog focus behaviour", () => {
  test("moves focus into the dialog on open and returns it to the trigger on close", async () => {
    render(<TestDialog />);
    const trigger = screen.getByTestId("open");
    trigger.focus();
    fireEvent.click(trigger);

    const popup = await screen.findByTestId("popup");
    expect(popup.getAttribute("role")).toBe("dialog");
    await waitFor(() => {
      expect(popup.contains(document.activeElement)).toBe(true);
    });

    fireEvent.click(screen.getByTestId("close"));
    await waitFor(() => {
      expect(screen.queryByTestId("popup")).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  test("Escape dismisses the dialog", async () => {
    render(<TestDialog />);
    fireEvent.click(screen.getByTestId("open"));
    const popup = await screen.findByTestId("popup");
    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("popup")).toBeNull();
    });
  });

  test("the title and description are wired to the dialog for screen readers", async () => {
    render(<TestDialog />);
    fireEvent.click(screen.getByTestId("open"));
    const popup = await screen.findByTestId("popup");
    expect(popup.getAttribute("aria-labelledby")).not.toBeNull();
    expect(popup.getAttribute("aria-describedby")).not.toBeNull();
  });
});

describe("Popover", () => {
  test("opens from its trigger and closes on Escape", async () => {
    render(
      <Popover.Root>
        <Popover.Trigger data-testid="more">More options</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="menu">
              <button type="button">Duplicate page</button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    const trigger = screen.getByTestId("more");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);

    const menu = await screen.findByTestId("menu");
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("menu")).toBeNull();
    });
  });
});

describe("Tabs", () => {
  test("exposes tab semantics and moves selection with the arrow keys", async () => {
    render(
      <Tabs.Root defaultValue="edit">
        <Tabs.List>
          <Tabs.Tab value="edit" data-testid="tab-edit">
            Edit
          </Tabs.Tab>
          <Tabs.Tab value="preview" data-testid="tab-preview">
            Preview
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="edit">edit panel</Tabs.Panel>
        <Tabs.Panel value="preview">preview panel</Tabs.Panel>
      </Tabs.Root>,
    );

    const edit = screen.getByTestId("tab-edit");
    const preview = screen.getByTestId("tab-preview");
    expect(edit.getAttribute("role")).toBe("tab");
    expect(edit.getAttribute("aria-selected")).toBe("true");

    // Base UI's tab list is a composite: ArrowRight moves roving focus.
    // Selection follows focus here because `activateOnFocus` defaults on.
    edit.focus();
    fireEvent.keyDown(edit, { key: "ArrowRight" });
    await waitFor(() => {
      expect(document.activeElement).toBe(preview);
    });

    fireEvent.click(preview);
    await waitFor(() => {
      expect(preview.getAttribute("aria-selected")).toBe("true");
      expect(edit.getAttribute("aria-selected")).toBe("false");
    });
  });
});
