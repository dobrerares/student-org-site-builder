/** @jsxImportSource react */
/**
 * OverviewScreen — the content Overview a Site opens into.
 *
 * Issue #102's fourth round pins the contents: a Pages summary, an Articles
 * summary with per-state counts, Create Page / Create Article, and Site Health
 * with actionable findings. Theme and Site settings stay in the main
 * navigation and are repeated at the foot of the overview, which is where
 * someone who has just finished reading the page is looking.
 *
 * The summaries show the first few entries rather than the whole list: this
 * screen answers "what is in this project and what needs my attention",
 * and the Pages and Articles destinations answer "show me all of them".
 */
import type { JSX } from "react";
import type { Site, ValidationIssue, ValidationResult } from "@sosb/schema";
import { Badge, Button } from "@sosb/ui";

import { FindingList } from "./findings-list.js";
import {
  IconArticle,
  IconChevronRight,
  IconPages,
  IconPalette,
  IconPlus,
  IconSettings,
} from "./icons.js";
import { buildThemeCatalog } from "./theme-catalog.js";
import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";
import type { NavSection } from "./builder-navigation.js";

/** How many entries each summary card lists before deferring to its destination. */
const SUMMARY_LIMIT = 4;

const STATE_TONE = {
  published: "published",
  draft: "draft",
  unlisted: "unlisted",
} as const;

export interface OverviewScreenProps {
  readonly site: Site;
  readonly validation: ValidationResult;
  readonly onOpenPage: (pageIndex: number) => void;
  readonly onOpenArticle: (articleId: string) => void;
  readonly onNavigate: (section: NavSection) => void;
  readonly onCreatePage: () => void;
  readonly onCreateArticle: () => void;
  readonly onFix: (issue: ValidationIssue) => void;
}

export function OverviewScreen(props: OverviewScreenProps): JSX.Element {
  const t = useTranslator();
  const articles = props.site.articles ?? [];
  const errors = props.validation.errors;
  const warnings = props.validation.warnings;
  // Info-level issues are deliberately left off the overview: they are
  // observations, not things anyone needs to act on, and mixing them in makes
  // a healthy project look busy.
  const findings = [...errors, ...warnings];

  function stateCount(state: keyof typeof STATE_TONE): number {
    return articles.filter((a) => a.state === state).length;
  }

  // The author picked "Scholarly", not "academic": show the name they chose
  // from. An imported Theme package is not in the built-in catalog and keeps
  // its id, which is also what its own picker shows.
  const themeLabel =
    buildThemeCatalog().entries.find((entry) => entry.id === props.site.theme.id)?.label ??
    props.site.theme.id;
  const stateCounts = (["published", "draft", "unlisted"] as const)
    .map((state) => ({ state, count: stateCount(state) }))
    .filter((entry) => entry.count > 0);

  const recentArticles = [...articles]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, SUMMARY_LIMIT);

  return (
    <div data-testid="overview" data-screen aria-label={t("overview.title")}>
      <header data-screen-head>
        <h1 data-display>{props.site.org.name}</h1>
        <p data-muted>{t("overview.theme", { theme: themeLabel })}</p>
      </header>

      <div data-overview-grid>
        <section data-card data-testid="overview-pages">
          <div data-row-between>
            <h2>
              <span data-card-icon aria-hidden="true">
                <IconPages size={16} />
              </span>
              {t("overview.pages.title")}
              <InfoHint
                label={t("overview.pages.title")}
                text={t("overview.pages.info")}
                testId="overview-pages-info"
              />
            </h2>
            <Badge tone="neutral">{props.site.pages.length}</Badge>
          </div>

          {props.site.pages.length === 0 ? (
            <p data-muted data-card-empty>
              {t("overview.pages.empty")}
            </p>
          ) : (
            <ul data-summary-list>
              {props.site.pages.slice(0, SUMMARY_LIMIT).map((page, index) => (
                // Index first: two pages can share a slug while the author
                // is mid-way through fixing exactly that validation error.
                <li key={`${index}:${page.lang}:${page.slug}`}>
                  <button
                    type="button"
                    data-summary-row
                    data-testid={`overview-page-${page.slug}`}
                    onClick={() => props.onOpenPage(index)}
                  >
                    <span data-summary-main>
                      <span data-summary-title>{page.navLabel}</span>
                      <span data-summary-meta>
                        {t("overview.pages.blocks", { count: (page.blocks ?? []).length })}
                      </span>
                    </span>
                    <Badge tone="outline">{page.lang}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div data-row>
            <Button
              type="button"
              variant="primary"
              data-testid="overview-create-page"
              onClick={props.onCreatePage}
            >
              <IconPlus size={16} />
              {t("builder.action.createPage")}
            </Button>
            <Button type="button" onClick={() => props.onNavigate("pages")}>
              {t("overview.pages.all")}
            </Button>
          </div>
        </section>

        <section data-card data-testid="overview-articles">
          <div data-row-between>
            <h2>
              <span data-card-icon aria-hidden="true">
                <IconArticle size={16} />
              </span>
              {t("overview.articles.title")}
            </h2>
            <Badge tone="neutral">{articles.length}</Badge>
          </div>

          {/* Only the states that have articles: a row of zeros is noise, and
              an empty project already says so below. */}
          {stateCounts.length > 0 && (
            <div data-row>
              {stateCounts.map(({ state, count }) => (
                <Badge key={state} tone={STATE_TONE[state]} data-testid={`overview-count-${state}`}>
                  {`${count} ${t(`articles.state.${state}`)}`}
                </Badge>
              ))}
            </div>
          )}

          {articles.length === 0 ? (
            <p data-muted data-card-empty>
              {t("overview.articles.empty")}
            </p>
          ) : (
            <ul data-summary-list>
              {recentArticles.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    data-summary-row
                    data-testid={`overview-article-${article.id}`}
                    onClick={() => props.onOpenArticle(article.id)}
                  >
                    <span data-summary-main>
                      <span data-summary-title>
                        {article.title.trim() === "" ? t("articles.untitled") : article.title}
                      </span>
                      <span data-summary-meta>{article.publishedAt}</span>
                    </span>
                    <Badge tone="outline">{article.lang}</Badge>
                    <Badge tone={STATE_TONE[article.state as keyof typeof STATE_TONE] ?? "neutral"}>
                      {t(`articles.state.${article.state}` as "articles.state.draft")}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div data-row>
            <Button
              type="button"
              variant="primary"
              data-testid="overview-create-article"
              onClick={props.onCreateArticle}
            >
              <IconPlus size={16} />
              {t("builder.action.createArticle")}
            </Button>
            <Button type="button" onClick={() => props.onNavigate("articles")}>
              {t("overview.articles.all")}
            </Button>
          </div>
        </section>
      </div>

      <section data-card data-testid="overview-health">
        <div data-row-between>
          <h2>
            {t("overview.health.title")}
            <InfoHint
              label={t("overview.health.title")}
              text={t("overview.health.info")}
              testId="overview-health-info"
            />
          </h2>
          <Badge
            tone={errors.length > 0 ? "error" : warnings.length > 0 ? "draft" : "published"}
            data-testid="overview-health-summary"
          >
            {findings.length === 0
              ? t("overview.health.allGood")
              : t("overview.health.summary", {
                  errors: errors.length,
                  warnings: warnings.length,
                })}
          </Badge>
        </div>
        <FindingList
          issues={findings}
          onFix={props.onFix}
          testId="overview-findings"
          emptyText={t("overview.health.empty")}
        />
      </section>

      <ul data-summary-list data-overview-links>
        <li>
          <button
            type="button"
            data-summary-row
            data-testid="overview-theme"
            onClick={() => props.onNavigate("theme")}
          >
            <span data-card-icon aria-hidden="true">
              <IconPalette size={16} />
            </span>
            <span data-summary-main>
              <span data-summary-title>{t("builder.nav.theme")}</span>
              <span data-summary-meta>{themeLabel}</span>
            </span>
            <IconChevronRight size={16} />
          </button>
        </li>
        <li>
          <button
            type="button"
            data-summary-row
            data-testid="overview-settings"
            onClick={() => props.onNavigate("settings")}
          >
            <span data-card-icon aria-hidden="true">
              <IconSettings size={16} />
            </span>
            <span data-summary-main>
              <span data-summary-title>{t("builder.nav.settings")}</span>
              <span data-summary-meta>{props.site.org.name}</span>
            </span>
            <IconChevronRight size={16} />
          </button>
        </li>
      </ul>
    </div>
  );
}
