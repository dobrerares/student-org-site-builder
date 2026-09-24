/** @jsxImportSource react */
/**
 * LinkTargetField — the control behind a Custom Block `link` field
 * (ADR 0055; issue-106 plan, "external and Page links").
 *
 * Stores a **Link target**, the same identity model prose links use
 * (ADR 0048): a Page by its permanent id, an Article by its id, or an
 * external address. Choosing a Page keeps that Page's identity when its
 * address changes; the Renderer turns identity back into a URL at render
 * time. A Page that was since deleted is shown as *missing* — the reference
 * is kept so the author can pick another Page or remove the link, and until
 * then the linked text renders without a link.
 *
 * One select does the choosing: "No link", "A web address", then this
 * language's Pages and Articles by name (a Draft is marked, not hidden —
 * linking ahead of publication is normal). Picking a Page stamps a permanent
 * id on it if it has none, through the same `resolveTarget` the rich-text
 * link dialog uses, and commits that Site change before the target that
 * references it.
 */
import type { JSX } from "react";
import type * as React from "react";
import { useMemo } from "react";
import { isAcceptableLinkUrl, pageById, type RichTextLinkTarget, type Site } from "@sosb/schema";
import { Input, NativeSelect } from "@sosb/ui";

import { FieldHint } from "./field-hint.js";
import { useTranslator } from "./i18n-context.js";
import { linkTargetsFor, makePageIdFactory, resolveTarget } from "./rich-text/link-targets.js";

/** What the field needs from the editor shell: the same three things the rich-text link dialog needs. */
export interface LinkTargetFieldContext {
  readonly site: Site;
  readonly lang: string;
  readonly onApplySite: (next: Site) => void;
}

export interface LinkTargetFieldProps {
  readonly value: RichTextLinkTarget | undefined;
  readonly onChange: (next: RichTextLinkTarget | undefined) => void;
  readonly context: LinkTargetFieldContext | undefined;
  /** The dotted data path, for `data-field` addressing. */
  readonly dottedPath: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly children?: React.ReactNode;
}

const NONE = "";
const EXTERNAL = "external";
const MISSING = "missing";

export function LinkTargetField(props: LinkTargetFieldProps): JSX.Element {
  const t = useTranslator();
  const { context, value } = props;
  const options = useMemo(
    () => (context === undefined ? [] : linkTargetsFor(context.site, context.lang)),
    [context],
  );

  // Without the shell's plumbing there is no catalogue to choose from: an
  // inert marker rather than a select that cannot list anything.
  if (context === undefined) {
    return <span data-field={props.dottedPath} data-kind="custom" data-renderer="link-target" />;
  }

  // Which option the saved target corresponds to, or `missing` when the
  // Page/Article it names is gone.
  let selected = NONE;
  let missing = false;
  let draft = false;
  if (value?.kind === "external") {
    selected = EXTERNAL;
  } else if (value?.kind === "page") {
    const page = pageById(context.site, value.pageId);
    const index = page === undefined ? -1 : context.site.pages.indexOf(page);
    const option = options.find((o) => o.kind === "page" && o.index === index);
    if (option === undefined) missing = true;
    else selected = option.key;
  } else if (value?.kind === "article") {
    const index = (context.site.articles ?? []).findIndex((a) => a.id === value.articleId);
    const option = options.find((o) => o.kind === "article" && o.index === index);
    if (option === undefined) missing = true;
    else {
      selected = option.key;
      draft = option.isDraft;
    }
  }
  if (missing) selected = MISSING;

  function choose(key: string): void {
    if (key === NONE) {
      props.onChange(undefined);
      return;
    }
    if (key === EXTERNAL) {
      props.onChange({ kind: "external", href: value?.kind === "external" ? value.href : "" });
      return;
    }
    if (key === MISSING) return;
    const option = options.find((o) => o.key === key);
    if (option === undefined || context === undefined) return;
    const resolved = resolveTarget(context.site, option, makePageIdFactory(context.site));
    // The id stamped on a Page must be saved before — or with — the link that
    // references it (see the rich-text link dialog).
    if (resolved.site !== context.site) context.onApplySite(resolved.site);
    props.onChange(resolved.target);
  }

  const href = value?.kind === "external" ? value.href : "";
  const hrefInvalid = href.trim().length > 0 && !isAcceptableLinkUrl(href.trim());
  const pages = options.filter((o) => o.kind === "page");
  const articles = options.filter((o) => o.kind === "article");

  return (
    <fieldset data-field={props.dottedPath} data-kind="link-target" data-link-missing={missing}>
      <legend>{props.label}</legend>
      <label data-field-label={`${props.dottedPath}.kind`}>
        <span>{t("link.field.target")}</span>
        <NativeSelect
          data-field={`${props.dottedPath}.kind`}
          data-testid="link-target-select"
          value={selected}
          onChange={(event: React.FormEvent<HTMLSelectElement>) =>
            choose(event.currentTarget.value)
          }
        >
          <option value={NONE}>{t("link.field.none")}</option>
          <option value={EXTERNAL}>{t("link.field.external")}</option>
          {missing ? <option value={MISSING}>{t("link.field.missing.option")}</option> : null}
          {pages.length > 0 ? (
            <optgroup label={t("link.field.pages")}>
              {pages.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {articles.length > 0 ? (
            <optgroup label={t("link.field.articles")}>
              {articles.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.isDraft
                    ? t("link.field.draftOption", { title: option.label })
                    : option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
      </label>
      {selected === EXTERNAL ? (
        <label data-field-label={`${props.dottedPath}.href`}>
          <span>{t("link.field.address")}</span>
          <Input
            type="url"
            data-field={`${props.dottedPath}.href`}
            data-testid="link-target-href"
            value={href}
            placeholder="https://"
            onInput={(event: React.FormEvent<HTMLInputElement>) =>
              props.onChange({ kind: "external", href: event.currentTarget.value })
            }
          />
          {hrefInvalid ? (
            <p data-field-issue data-severity="warning" role="status">
              {t("link.field.address.invalid")}
            </p>
          ) : null}
        </label>
      ) : null}
      {missing ? (
        <p data-testid="link-target-missing" data-field-issue data-severity="warning" role="status">
          {value?.kind === "article"
            ? t("link.field.missing.article")
            : t("link.field.missing.page")}
        </p>
      ) : null}
      {draft ? (
        <p data-testid="link-target-draft" data-field-issue data-severity="warning" role="status">
          {t("link.field.draft")}
        </p>
      ) : null}
      <FieldHint hint={props.hint} />
      {props.children}
    </fieldset>
  );
}
