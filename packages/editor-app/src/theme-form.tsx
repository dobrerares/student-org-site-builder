/**
 * Theme form — the form behind the editor's theme drill-in
 * (ADR 0043). It owns the structural overrides for everything under
 * `site.theme`: the ThemePicker (per ADR 0044) for `theme.id`, and the
 * six theme-token controls (T13/T14/T15) for `theme.tokens.*`.
 *
 * Tokens land in Phase 3 (this batch): two ColorPickers for the
 * primary/accent palette slots, two FontPickers (headline + body), and
 * two NamedValueSelects for density and corner radius. All six widgets
 * follow the tri-state convention: `value === undefined` means "use
 * the active theme's default", and the parent's `onChange(nextSite)`
 * is invoked with an immutably updated `site.theme.tokens`.
 *
 * `theme.tokens` may itself be `undefined` on a fresh site. The
 * `updateToken` helper below normalises that case by seeding with `{}`
 * before applying the new field, so the rest of `site` (and any other
 * tokens already set) is preserved across edits.
 *
 * No raw `<input type="text">` for `theme.id` appears here per
 * ADR 0044 (no technical field escape hatches); the ThemePicker
 * is the only entry point for changing the theme id, and the token
 * pickers (ColorPicker / FontPicker / NamedValueSelect) are the only
 * entry points for token values.
 *
 * The form intentionally has no internal heading or prefatory
 * paragraph: it is mounted exclusively inside EditorApp's
 * drill-in inspector, which renders its own
 * `<header data-testid="inspector-header">` with eyebrow + `<h2>`.
 * Re-stating "Theme" inside this form would compete with the
 * inspector chrome (T7 review).
 */
import type { JSX } from "preact";
import type { Site } from "@sosb/schema";

import { ColorPicker } from "./color-picker.js";
import { FontPicker } from "./font-picker.js";
import { NamedValueSelect } from "./named-value-select.js";
import { ThemePicker } from "./theme-picker.js";

// `ThemeTokens` is not exported from `@sosb/schema` as a standalone
// type alias — the schema package only exposes the `Theme` type. We
// derive the tokens type here via `NonNullable<...>` so this file
// stays in sync automatically with any future schema additions to
// `ThemeTokensSchema` (e.g. a new `spacing` token slot).
type ThemeTokens = NonNullable<Site["theme"]["tokens"]>;

// Per-slot vocabularies for the density/radius pickers. Defined at
// module scope so the option arrays have stable identity across
// renders (NamedValueSelect compares by `value`, not by array
// reference, but stable identity keeps render diffs cheaper).
const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Comfortable" },
] as const;

const RADIUS_OPTIONS = [
  { value: "sharp", label: "Sharp (no rounding)" },
  { value: "soft", label: "Soft (subtle rounding)" },
  { value: "round", label: "Round (pill shape)" },
] as const;

export interface ThemeFormProps {
  readonly site: Site;
  readonly onChange: (next: Site) => void;
}

/**
 * Immutably patch a single token on `site.theme.tokens`, preserving
 * all other tokens and the rest of the site tree. Seeds an empty
 * object when `tokens` is undefined so the very first edit doesn't
 * crash on a fresh site.
 */
function updateToken<K extends keyof ThemeTokens>(
  site: Site,
  key: K,
  value: ThemeTokens[K] | undefined,
): Site {
  const tokens = { ...(site.theme.tokens ?? {}), [key]: value };
  // If the user reset everything to undefined, `tokens` is still an
  // empty-keyed object; that's fine — round-trip is preserved and the
  // schema accepts it (ThemeTokensSchema is `looseObject` with every
  // field optional).
  return {
    ...site,
    theme: { ...site.theme, tokens },
  };
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
      <ThemePicker value={props.site.theme.id} onChange={handleThemeChange} />
      <ColorPicker
        label="Primary color"
        previewOnColor
        value={props.site.theme.tokens?.colorPrimary}
        onChange={(next) => props.onChange(updateToken(props.site, "colorPrimary", next))}
      />
      <ColorPicker
        label="Accent color"
        previewOnColor
        value={props.site.theme.tokens?.colorAccent}
        onChange={(next) => props.onChange(updateToken(props.site, "colorAccent", next))}
      />
      <FontPicker
        kind="headline"
        themeId={props.site.theme.id}
        label="Headline font"
        value={props.site.theme.tokens?.fontHeadline}
        onChange={(next) => props.onChange(updateToken(props.site, "fontHeadline", next))}
      />
      <FontPicker
        kind="body"
        themeId={props.site.theme.id}
        label="Body font"
        value={props.site.theme.tokens?.fontBody}
        onChange={(next) => props.onChange(updateToken(props.site, "fontBody", next))}
      />
      <NamedValueSelect
        label="Density"
        options={DENSITY_OPTIONS}
        nameKey="density"
        value={props.site.theme.tokens?.density}
        onChange={(next) => props.onChange(updateToken(props.site, "density", next))}
      />
      <NamedValueSelect
        label="Corner radius"
        options={RADIUS_OPTIONS}
        nameKey="radius"
        value={props.site.theme.tokens?.radius}
        onChange={(next) => props.onChange(updateToken(props.site, "radius", next))}
      />
    </div>
  );
}
