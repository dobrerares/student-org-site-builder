/**
 * Preview-mode in-place update receiver.
 *
 * The renderer emits this inline `<script>` ONLY when `renderSite` is called
 * with `mode: "preview"`. Built/deployed sites never carry it.
 *
 * Why it exists
 * -------------
 * The editor used to refresh the preview by reassigning the iframe's
 * `srcdoc` on every snapshot change. `srcdoc` reassignment tears down and
 * rebuilds the whole document, so every keystroke in a form reset the
 * preview's scroll position to the top, collapsed any FAQ the user had
 * opened, closed the lightbox, and dropped focus. On a long page the content
 * being edited jumped out of view on every character typed.
 *
 * ADR 0005 left the receiving half of the preview bridge unbuilt ("v1 has no
 * iframe-side message listener ... the hook is in place"). This is that half.
 * The host still renders with the real renderer — there is exactly one
 * renderer code path, as ADR 0005 requires — but it now posts the resulting
 * HTML over the bridge instead of reassigning `srcdoc`, and this script
 * applies it to the live document with an idempotent DOM diff.
 *
 * The host falls back to a full `srcdoc` reload when the theme, the page, or
 * the language changes; those are the cases where preserving in-page state is
 * meaningless or actively wrong.
 *
 * Provenance of the diff
 * ----------------------
 * The algorithm follows the approach of **morphdom** (MIT licence,
 * https://github.com/patrick-steele-idem/morphdom): walk the old and new
 * trees in parallel, match children positionally with an `id`-keyed lookahead,
 * and patch attributes and text in place rather than replacing nodes. It is a
 * compact reimplementation (not a vendored copy) because the preview needs
 * three rules morphdom has no opinion about, all of them load-bearing here:
 *
 *  1. **Never touch a `<script>`.** Scripts are neither modified nor removed,
 *     so the renderer's lightbox / FAQ / event-list bootstraps are never
 *     re-executed and can never double-bind their listeners. A script present
 *     in the new HTML but absent from the live document (the user just added
 *     the first gallery with a lightbox) is appended once, which runs it
 *     exactly once.
 *  2. **Never clobber user-created state.** `<details open>` (an FAQ the user
 *     opened) and the lightbox's `hidden` / `data-open` attributes describe
 *     live state the freshly-rendered HTML cannot know about. An open
 *     lightbox's subtree is left alone entirely — it is showing an image the
 *     user chose.
 *  3. **Update `<style>` and `<title>` through `textContent`.** Replacing the
 *     theme's `<style>` element would drop and re-add the entire stylesheet,
 *     which flashes the page and resets scroll anchoring.
 *
 * Scroll position is captured before the diff and restored after it, so an
 * edit that changes the height of content above the viewport does not shift
 * what the user is looking at.
 *
 * Protocol coupling
 * -----------------
 * The envelope shape (`{ channel, version, payload }`) is duplicated from
 * `@sosb/preview-bridge` deliberately — the renderer cannot depend on the
 * bridge (the renderer is self-contained; the bridge is editor-side
 * infrastructure). If `PREVIEW_BRIDGE_VERSION` is ever bumped, update this
 * script in lockstep. `preview-morph.test.ts` asserts the channel and payload
 * type strings appear verbatim in the emitted script.
 *
 * Testing hook
 * ------------
 * The script assigns its `apply(html)` entry point to
 * `window.__sosbPreviewMorph` so the unit tests can drive the diff directly
 * in jsdom without going through `postMessage`.
 */

// Channel + version literal MUST match @sosb/preview-bridge's
// PREVIEW_BRIDGE_CHANNEL / PREVIEW_BRIDGE_VERSION.
export const PREVIEW_MORPH_SCRIPT = `(function(){
  if (window.parent === window) return;
  var CH = "sosb:preview", V = 1;

  function post(payload) {
    window.parent.postMessage({ channel: CH, version: V, payload: payload }, "*");
  }

  function isScript(n) { return n.nodeType === 1 && n.tagName === "SCRIPT"; }
  function skipScripts(n) { while (n && isScript(n)) n = n.nextSibling; return n; }

  function preserved(el, name) {
    if (el.tagName === "DETAILS" && name === "open") return true;
    if (el.hasAttribute("data-sosb-lightbox") && (name === "hidden" || name === "data-open")) {
      return true;
    }
    return false;
  }

  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    if (a.tagName !== b.tagName) return false;
    var aid = a.getAttribute("id"), bid = b.getAttribute("id");
    if (aid || bid) return aid === bid;
    return true;
  }

  function findKeyed(parent, node) {
    if (node.nodeType !== 1) return null;
    var id = node.getAttribute("id");
    if (!id) return null;
    for (var c = parent.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && c.tagName === node.tagName && c.getAttribute("id") === id) return c;
    }
    return null;
  }

  function syncAttrs(from, to) {
    var i, attr;
    for (i = to.attributes.length - 1; i >= 0; i--) {
      attr = to.attributes[i];
      if (preserved(from, attr.name)) continue;
      if (from.getAttribute(attr.name) !== attr.value) from.setAttribute(attr.name, attr.value);
    }
    for (i = from.attributes.length - 1; i >= 0; i--) {
      attr = from.attributes[i];
      if (preserved(from, attr.name)) continue;
      if (!to.hasAttribute(attr.name)) from.removeAttribute(attr.name);
    }
  }

  function morph(from, to) {
    if (from.nodeType === 3 || from.nodeType === 8) {
      if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
      return;
    }
    if (from.nodeType !== 1 || isScript(from)) return;
    syncAttrs(from, to);
    if (from.tagName === "STYLE" || from.tagName === "TITLE" || from.tagName === "TEXTAREA") {
      if (from.textContent !== to.textContent) from.textContent = to.textContent;
      return;
    }
    if (from.hasAttribute("data-sosb-lightbox") && from.getAttribute("data-open") === "true") {
      return;
    }
    morphChildren(from, to);
  }

  function morphChildren(from, to) {
    var fromChild = skipScripts(from.firstChild);
    var toChild = skipScripts(to.firstChild);
    var nextFrom, nextTo, keyed;
    while (toChild) {
      nextTo = skipScripts(toChild.nextSibling);
      if (!fromChild) {
        from.appendChild(document.importNode(toChild, true));
        toChild = nextTo;
        continue;
      }
      nextFrom = skipScripts(fromChild.nextSibling);
      if (sameNode(fromChild, toChild)) {
        morph(fromChild, toChild);
        fromChild = nextFrom;
        toChild = nextTo;
        continue;
      }
      keyed = findKeyed(from, toChild);
      if (keyed) {
        from.insertBefore(keyed, fromChild);
        morph(keyed, toChild);
      } else {
        from.insertBefore(document.importNode(toChild, true), fromChild);
      }
      toChild = nextTo;
    }
    while (fromChild) {
      nextFrom = skipScripts(fromChild.nextSibling);
      from.removeChild(fromChild);
      fromChild = nextFrom;
    }
  }

  function syncScripts(from, to) {
    var have = [], c, d, i, seen;
    for (c = from.firstChild; c; c = c.nextSibling) if (isScript(c)) have.push(c.outerHTML);
    for (d = to.firstChild; d; d = d.nextSibling) {
      if (!isScript(d)) continue;
      seen = false;
      for (i = 0; i < have.length; i++) if (have[i] === d.outerHTML) { seen = true; break; }
      if (!seen) from.appendChild(document.importNode(d, true));
    }
  }

  function apply(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var x = window.scrollX, y = window.scrollY;
    var active = document.activeElement;
    syncAttrs(document.documentElement, doc.documentElement);
    morphChildren(document.head, doc.head);
    morphChildren(document.body, doc.body);
    syncScripts(document.body, doc.body);
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
    if (active && active !== document.activeElement && active.focus && document.contains(active)) {
      active.focus();
    }
  }

  window.__sosbPreviewMorph = apply;

  window.addEventListener("message", function(e) {
    var d = e.data;
    if (!d || d.channel !== CH || d.version !== V) return;
    var p = d.payload;
    if (!p || p.type !== "previewHtml" || typeof p.html !== "string") return;
    try {
      apply(p.html);
    } catch (err) {
      post({ type: "error", message: String((err && err.message) || err) });
    }
  }, false);

  post({ type: "ready" });
})();`;

/** Marker attribute the renderer puts on the emitted `<script>` tag so the
 * preview-mode tests (and any host-side audit) can find it. */
export const PREVIEW_MORPH_SCRIPT_MARKER = "data-sosb-preview-morph";
