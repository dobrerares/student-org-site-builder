/** @jsxImportSource react */
/**
 * PagesScreen — the Pages destination.
 *
 * A heading, Create Page, a search box, and the list. Selecting a page opens
 * its focused workspace; the per-row management affordances (reorder, clone,
 * delete, add a language version) stay where they already were, on
 * `<PagesList>`, which this screen wraps rather than reimplements.
 *
 * Wrapping matters: `PagesList` carries the slug validation, the
 * home-page/navOrder conventions and the missing-translation indicators, and a
 * second list built for this screen would have to grow all of it again and
 * then drift.
 */
import type { JSX } from "react";
import { useState } from "react";
import type { Site } from "@sosb/schema";
import { Button, Input, Label } from "@sosb/ui";

import { PagesList } from "./pages-list.js";
import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";

export interface PagesScreenProps {
  readonly site: Site;
  readonly activeIndex: number;
  /** Open a page's workspace. */
  readonly onOpen: (pageIndex: number) => void;
  readonly onCreatePage: () => void;
  readonly onClone: (index: number, slug: string) => void;
  readonly onDelete: (index: number) => void;
  readonly onMove: (index: number, direction: "up" | "down") => void;
  readonly onAddLanguageVersion: (index: number, targetLang: string) => void;
}

export function PagesScreen(props: PagesScreenProps): JSX.Element {
  const t = useTranslator();
  const [query, setQuery] = useState("");

  return (
    <div data-testid="pages-screen" data-screen>
      <header data-screen-head>
        <div data-row-between>
          <h1>
            {t("pages.title")}
            <InfoHint label={t("pages.title")} text={t("pages.info")} testId="pages-screen-info" />
          </h1>
          <Button
            type="button"
            variant="primary"
            data-testid="pages-create"
            onClick={props.onCreatePage}
          >
            {t("builder.action.createPage")}
          </Button>
        </div>
      </header>

      <div data-screen-search>
        <Label htmlFor="pages-search">{t("pages.search.label")}</Label>
        <Input
          id="pages-search"
          type="search"
          data-testid="pages-search"
          placeholder={t("pages.search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <PagesList
        site={props.site}
        activeIndex={props.activeIndex}
        query={query}
        hideAddForm
        hideHeader
        onSelect={props.onOpen}
        // Creating a page is the destination's own primary action, so the
        // list's inline form is hidden and this never fires.
        onAdd={() => props.onCreatePage()}
        onClone={props.onClone}
        onDelete={props.onDelete}
        onMove={props.onMove}
        onAddLanguageVersion={props.onAddLanguageVersion}
      />
    </div>
  );
}
