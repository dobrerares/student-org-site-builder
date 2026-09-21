/**
 * Preview-mode link-click interceptor.
 *
 * The renderer emits this inline `<script>` ONLY when `renderSite` is called
 * with `mode: "preview"`. Built/deployed sites never carry this script —
 * navigation in deploy works against a real static-file root.
 *
 * It is emitted for EVERY preview page, including single-page sites. It used
 * to be gated on "the page has multi-page nav or a language switcher", which
 * quietly assumed nav links are the only links on a page. They are not: a
 * hero CTA, a CTA banner, a footer link or a rich-text link on a one-page
 * site all carry hrefs, and without the interceptor the first click
 * navigated the preview iframe off the editor's origin to a 404 and the user
 * lost their editor session view.
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
 * - In-page hash links (`#section`) fall through to the browser so
 *   same-document anchor scrolling keeps working inside the preview.
 * - `mailto:`, `tel:` and `sms:` fall through to the browser: they hand off
 *   to an external handler and never navigate the iframe.
 * - Any other absolute or protocol-relative URL (`https://...`, `//cdn/...`)
 *   is EXTERNAL. It is opened in a new tab (`window.open`) rather than being
 *   allowed to replace the preview document — the editor is not a browser,
 *   and a user who clicks their own partner link should not lose the editor.
 *   This needs `allow-popups` in the iframe's sandbox attribute.
 * - Everything else is an intra-site path — absolute (`/despre/`) or relative
 *   (`despre/`) — and is posted to the host as a `navigate` message. Relative
 *   paths are forwarded verbatim; the host resolves them against the page
 *   currently being previewed (it knows which page that is; the iframe, whose
 *   `document.baseURI` is the editor's own URL, does not).
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
  if (window.parent === window) return;
  document.addEventListener("click", function(e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    var a = t && t.closest ? t.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (typeof href !== "string" || href.length === 0) return;
    if (href.charAt(0) === "#") return;
    if (/^(?:mailto|tel|sms):/i.test(href)) return;
    if (href.indexOf("//") === 0 || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    e.preventDefault();
    window.parent.postMessage(
      { channel: "sosb:preview", version: 1, payload: { type: "navigate", path: href } },
      "*"
    );
  }, false);
})();`;

/** Marker attribute the renderer puts on the emitted `<script>` tag so the
 * preview-mode test (and any future host-side audit) can find it. */
export const PREVIEW_NAV_SCRIPT_MARKER = "data-sosb-preview-nav";
