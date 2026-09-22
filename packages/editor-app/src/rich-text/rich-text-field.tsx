/** @jsxImportSource react */
/**
 * The Rich-text Block's editing surface — the ADR 0043 override that
 * replaces the generated form for `RichTextDocumentSchema`.
 *
 * ## Undo, and why there are two of them
 *
 * Issue #100 asks for two histories that must not fight:
 *
 *   > While focused inside rich-text editing, Ctrl/Cmd+Z undoes local typing
 *   > and formatting. Outside it, undo operates on Site history. Each editing
 *   > visit forms one Site-history entry restoring its previous content.
 *   > Updates reach preview and export immediately; history grouping does not
 *   > buffer saved content.
 *
 * The implementation:
 *
 * - **Local history is Tiptap's.** The whole field — text and toolbar —
 *   carries `data-rich-text-surface`, and the editor's global Ctrl+Z handler
 *   ignores key events originating inside it. With the caret in the text,
 *   ProseMirror's own history plugin sees the keystroke and undoes a typing
 *   step; with focus on a toolbar button, the field forwards it to the same
 *   local history. No custom keymap, no race.
 * - **Every change is committed immediately, without a history entry.**
 *   `onPatchQuiet` writes the document straight into Site data, so preview,
 *   validation and export are never stale. What it does *not* do is push a
 *   Site-history snapshot, which is what "history grouping does not buffer
 *   saved content" asks for: the saving and the grouping are decoupled.
 * - **One Site-history entry per visit.** On blur — or on unmount, which is
 *   what switching Block, Page or Article looks like from here — a single
 *   snapshot is pushed if anything changed. Undoing from outside the field
 *   therefore restores the content as it was when the author arrived,
 *   rather than replaying three hundred keystrokes.
 *
 * ## Unsupported content
 *
 * If the stored document contains a node or mark this version does not
 * understand, Tiptap is never mounted. The Block renders read-only with an
 * explanation and the document is passed through untouched. ADR 0048
 * forbids automatic simplification, and the surest way to honour that is to
 * keep unknown content away from a schema that has no node for it.
 */
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  collectUnsupportedRichText,
  emptyRichTextDocument,
  type AssetRefLike,
  type RichTextDocument,
  type RichTextLinkTarget,
  type Site,
} from "@sosb/schema";
import { useTranslator } from "../i18n-context.js";
import { FieldHint } from "../field-hint.js";
import { docToProseMirror, proseMirrorToDoc, type ProseMirrorDoc } from "./doc-prosemirror.js";
import { RichTextAlign, SosbImage, SosbLink } from "./extensions.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";
import { RichTextLinkDialog } from "./link-dialog.js";
import { RichTextImageDialog } from "./image-dialog.js";

/**
 * Everything the field needs that only the editor shell can supply.
 *
 * Passed as one object rather than six props because it is threaded through
 * `BlockForm` and `FieldRenderer`, neither of which has any business knowing
 * what is inside it.
 */
export interface RichTextFieldContext {
  /** Current Site, for the link picker's catalogue of targets. */
  readonly site: Site;
  /** Language whose Pages and Articles this Block can link at. */
  readonly lang: string;
  /**
   * Commit a Site change made by the field itself — today, stamping a
   * permanent id on a Page the author just linked at. Separate from the
   * document patch because it touches the spine, not the Block.
   */
  readonly onApplySite: (next: Site) => void;
  /** Upload an image through the project's asset pipeline. */
  readonly uploader: (file: File, suggestedAlt?: string) => Promise<AssetRefLike>;
  /** Resolve an asset reference to something a browser can display. */
  readonly displayUrlFor?: ((ref: AssetRefLike) => string | undefined) | undefined;
  /** Called when an editing visit ends having changed something. */
  readonly onCommitVisit: () => void;
}

export interface RichTextFieldProps {
  readonly value: RichTextDocument | undefined;
  /** Writes the document into Site data *without* a history entry. */
  readonly onChange: (next: RichTextDocument) => void;
  readonly context: RichTextFieldContext;
}

export function RichTextField(props: RichTextFieldProps): JSX.Element {
  const t = useTranslator();
  const { context } = props;

  const unsupported = useMemo(
    () => collectUnsupportedRichText(props.value ?? emptyRichTextDocument()),
    [props.value],
  );

  if (unsupported.length > 0) {
    return <UnsupportedNotice types={unsupported.map((entry) => entry.type)} />;
  }

  return <EditableRichText {...props} context={context} key="editable" t={t} />;
}

function UnsupportedNotice(props: { types: readonly string[] }): JSX.Element {
  const t = useTranslator();
  const unique = Array.from(new Set(props.types)).sort();
  return (
    <div data-testid="rich-text-unsupported" role="note" className="rich-text-unsupported-notice">
      <strong>{t("richText.unsupported.title")}</strong>
      <p>{t("richText.unsupported.body")}</p>
      <p data-testid="rich-text-unsupported-types">{unique.join(", ")}</p>
    </div>
  );
}

function EditableRichText(
  props: RichTextFieldProps & { t: ReturnType<typeof useTranslator> },
): JSX.Element {
  const { context, t } = props;
  const [revision, setRevision] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  /**
   * Whether this visit has changed anything. A ref, not state: it is read
   * from an effect cleanup that must see the latest value, and changing it
   * must never cause a render.
   */
  const dirtyRef = useRef(false);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  const commitVisitRef = useRef(context.onCommitVisit);
  commitVisitRef.current = context.onCommitVisit;

  const initialContent = useMemo(
    () => docToProseMirror(props.value),
    // Intentionally computed once per mount, so `props.value` is deliberately
    // absent from the dependency list. Tiptap owns the document while it is
    // mounted; re-seeding it from props on every keystroke would fight the
    // editor for the caret. Remounting happens when the Block changes, which
    // is exactly when re-seeding is correct.
    [],
  );

  const editor = useEditor({
    // The archival single-file build and the Electron renderer both run this
    // in a real DOM, but Tiptap 3 warns when it renders during the first
    // React pass. Deferring costs one frame and removes the warning.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Owned locally: our link stores a target, not an href.
        link: false,
        // Code fences and horizontal rules are explicitly deferred by
        // issue #100 and have no node in the document vocabulary.
        codeBlock: false,
        horizontalRule: false,
        // The page shell owns the single `<h1>` (ADR 0034).
        heading: { levels: [2, 3, 4] },
      }),
      SosbLink,
      SosbImage,
      RichTextAlign,
    ],
    content: initialContent,
    onUpdate: ({ editor: instance }) => {
      dirtyRef.current = true;
      onChangeRef.current(proseMirrorToDoc(instance.getJSON() as ProseMirrorDoc));
      setRevision((value) => value + 1);
    },
    onSelectionUpdate: () => setRevision((value) => value + 1),
    onTransaction: () => setRevision((value) => value + 1),
    editorProps: {
      attributes: {
        "data-testid": "rich-text-surface",
        "data-rich-text-surface": "",
        "aria-label": t("richText.editor.label"),
        role: "textbox",
        "aria-multiline": "true",
        class: "rich-text rich-text-editing",
      },
    },
  });

  // End the visit when the field goes away: switching Block, Page or Article
  // all unmount this component, and issue #100 counts each of those as the
  // end of an editing visit.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) commitVisitRef.current();
      dirtyRef.current = false;
    };
  }, []);

  const onBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    // Moving between the toolbar and the text is not leaving the field.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    commitVisitRef.current();
  }, []);

  // Ctrl/Cmd+Z with focus on a toolbar button is still "inside rich-text
  // editing" (issue #100): it undoes the last local step, exactly as it
  // would with the caret in the text. Inside the text itself ProseMirror's
  // own keymap has already handled the keystroke, so those are left alone.
  // Either way the event never reaches the editor shell's Site-history
  // handler — the wrapper carries the marker that handler checks for.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (editor === null) return;
      if (event.key !== "z" && event.key !== "Z") return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (editor.view.dom.contains(event.target as Node)) return;
      event.preventDefault();
      if (event.shiftKey) editor.chain().focus().redo().run();
      else editor.chain().focus().undo().run();
    },
    [editor],
  );

  if (editor === null) {
    return <div data-testid="rich-text-loading" />;
  }

  return (
    <div
      data-testid="rich-text-field"
      data-field="doc"
      data-rich-text-surface=""
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <RichTextToolbar
        editor={editor}
        revision={revision}
        disabled={false}
        onOpenLink={() => setLinkOpen(true)}
        onOpenImage={() => setImageOpen(true)}
      />
      <EditorContent editor={editor} />
      <FieldHint hint={t("richText.editor.help")} />

      <RichTextLinkDialog
        open={linkOpen}
        site={context.site}
        lang={context.lang}
        hasSelection={!editor.state.selection.empty || editor.isActive("sosbLink")}
        onClose={() => {
          setLinkOpen(false);
          editor.commands.focus();
        }}
        onApplySite={context.onApplySite}
        onApply={(target: RichTextLinkTarget) => {
          setLinkOpen(false);
          editor.chain().focus().setSosbLink(target).run();
        }}
        onRemove={() => {
          setLinkOpen(false);
          editor.chain().focus().unsetSosbLink().run();
        }}
      />

      <RichTextImageDialog
        open={imageOpen}
        uploader={context.uploader}
        displayUrlFor={context.displayUrlFor}
        onClose={() => {
          setImageOpen(false);
          editor.commands.focus();
        }}
        onInsert={(asset, caption) => {
          setImageOpen(false);
          editor.chain().focus().insertSosbImage({ asset, caption }).run();
        }}
      />
    </div>
  );
}
