/**
 * Shared axe-core harness for the editor's accessibility tests.
 *
 * Every editor a11y suite wants the same two adjustments, and they are
 * easy to get subtly different when copied:
 *
 *  - **Colour contrast off.** jsdom does not compute styles, so contrast
 *    results are noise. The renderer's own a11y tests follow the same
 *    convention. Structural and semantic rules — landmarks, labels, button
 *    accessibility, ARIA, keyboard reach — all still run.
 *  - **Base UI focus guards excluded.** Base UI brackets a dialog popup
 *    with two visually hidden `role="button"` sentinels
 *    (`data-base-ui-focus-guard`). They exist to catch focus leaving the
 *    trap, are never reachable as commands, and are empty by construction,
 *    so axe's `aria-command-name` rule fires on an upstream implementation
 *    detail we do not author. Giving them names would be inventing UI to
 *    satisfy a checker. Everything we do author is still audited.
 */
import axe from "axe-core";

/** Run axe over `node` with the editor's standard configuration. */
export async function runEditorAxe(node: Element): Promise<axe.AxeResults> {
  return axe.run(
    {
      include: [node],
      exclude: [["[data-base-ui-focus-guard]"]],
    },
    {
      rules: {
        "color-contrast": { enabled: false },
      },
    },
  );
}

/** Assert `node` has zero axe violations under that configuration. */
export async function expectNoAxeViolations(node: Element): Promise<void> {
  const results = await runEditorAxe(node);
  // Surface rule ids in the failure message; the raw violation objects are
  // hundreds of lines and bury the actual problem.
  const summary = results.violations.map((violation) => violation.id);
  if (summary.length > 0) {
    throw new Error(
      `axe violations: ${summary.join(", ")}\n${JSON.stringify(results.violations, null, 2)}`,
    );
  }
}
