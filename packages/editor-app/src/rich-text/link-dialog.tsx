/** @jsxImportSource react */
/**
 * The link dialog: two tabs, one for things in this project and one for
 * addresses on the web.
 *
 * The split is the product decision from issue #100 made visible. Internal
 * links are chosen from a list, because the author should never have to know
 * that "About us" lives at `/despre/` — and because picking from the list is
 * what stores a *target* rather than a path, which is what survives a slug
 * rename. External links are typed, validated against the same rule every
 * other link field in the schema uses.
 *
 * Focus entry and return come from `EditorDialog` (Base UI): opening moves
 * focus into the dialog, closing returns it to the toolbar button, Escape
 * dismisses. The caller then restores focus to the text itself so the
 * selection the author made is still there.
 */
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label, TabsList, TabsPanel, TabsRoot, TabsTab } from "@sosb/ui";
import { isAcceptableLinkUrl, type RichTextLinkTarget, type Site } from "@sosb/schema";
import { EditorDialog } from "../editor-dialog.js";
import { FieldHint } from "../field-hint.js";
import { useTranslator } from "../i18n-context.js";
import {
  linkTargetsFor,
  makePageIdFactory,
  matchesQuery,
  resolveTarget,
  type LinkTargetOption,
} from "./link-targets.js";

export interface RichTextLinkDialogProps {
  readonly open: boolean;
  readonly site: Site;
  readonly lang: string;
  /** False when the caret is collapsed and not already inside a link. */
  readonly hasSelection: boolean;
  readonly onClose: () => void;
  readonly onApply: (target: RichTextLinkTarget) => void;
  readonly onRemove: () => void;
  readonly onApplySite: (next: Site) => void;
}

export function RichTextLinkDialog(props: RichTextLinkDialogProps): JSX.Element {
  const t = useTranslator();
  const [query, setQuery] = useState("");
  const [href, setHref] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showInvalid, setShowInvalid] = useState(false);

  // Reset on each open: a dialog that remembers last time's half-typed URL
  // is a dialog that silently links somewhere the author did not mean.
  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setHref("");
    setSelected(null);
    setShowInvalid(false);
  }, [props.open]);

  const options = useMemo(
    () => linkTargetsFor(props.site, props.lang),
    [props.site, props.lang],
  );
  const visible = useMemo(
    () => options.filter((option) => matchesQuery(option, query)),
    [options, query],
  );
  const selectedOption = options.find((option) => option.key === selected);

  function applyInternal(option: LinkTargetOption): void {
    const { site, target } = resolveTarget(props.site, option, makePageIdFactory(props.site));
    // The id stamped on a Page must be saved before — or with — the link
    // that references it. Committing the Site first means a link can never
    // point at an id that exists only in this dialog's memory.
    if (site !== props.site) props.onApplySite(site);
    props.onApply(target);
  }

  function applyExternal(): void {
    const trimmed = href.trim();
    if (!isAcceptableLinkUrl(trimmed) || trimmed === "") {
      setShowInvalid(true);
      return;
    }
    props.onApply({ kind: "external", href: trimmed });
  }

  return (
    <EditorDialog
      open={props.open}
      onClose={props.onClose}
      testId="rich-text-link-dialog"
      label={t("richText.link.title")}
    >
      <h2>{t("richText.link.title")}</h2>
      <p>{t("richText.link.description")}</p>

      {!props.hasSelection && (
        <p role="alert" data-testid="rich-text-link-no-selection">
          {t("richText.link.selectionRequired")}
        </p>
      )}

      <TabsRoot defaultValue="internal">
        <TabsList>
          <TabsTab value="internal" data-testid="rich-text-link-tab-internal">
            {t("richText.link.tab.internal")}
          </TabsTab>
          <TabsTab value="external" data-testid="rich-text-link-tab-external">
            {t("richText.link.tab.external")}
          </TabsTab>
        </TabsList>

        <TabsPanel value="internal">
          <Label htmlFor="rich-text-link-search">{t("richText.link.search.label")}</Label>
          <Input
            id="rich-text-link-search"
            data-testid="rich-text-link-search"
            type="search"
            value={query}
            placeholder={t("richText.link.search.placeholder")}
            onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
          />

          {visible.length === 0 ? (
            <p data-testid="rich-text-link-empty">{t("richText.link.search.empty")}</p>
          ) : (
            <ul data-testid="rich-text-link-results" role="listbox" aria-label={t("richText.link.search.label")}>
              {visible.map((option) => (
                <li key={option.key}>
                  <button
                    type="button"
                    data-sosb-ui
                    role="option"
                    aria-selected={selected === option.key}
                    data-testid={`rich-text-link-option-${option.key}`}
                    data-link-kind={option.kind}
                    onClick={() => setSelected(option.key)}
                    onDoubleClick={() => applyInternal(option)}
                  >
                    <span>{option.label}</span>
                    <span>
                      {option.kind === "page"
                        ? t("richText.link.kind.page")
                        : t("richText.link.kind.article")}
                    </span>
                    <span>{option.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/*
            Selecting a Draft is allowed — linking ahead of publication is a
            normal way to work — but it is never silent. The public page will
            show the words unlinked until the Draft goes live.
          */}
          {selectedOption?.isDraft === true && (
            <p role="status" data-testid="rich-text-link-draft-warning">
              {t("richText.link.draftWarning")}
            </p>
          )}

          <Button
            data-testid="rich-text-link-apply-internal"
            disabled={selectedOption === undefined}
            onClick={() => {
              if (selectedOption !== undefined) applyInternal(selectedOption);
            }}
          >
            {t("richText.link.action.apply")}
          </Button>
        </TabsPanel>

        <TabsPanel value="external">
          <Label htmlFor="rich-text-link-href">{t("richText.link.external.label")}</Label>
          <Input
            id="rich-text-link-href"
            data-testid="rich-text-link-href"
            type="text"
            inputMode="url"
            value={href}
            placeholder={t("richText.link.external.placeholder")}
            aria-invalid={showInvalid ? "true" : undefined}
            onInput={(event) => {
              setHref((event.target as HTMLInputElement).value);
              setShowInvalid(false);
            }}
          />
          <FieldHint hint={t("richText.link.external.help")} />
          {showInvalid && (
            <p role="alert" data-testid="rich-text-link-invalid">
              {t("richText.link.external.invalid")}
            </p>
          )}
          <Button data-testid="rich-text-link-apply-external" onClick={applyExternal}>
            {t("richText.link.action.apply")}
          </Button>
        </TabsPanel>
      </TabsRoot>

      <Button variant="ghost" data-testid="rich-text-link-remove" onClick={props.onRemove}>
        {t("richText.link.action.remove")}
      </Button>
      <Button variant="ghost" data-testid="rich-text-link-cancel" onClick={props.onClose}>
        {t("richText.link.action.cancel")}
      </Button>
    </EditorDialog>
  );
}
