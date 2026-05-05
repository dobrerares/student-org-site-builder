/**
 * imageGallery lightbox — vanilla-JS bootstrap (issue #14).
 *
 * The renderer ships this string verbatim inside an inline `<script>` tag in
 * the rendered page, so built sites get the lightbox without depending on any
 * runtime framework — honouring renderer ADR 0003's no-runtime contract.
 *
 * The script is hand-minified to keep the AC bound (under 3kb minified).
 * The unminified equivalent is documented in `LIGHTBOX_SCRIPT_SOURCE` below
 * for review and future edits; the byte payload that actually ships is in
 * `LIGHTBOX_SCRIPT`.
 *
 * Behaviour contract (mirrored by the jsdom + Playwright tests):
 *
 *  - Each gallery section carries `data-block="imageGallery"` and a stable
 *    `data-block-id`. Each `<button data-sosb-lightbox-open>` inside it
 *    carries `data-gallery` (the block id), `data-index` (numeric position
 *    in the gallery), `data-src` (image URL), `data-alt`, and optional
 *    `data-caption`.
 *  - The dialog scaffold (`[data-sosb-lightbox]`) is page-global (one per
 *    page, even if multiple galleries exist) and starts hidden. Inside it
 *    the script writes to `[data-sosb-lightbox-img]`,
 *    `[data-sosb-lightbox-caption]`, and binds
 *    `[data-sosb-lightbox-prev]`, `[data-sosb-lightbox-next]`,
 *    `[data-sosb-lightbox-close]`.
 *  - Click on a trigger opens the dialog at the trigger's image and stores
 *    the trigger as the "return-focus target".
 *  - Esc / close-button / backdrop click closes the dialog and returns
 *    focus to the trigger.
 *  - ArrowLeft / ArrowRight cycle within the active gallery (wrap around).
 *  - Tab / Shift+Tab inside the open dialog wrap focus among focusable
 *    elements within the dialog (lightweight focus trap; no inert polyfill).
 */

/**
 * Source-form lightbox bootstrap. Kept here for readability and PR review;
 * the shipped bytes are `LIGHTBOX_SCRIPT` below. The byte budget AC is
 * verified against `LIGHTBOX_SCRIPT`, not this constant.
 */
export const LIGHTBOX_SCRIPT_SOURCE = `
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var dialog = document.querySelector("[data-sosb-lightbox]");
    if (!dialog) return;
    var imgEl = dialog.querySelector("[data-sosb-lightbox-img]");
    var capEl = dialog.querySelector("[data-sosb-lightbox-caption]");
    var prevBtn = dialog.querySelector("[data-sosb-lightbox-prev]");
    var nextBtn = dialog.querySelector("[data-sosb-lightbox-next]");
    var closeBtn = dialog.querySelector("[data-sosb-lightbox-close]");
    if (!imgEl) return;

    var triggers = document.querySelectorAll("[data-sosb-lightbox-open]");
    var byGallery = {};
    triggers.forEach(function (t) {
      var g = t.getAttribute("data-gallery") || "";
      (byGallery[g] = byGallery[g] || []).push(t);
    });
    Object.keys(byGallery).forEach(function (g) {
      byGallery[g].sort(function (a, b) {
        return Number(a.getAttribute("data-index")) - Number(b.getAttribute("data-index"));
      });
    });

    var current = null;
    var trapHandler = null;
    var keyHandler = null;

    function paint(t) {
      imgEl.setAttribute("src", t.getAttribute("data-src") || "");
      imgEl.setAttribute("alt", t.getAttribute("data-alt") || "");
      var cap = t.getAttribute("data-caption") || "";
      if (capEl) {
        capEl.textContent = cap;
        if (cap) capEl.removeAttribute("hidden");
        else capEl.setAttribute("hidden", "");
      }
    }

    function focusFirst() {
      var f = dialog.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (f.length) f[0].focus();
    }

    function open(t) {
      current = t;
      paint(t);
      dialog.removeAttribute("hidden");
      dialog.setAttribute("data-open", "");
      keyHandler = function (e) {
        if (e.key === "Escape") { e.preventDefault(); close(); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
        if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
        if (e.key === "Tab") trap(e);
      };
      document.addEventListener("keydown", keyHandler, true);
      focusFirst();
    }

    function close() {
      var ret = current;
      current = null;
      dialog.setAttribute("hidden", "");
      dialog.removeAttribute("data-open");
      if (keyHandler) document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
      if (ret && typeof ret.focus === "function") ret.focus();
    }

    function step(delta) {
      if (!current) return;
      var g = current.getAttribute("data-gallery") || "";
      var arr = byGallery[g] || [];
      if (!arr.length) return;
      var i = arr.indexOf(current);
      i = (i + delta + arr.length) % arr.length;
      current = arr[i];
      paint(current);
    }

    function trap(e) {
      var f = dialog.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      var active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    triggers.forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.preventDefault();
        open(t);
      });
    });
    if (closeBtn) closeBtn.addEventListener("click", function () { close(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) close();
    });
  });
})();
`;

/**
 * Hand-minified IIFE. Authored alongside `LIGHTBOX_SCRIPT_SOURCE`; the two
 * are functionally identical. The size AC asserts this string ships under
 * 3kb.
 */
export const LIGHTBOX_SCRIPT =
  '(function(){document.addEventListener("DOMContentLoaded",function(){var d=document.querySelector("[data-sosb-lightbox]");if(!d)return;var i=d.querySelector("[data-sosb-lightbox-img]"),c=d.querySelector("[data-sosb-lightbox-caption]"),p=d.querySelector("[data-sosb-lightbox-prev]"),n=d.querySelector("[data-sosb-lightbox-next]"),x=d.querySelector("[data-sosb-lightbox-close]");if(!i)return;var T=document.querySelectorAll("[data-sosb-lightbox-open]"),B={};T.forEach(function(t){var g=t.getAttribute("data-gallery")||"";(B[g]=B[g]||[]).push(t)});Object.keys(B).forEach(function(g){B[g].sort(function(a,b){return Number(a.getAttribute("data-index"))-Number(b.getAttribute("data-index"))})});var C=null,K=null;function P(t){i.setAttribute("src",t.getAttribute("data-src")||"");i.setAttribute("alt",t.getAttribute("data-alt")||"");var v=t.getAttribute("data-caption")||"";if(c){c.textContent=v;if(v)c.removeAttribute("hidden");else c.setAttribute("hidden","")}}function F(){var f=d.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex=\'-1\'])");if(f.length)f[0].focus()}function O(t){C=t;P(t);d.removeAttribute("hidden");d.setAttribute("data-open","");K=function(e){if(e.key==="Escape"){e.preventDefault();X();return}if(e.key==="ArrowRight"){e.preventDefault();S(1);return}if(e.key==="ArrowLeft"){e.preventDefault();S(-1);return}if(e.key==="Tab")R(e)};document.addEventListener("keydown",K,true);F()}function X(){var r=C;C=null;d.setAttribute("hidden","");d.removeAttribute("data-open");if(K)document.removeEventListener("keydown",K,true);K=null;if(r&&typeof r.focus==="function")r.focus()}function S(D){if(!C)return;var g=C.getAttribute("data-gallery")||"",a=B[g]||[];if(!a.length)return;var k=a.indexOf(C);k=(k+D+a.length)%a.length;C=a[k];P(C)}function R(e){var f=d.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex=\'-1\'])");if(!f.length)return;var u=f[0],w=f[f.length-1],z=document.activeElement;if(e.shiftKey){if(z===u||!d.contains(z)){e.preventDefault();w.focus()}}else{if(z===w){e.preventDefault();u.focus()}}}T.forEach(function(t){t.addEventListener("click",function(e){e.preventDefault();O(t)})});if(x)x.addEventListener("click",function(){X()});if(p)p.addEventListener("click",function(){S(-1)});if(n)n.addEventListener("click",function(){S(1)});d.addEventListener("click",function(e){if(e.target===d)X()})})})();';
