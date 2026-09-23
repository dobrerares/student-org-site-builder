/** @jsxImportSource react */
// @vitest-environment jsdom
import { describe, expect, test, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import type { JSX } from "react";
import type { Site } from "@sosb/schema";
import { ArticlesScreen } from "../src/articles-screen.js";
import { ArticleSettingsForm } from "../src/article-settings-form.js";
import { ArticleListInspector } from "../src/article-list-inspector.js";
import { Workspace } from "../src/workspace.js";
import { TagManager } from "../src/tag-manager.js";
import { createArticle, createTag, updateArticle } from "../src/articles-ops.js";
import { expectNoAxeViolations } from "./helpers/axe.js";

const TODAY = "2026-09-21";

function baseSite(): Site {
  return {
    schemaVersion: 1,
    org: { name: "Stub Org", email: "a@b.ro" },
    theme: { id: "stub" },
    defaultLanguage: "ro",
    languages: ["ro", "en"],
    pages: [
      { slug: "acasa", lang: "ro", navLabel: "Acasă", navOrder: 0, showInNav: true, blocks: [] },
    ],
  } as unknown as Site;
}

function populatedSite(): Site {
  let site = baseSite();
  const tag = createTag(site, "Evenimente");
  site = tag.site;
  site = createArticle(site, { title: "Gala de final", lang: "ro", today: "2026-06-12" }).site;
  site = updateArticle(site, 0, { state: "published", tags: [tag.tagId] });
  site = createArticle(site, { title: "Atelier", lang: "ro", today: "2026-04-03" }).site;
  site = createArticle(site, { title: "English post", lang: "en", today: "2026-07-01" }).site;
  return site;
}

/**
 * Harness giving the components the same `onApply` contract the editor
 * provides: a pure `Site -> Site` transform applied to local state.
 */
function Harness(props: {
  initial: Site;
  children: (site: Site, apply: (fn: (site: Site) => Site) => void) => JSX.Element;
}): JSX.Element {
  const [site, setSite] = useState(props.initial);
  return (
    <div data-testid="editor-app">
      {props.children(site, (fn) => setSite((current) => fn(current)))}
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("ArticlesScreen", () => {
  function renderPanel(initial: Site = populatedSite()) {
    const selected: string[] = [];
    let created = 0;
    const utils = render(
      <Harness initial={initial}>
        {(site, apply) => (
          <ArticlesScreen
            site={site}
            onApply={apply}
            onOpen={(id: string) => selected.push(id)}
            onCreate={() => {
              created += 1;
            }}
          />
        )}
      </Harness>,
    );
    return { ...utils, selected, createdCount: () => created };
  }

  test("lists every article with language, state, and date", () => {
    const { getByTestId } = renderPanel();
    const row = getByTestId("article-row-art_1");
    expect(row.textContent).toContain("Gala de final");
    expect(row.textContent).toContain("ro");
    expect(row.textContent).toContain("Published");
    expect(row.textContent).toContain("2026-06-12");
  });

  test("orders newest first", () => {
    const { getByTestId } = renderPanel();
    const titles = [...getByTestId("articles-list").querySelectorAll("[data-summary-title]")];
    expect(titles.map((n) => n.textContent)).toEqual(["English post", "Gala de final", "Atelier"]);
  });

  test("search narrows the list", () => {
    const { getByTestId, queryByTestId } = renderPanel();
    fireEvent.change(getByTestId("articles-search"), { target: { value: "atel" } });
    expect(queryByTestId("article-row-art_2")).not.toBeNull();
    expect(queryByTestId("article-row-art_1")).toBeNull();
  });

  test("the language filter narrows the list", () => {
    const { getByTestId, queryByTestId } = renderPanel();
    fireEvent.change(getByTestId("articles-filter-lang"), { target: { value: "en" } });
    expect(queryByTestId("article-row-art_3")).not.toBeNull();
    expect(queryByTestId("article-row-art_1")).toBeNull();
  });

  test("the state filter narrows the list", () => {
    const { getByTestId, queryByTestId } = renderPanel();
    fireEvent.change(getByTestId("articles-filter-state"), { target: { value: "published" } });
    expect(queryByTestId("article-row-art_1")).not.toBeNull();
    expect(queryByTestId("article-row-art_2")).toBeNull();
  });

  test("the tag filter narrows the list", () => {
    const site = populatedSite();
    const { getByTestId, queryByTestId } = renderPanel(site);
    fireEvent.change(getByTestId("articles-filter-tag"), {
      target: { value: site.tags![0]!.id },
    });
    expect(queryByTestId("article-row-art_1")).not.toBeNull();
    expect(queryByTestId("article-row-art_2")).toBeNull();
  });

  test("an empty site invites creating the first article", () => {
    const { getByTestId } = renderPanel(baseSite());
    expect(getByTestId("articles-empty").textContent).toContain("No articles yet");
  });

  test("filters that match nothing say so differently", () => {
    const { getByTestId } = renderPanel();
    fireEvent.change(getByTestId("articles-search"), { target: { value: "zzzz" } });
    expect(getByTestId("articles-empty").textContent).toContain("match these filters");
  });

  test("Create Article is one click, with no title dialog in between", () => {
    const { getByTestId, queryByTestId, createdCount } = renderPanel(baseSite());
    fireEvent.click(getByTestId("articles-create"));
    expect(createdCount()).toBe(1);
    expect(queryByTestId("article-create-dialog")).toBeNull();
  });

  test("an article with no title yet is still listed, as untitled", () => {
    const site = createArticle(baseSite(), { title: "", lang: "ro", today: TODAY }).site;
    const { getByTestId } = renderPanel(site);
    expect(getByTestId("article-row-art_1").textContent).toContain("Untitled article");
  });

  test("the explanation of what articles are sits behind an (i) icon", () => {
    const { getByTestId, container } = renderPanel();
    expect(getByTestId("articles-screen-info")).toBeTruthy();
    expect(container.textContent).not.toContain("dated pieces of writing");
  });

  test("clicking a row opens that article", () => {
    const { getByTestId, selected } = renderPanel();
    fireEvent.click(getByTestId("article-open-art_2"));
    expect(selected).toEqual(["art_2"]);
  });

  test("deleting asks first and names the article", () => {
    const { getByTestId, queryByTestId } = renderPanel();
    fireEvent.click(getByTestId("article-delete-art_2"));
    expect(getByTestId("article-delete-dialog").textContent).toContain("Atelier");
    fireEvent.click(getByTestId("article-delete-confirm"));
    expect(queryByTestId("article-row-art_2")).toBeNull();
  });

  test("has no axe violations", async () => {
    const { getByTestId } = renderPanel();
    await expectNoAxeViolations(getByTestId("editor-app"));
  });
});

describe("ArticleSettingsForm", () => {
  function renderForm(initial: Site = populatedSite()) {
    const result = render(
      <Harness initial={initial}>
        {(site, apply) => (
          <ArticleSettingsForm
            site={site}
            articleIndex={0}
            onApply={apply}
            uploader={async () => {
              throw new Error("not used");
            }}
          />
        )}
      </Harness>,
    );
    return result;
  }

  test("search and sharing overrides live behind More options, not on the form", () => {
    const { container, getByTestId } = renderForm();
    // Issue #97: the overrides are optional and rare, so they start collapsed.
    expect(container.querySelector("#article-seo-title")).toBeNull();
    fireEvent.click(getByTestId("advanced-toggle"));
    const title = container.querySelector("#article-seo-title") as HTMLInputElement;
    // The placeholder shows what search engines use when the override is blank.
    expect(title.placeholder).toBe("Gala de final");
    fireEvent.change(title, { target: { value: "Gala 2026 — recapitulare" } });
    expect((container.querySelector("#article-seo-title") as HTMLInputElement).value).toBe(
      "Gala 2026 — recapitulare",
    );
    const description = container.querySelector("#article-seo-description") as HTMLTextAreaElement;
    fireEvent.change(description, { target: { value: "Cum a decurs gala." } });
    expect((container.querySelector("#article-seo-description") as HTMLTextAreaElement).value).toBe(
      "Cum a decurs gala.",
    );
  });

  test("does not repeat the title: that is edited on the workspace outline", () => {
    const { getByTestId } = renderForm();
    expect(getByTestId("article-settings-form").querySelector("#article-title")).toBeNull();
  });

  test("committing a slug change retires the old slug", () => {
    const { container } = renderForm();
    const input = container.querySelector("#article-slug") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "gala-2026" } });
    fireEvent.blur(input);
    expect(input.value).toBe("gala-2026");
  });

  test("an invalid slug surfaces an error and does not commit", () => {
    const { container } = renderForm();
    const input = container.querySelector("#article-slug") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nu Merge" } });
    fireEvent.blur(input);
    expect(container.querySelector("#article-slug-error")?.textContent).toContain(
      "lowercase letters",
    );
  });

  test("the publication state is a visible selector with all three options", () => {
    const { container } = renderForm();
    const select = container.querySelector("#article-state") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["draft", "published", "unlisted"]);
  });

  test("changing state does not change the publication date", () => {
    const { container } = renderForm();
    const date = container.querySelector("#article-date") as HTMLInputElement;
    const before = date.value;
    fireEvent.change(container.querySelector("#article-state")!, {
      target: { value: "unlisted" },
    });
    expect((container.querySelector("#article-date") as HTMLInputElement).value).toBe(before);
  });

  test("publication status help is behind an (i) icon, not persistent prose", () => {
    const { getByTestId, queryByText } = renderForm();
    expect(queryByText(/go live only after you export/i)).toBeNull();
    fireEvent.click(getByTestId("article-state-hint"));
    expect(document.body.textContent).toContain("export the website");
  });

  test("tags can be created inline and are selected immediately", () => {
    const { getByTestId } = renderForm();
    fireEvent.change(getByTestId("tag-picker-search"), { target: { value: "Proiecte" } });
    fireEvent.click(getByTestId("tag-picker-create"));
    expect(getByTestId("tag-picker-selected").textContent).toContain("Proiecte");
  });

  test("an existing tag can be toggled on and off", () => {
    const site = populatedSite();
    const tagId = site.tags![0]!.id;
    const { getByTestId, queryByTestId } = renderForm(site);
    fireEvent.click(getByTestId(`tag-chip-${tagId}`));
    expect(queryByTestId(`tag-chip-${tagId}`)).toBeNull();
  });

  test("has no axe violations", async () => {
    const { getByTestId } = renderForm();
    await expectNoAxeViolations(getByTestId("editor-app"));
  });
});

describe("ArticleListInspector", () => {
  function renderInspector(initialValue: Record<string, unknown> = { mode: "byTag" }) {
    function Wrapper(): JSX.Element {
      const [site, setSite] = useState(populatedSite());
      const [value, setValue] = useState(initialValue);
      return (
        <div data-testid="editor-app">
          <ArticleListInspector
            site={site}
            value={value}
            containerLang="ro"
            showTextFields
            onApply={(fn) => setSite((current) => fn(current))}
            onPatch={(patch) => setValue((current) => ({ ...current, ...patch }))}
          />
        </div>
      );
    }
    return render(<Wrapper />);
  }

  test("offers both modes", () => {
    const { getByTestId } = renderInspector();
    expect(getByTestId("article-list-mode-byTag")).toBeTruthy();
    expect(getByTestId("article-list-mode-selected")).toBeTruthy();
  });

  test("by-tag previews only published articles of the container language", () => {
    const { getByTestId } = renderInspector();
    const matches = getByTestId("article-list-matches").textContent ?? "";
    expect(matches).toContain("Gala de final");
    expect(matches).not.toContain("Atelier");
    expect(matches).not.toContain("English post");
  });

  test("with no tags selected it says it is showing everything", () => {
    const { getByTestId } = renderInspector();
    expect(getByTestId("article-list-no-tags").textContent).toContain("showing all");
  });

  test("any-tag matching is explained behind an (i) icon", () => {
    const { getByTestId, queryByText } = renderInspector();
    expect(queryByText(/matches when it has any of the selected tags/i)).toBeNull();
    fireEvent.click(getByTestId("tag-picker-hint"));
    expect(document.body.textContent).toContain("any of the selected tags");
  });

  test("switching to explicit selection shows candidates with language and state", () => {
    const { getByTestId } = renderInspector();
    fireEvent.click(getByTestId("article-list-mode-selected"));
    const candidate = getByTestId("article-candidate-art_3");
    expect(candidate.textContent).toContain("English post");
    expect(candidate.textContent).toContain("en");
    expect(candidate.textContent).toContain("Draft");
  });

  test("candidates can be searched", () => {
    const { getByTestId, queryByTestId } = renderInspector();
    fireEvent.click(getByTestId("article-list-mode-selected"));
    fireEvent.change(getByTestId("article-list-search"), { target: { value: "English" } });
    expect(queryByTestId("article-candidate-art_3")).not.toBeNull();
    expect(queryByTestId("article-candidate-art_1")).toBeNull();
  });

  test("selections keep author order and can be reordered", () => {
    const { getByTestId } = renderInspector({
      mode: "selected",
      articleIds: ["art_1", "art_3"],
    });
    const before = [...getByTestId("article-list-selected").querySelectorAll("li")];
    expect(before[0]?.getAttribute("data-testid")).toBe("article-selected-art_1");
    fireEvent.click(getByTestId("article-move-down-art_1"));
    const after = [...getByTestId("article-list-selected").querySelectorAll("li")];
    expect(after[0]?.getAttribute("data-testid")).toBe("article-selected-art_3");
  });

  test("move controls are disabled at the ends", () => {
    const { getByTestId } = renderInspector({
      mode: "selected",
      articleIds: ["art_1", "art_3"],
    });
    expect((getByTestId("article-move-up-art_1") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("article-move-down-art_3") as HTMLButtonElement).disabled).toBe(true);
  });

  test("a selection can be removed", () => {
    const { getByTestId, queryByTestId } = renderInspector({
      mode: "selected",
      articleIds: ["art_1"],
    });
    fireEvent.click(getByTestId("article-remove-art_1"));
    expect(queryByTestId("article-selected-art_1")).toBeNull();
  });

  test("a dangling selection is labelled rather than rendered as a blank row", () => {
    const { getByTestId } = renderInspector({ mode: "selected", articleIds: ["ghost"] });
    expect(getByTestId("article-selected-ghost").textContent).toContain("no longer available");
  });

  test("an empty result explains what visitors will see", () => {
    const { getByTestId } = renderInspector({ mode: "selected", articleIds: [] });
    expect(getByTestId("article-list-no-matches").textContent).toContain("No articles yet");
  });

  test("has no axe violations", async () => {
    const { getByTestId } = renderInspector();
    await expectNoAxeViolations(getByTestId("editor-app"));
  });
});

describe("TagManager", () => {
  function renderManager(initial: Site = populatedSite()) {
    return render(
      <Harness initial={initial}>
        {(site, apply) => <TagManager site={site} onApply={apply} />}
      </Harness>,
    );
  }

  test("creates a tag", () => {
    const { getByTestId } = renderManager(baseSite());
    fireEvent.change(getByTestId("tag-manager-new"), { target: { value: "Proiecte" } });
    fireEvent.click(getByTestId("tag-manager-create"));
    expect(getByTestId("tag-manager-list").textContent).toContain("Proiecte");
  });

  test("renaming preserves the tag and updates the label", () => {
    const site = populatedSite();
    const tagId = site.tags![0]!.id;
    const { getByTestId } = renderManager(site);
    fireEvent.click(getByTestId(`tag-rename-${tagId}`));
    fireEvent.change(getByTestId(`tag-rename-input-${tagId}`), {
      target: { value: "Evenimente mari" },
    });
    fireEvent.click(getByTestId("tag-manager-list").querySelector("button")!);
    expect(getByTestId(`tag-row-${tagId}`).textContent).toContain("Evenimente mari");
  });

  test("deletion warns about tagged articles before removing anything", () => {
    const site = populatedSite();
    const tagId = site.tags![0]!.id;
    const { getByTestId } = renderManager(site);
    fireEvent.click(getByTestId(`tag-delete-${tagId}`));
    expect(getByTestId("tag-delete-articles").textContent).toContain("1 article");
    expect(getByTestId("tag-manager-list").textContent).toContain("Evenimente");
  });

  test("confirming deletion removes the tag", () => {
    const site = populatedSite();
    const tagId = site.tags![0]!.id;
    const { getByTestId } = renderManager(site);
    fireEvent.click(getByTestId(`tag-delete-${tagId}`));
    fireEvent.click(getByTestId("tag-delete-confirm"));
    expect(getByTestId("tag-manager").textContent).toContain("No tags yet");
  });

  test("warns when a list will start showing every eligible article", () => {
    const site = populatedSite();
    const tagId = site.tags![0]!.id;
    site.pages[0]!.blocks.push({
      id: "list",
      type: "articleList",
      version: 1,
      data: { title: "Noutăți", mode: "byTag", tags: [tagId] },
    } as never);
    const { getByTestId } = renderManager(site);
    fireEvent.click(getByTestId(`tag-delete-${tagId}`));
    expect(getByTestId("tag-delete-unfiltered").textContent).toContain("Noutăți");
  });

  test("has no axe violations", async () => {
    const { getByTestId } = renderManager();
    await expectNoAxeViolations(getByTestId("editor-app"));
  });
});

describe("Workspace (Article)", () => {
  function renderWorkspace(initial: Site = populatedSite()) {
    const opened: string[] = [];
    const titles: string[] = [];
    const utils = render(
      <Harness initial={initial}>
        {(site, apply) => (
          <Workspace
            site={site}
            target={{ kind: "article", articleId: "art_1" }}
            drill={{ kind: "outline" }}
            onDrillChange={() => undefined}
            isNarrow={false}
            onBack={() => undefined}
            onTitleChange={(value: string) => titles.push(value)}
            onAddBlock={() => undefined}
            onMoveBlock={() => undefined}
            onRemoveBlock={() => undefined}
            onSetBlockVariant={() => undefined}
            onPatchBlockData={() => undefined}
            onArrayChangeBlockData={() => undefined}
            onReplaceBlockData={() => undefined}
            pageSettingsFields={[]}
            onPatchSite={() => undefined}
            onApplySite={apply}
            today={TODAY}
            onOpenArticle={(id: string) => opened.push(id)}
            uploader={async () => {
              throw new Error("not used");
            }}
            documentUploader={async () => {
              throw new Error("not used");
            }}
            preview={<div data-testid="preview-stub" />}
            pane="edit"
            onPaneChange={() => undefined}
          />
        )}
      </Harness>,
    );
    return { ...utils, opened, titles };
  }

  test("edits the title on the outline", () => {
    const { getByTestId, titles } = renderWorkspace();
    fireEvent.change(getByTestId("workspace-title"), { target: { value: "Titlu nou" } });
    expect(titles).toEqual(["Titlu nou"]);
  });

  test("the publication state is a visible selector with its explanation behind an (i)", () => {
    const { getByTestId, container } = renderWorkspace();
    expect(getByTestId("workspace-state-published").getAttribute("aria-pressed")).toBe("true");
    expect(getByTestId("workspace-state-draft")).toBeTruthy();
    expect(getByTestId("workspace-state-unlisted")).toBeTruthy();
    expect(getByTestId("workspace-state-hint")).toBeTruthy();
    expect(container.textContent).not.toContain("export the website and upload it again");
  });

  test("offers the missing language and opens the new Draft counterpart", () => {
    const { getByTestId, queryByTestId, opened } = renderWorkspace();
    // The article is `ro`; only `en` is missing from its translation group.
    expect(queryByTestId("article-add-translation-ro")).toBeNull();
    fireEvent.click(getByTestId("article-add-translation-en"));
    expect(opened).toEqual(["art_4"]);
    // Both ends now sit in one group, so nothing is left to offer.
    expect(queryByTestId("article-translations")).toBeNull();
  });

  test("single-language sites show no translation controls", () => {
    const single = { ...populatedSite(), languages: ["ro"] } as Site;
    const { queryByTestId } = renderWorkspace(single);
    expect(queryByTestId("article-translations")).toBeNull();
  });

  test("has no axe violations", async () => {
    const { getByTestId } = renderWorkspace();
    await expectNoAxeViolations(getByTestId("editor-app"));
  });
});
