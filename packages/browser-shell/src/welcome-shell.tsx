import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { parseSite, type Site } from "@sosb/schema";
import type { Vfs } from "@sosb/vfs/vfs";
import { loadAutosave, saveAutosave } from "@sosb/editor-state";
import { EditorApp } from "@sosb/editor-app";
import { TEMPLATES } from "@sosb/themes";
import { Wizard } from "@sosb/wizard";

import { openPreferredPersistentVfs } from "./persistent-vfs/preferred.js";
import "./welcome-shell-css.js";

export interface WelcomeLoadedSite {
  readonly site: Site;
  readonly assetVfs?: Vfs;
  readonly autosaveVfs?: Vfs;
}

export interface WelcomeShellProps {
  /** Blank/new-site seed used by the "Start blank" action. */
  readonly blankSite: Site;
  /** Most recent sites, already resolved by the host shell. */
  readonly recentSites?: readonly string[];
  /** Import flow supplied by the host; returns a Site or null when cancelled. */
  readonly onImportSite?: () => Promise<Site | WelcomeLoadedSite | null>;
  /** Recent-site opener supplied by Electron/host shells that can resolve paths. */
  readonly onOpenRecent?: (
    entry: string,
  ) => Promise<Site | WelcomeLoadedSite | null> | Site | WelcomeLoadedSite | null;
  /** Optional draft store override, mainly for tests and native shells. */
  readonly draftVfs?: Vfs;
}

type ShellMode =
  | { readonly kind: "welcome" }
  | { readonly kind: "wizard" }
  | {
      readonly kind: "editor";
      readonly site: Site;
      readonly assetVfs?: Vfs;
      readonly autosaveVfs?: Vfs;
    };

export function WelcomeShell(props: WelcomeShellProps): JSX.Element {
  const [mode, setMode] = useState<ShellMode>({ kind: "welcome" });
  const [importError, setImportError] = useState<string | null>(null);
  const [draftVfs, setDraftVfs] = useState<Vfs | null>(props.draftVfs ?? null);
  const [draft, setDraft] = useState<WelcomeLoadedSite | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDraft(): Promise<void> {
      try {
        const vfs = props.draftVfs ?? (await openPreferredPersistentVfs());
        if (cancelled) return;
        setDraftVfs(vfs);

        const rawSite = await loadAutosave(vfs);
        if (cancelled || rawSite === null) return;
        const site = parseSite(rawSite);
        setDraft({ site, assetVfs: vfs, autosaveVfs: vfs });
      } catch {
        if (!cancelled) setDraft(null);
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [props.draftVfs]);

  async function importSite(): Promise<void> {
    if (props.onImportSite === undefined) return;
    setImportError(null);
    try {
      const site = await props.onImportSite();
      if (site !== null) await openEditor(site);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function openRecent(entry: string): Promise<void> {
    if (props.onOpenRecent === undefined) return;
    const site = await props.onOpenRecent(entry);
    if (site !== null) await openEditor(site);
  }

  async function openEditor(input: Site | WelcomeLoadedSite): Promise<void> {
    const loaded = normalizeLoadedSite(input);
    const persistentVfs = loaded.autosaveVfs ?? draftVfs ?? undefined;
    let assetVfs = loaded.assetVfs ?? persistentVfs;

    if (persistentVfs !== undefined) {
      if (loaded.assetVfs !== undefined && loaded.assetVfs !== persistentVfs) {
        await copyAssets(loaded.assetVfs, persistentVfs);
        assetVfs = persistentVfs;
      }
      await saveAutosave(persistentVfs, loaded.site);
      setDraft({ site: loaded.site, assetVfs: persistentVfs, autosaveVfs: persistentVfs });
    }

    setMode({
      kind: "editor",
      site: loaded.site,
      ...(assetVfs === undefined ? {} : { assetVfs }),
      ...(persistentVfs === undefined ? {} : { autosaveVfs: persistentVfs }),
    });
  }

  if (mode.kind === "wizard") {
    return (
      <Wizard
        onComplete={(site) => {
          void openEditor(site);
        }}
        onCancel={() => setMode({ kind: "welcome" })}
      />
    );
  }

  if (mode.kind === "editor") {
    return (
      <EditorApp
        initial={mode.site}
        {...(mode.assetVfs === undefined ? {} : { initialAssetVfs: mode.assetVfs })}
        {...(mode.autosaveVfs === undefined ? {} : { autosaveVfs: mode.autosaveVfs })}
      />
    );
  }

  const primaryTemplate = TEMPLATES[0];

  return (
    <main data-testid="welcome-screen">
      <header>
        <h1>Build your organisation&apos;s website</h1>
        <p>No backend, no lock-in, no hosting fees.</p>
      </header>

      <nav aria-label="Start options">
        {draft !== null ? (
          <button
            type="button"
            data-testid="welcome-action-continue"
            onClick={() => {
              void openEditor({
                site: structuredClone(draft.site),
                ...(draft.assetVfs === undefined ? {} : { assetVfs: draft.assetVfs }),
                ...(draft.autosaveVfs === undefined ? {} : { autosaveVfs: draft.autosaveVfs }),
              });
            }}
          >
            Continue draft
          </button>
        ) : null}
        <button
          type="button"
          data-testid="welcome-action-wizard"
          onClick={() => setMode({ kind: "wizard" })}
        >
          Start the guided wizard
        </button>
        <button
          type="button"
          data-testid="welcome-action-template"
          disabled={primaryTemplate === undefined}
          onClick={() => {
            if (primaryTemplate !== undefined) {
              void openEditor(structuredClone(primaryTemplate.data));
            }
          }}
        >
          Start from a template
        </button>
        <button
          type="button"
          data-testid="welcome-action-import"
          disabled={props.onImportSite === undefined}
          onClick={() => {
            void importSite();
          }}
        >
          Import an existing site
        </button>
        <button
          type="button"
          data-testid="welcome-action-blank"
          onClick={() => {
            void openEditor(structuredClone(props.blankSite));
          }}
        >
          Start blank
        </button>
      </nav>

      {importError !== null ? (
        <p data-testid="welcome-import-error" role="alert">
          {importError}
        </p>
      ) : null}

      <section data-testid="welcome-recent-sites" aria-labelledby="welcome-recent-title">
        <h2 id="welcome-recent-title">Recent sites</h2>
        {props.recentSites !== undefined && props.recentSites.length > 0 ? (
          <ol>
            {props.recentSites.map((entry) => (
              <li key={entry}>
                <button
                  type="button"
                  data-testid="welcome-recent-site"
                  disabled={props.onOpenRecent === undefined}
                  onClick={() => {
                    void openRecent(entry);
                  }}
                >
                  {entry}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>No recent sites yet.</p>
        )}
      </section>
    </main>
  );
}

function normalizeLoadedSite(site: Site | WelcomeLoadedSite): WelcomeLoadedSite {
  if (isWelcomeLoadedSite(site)) return site;
  return { site };
}

function isWelcomeLoadedSite(value: Site | WelcomeLoadedSite): value is WelcomeLoadedSite {
  if (typeof value !== "object" || value === null || !("site" in value)) return false;
  return isSite((value as { readonly site: unknown }).site);
}

function isSite(value: unknown): value is Site {
  return typeof value === "object" && value !== null && "schemaVersion" in value && "org" in value;
}

async function copyAssets(source: Vfs, target: Vfs): Promise<void> {
  const paths = await source.list("assets/");
  for (const path of paths) {
    await target.write(path, await source.read(path));
  }
}
