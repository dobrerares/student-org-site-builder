/** @jsxImportSource react */
// @vitest-environment jsdom
/**
 * Tests for the theme picker — the canonical structural override that
 * replaces what would otherwise be a raw `theme.id` text input
 * (ADR 0043). Per ADR 0044, this component never falls back to a raw
 * text input.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import type { ThemeBundle } from "@sosb/renderer";

import { ThemePicker } from "../src/theme-picker.js";

describe("ThemePicker", () => {
  afterEach(() => cleanup());

  test("renders one option per cataloged theme (5 — stub omitted)", () => {
    const { container } = render(<ThemePicker value="academic" onChange={() => {}} />);
    const options = container.querySelectorAll("[data-theme-option]");
    expect(options.length).toBe(5);
  });

  test("marks the active option", () => {
    const { container } = render(<ThemePicker value="civic" onChange={() => {}} />);
    const active = container.querySelector('[data-theme-option][data-active="true"]');
    expect(active?.getAttribute("data-theme-id")).toBe("civic");
  });

  test("invokes onChange with the new theme id when an option is clicked", () => {
    let received = "";
    const { container } = render(
      <ThemePicker value="academic" onChange={(id) => (received = id)} />,
    );
    const civic = container.querySelector('[data-theme-id="civic"]') as HTMLElement;
    civic.click();
    expect(received).toBe("civic");
  });

  test("renders the humanised current-value note when value is unknown", () => {
    const { container } = render(<ThemePicker value="someFutureTheme" onChange={() => {}} />);
    // Per ADR 0044, never fall back to a raw text input.
    expect(container.querySelector('input[type="text"]')).toBeNull();
    const note = container.querySelector("[data-theme-current-unknown]");
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain("Some future theme");
  });

  test("the active option has aria-checked=true and others have aria-checked=false", () => {
    const { container } = render(<ThemePicker value="civic" onChange={() => {}} />);
    const inputs = container.querySelectorAll('input[type="radio"]');
    expect(inputs.length).toBe(5);
    for (const input of Array.from(inputs)) {
      const expected = (input as HTMLInputElement).value === "civic";
      expect((input as HTMLInputElement).checked).toBe(expected);
    }
  });

  test("renders each theme's description text", () => {
    const { container } = render(<ThemePicker value="academic" onChange={() => {}} />);
    // The "Academic" description from theme-catalog.ts mentions "scholarly"
    const academic = container.querySelector('[data-theme-id="academic"]');
    expect(academic?.textContent?.toLowerCase()).toContain("scholarly");
  });

  test("renders a real miniature of each cataloged theme", () => {
    const { container } = render(<ThemePicker value="academic" onChange={() => {}} />);
    expect(container.querySelectorAll("[data-theme-option-preview]").length).toBe(5);
    const minis = container.querySelectorAll("[data-theme-mini-preview]");
    expect(minis.length).toBe(5);
    // Each miniature is tied to its own theme, and is decorative — everything
    // it shows is also in the option's label and description.
    const ids = Array.from(minis).map((n) => n.getAttribute("data-theme-id"));
    expect(new Set(ids).size).toBe(5);
    for (const mini of Array.from(minis)) {
      expect(mini.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

/**
 * An imported Theme package is not compiled into the renderer, so it can only
 * be previewed if the picker hands its bundle down to the miniature. Get that
 * wrong and every custom Theme silently previews as the unstyled stub layout
 * — which looks like a broken Theme rather than a broken picker, so it is
 * worth pinning.
 */
describe("ThemePicker with imported Theme packages", () => {
  afterEach(() => cleanup());

  const bundle = {
    id: "org.example.practice",
    name: "Practice",
    version: "1.0.0",
    description: "A packaged Theme.",
    origin: "package",
    css: "body{color:red}",
    baselineTokens: [],
    supports: { colors: true, fonts: true, density: true, radius: true },
    blockVariants: {},
    shellVariants: [],
    fontSource: { kind: "registry" },
    assets: new Map(),
  } as unknown as ThemeBundle;

  test("lists imported Themes after the built-ins", () => {
    const { container } = render(
      <ThemePicker value="academic" onChange={() => {}} customThemes={[bundle]} />,
    );
    const options = container.querySelectorAll("[data-theme-option]");
    expect(options.length).toBe(6);
    expect(options[5]?.getAttribute("data-theme-id")).toBe("org.example.practice");
  });

  test("an imported Theme is a known value, not an unrecognised one", () => {
    const { container } = render(
      <ThemePicker value="org.example.practice" onChange={() => {}} customThemes={[bundle]} />,
    );
    expect(container.querySelector("[data-theme-current-unknown]")).toBeNull();
    const active = container.querySelector('[data-theme-option][data-active="true"]');
    expect(active?.getAttribute("data-theme-id")).toBe("org.example.practice");
  });

  test("renders a miniature for the imported Theme too", () => {
    const { container } = render(
      <ThemePicker value="academic" onChange={() => {}} customThemes={[bundle]} />,
    );
    const custom = container.querySelector(
      '[data-theme-option][data-theme-id="org.example.practice"] [data-theme-mini-preview]',
    );
    expect(custom).not.toBeNull();
    expect(custom?.getAttribute("data-theme-id")).toBe("org.example.practice");
  });
});
