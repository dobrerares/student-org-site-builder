import type { FieldNode } from "./form-generator.js";

/**
 * Rewrite the synthetic `[]` segment inside an element-template node so its
 * path points at a concrete array index. The traversal recurses through
 * nested objects/arrays so deeply-nested item subtrees still resolve.
 *
 * Shared by `BlockForm` (array items inside block data) and `SpineForm`
 * (site-level arrays such as `org.social`, and the per-page settings form
 * that rebases `pages.[]` onto the active page index).
 */
export function rebaseElement(node: FieldNode, basePath: (string | number)[]): FieldNode {
  function rebase(n: FieldNode, prefix: (string | number)[]): FieldNode {
    const newPath = prefix;
    switch (n.kind) {
      case "object":
        return {
          ...n,
          path: newPath,
          fields: n.fields.map((c) => rebase(c, [...newPath, c.name])),
        };
      case "array":
        return { ...n, path: newPath, element: rebase(n.element, [...newPath, "[]"]) };
      default:
        return { ...n, path: newPath };
    }
  }
  return rebase(node, basePath);
}
