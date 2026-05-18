/**
 * Preview-mode nav-click interceptor.
 *
 * The renderer emits this inline `<script>` ONLY when `renderSite` is called
 * with `mode: "preview"` (and the page has multi-page nav). Built/deployed
 * sites never carry this script — navigation in deploy works against a real
 * static-file root.
 *
 * Why it exists
 * -------------
 * The editor's preview iframe is loaded via `srcdoc` (no backing server).
 * When a user clicks `<a href="/about/">` inside the preview, the browser
 * resolves the absolute path against the parent document's origin and
 * navigates the iframe to e.g. `http://editor-origin/about/` — which the
 * editor's dev server does not serve → 404. This script intercepts those
 * clicks, calls `e.preventDefault()`, and posts the path back to the host
 * via the existing preview-bridge envelope; the host swaps the active page
 * instead of letting the iframe navigate.
 *
 * Protocol coupling
 * -----------------
 * The envelope shape (`{ channel, version, payload }`) is duplicated from
 * `@sosb/preview-bridge` deliberately — the renderer cannot depend on the
 * bridge (the renderer is supposed to be self-contained, and the bridge is
 * editor-side infrastructure). If `PREVIEW_BRIDGE_VERSION` is ever bumped,
 * update this script in lockstep. The protocol-coupling regression test in
 * `preview-mode.test.ts` asserts the channel + payload type strings appear
 * verbatim in the emitted script.
 *
 * Behaviour contract
 * ------------------
 * - Listens to `click` on `document` (event delegation; catches future DOM
 *   mutations without re-wiring).
 * - Filters to anchor elements with a same-origin absolute path href
 *   (`href` starts with `/` but not `//`). Hash links (`#section`),
 *   protocol-relative (`//cdn`), and absolute URLs (`http://...`,
 *   `mailto:`, `tel:`) fall through to normal browser behaviour.
 * - Skips modifier clicks (ctrl/cmd/shift/middle-button) so power users can
 *   still open links in a new tab — though in a sandboxed iframe most of
 *   that won't fire anyway.
 * - When in a top-level window (`window.parent === window`), no-ops — this
 *   is a belt-and-suspenders guard; the script should never be emitted into
 *   a top-level deploy.
 */

// Channel + version literal MUST match @sosb/preview-bridge's
// PREVIEW_BRIDGE_CHANNEL / PREVIEW_BRIDGE_VERSION.
export const PREVIEW_NAV_SCRIPT = `(function(){
  document.addEventListener("click", function(e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    var a = t && t.closest ? t.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (typeof href !== "string" || href.length === 0) return;
    if (href.charAt(0) !== "/" || href.indexOf("//") === 0) return;
    e.preventDefault();
    if (window.parent === window) return;
    window.parent.postMessage(
      { channel: "sosb:preview", version: 1, payload: { type: "navigate", path: href } },
      "*"
    );
  }, false);
})();`;

/** Marker attribute the renderer puts on the emitted `<script>` tag so the
 * preview-mode test (and any future host-side audit) can find it. */
export const PREVIEW_NAV_SCRIPT_MARKER = "data-sosb-preview-nav";
