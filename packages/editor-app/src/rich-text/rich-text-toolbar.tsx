/** @jsxImportSource react */
/**
 * The Site-aware toolbar layer.
 *
 * ADR 0049 draws the line here: the vendored editorcn primitives in
 * `../vendor/editorcn/toolbar.tsx` are presentation, and everything that
 * knows about Tiptap commands, about assets, or about Pages and Articles
 * stays editor-owned. This file is that owned layer.
 *
 * Button order follows how often a non-technical author reaches for each
 * control rather than the order the extensions happen to be registered in:
 * text style first, then emphasis, then structure, then the two things that
 * open a dialog, then history.
 */
import type { JSX } from "react";
import type { Editor } from "@tiptap/core";
import { useTranslator } from "../i18n-context.js";
import { IconRedo, IconUndo } from "../icons.js";
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from "../vendor/editorcn/toolbar.js";
import {
  IconBold,
  IconBulletList,
  IconCode,
  IconHeading,
  IconItalic,
  IconLink,
  IconOrderedList,
  IconParagraph,
  IconQuote,
  IconStrikethrough,
  IconUnderline,
  IconUnlink,
} from "./icons.js";
import { SOSB_LINK_MARK } from "./doc-prosemirror.js";

export interface RichTextToolbarProps {
  readonly editor: Editor;
  /** Bumped by the caller on every transaction so this re-reads editor state. */
  readonly revision: number;
  readonly onOpenLink: () => void;
  readonly onOpenImage: () => void;
  readonly disabled: boolean;
}

export function RichTextToolbar(props: RichTextToolbarProps): JSX.Element {
  const t = useTranslator();
  const { editor, disabled } = props;

  // `revision` is read so the memo-free render is not optimised away by a
  // future `memo()`: every button's pressed state comes from mutable editor
  // state, which React cannot observe on its own.
  void props.revision;

  const can = (fn: () => boolean): boolean => (disabled ? false : fn());

  return (
    <Toolbar label={t("richText.toolbar.label")} className="rich-text-toolbar">
      <ToolbarGroup>
        <ToolbarButton
          label={t("richText.toolbar.paragraph")}
          testId="rich-text-paragraph"
          tabIndex={0}
          disabled={disabled}
          pressed={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <IconParagraph />
        </ToolbarButton>
        {([2, 3, 4] as const).map((level) => (
          <ToolbarButton
            key={level}
            label={t(`richText.toolbar.heading${level}` as "richText.toolbar.heading2")}
            testId={`rich-text-heading-${level}`}
            disabled={disabled}
            pressed={editor.isActive("heading", { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <IconHeading level={level} />
          </ToolbarButton>
        ))}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label={t("richText.toolbar.bold")}
          testId="rich-text-bold"
          disabled={disabled}
          pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <IconBold />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.italic")}
          testId="rich-text-italic"
          disabled={disabled}
          pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <IconItalic />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.underline")}
          testId="rich-text-underline"
          disabled={disabled}
          pressed={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <IconUnderline />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.strike")}
          testId="rich-text-strike"
          disabled={disabled}
          pressed={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <IconStrikethrough />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.code")}
          testId="rich-text-code"
          disabled={disabled}
          pressed={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <IconCode />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label={t("richText.toolbar.bulletList")}
          testId="rich-text-bullet-list"
          disabled={disabled}
          pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <IconBulletList />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.orderedList")}
          testId="rich-text-ordered-list"
          disabled={disabled}
          pressed={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <IconOrderedList />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.blockquote")}
          testId="rich-text-blockquote"
          disabled={disabled}
          pressed={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <IconQuote />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label={t("richText.toolbar.link")}
          testId="rich-text-link"
          disabled={disabled}
          pressed={editor.isActive(SOSB_LINK_MARK)}
          onClick={props.onOpenLink}
        >
          <IconLink />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.unlink")}
          testId="rich-text-unlink"
          // Only offered when the caret is actually inside a link: a
          // permanently enabled "remove link" invites the author to wonder
          // what it would have done.
          disabled={disabled || !editor.isActive(SOSB_LINK_MARK)}
          onClick={() => editor.chain().focus().unsetSosbLink().run()}
        >
          <IconUnlink />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.image")}
          testId="rich-text-image"
          disabled={disabled}
          onClick={props.onOpenImage}
        >
          <IconImageGlyph />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label={t("richText.toolbar.undo")}
          testId="rich-text-undo"
          disabled={!can(() => editor.can().undo())}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <IconUndo />
        </ToolbarButton>
        <ToolbarButton
          label={t("richText.toolbar.redo")}
          testId="rich-text-redo"
          disabled={!can(() => editor.can().redo())}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <IconRedo />
        </ToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

/** Local alias so the import list above reads as one group of formatting icons. */
function IconImageGlyph(): JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="icon"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 18 5-5 3 3 3-3 5 5" />
    </svg>
  );
}
