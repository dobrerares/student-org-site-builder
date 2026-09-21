/**
 * THROWAWAY prototype (issue #102) — toolbar + contenteditable rich text.
 * Deliberately NOT Tiptap: this only has to feel right, not be correct.
 */
import { useEffect, useRef, useState } from "react";
import { articleUrl, pageUrl, type Site } from "../model";
import { Dialog, Field, Info, LangBadge, Segmented, StateBadge } from "./ui";

type LinkKind = "page" | "article" | "url" | "email" | "tel";

const cmd = (name: string, value?: string) => document.execCommand(name, false, value);

export function RichTextEditor({
  site,
  html,
  onChange,
}: {
  site: Site;
  html: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html;
    // Only sync in on mount / block switch; the key prop remounts per block.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const run = (name: string, value?: string) => {
    ref.current?.focus();
    cmd(name, value);
    emit();
  };

  const openLinkDialog = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setLinkOpen(true);
  };

  const applyLink = (href: string, target: string | null, title: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    const placeholder = "https://prototype.invalid/pending-link";
    if (sel && sel.isCollapsed) {
      cmd("insertHTML", `<a href="${placeholder}">${title}</a>`);
    } else {
      cmd("createLink", placeholder);
    }
    el.querySelectorAll<HTMLAnchorElement>(`a[href="${placeholder}"]`).forEach((a) => {
      a.setAttribute("href", href);
      if (target) a.setAttribute("data-target", target);
      else a.removeAttribute("data-target");
    });
    emit();
  };

  return (
    <div>
      <div className="rt-toolbar" role="toolbar" aria-label="Text formatting">
        <button className="btn" title="Paragraph" onClick={() => run("formatBlock", "<p>")}>
          ¶
        </button>
        <button className="btn" title="Heading 2" onClick={() => run("formatBlock", "<h2>")}>
          H2
        </button>
        <button className="btn" title="Heading 3" onClick={() => run("formatBlock", "<h3>")}>
          H3
        </button>
        <button className="btn" title="Heading 4" onClick={() => run("formatBlock", "<h4>")}>
          H4
        </button>
        <span className="rt-sep" />
        <button className="btn" title="Bold" onClick={() => run("bold")}>
          <b>B</b>
        </button>
        <button className="btn" title="Italic" onClick={() => run("italic")}>
          <i>I</i>
        </button>
        <button className="btn" title="Underline" onClick={() => run("underline")}>
          <u>U</u>
        </button>
        <button className="btn" title="Strikethrough" onClick={() => run("strikeThrough")}>
          <s>S</s>
        </button>
        <button
          className="btn"
          title="Inline code"
          onClick={() =>
            run("insertHTML", `<code>${window.getSelection()?.toString() || "code"}</code>`)
          }
        >
          {"</>"}
        </button>
        <span className="rt-sep" />
        <button className="btn" title="Bulleted list" onClick={() => run("insertUnorderedList")}>
          • List
        </button>
        <button className="btn" title="Numbered list" onClick={() => run("insertOrderedList")}>
          1. List
        </button>
        <button
          className="btn"
          title="Blockquote"
          onClick={() => run("formatBlock", "<blockquote>")}
        >
          ❝
        </button>
        <span className="rt-sep" />
        <button className="btn" title="Insert or edit a link" onClick={openLinkDialog}>
          🔗 Link
        </button>
        <button
          className="btn"
          title="Insert an image"
          onClick={() =>
            run(
              "insertHTML",
              "<p><em>[Image: uploaded-photo.jpg — “Members at the river clean-up”]</em></p>",
            )
          }
        >
          🖼 Image
        </button>
        <button className="btn" title="Remove link" onClick={() => run("unlink")}>
          Unlink
        </button>
      </div>
      <div
        ref={ref}
        className="rt-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Article text"
        onInput={emit}
        onBlur={emit}
      />
      {linkOpen && (
        <LinkDialog
          site={site}
          onClose={() => setLinkOpen(false)}
          onApply={(href, target, title) => {
            applyLink(href, target, title);
            setLinkOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LinkDialog({
  site,
  onClose,
  onApply,
}: {
  site: Site;
  onClose: () => void;
  onApply: (href: string, target: string | null, title: string) => void;
}) {
  const [kind, setKind] = useState<LinkKind>("article");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [raw, setRaw] = useState("");

  const q = query.trim().toLowerCase();
  const articles = site.articles.filter((a) => a.title.toLowerCase().includes(q));
  const pages = site.pages.filter((p) => p.title.toLowerCase().includes(q));
  const chosenArticle = site.articles.find((a) => a.id === chosen);
  const chosenPage = site.pages.find((p) => p.id === chosen);

  const apply = () => {
    if (kind === "article" && chosenArticle)
      onApply(articleUrl(site, chosenArticle), `article:${chosenArticle.id}`, chosenArticle.title);
    else if (kind === "page" && chosenPage)
      onApply(pageUrl(site, chosenPage), `page:${chosenPage.id}`, chosenPage.title);
    else if (kind === "url") onApply(raw, null, raw);
    else if (kind === "email") onApply(`mailto:${raw}`, null, raw);
    else if (kind === "tel") onApply(`tel:${raw}`, null, raw);
  };

  const canApply =
    (kind === "article" && !!chosenArticle) ||
    (kind === "page" && !!chosenPage) ||
    (kind !== "article" && kind !== "page" && raw.trim() !== "");

  return (
    <Dialog
      title="Add a link"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canApply} onClick={apply}>
            Add link
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <span className="field-label">
            Link to
            <Info label="link targets">
              Links to a Page or Article stay connected to that content. If its web address changes
              later, the link follows it — you do not have to fix anything.
            </Info>
          </span>
          <Segmented
            ariaLabel="Link to"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setChosen(null);
            }}
            options={[
              { value: "article", label: "Article" },
              { value: "page", label: "Page" },
              { value: "url", label: "Web address" },
              { value: "email", label: "Email" },
              { value: "tel", label: "Phone" },
            ]}
          />
        </div>

        {(kind === "article" || kind === "page") && (
          <>
            <Field label={`Search ${kind === "article" ? "articles" : "pages"}`}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a title"
              />
            </Field>
            <div className="list" style={{ maxHeight: 220, overflow: "auto" }}>
              {(kind === "article" ? articles : pages).map((item) => {
                const isArticle = "state" in item;
                return (
                  <button
                    key={item.id}
                    className="list-row"
                    aria-pressed={chosen === item.id}
                    style={chosen === item.id ? { background: "var(--accent-soft)" } : undefined}
                    onClick={() => setChosen(item.id)}
                  >
                    <span className="list-row-main">
                      <span className="list-row-title">{item.title}</span>
                      <span className="row" style={{ gap: 4 }}>
                        <LangBadge lang={item.lang} />
                        {isArticle && <StateBadge state={item.state} />}
                        <span className="small muted">
                          {isArticle ? articleUrl(site, item) : pageUrl(site, item)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {chosenArticle?.state === "draft" && (
              <div className="finding" data-sev="warning">
                <span aria-hidden="true">⚠</span>
                <div>
                  <strong>“{chosenArticle.title}” is a Draft.</strong>
                  <div className="small">
                    You can link to it while you work. On the public website the text will appear
                    without a link until the article is Published.{" "}
                    <Info label="draft link targets">
                      The link target is kept in your project so you can repair it later. Broken and
                      Draft prose links warn here and render as plain text on the website; they do
                      not block exporting.
                    </Info>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {kind === "url" && (
          <Field label="Web address">
            <input
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="https://example.org/page"
            />
          </Field>
        )}
        {kind === "email" && (
          <Field label="Email address">
            <input
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="committee@example.org"
            />
          </Field>
        )}
        {kind === "tel" && (
          <Field label="Phone number">
            <input
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="+40 700 000 000"
            />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
