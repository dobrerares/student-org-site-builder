/** @jsxImportSource react */
/**
 * TagPicker — searchable tag selection with inline creation.
 *
 * Issue #98 requires the *same* picker in two places: Article settings and
 * Article-list configuration. Both "offer existing tags first" and both allow
 * creating a tag without leaving the surface, so they are one component rather
 * than two that drift.
 *
 * Duplicate protection lives in `createTag` (case- and whitespace-insensitive),
 * so this component can offer "Create X" freely: if X already exists under a
 * different capitalisation, the author gets the existing tag instead of a
 * near-duplicate. The button is still hidden for exact matches, because
 * offering to create something visibly already in the list is just confusing.
 */
import type { JSX } from "react";
import { useState } from "react";
import type { ArticleTag } from "@sosb/schema";
import { normalizeTagLabel } from "@sosb/schema";
import { Button, Input, Label } from "@sosb/ui";
import { IconClose, IconPlus } from "./icons.js";
import { InfoHint } from "./info-hint.js";
import { useTranslator } from "./i18n-context.js";

export interface TagPickerProps {
  readonly tags: readonly ArticleTag[];
  readonly selected: readonly string[];
  readonly onToggle: (tagId: string) => void;
  /** Create (or reuse) a tag by label and select it. */
  readonly onCreate: (label: string) => void;
  readonly label: string;
  readonly hint?: { readonly label: string; readonly text: string } | undefined;
  readonly testId?: string | undefined;
}

export function TagPicker(props: TagPickerProps): JSX.Element {
  const t = useTranslator();
  const [query, setQuery] = useState("");
  const needle = normalizeTagLabel(query);

  const selectedTags = props.selected
    .map((id) => props.tags.find((tag) => tag.id === id))
    .filter((tag): tag is ArticleTag => tag !== undefined);

  const suggestions = props.tags.filter(
    (tag) => !props.selected.includes(tag.id) && normalizeTagLabel(tag.label).includes(needle),
  );
  const exactExists = props.tags.some((tag) => normalizeTagLabel(tag.label) === needle);
  const canCreate = needle.length > 0 && !exactExists;

  return (
    <div className="tag-picker" data-testid={props.testId ?? "tag-picker"}>
      <div className="tag-picker__heading">
        <Label>{props.label}</Label>
        {props.hint !== undefined && (
          <InfoHint label={props.hint.label} text={props.hint.text} testId="tag-picker-hint" />
        )}
      </div>

      {selectedTags.length > 0 && (
        <ul className="tag-picker__selected" data-testid="tag-picker-selected">
          {selectedTags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                className="tag-picker__chip"
                onClick={() => props.onToggle(tag.id)}
                aria-label={`${t("articleList.selected.remove")} — ${tag.label}`}
                data-testid={`tag-chip-${tag.id}`}
              >
                <span>{tag.label}</span>
                <IconClose size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        type="search"
        value={query}
        placeholder={t("articles.settings.tags.placeholder")}
        aria-label={props.label}
        onChange={(event) => setQuery(event.currentTarget.value)}
        data-testid="tag-picker-search"
      />

      {suggestions.length > 0 && (
        <ul className="tag-picker__options" data-testid="tag-picker-options">
          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                className="tag-picker__option"
                onClick={() => {
                  props.onToggle(tag.id);
                  setQuery("");
                }}
                data-testid={`tag-option-${tag.id}`}
              >
                {tag.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            props.onCreate(query.trim());
            setQuery("");
          }}
          data-testid="tag-picker-create"
        >
          <IconPlus size={14} />
          {`${t("articles.settings.tags.add")}: ${query.trim()}`}
        </Button>
      )}
    </div>
  );
}
