/** THROWAWAY prototype (issue #102) — builder navigation and authoring walkthrough. */
import { useMemo, useState } from "react";
import {
  LANG_LABEL,
  computeFindings,
  createSeedSite,
  emptyListConfig,
  slugify,
  today,
  uid,
  type Lang,
  type Site,
  type Tag,
} from "./model";
import type { PreviewTarget } from "./components/preview";
import {
  ArticlesScreen,
  ExportDialog,
  Overview,
  PagesScreen,
  SettingsScreen,
  TagsScreen,
  ThemeScreen,
} from "./components/screens";
import { Info, ToastHost, useIsPhone, useToasts } from "./components/ui";
import { Workspace } from "./components/workspace";

type Screen =
  | { kind: "overview" }
  | { kind: "pages" }
  | { kind: "articles" }
  | { kind: "tags" }
  | { kind: "theme" }
  | { kind: "settings" }
  | { kind: "workspace"; target: PreviewTarget };

export default function App() {
  const [site, setSiteState] = useState<Site>(() => createSeedSite());
  const [screen, setScreen] = useState<Screen>({ kind: "overview" });
  const [lang, setLang] = useState<Lang>("en");
  const [drawer, setDrawer] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const { toasts, push, dismiss } = useToasts();
  const isPhone = useIsPhone();

  const setSite = (fn: (s: Site) => Site) => {
    setSiteState(fn);
    setDirty(true);
  };

  const findings = useMemo(() => computeFindings(site), [site]);
  const blockers = findings.filter((f) => f.blocksExport).length;

  const go = (next: Screen) => {
    setScreen(next);
    setDrawer(false);
  };

  const open = (target: PreviewTarget) => go({ kind: "workspace", target });

  const createTag = (label: string): Tag | null => {
    const norm = label.trim().toLowerCase();
    const existing = site.tags.find((t) => t.label.trim().toLowerCase() === norm);
    if (existing) {
      push(`“${existing.label}” already exists, so it was used instead.`, "warn");
      return existing;
    }
    const tag: Tag = { id: uid("tag"), label: label.trim() };
    setSite((s) => ({ ...s, tags: [...s.tags, tag] }));
    push(`Tag “${tag.label}” created.`, "ok");
    return tag;
  };

  const createArticle = () => {
    const id = uid("art");
    setSite((s) => ({
      ...s,
      articles: [
        {
          id,
          title: "Untitled article",
          slug: slugify(`untitled-article-${s.articles.length + 1}`),
          lang,
          state: "draft",
          date: today(),
          summary: "",
          cover: null,
          tagIds: [],
          blocks: [{ id: uid("blk"), type: "richText", html: "<p>Start writing…</p>" }],
          related: { enabled: false, config: emptyListConfig("Related articles") },
        },
        ...s.articles,
      ],
    }));
    open({ kind: "article", id });
    push(
      `New Draft article created in ${LANG_LABEL[lang]}. Nobody sees it until you publish and export.`,
      "ok",
    );
  };

  const createPage = () => {
    const id = uid("page");
    setSite((s) => ({
      ...s,
      pages: [
        ...s.pages,
        {
          id,
          title: "Untitled page",
          slug: slugify(`untitled-page-${s.pages.length + 1}`),
          lang,
          showInNav: true,
          blocks: [{ id: uid("blk"), type: "richText", html: "<p>Start writing…</p>" }],
        },
      ],
    }));
    open({ kind: "page", id });
  };

  const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const saveProject = () => {
    setSavedAt(stamp());
    setDirty(false);
    push(
      "Project saved, including every Draft. This is the editable copy, not the public website.",
      "ok",
    );
  };

  const navItems: { key: Screen["kind"]; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "pages", label: "Pages", count: site.pages.length },
    { key: "articles", label: "Articles", count: site.articles.length },
    { key: "theme", label: "Theme" },
    { key: "settings", label: "Site settings" },
  ];

  const nav = (
    <nav className="nav" data-drawer={drawer} aria-label="Main">
      <div className="drawer-head">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            SB
          </span>
          <span>Site Builder</span>
        </span>
        <button className="btn btn-sm" onClick={() => setDrawer(false)}>
          Close
        </button>
      </div>
      <span className="nav-label">Site</span>
      {navItems.map((item) => (
        <button
          key={item.key}
          className="nav-item"
          aria-current={screen.kind === item.key ? "page" : undefined}
          onClick={() => go({ kind: item.key } as Screen)}
        >
          <span>{item.label}</span>
          {item.count !== undefined && <span className="nav-count">{item.count}</span>}
        </button>
      ))}
      <span className="nav-label">Create</span>
      <button className="nav-item" onClick={createPage}>
        Create Page
      </button>
      <button className="nav-item" onClick={createArticle}>
        Create Article
      </button>
      <span className="nav-label">Content language</span>
      <div style={{ padding: "0 var(--s2)" }}>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          aria-label="Content language"
        >
          {site.languages.map((l) => (
            <option key={l} value={l}>
              {LANG_LABEL[l]}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );

  return (
    <div className="app">
      <div className="topbar">
        <button
          className="btn btn-icon drawer-btn"
          aria-label="Open the main menu"
          onClick={() => setDrawer(true)}
        >
          ☰
        </button>
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            SB
          </span>
          <span>Site Builder</span>
        </span>
        <span className="topbar-spacer" />
        <span className="save-status">
          <b>
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved in this browser · ${savedAt}`
                : "Not saved yet"}
          </b>
          <span>
            Downloaded copy: {downloadedAt ? downloadedAt : "never"}{" "}
            <Info label="saving and downloading">
              <strong>Save project</strong> keeps your work in this browser, Drafts included, so you
              can carry on later. It is not a file you can hand to someone.{" "}
              <strong>Export website</strong> downloads the public website to your computer; you
              then upload it to your hosting for visitors to see it.
            </Info>
          </span>
        </span>
        <button className="btn" onClick={saveProject}>
          Save project
        </button>
        <button className="btn btn-primary" onClick={() => setExporting(true)}>
          Export website{blockers > 0 ? ` (${blockers})` : ""}
        </button>
      </div>

      <div className="body">
        {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}
        {nav}
        <main className="main">
          {screen.kind === "overview" && (
            <Overview
              site={site}
              findings={findings}
              onOpen={open}
              onGo={(s) => go({ kind: s } as Screen)}
              onCreatePage={createPage}
              onCreateArticle={createArticle}
            />
          )}
          {screen.kind === "pages" && (
            <PagesScreen site={site} onOpen={open} onCreatePage={createPage} />
          )}
          {screen.kind === "articles" && (
            <ArticlesScreen
              site={site}
              onOpen={open}
              onCreateArticle={createArticle}
              onManageTags={() => go({ kind: "tags" })}
            />
          )}
          {screen.kind === "tags" && (
            <TagsScreen
              site={site}
              setSite={setSite}
              onBack={() => go({ kind: "articles" })}
              toast={push}
            />
          )}
          {screen.kind === "theme" && <ThemeScreen site={site} setSite={setSite} />}
          {screen.kind === "settings" && <SettingsScreen site={site} setSite={setSite} />}
          {screen.kind === "workspace" && (
            <Workspace
              key={`${screen.target.kind}:${screen.target.id}`}
              site={site}
              setSite={setSite}
              target={screen.target}
              isPhone={isPhone}
              toast={push}
              createTag={createTag}
              onOpen={open}
              onBack={() => go({ kind: screen.target.kind === "page" ? "pages" : "articles" })}
            />
          )}
        </main>
      </div>

      {exporting && (
        <ExportDialog
          site={site}
          onOpen={open}
          onClose={() => setExporting(false)}
          onExported={() => {
            setDownloadedAt(stamp());
            push(
              "Website exported to your Downloads folder. Upload it to your hosting to make it live.",
              "ok",
            );
          }}
        />
      )}

      <ToastHost toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
