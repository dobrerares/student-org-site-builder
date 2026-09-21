/** @jsxImportSource react */
/**
 * Theme picker — the canonical structural form override that replaces
 * what would otherwise be a raw `<input>` for `theme.id` (ADR 0043).
 *
 * Renders a radio-list of user-facing themes drawn from
 * `buildThemeCatalog()`. The stub theme is intentionally omitted by the
 * catalog (it is a renderer-test fixture). Each option carries the
 * humanised label and a one-line description so the user has enough
 * context to choose.
 *
 * Per ADR 0044 (no technical field escape hatches) this component must
 * never fall back to a raw `<input type="text">` — even if the current
 * value is not in the catalog. In that case we render a status note
 * showing the humanised current value (so the user understands why
 * none of the cataloged options is selected) and the 5 catalog entries
 * with none marked active; the unknown value is preserved by the parent
 * form and the user can pick any cataloged theme to move forward.
 *
 * Each option shows a real miniature render of the theme (see
 * `@sosb/themes`'s `ThemeMiniPreview`) rather than the hand-written hex
 * swatches it used to carry. Those swatches were a second, manual copy of
 * what the theme CSS already says, so they could drift without any test
 * noticing — and a colour chip answers a narrower question than the one the
 * user is actually asking, which is "what will my site look like".
 *
 * Markup choice: native `<input type="radio">` wrapped in a `<label>`,
 * matching the prior art in `packages/wizard/src/steps/identity.tsx`.
 * Native radios with a shared `name` form a radiogroup and get arrow-key
 * cycling, focus management, and `:checked` semantics for free — none
 * of which `<button role="radio">` provides. The outer
 * `<div role="radiogroup">` is kept for layout + a labelled wrapper
 * (the `aria-label="Theme"` gives assistive tech a group label).
 */
import type { JSX } from "react";
import type { ThemeCatalogEntry } from "@sosb/themes";
import type { ThemeBundle } from "@sosb/renderer";

import { ThemeMiniPreview } from "@sosb/themes";

import { buildThemeCatalog } from "./theme-catalog.js";
import { Input } from "@sosb/ui";

export interface ThemePickerProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
  /**
   * Imported Theme packages, listed after the built-ins (ADR 0051).
   *
   * They share the built-ins' radio group rather than getting a list of their
   * own: "which look does my site use?" is one question with one answer, and a
   * split would make an author pick a category before picking a design.
   */
  readonly customThemes?: readonly ThemeBundle[];
}

/**
 * Present an imported Theme in the catalog's shape so both kinds render
 * through one code path.
 *
 * The label and description come from the package manifest, which is the
 * Theme author's own words about their Theme — the equivalent of the
 * built-ins' catalog entry. Everything *visual* comes from the miniature
 * render instead, for the reason in this file's header: a picture the
 * renderer produces cannot drift from the Theme, and a hand-written swatch
 * can.
 */
function entryForBundle(bundle: ThemeBundle): ThemeCatalogEntry {
  return {
    id: bundle.id,
    label: bundle.name,
    description: bundle.description ?? "",
    fonts: { headline: [], body: [] },
  };
}

// Stable per-page radio-group name. Only one ThemePicker mounts on a
// page (T6), so a hardcoded name is sufficient and avoids the noise of
// `useId()`.
const RADIO_GROUP_NAME = "theme-picker";

export function ThemePicker(props: ThemePickerProps): JSX.Element {
  const catalog = buildThemeCatalog();
  const customThemes = props.customThemes ?? [];
  const entries = [...catalog.entries, ...customThemes.map(entryForBundle)];
  // An imported Theme is not compiled into the renderer, so its miniature has
  // to be handed the bundle to render from. Built-ins resolve by id.
  const bundleFor = (id: string): ThemeBundle | undefined =>
    customThemes.find((bundle) => bundle.id === id);
  const isKnown = entries.some((e) => e.id === props.value);

  return (
    <div data-theme-picker-root>
      {!isKnown && (
        <p data-theme-current-unknown role="status">
          This site uses a look that is not in the list ({catalog.entryFor(props.value).label}).
          Choose one below to switch.
        </p>
      )}
      <div data-testid="theme-picker" role="radiogroup" aria-label="Theme">
        {entries.map((entry) => {
          const isActive = entry.id === props.value;
          return (
            <label
              key={entry.id}
              data-theme-option
              data-theme-id={entry.id}
              data-active={isActive ? "true" : "false"}
            >
              <Input
                type="radio"
                name={RADIO_GROUP_NAME}
                value={entry.id}
                checked={isActive}
                onChange={() => props.onChange(entry.id)}
              />
              <span data-theme-option-body>
                <span data-theme-option-preview>
                  <ThemeMiniPreview themeId={entry.id} bundle={bundleFor(entry.id)} />
                </span>
                <span data-theme-option-label>{entry.label}</span>
                <span data-theme-option-description>{entry.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
