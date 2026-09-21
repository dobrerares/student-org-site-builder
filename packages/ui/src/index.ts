/**
 * `@sosb/ui` — the shared builder UI package.
 *
 * shadcn-style React components built on Base UI primitives (ADR 0049),
 * plus the builder stylesheet. Used by `@sosb/editor-app`, `@sosb/wizard`
 * and `@sosb/browser-shell`'s welcome interface.
 *
 * Boundary rules:
 *
 *  - **Builder only.** Nothing here may be imported by `@sosb/renderer`,
 *    `@sosb/build`, or any code that produces public-site output. The
 *    builder stylesheet is a separate artifact from the public-site Theme
 *    CSS and must never appear in an export. `packages/build/test/
 *    no-builder-css.test.ts` enforces this.
 *  - **Presentation only.** No Site awareness, no schema knowledge. Site-
 *    aware adapters and ADR 0043 schema-form overrides stay in
 *    `@sosb/editor-app`.
 *  - **Offline.** No network at runtime: no web fonts, no icon CDN, no
 *    telemetry. The compiled stylesheet ships as bytes inside the bundle.
 *
 * Styles reach a shell one of two ways:
 *
 *  - `import "@sosb/ui/styles.css"` — for entry points that run through a
 *    CSS-aware bundler (the Vite dev server, the esbuild archival bundle,
 *    the Electron renderer bundle).
 *  - `import { injectBuilderCss } from "@sosb/ui/css"` — for hosts with no
 *    CSS pipeline. Matches the existing `editor-app-css.ts` idiom.
 */
export { cn } from "./lib/cn.js";

export { Button, buttonVariants, type ButtonProps } from "./components/button.js";
export {
  Input,
  NativeSelect,
  Textarea,
  type InputProps,
  type NativeSelectProps,
  type TextareaProps,
} from "./components/input.js";
export { Hint, Label, type HintProps, type LabelProps } from "./components/label.js";
export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "./components/dialog.js";
export {
  Popover,
  PopoverClose,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
} from "./components/popover.js";
export { Select } from "./components/select.js";
export { Tabs, TabsList, TabsPanel, TabsRoot, TabsTab } from "./components/tabs.js";
export { Toast, ToastProvider, ToastViewport, useToast } from "./components/toast.js";
