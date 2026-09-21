/** @jsxImportSource react */
/**
 * TagManager — the small management screen for Article tags (issue #98).
 *
 * Renaming is the easy half: it updates the label everywhere while preserving
 * every association and every configured filter, because associations reference
 * the tag's permanent id.
 *
 * Deletion is the half that needs care. It is genuinely destructive — the tag
 * comes off every Article and out of every list filter — and it has one
 * counter-intuitive consequence worth calling out explicitly: removing the last
 * selected tag from a list does not empty that list, it makes it show *every*
 * eligible Article. The confirmation names the affected lists for exactly that
 * reason.
 */
import type { JSX } from "react";
import { useState } from "react";
import type { Site } from "@sosb/schema";
import { Button, Input, Label } from "@sosb/ui";
import { EditorDialog } from "./editor-dialog.js";
import { IconPlus, IconTrash } from "./icons.js";
import { createTag, deleteTag, renameTag, tagUsage } from "./articles-ops.js";
import type { ApplySiteChange } from "./article-settings-form.js";
import { useTranslator } from "./i18n-context.js";

export interface TagManagerProps {
  readonly site: Site;
  readonly onApply: ApplySiteChange;
}

export function TagManager(props: TagManagerProps): JSX.Element {
  const t = useTranslator();
  const tags = props.site.tags ?? [];

  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [error, setError] = useState<"duplicate" | "empty" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const deleting = pendingDelete === null ? null : tags.find((tag) => tag.id === pendingDelete);
  const usage = pendingDelete === null ? null : tagUsage(props.site, pendingDelete);

  function commitRename(tagId: string): void {
    let failure: "duplicate" | "empty" | undefined;
    props.onApply((site) => {
      const result = renameTag(site, tagId, editingLabel);
      failure = result.error;
      return result.site;
    });
    if (failure !== undefined) {
      setError(failure);
      return;
    }
    setError(null);
    setEditingId(null);
  }

  return (
    <div className="tag-manager" data-testid="tag-manager">
      <h2>{t("articles.tags.title")}</h2>

      <div className="tag-manager__create">
        <Label htmlFor="tag-manager-new">{t("articles.tags.newLabel")}</Label>
        <Input
          id="tag-manager-new"
          value={newLabel}
          onChange={(event) => setNewLabel(event.currentTarget.value)}
          data-testid="tag-manager-new"
        />
        <Button
          type="button"
          disabled={newLabel.trim().length === 0}
          onClick={() => {
            props.onApply((site) => createTag(site, newLabel).site);
            setNewLabel("");
          }}
          data-testid="tag-manager-create"
        >
          <IconPlus size={14} />
          {t("articles.tags.create")}
        </Button>
      </div>

      {tags.length === 0 ? (
        <p className="tag-manager__empty">{t("articles.tags.empty")}</p>
      ) : (
        <ul className="tag-manager__list" data-testid="tag-manager-list">
          {tags.map((tag) => (
            <li key={tag.id} data-testid={`tag-row-${tag.id}`}>
              {editingId === tag.id ? (
                <>
                  <Input
                    value={editingLabel}
                    aria-label={t("articles.tags.rename")}
                    onChange={(event) => setEditingLabel(event.currentTarget.value)}
                    data-testid={`tag-rename-input-${tag.id}`}
                  />
                  <Button type="button" onClick={() => commitRename(tag.id)}>
                    {t("articles.tags.save")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                  >
                    {t("articles.tags.cancel")}
                  </Button>
                  {error !== null && (
                    <p role="alert" className="tag-manager__error">
                      {t(
                        error === "duplicate"
                          ? "articles.tags.error.duplicate"
                          : "articles.tags.error.empty",
                      )}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <span className="tag-manager__label">{tag.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditingLabel(tag.label);
                      setError(null);
                    }}
                    data-testid={`tag-rename-${tag.id}`}
                  >
                    {t("articles.tags.rename")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    data-tone="danger"
                    onClick={() => setPendingDelete(tag.id)}
                    data-testid={`tag-delete-${tag.id}`}
                  >
                    <IconTrash size={14} />
                    {t("articles.tags.delete")}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <EditorDialog
        open={deleting !== undefined && deleting !== null}
        onClose={() => setPendingDelete(null)}
        testId="tag-delete-dialog"
        tone="warning"
        labelledBy="tag-delete-title"
      >
        <h2 id="tag-delete-title">
          {t("articles.tags.delete.confirm", { label: deleting?.label ?? "" })}
        </h2>
        {usage !== null && usage.articleTitles.length > 0 && (
          <p data-testid="tag-delete-articles">
            {t("articles.tags.delete.articles", { count: usage.articleTitles.length })}
          </p>
        )}
        {usage !== null && usage.listLabels.length > 0 && (
          <p data-testid="tag-delete-lists">
            {t("articles.tags.delete.lists", { names: usage.listLabels.join(", ") })}
          </p>
        )}
        {usage !== null && usage.listsBecomingUnfiltered.length > 0 && (
          <p data-testid="tag-delete-unfiltered">
            {t("articles.tags.delete.unfiltered", {
              names: usage.listsBecomingUnfiltered.join(", "),
            })}
          </p>
        )}
        <div className="tag-manager__dialog-actions">
          <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>
            {t("articles.tags.cancel")}
          </Button>
          <Button
            type="button"
            data-tone="danger"
            onClick={() => {
              const id = pendingDelete;
              setPendingDelete(null);
              if (id !== null) props.onApply((site) => deleteTag(site, id));
            }}
            data-testid="tag-delete-confirm"
          >
            {t("articles.tags.delete")}
          </Button>
        </div>
      </EditorDialog>
    </div>
  );
}
