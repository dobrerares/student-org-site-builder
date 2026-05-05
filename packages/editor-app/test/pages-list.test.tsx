// @vitest-environment jsdom
import { describe, expect, test, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/preact";
import type { Site } from "@sosb/schema";
import { PagesList } from "../src/pages-list.js";

function makeSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Stub Org" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro"],
    pages: [
      {
        slug: "acasa",
        lang: "ro",
        navLabel: "Acasă",
        navOrder: 0,
        showInNav: true,
        blocks: [{ id: "blk_home", type: "hero", version: 1, data: { title: "Acasă" } }],
      },
      {
        slug: "despre",
        lang: "ro",
        navLabel: "Despre",
        navOrder: 1,
        showInNav: true,
        blocks: [{ id: "blk_about", type: "hero", version: 1, data: { title: "Despre" } }],
      },
    ],
  } as unknown as Site;
}

describe("PagesList component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders one entry per page with navLabel and slug visible", () => {
    const handlers = {
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onClone: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
    };
    const { container } = render(<PagesList site={makeSite()} activeIndex={0} {...handlers} />);
    const items = container.querySelectorAll('[data-testid="pages-list-item"]');
    expect(items).toHaveLength(2);
    expect(container.textContent).toContain("Acasă");
    expect(container.textContent).toContain("/acasa");
    expect(container.textContent).toContain("Despre");
    expect(container.textContent).toContain("/despre");
  });

  test("highlights the active page", () => {
    const handlers = {
      onSelect: vi.fn(),
      onAdd: vi.fn(),
      onClone: vi.fn(),
      onDelete: vi.fn(),
      onMove: vi.fn(),
    };
    const { container } = render(<PagesList site={makeSite()} activeIndex={1} {...handlers} />);
    const items = container.querySelectorAll<HTMLElement>('[data-testid="pages-list-item"]');
    expect(items[0]!.dataset.active).toBe("false");
    expect(items[1]!.dataset.active).toBe("true");
  });

  test("clicking a page button calls onSelect with its index", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={onSelect}
        onAdd={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const second = container.querySelector<HTMLButtonElement>(
      '[data-action="select"][data-index="1"]',
    );
    fireEvent.click(second!);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  test("submitting the add form with a valid slug calls onAdd", () => {
    const onAdd = vi.fn();
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={onAdd}
        onClone={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('[data-testid="pages-list-add-slug"]');
    fireEvent.input(input!, { target: { value: "proiecte" } });
    const submit = container.querySelector<HTMLButtonElement>('[data-action="add"]');
    fireEvent.click(submit!);
    expect(onAdd).toHaveBeenCalledWith("proiecte");
  });

  test("submitting an invalid slug shows an inline error and does not call onAdd", () => {
    const onAdd = vi.fn();
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={onAdd}
        onClone={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('[data-testid="pages-list-add-slug"]');
    fireEvent.input(input!, { target: { value: "Bad Slug!" } });
    const submit = container.querySelector<HTMLButtonElement>('[data-action="add"]');
    fireEvent.click(submit!);
    expect(onAdd).not.toHaveBeenCalled();
    const error = container.querySelector('[data-testid="pages-list-add-error"]');
    expect(error).not.toBeNull();
  });

  test("submitting a duplicate slug for the default language shows an error", () => {
    const onAdd = vi.fn();
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={onAdd}
        onClone={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('[data-testid="pages-list-add-slug"]');
    fireEvent.input(input!, { target: { value: "acasa" } });
    const submit = container.querySelector<HTMLButtonElement>('[data-action="add"]');
    fireEvent.click(submit!);
    expect(onAdd).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="pages-list-add-error"]')).not.toBeNull();
  });

  test("clone button calls onClone with the source index and a unique slug", () => {
    const onClone = vi.fn();
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClone={onClone}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const cloneBtn = container.querySelector<HTMLButtonElement>(
      '[data-action="clone"][data-index="1"]',
    );
    fireEvent.click(cloneBtn!);
    expect(onClone).toHaveBeenCalledWith(1, expect.any(String));
    const [, generatedSlug] = onClone.mock.calls[0]!;
    expect(generatedSlug).toMatch(/^despre-copy/);
  });

  test("delete is two-step (confirmation) and disabled when only one page", () => {
    const onDelete = vi.fn();
    const { container, rerender } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClone={vi.fn()}
        onDelete={onDelete}
        onMove={vi.fn()}
      />,
    );
    const deleteBtn = container.querySelector<HTMLButtonElement>(
      '[data-action="delete"][data-index="1"]',
    );
    fireEvent.click(deleteBtn!);
    expect(onDelete).not.toHaveBeenCalled();
    expect(deleteBtn!.dataset.confirming).toBe("true");
    fireEvent.click(deleteBtn!);
    expect(onDelete).toHaveBeenCalledWith(1);

    const singlePage = {
      ...makeSite(),
      pages: [makeSite().pages[0]!],
    };
    rerender(
      <PagesList
        site={singlePage}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClone={vi.fn()}
        onDelete={onDelete}
        onMove={vi.fn()}
      />,
    );
    const onlyDelete = container.querySelector<HTMLButtonElement>(
      '[data-action="delete"][data-index="0"]',
    );
    expect(onlyDelete!.disabled).toBe(true);
  });

  test("move buttons fire onMove with the correct direction", () => {
    const onMove = vi.fn();
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
        onMove={onMove}
      />,
    );
    const upOnSecond = container.querySelector<HTMLButtonElement>(
      '[data-action="move-up"][data-index="1"]',
    );
    fireEvent.click(upOnSecond!);
    expect(onMove).toHaveBeenCalledWith(1, "up");

    const downOnFirst = container.querySelector<HTMLButtonElement>(
      '[data-action="move-down"][data-index="0"]',
    );
    fireEvent.click(downOnFirst!);
    expect(onMove).toHaveBeenCalledWith(0, "down");
  });

  test("move-up disabled at top, move-down disabled at bottom", () => {
    const { container } = render(
      <PagesList
        site={makeSite()}
        activeIndex={0}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClone={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    const upFirst = container.querySelector<HTMLButtonElement>(
      '[data-action="move-up"][data-index="0"]',
    );
    expect(upFirst!.disabled).toBe(true);
    const downLast = container.querySelector<HTMLButtonElement>(
      '[data-action="move-down"][data-index="1"]',
    );
    expect(downLast!.disabled).toBe(true);
  });
});
