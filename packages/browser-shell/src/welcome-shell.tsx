import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { parseSite, type Site } from "@sosb/schema";
import type { Vfs } from "@sosb/vfs/vfs";
import { loadAutosave, saveAutosave } from "@sosb/editor-state";
import { EditorApp } from "@sosb/editor-app";
import { TEMPLATES } from "@sosb/themes";
import {
  clearWizardProgress,
  loadWizardProgress,
  saveWizardProgress,
  Wizard,
  type WizardState,
} from "@sosb/wizard";

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
  /** Optional drag/drop import flow for a user-supplied saved-site zip file. */
  readonly onImportFile?: (file: File) => Promise<Site | WelcomeLoadedSite | null>;
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
  const [wizardProgress, setWizardProgress] = useState<WizardState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDraft(): Promise<void> {
      try {
        const vfs = props.draftVfs ?? (await openPreferredPersistentVfs());
        if (cancelled) return;
        setDraftVfs(vfs);

        const rawSite = await loadAutosave(vfs);
        if (!cancelled && rawSite !== null) {
          const site = parseSite(rawSite);
          setDraft({ site, assetVfs: vfs, autosaveVfs: vfs });
        }

        const savedWizardProgress = await loadWizardProgress(vfs);
        if (!cancelled) setWizardProgress(savedWizardProgress);
      } catch {
        if (!cancelled) {
          setDraft(null);
          setWizardProgress(null);
        }
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

  async function importFile(file: File): Promise<void> {
    if (props.onImportFile === undefined) return;
    setImportError(null);
    try {
      const site = await props.onImportFile(file);
      if (site !== null) await openEditor(site);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not open that saved site.");
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

  function persistWizardProgress(state: WizardState): void {
    setWizardProgress(state);
    if (draftVfs !== null) {
      void saveWizardProgress(draftVfs, state);
    }
  }

  async function clearSavedWizardProgress(): Promise<void> {
    setWizardProgress(null);
    if (draftVfs !== null) {
      await clearWizardProgress(draftVfs);
    }
  }

  async function finishWizard(site: Site): Promise<void> {
    await clearSavedWizardProgress();
    await openEditor(site);
  }

  function cancelWizard(): void {
    setWizardProgress(null);
    if (draftVfs !== null) {
      void clearWizardProgress(draftVfs);
    }
    setMode({ kind: "welcome" });
  }

  if (mode.kind === "wizard") {
    return (
      <Wizard
        {...(wizardProgress === null ? {} : { initial: wizardProgress })}
        onProgress={persistWizardProgress}
        onComplete={(site) => {
          void finishWizard(site);
        }}
        onCancel={cancelWizard}
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
  const canDropImport = props.onImportFile !== undefined;

  return (
    <main
      data-testid="welcome-screen"
      onDragOver={(event: JSX.TargetedDragEvent<HTMLElement>) => {
        if (!canDropImport || !event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
      }}
      onDrop={(event: JSX.TargetedDragEvent<HTMLElement>) => {
        if (!canDropImport) return;
        const file = firstZipFile(event.dataTransfer?.files);
        event.preventDefault();
        if (file === null) {
          setImportError("Drop a .zip file downloaded from this app.");
          return;
        }
        void importFile(file);
      }}
    >
      <header>
        <h1>Build your organisation&apos;s website</h1>
        <p>Make a clean site, keep your files, and download a copy when you are ready.</p>
        {canDropImport ? (
          <p data-testid="welcome-drop-hint">Drop a saved .zip here to open it.</p>
        ) : null}
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
            <span data-action-title>Continue draft</span>
            <span data-action-detail>Saved in this browser</span>
          </button>
        ) : null}
        <button
          type="button"
          data-testid="welcome-action-wizard"
          onClick={() => setMode({ kind: "wizard" })}
        >
          <span data-action-title>
            {wizardProgress === null ? "Answer a few questions" : "Continue setup"}
          </span>
          <span data-action-detail>Best when you are making a new site</span>
        </button>
        <button
          type="button"
          data-testid="welcome-action-template"
          disabled={primaryTemplate === undefined}
          onClick={() => {
            if (primaryTemplate !== undefined) {
              void openEditor(templateSiteForEditing(primaryTemplate.data));
            }
          }}
        >
          <span data-action-title>Use a ready-made example</span>
          <span data-action-detail>Start with useful pages and sections</span>
        </button>
        <button
          type="button"
          data-testid="welcome-action-import"
          disabled={props.onImportSite === undefined}
          onClick={() => {
            void importSite();
          }}
        >
          <span data-action-title>Open a saved site</span>
          <span data-action-detail>
            {props.onImportSite === undefined
              ? "Saved-site opening is unavailable here"
              : "Choose the .zip file you downloaded earlier"}
          </span>
        </button>
        <button
          type="button"
          data-testid="welcome-action-blank"
          onClick={() => {
            void openEditor(structuredClone(props.blankSite));
          }}
        >
          <span data-action-title>Start from scratch</span>
          <span data-action-detail>Begin with the minimum site</span>
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

function firstZipFile(files: FileList | undefined): File | null {
  if (files === undefined || files.length === 0) return null;
  const list = Array.from(files);
  return (
    list.find(
      (file) =>
        file.name.toLowerCase().endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed",
    ) ?? null
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

function templateSiteForEditing(site: Site): Site {
  const copy = structuredClone(site);
  const org = copy.org as Record<string, unknown>;
  removePlaceholderAsset(org, "logo");
  if (org.logo === undefined) delete org.logoAlt;

  for (const page of copy.pages) {
    page.blocks = page.blocks.filter((block) => !isPlaceholderTemplateEmbed(block));
    for (const block of page.blocks) {
      const data = block.data as Record<string, unknown>;
      switch (block.type) {
        case "hero":
          removePlaceholderAsset(data, "backgroundImage");
          if (data.backgroundImage === undefined) delete data.backgroundAlt;
          break;
        case "activitiesList":
          removePlaceholderAssetFromItems(data.items, "image");
          break;
        case "teamGrid":
          removePlaceholderAssetFromItems(data.people, "photo");
          break;
        case "imageGallery":
          data.images = withoutPlaceholderAssetItems(data.images, "asset");
          break;
        case "quote":
          removePlaceholderAsset(data, "authorImage");
          break;
        case "ctaBanner":
          removePlaceholderAsset(data, "backgroundImage");
          break;
        case "partnerLogos":
          data.partners = withoutPlaceholderAssetItems(data.partners, "logo");
          break;
        case "siteFooter":
          if (data.membership !== null && typeof data.membership === "object") {
            removePlaceholderAsset(data.membership as Record<string, unknown>, "logo");
          }
          break;
        case "documentDownloads":
          data.files = withoutPlaceholderAssetItems(data.files, "asset");
          break;
        case "eventList":
          removePlaceholderAssetFromItems(data.events, "image");
          break;
      }
    }
  }

  return copy;
}

function removePlaceholderAsset(record: Record<string, unknown>, key: string): void {
  if (isPlaceholderTemplateAsset(record[key])) delete record[key];
}

function removePlaceholderAssetFromItems(items: unknown, key: string): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item !== null && typeof item === "object") {
      removePlaceholderAsset(item as Record<string, unknown>, key);
    }
  }
}

function withoutPlaceholderAssetItems(items: unknown, key: string): unknown[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (item === null || typeof item !== "object") return true;
    return !isPlaceholderTemplateAsset((item as Record<string, unknown>)[key]);
  });
}

function isPlaceholderTemplateAsset(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const path = (value as { readonly path?: unknown }).path;
  return typeof path === "string" && path.startsWith("assets/placeholder-");
}

function isPlaceholderTemplateEmbed(block: Site["pages"][number]["blocks"][number]): boolean {
  if (block.type !== "embed") return false;
  const url = (block.data as { readonly url?: unknown }).url;
  return typeof url === "string" && url.toLowerCase().includes("placeholder");
}
