/** @jsxImportSource react */
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { SiteSchema, type Site } from "@sosb/schema";
import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { EditorApp } from "../src/editor-app.js";
import { setViewportWidth } from "./helpers/nav.js";

afterEach(cleanup);

test("edits the saved header button without losing other navigation settings", async () => {
  setViewportWidth(1200);
  const site = structuredClone(minimal) as unknown as Site;
  site.navigation = {
    mobileMenu: true,
    action: { label: "Semnalează o problemă", url: "/semnaleaza/", style: "primary" },
  };
  const onExport = vi.fn();
  const view = render(<EditorApp initial={site} onExport={onExport} />);
  fireEvent.click(view.getByRole("button", { name: "Site settings" }));
  expect((view.getByLabelText(/Button text/) as HTMLInputElement).value).toBe(
    "Semnalează o problemă",
  );
  const link = view.getByLabelText(/Button link/);
  await act(async () => {
    fireEvent.input(link, { target: { value: "https://example.org/report" } });
  });
  fireEvent.click(view.getByTestId("save-project"));
  const saved = onExport.mock.calls.at(-1)![0] as Site;
  expect(SiteSchema.parse(saved).navigation).toEqual({
    mobileMenu: true,
    action: { label: "Semnalează o problemă", url: "https://example.org/report", style: "primary" },
  });
});

test("can add a header button to a project with no navigation settings", async () => {
  setViewportWidth(1200);
  const onExport = vi.fn();
  const view = render(
    <EditorApp initial={structuredClone(minimal) as unknown as Site} onExport={onExport} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Site settings" }));
  await act(async () => {
    fireEvent.input(view.getByLabelText(/Button text/), {
      target: { value: "Contact" },
    });
  });
  await act(async () => {
    fireEvent.input(view.getByLabelText(/Button link/), {
      target: { value: "/contact/" },
    });
  });
  fireEvent.click(view.getByTestId("save-project"));
  expect(onExport.mock.calls.at(-1)![0].navigation.action).toEqual({
    label: "Contact",
    url: "/contact/",
  });
});
