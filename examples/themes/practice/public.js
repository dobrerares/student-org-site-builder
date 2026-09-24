/*
 * Practice — public-site script (`public.js`, ADR 0046 / ADR 0054).
 *
 * Runs on the published Site only, never during preview or export. Declared in
 * `theme.json` with `network: []`: it contacts nothing, so nothing about it is
 * unavailable offline.
 *
 * Two enhancements, both additive:
 *
 *  1. Phone navigation toggle. `render.js` ships the menu button `hidden` and
 *     the navigation list visible. This script reveals the button and marks
 *     the header `data-nav-enhanced`, which is what lets the stylesheet
 *     collapse the list at phone widths. A visitor without JavaScript keeps
 *     the wrapped list and loses nothing.
 *  2. Sticky-header shrink. Past a short scroll the header is marked
 *     `data-scrolled`, and the stylesheet tightens its padding.
 *
 * No framework, no build step, ~1 KB. A public script *may* bundle one
 * (ADR 0046); this one has no reason to.
 */
(function () {
  "use strict";

  var header = document.querySelector("[data-site-nav]");
  if (!header) return;

  var toggle = header.querySelector(".site-nav__toggle");
  var list = header.querySelector(".site-nav__list");

  if (toggle && list) {
    header.setAttribute("data-nav-enhanced", "true");
    header.setAttribute("data-nav-open", "false");
    toggle.removeAttribute("hidden");

    var setOpen = function (open) {
      header.setAttribute("data-nav-open", open ? "true" : "false");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggle.addEventListener("click", function () {
      setOpen(header.getAttribute("data-nav-open") !== "true");
    });

    // Escape closes the menu and hands focus back to the button, so a
    // keyboard user is never left inside a list that just disappeared.
    header.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (header.getAttribute("data-nav-open") !== "true") return;
      setOpen(false);
      toggle.focus();
    });
  }

  var scrolled = null;
  var onScroll = function () {
    var next = window.scrollY > 24;
    if (next === scrolled) return;
    scrolled = next;
    header.setAttribute("data-scrolled", next ? "true" : "false");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
