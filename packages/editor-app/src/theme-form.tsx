/** @jsxImportSource react */
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
 * inspector chrome (T7 review). The three groups below (look, colours,
 * type & spacing) are sub-headings, not a title.
 */
import type { JSX } from "react";
import type { Site } from "@sosb/schema";
import type { ThemeBundle } from "@sosb/renderer";
import { themeReferenceIssue } from "@sosb/renderer";
import { Button, Hint } from "@sosb/ui";

import { ColorPicker } from "./color-picker.js";
import { FontPicker } from "./font-picker.js";
import { NamedValueSelect } from "./named-value-select.js";
import { ThemePicker } from "./theme-picker.js";
import { ThemePackagesPanel } from "./theme-packages-panel.js";
import { applyThemeSwitch, setShellVariant } from "./theme-switch.js";

/**
 * The look controls a Theme does not honour are hidden rather than disabled.
 *
 * ADR 0046 lets a Theme declare which appearance controls it supports. Showing
 * an author a colour picker whose value the Theme's CSS overrides is worse
 * than showing nothing: they change it, nothing happens, and they conclude the
 * editor is broken. A short note explains the absence so it does not read as a
 * missing feature either.
 */
function UnsupportedNote(props: { what: string; themeName: string }): JSX.Element {
  return (
    <Hint className="field-hint" data-theme-unsupported={props.what}>
      This look sets its own {props.what}, so there is nothing to change here. Pick a different look
      to adjust {props.what}.
    </Hint>
  );
}

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
  { value: "compact", label: "Compact — tighter spacing" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Comfortable — more breathing room" },
] as const;

const RADIUS_OPTIONS = [
  { value: "sharp", label: "Sharp (no rounding)" },
  { value: "soft", label: "Soft (subtle rounding)" },
  { value: "round", label: "Round (pill shape)" },
] as const;

export interface ThemeFormProps {
  readonly site: Site;
  readonly onChange: (next: Site) => void;
  /**
   * The resolved active Theme. `undefined` means the Site names a Theme
   * package that is not installed — the form then leads with a repair action
   * instead of pretending the design is fine (ADR 0051).
   */
  readonly activeTheme?: ThemeBundle | undefined;
  /** Imported Theme packages available to this Site. */
  readonly installedThemes?: readonly ThemeBundle[];
  readonly onImportTheme?: (file: File) => Promise<void>;
  readonly onExportTheme?: (themeId: string) => Promise<void>;
  readonly onRemoveTheme?: (themeId: string) => Promise<void>;
}

/** The built-in look we offer as the one-click repair for a missing Theme. */
const REPAIR_THEME_ID = "modern";

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
  const installed = props.installedThemes ?? [];
  const supports = props.activeTheme?.supports ?? {
    colors: true,
    fonts: true,
    density: true,
    radius: true,
  };
  const themeName = props.activeTheme?.name ?? props.site.theme.id;
  const shellVariants = props.activeTheme?.shellVariants ?? [];
  const missing = themeReferenceIssue(
    props.site,
    installed.map((bundle) => bundle.id),
  );

  const handleThemeChange = (newId: string): void => {
    // Route every switch through `applyThemeSwitch` so the per-Theme variant
    // memory is maintained in one place (ADR 0051). Setting `theme.id`
    // directly here would silently drop the author's design choices.
    const target = installed.find((bundle) => bundle.id === newId);
    props.onChange(applyThemeSwitch(props.site, newId, target));
  };

  return (
    <div data-testid="theme-form">
      {missing !== undefined && (
        <section data-theme-missing role="alert" data-testid="theme-missing">
          <p>
            This Site was designed with the Theme package <code>{missing.themeId}</code>, which is
            not installed here. Your pages, text and images are unchanged — only the design is
            missing. Import the package below, or switch to a built-in look.
          </p>
          <Button
            type="button"
            variant="secondary"
            data-testid="theme-missing-repair"
            onClick={() => handleThemeChange(REPAIR_THEME_ID)}
          >
            Switch to a built-in look
          </Button>
        </section>
      )}

      <section data-theme-group="look" aria-labelledby="theme-group-look">
        <h3 id="theme-group-look">Look</h3>
        <p data-group-hint>
          Every look works with any content. Switch freely — your text and images stay.
        </p>
        <ThemePicker
          value={props.site.theme.id}
          onChange={handleThemeChange}
          customThemes={installed}
        />
        {shellVariants.length > 0 && (
          <NamedValueSelect
            label="Header style"
            hint="How this look arranges the header, navigation and footer."
            options={shellVariants.map((variant) => ({
              value: variant.id,
              label:
                variant.description === undefined
                  ? variant.label
                  : `${variant.label} — ${variant.description}`,
            }))}
            nameKey="shellVariant"
            value={props.site.theme.shellVariant}
            onChange={(next) => props.onChange(setShellVariant(props.site, next))}
          />
        )}
      </section>

      {props.onImportTheme !== undefined &&
        props.onExportTheme !== undefined &&
        props.onRemoveTheme !== undefined && (
          <ThemePackagesPanel
            site={props.site}
            installed={installed}
            onImport={props.onImportTheme}
            onExport={props.onExportTheme}
            onRemove={props.onRemoveTheme}
          />
        )}

      <section data-theme-group="colors" aria-labelledby="theme-group-colors">
        <h3 id="theme-group-colors">Colours</h3>
        {!supports.colors ? (
          <UnsupportedNote what="colours" themeName={themeName} />
        ) : (
          <>
            <p data-group-hint>
              Leave these on the theme default unless your organisation has brand colours. The “Aa”
              chip shows the text colour the site will use on top of your pick.
            </p>
            <ColorPicker
              label="Primary colour"
              hint="Headings, buttons, links."
              previewOnColor
              value={props.site.theme.tokens?.colorPrimary}
              onChange={(next) => props.onChange(updateToken(props.site, "colorPrimary", next))}
            />
            <ColorPicker
              label="Accent colour"
              hint="Highlights and small details."
              previewOnColor
              value={props.site.theme.tokens?.colorAccent}
              onChange={(next) => props.onChange(updateToken(props.site, "colorAccent", next))}
            />
          </>
        )}
      </section>

      <section data-theme-group="type" aria-labelledby="theme-group-type">
        <h3 id="theme-group-type">Fonts and spacing</h3>
        {supports.fonts ? (
          <>
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
          </>
        ) : (
          <UnsupportedNote what="fonts" themeName={themeName} />
        )}
        {supports.density ? (
          <NamedValueSelect
            label="Spacing"
            hint="How much room sections and cards get."
            options={DENSITY_OPTIONS}
            nameKey="density"
            value={props.site.theme.tokens?.density}
            onChange={(next) => props.onChange(updateToken(props.site, "density", next))}
          />
        ) : (
          <UnsupportedNote what="spacing" themeName={themeName} />
        )}
        {supports.radius ? (
          <NamedValueSelect
            label="Corners"
            hint="How rounded cards, buttons and images are."
            options={RADIUS_OPTIONS}
            nameKey="radius"
            value={props.site.theme.tokens?.radius}
            onChange={(next) => props.onChange(updateToken(props.site, "radius", next))}
          />
        ) : (
          <UnsupportedNote what="corners" themeName={themeName} />
        )}
      </section>
    </div>
  );
}
