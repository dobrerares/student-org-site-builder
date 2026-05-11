/**
 * Theme form — the form behind the editor's theme drill-in
 * (ADR 0043). It owns the structural override for `theme.id`
 * (the ThemePicker, per ADR 0044) and, in Phase 3 (T13-T15),
 * will host the theme-token controls (colours, fonts, density,
 * radius) as well.
 *
 * Phase 1 (this task) is intentionally minimal: the form mounts
 * only the ThemePicker. Tokens are deferred so Phase 1 ships as a
 * small, complete tracer through the drill-in plumbing. When a
 * user picks a new theme, the form computes the next-site
 * immutably — preserving `theme.tokens` and every other site
 * field — and fires `onChange(nextSite)` so the parent (EditorApp)
 * can advance its snapshot.
 *
 * No raw `<input type="text">` for `theme.id` appears here per
 * ADR 0044 (no technical field escape hatches); the ThemePicker
 * is the only entry point for changing the theme id.
 */
import type { JSX } from "preact";
import type { Site } from "@sosb/schema";

import { ThemePicker } from "./theme-picker.js";

export interface ThemeFormProps {
  readonly site: Site;
  readonly onChange: (next: Site) => void;
}

export function ThemeForm(props: ThemeFormProps): JSX.Element {
  const handleThemeChange = (newId: string): void => {
    props.onChange({
      ...props.site,
      theme: { ...props.site.theme, id: newId },
    });
  };

  return (
    <div data-testid="theme-form">
      <h2>Theme</h2>
      <p>Choose a visual treatment for the site.</p>
      <ThemePicker value={props.site.theme.id} onChange={handleThemeChange} />
    </div>
  );
}
