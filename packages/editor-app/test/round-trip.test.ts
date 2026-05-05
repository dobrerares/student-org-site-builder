import { describe, expect, test } from "vitest";
import { MemoryDriver } from "@sosb/vfs";
import { exportToZip, importFromZip } from "@sosb/zip";
import type { Site } from "@sosb/schema";

import minimal from "./fixtures/minimal-site.json" with { type: "json" };
import { createEditorState } from "@sosb/editor-state";

const baseSite = minimal as unknown as Site;

/**
 * AC: import → edit → export → re-import yields the last-saved state.
 *
 * This test wires the editor's components end-to-end: state is loaded from
 * a zip, mutated through `EditorState`, exported back to a zip, and finally
 * re-imported. The re-imported state must equal the state at export time.
 */
describe("import → edit → export → re-import identity", () => {
  test("re-imported siteData equals the last edit before export", async () => {
    // Build a starter zip from the fixture.
    const startBlob = await exportToZip(baseSite, new MemoryDriver());

    // Import.
    const imported = await importFromZip(startBlob);
    const state = createEditorState({ initial: imported.siteData });

    // Edit.
    state.update((draft) => {
      draft.org.name = "Renamed Org";
      draft.org.tagline = "Edited tagline";
    });
    const lastEdit = state.getSnapshot();

    // Export.
    const exported = await exportToZip(lastEdit, imported.vfs);

    // Re-import.
    const round2 = await importFromZip(exported);

    // The re-imported siteData equals the last edit, byte-for-byte.
    expect(round2.siteData).toEqual(lastEdit);
    expect(round2.siteData.org.name).toBe("Renamed Org");
    expect(round2.siteData.org.tagline).toBe("Edited tagline");
  });
});
