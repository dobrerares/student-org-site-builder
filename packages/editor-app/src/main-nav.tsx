/** @jsxImportSource react */
/**
 * MainNav — the builder's persistent main navigation.
 *
 * Five destinations (Overview, Pages, Articles, Theme, Site settings), the two
 * create actions, and the content-language picker. On a wide window it is a
 * permanent rail; at phone width the same markup becomes a drawer over the
 * content, opened by the top bar's menu button and dismissed by the scrim, the
 * Close button or Escape.
 *
 * The drawer is the same element rather than a second copy because the
 * accepted design asks for identical navigation at both widths, and two copies
 * would drift — and would also put two `aria-current="page"` entries in the
 * accessibility tree at once.
 *
 * Focus handling follows the dialog convention the rest of the editor uses: on
 * open, focus moves to the first control in the drawer; on close it returns to
 * the button that opened it. Without the return, dismissing the drawer on a
 * phone drops the user at the top of the document.
 */
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { Badge, Button, NativeSelect } from "@sosb/ui";

import { useTranslator } from "./i18n-context.js";
import { NAV_SECTIONS, type NavSection } from "./builder-navigation.js";
import {
  IconArticle,
  IconFolder,
  IconHome,
  IconPages,
  IconPalette,
  IconPlus,
  IconRotate,
  IconSettings,
} from "./icons.js";

const SECTION_LABEL_KEY = {
  overview: "builder.nav.overview",
  pages: "builder.nav.pages",
  articles: "builder.nav.articles",
  theme: "builder.nav.theme",
  settings: "builder.nav.settings",
} as const satisfies Record<NavSection, string>;

const SECTION_ICON = {
  overview: IconHome,
  pages: IconPages,
  articles: IconArticle,
  theme: IconPalette,
  settings: IconSettings,
} as const satisfies Record<NavSection, (props: { size?: number }) => JSX.Element>;

export interface MainNavProps {
  readonly active: NavSection;
  readonly onNavigate: (section: NavSection) => void;
  readonly onCreatePage: () => void;
  readonly onCreateArticle: () => void;
  /** Counts shown beside Pages and Articles. */
  readonly pageCount: number;
  readonly articleCount: number;
  /** Languages the Site declares, for the content-language picker. */
  readonly languages: readonly string[];
  readonly contentLanguage: string;
  readonly onContentLanguageChange: (lang: string) => void;
  /** Phone only: whether the drawer is open. */
  readonly drawerOpen: boolean;
  readonly onCloseDrawer: () => void;
  /**
   * Phone only: Open project / Start over. The top bar has no room for them
   * beside Save project and Export website at 390px, and they are rare
   * actions, so the drawer carries them there. Omitted on wide windows,
   * where the top bar shows them and a second copy would just be noise.
   */
  readonly projectActions?:
    | { readonly onImport: () => void; readonly onReset: () => void }
    | undefined;
}

export function MainNav(props: MainNavProps): JSX.Element {
  const t = useTranslator();
  const navRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  // Move focus into the drawer when it opens and hand it back when it closes.
  // Only when it *changes*, so a re-render while open does not steal focus
  // from whatever the user is interacting with inside it.
  useEffect(() => {
    if (props.drawerOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const first = navRef.current?.querySelector<HTMLElement>(
        "button:not([disabled]), select, a[href]",
      );
      first?.focus();
    } else if (!props.drawerOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      const opener = document.querySelector<HTMLElement>('[data-testid="nav-drawer-open"]');
      opener?.focus();
    }
  }, [props.drawerOpen]);

  // Escape closes the drawer. Capture phase so it is handled before the
  // workspace's own Escape-to-drill-out listener: with the drawer covering the
  // content, dismissing the drawer is unambiguously what Escape means.
  useEffect(() => {
    if (!props.drawerOpen) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      props.onCloseDrawer();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [props.drawerOpen, props.onCloseDrawer]);

  function countFor(section: NavSection): number | undefined {
    if (section === "pages") return props.pageCount;
    if (section === "articles") return props.articleCount;
    return undefined;
  }

  return (
    <>
      {props.drawerOpen && (
        <div
          data-testid="nav-drawer-scrim"
          data-nav-scrim
          // The scrim is a convenience for pointer users; Escape and the
          // Close button are the accessible paths, so it stays out of the
          // tab order and the accessibility tree.
          aria-hidden="true"
          onClick={props.onCloseDrawer}
        />
      )}
      <nav
        ref={navRef}
        data-testid="main-nav"
        data-drawer-open={props.drawerOpen ? "true" : "false"}
        aria-label={t("builder.nav.label")}
      >
        <div data-nav-drawer-head>
          <Button
            type="button"
            size="sm"
            data-testid="nav-drawer-close"
            onClick={props.onCloseDrawer}
          >
            {t("builder.nav.close")}
          </Button>
        </div>

        <span data-nav-group-label>{t("builder.nav.group.site")}</span>
        {NAV_SECTIONS.map((section) => {
          const count = countFor(section);
          const Icon = SECTION_ICON[section];
          return (
            <button
              key={section}
              type="button"
              data-testid={`nav-${section}`}
              data-nav-item
              data-active={props.active === section ? "true" : "false"}
              aria-current={props.active === section ? "page" : undefined}
              onClick={() => props.onNavigate(section)}
            >
              <Icon size={17} />
              <span data-nav-label>{t(SECTION_LABEL_KEY[section])}</span>
              {count !== undefined && (
                <Badge tone="neutral" data-testid={`nav-count-${section}`}>
                  {count}
                </Badge>
              )}
            </button>
          );
        })}

        <span data-nav-group-label>{t("builder.nav.group.create")}</span>
        <button
          type="button"
          data-testid="nav-create-page"
          data-nav-item
          data-nav-create
          onClick={props.onCreatePage}
        >
          <IconPlus size={17} />
          <span data-nav-label>{t("builder.action.createPage")}</span>
        </button>
        <button
          type="button"
          data-testid="nav-create-article"
          data-nav-item
          data-nav-create
          onClick={props.onCreateArticle}
        >
          <IconPlus size={17} />
          <span data-nav-label>{t("builder.action.createArticle")}</span>
        </button>

        {props.projectActions !== undefined && (
          <>
            <span data-nav-group-label>{t("builder.nav.group.project")}</span>
            <button
              type="button"
              data-testid="nav-import"
              data-nav-item
              onClick={props.projectActions.onImport}
            >
              <IconFolder size={17} />
              <span data-nav-label>{t("topbar.import")}</span>
            </button>
            <button
              type="button"
              data-testid="nav-reset"
              data-nav-item
              onClick={props.projectActions.onReset}
            >
              <IconRotate size={17} />
              <span data-nav-label>{t("topbar.reset")}</span>
            </button>
          </>
        )}

        {props.languages.length > 1 && (
          <>
            <span data-nav-group-label id="nav-content-language-label">
              {t("builder.nav.contentLanguage")}
            </span>
            <div data-nav-language>
              <NativeSelect
                data-testid="nav-content-language"
                aria-labelledby="nav-content-language-label"
                value={props.contentLanguage}
                onChange={(event) => props.onContentLanguageChange(event.currentTarget.value)}
              >
                {props.languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </>
        )}
      </nav>
    </>
  );
}
