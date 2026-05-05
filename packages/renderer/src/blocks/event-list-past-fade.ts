/**
 * The past-fade script for the eventList block.
 *
 * This is the **only** runtime JS the eventList contributes to the built
 * site, and it is shipped as a single self-contained string the renderer
 * inlines in `<script>`. The PRD budgets the script at <1.5kb minified;
 * the test suite asserts the raw source under 1500 bytes so any future
 * bloat surfaces in CI.
 *
 * Contract:
 *   - Walks every `[data-block="event-list"]` element on the page.
 *   - For each, reads `data-past-behavior`:
 *       `show`  → no-op (no DOM mutation; past events look identical to
 *                 upcoming ones — useful for archives).
 *       `fade`  → adds `is-past` class to past events; CSS owns the
 *                 visual treatment (default).
 *       `hide`  → removes past events from the DOM.
 *   - For each `[data-event-id]` child, treats it as past when:
 *       `data-ends-at` is present and parses to a number ≤ now,
 *       OR `data-ends-at` is absent and `data-starts-at` ≤ now.
 *     Unparseable timestamps are left as upcoming (defensive).
 *   - "Now" is read once at script entry via `Date.now()` so every event
 *     in every block is compared against the same instant, regardless of
 *     how long the loop takes.
 *
 * Determinism note: the script source itself contains no build-time
 * `Date.now()`, no random IDs, no embedded site URL. The renderer's
 * byte-equality determinism contract requires this — the only "now"
 * reference is the runtime `Date.now()` call inside the script body.
 */
export const EVENT_LIST_PAST_FADE_SCRIPT = `(function(){
function r(){var n=Date.now();var bs=document.querySelectorAll('[data-block="event-list"]');for(var i=0;i<bs.length;i++){var b=bs[i];var m=b.getAttribute("data-past-behavior")||"fade";if(m==="show")continue;var es=b.querySelectorAll("[data-event-id]");for(var j=0;j<es.length;j++){var ev=es[j];var s=ev.getAttribute("data-ends-at")||ev.getAttribute("data-starts-at");if(!s)continue;var t=Date.parse(s);if(isNaN(t))continue;if(t>n)continue;if(m==="hide"){if(ev.parentNode)ev.parentNode.removeChild(ev);}else{ev.classList.add("is-past");}}}}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",r);}else{r();}
})();`;
