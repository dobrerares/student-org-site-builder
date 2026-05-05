/**
 * Tiny vanilla-JS lazy-loader for embed blocks (issue #20).
 *
 * Hand-minified to keep the AC <1kb minified. The script:
 *  1. Selects every <figure data-block="embed" data-embed-src>...</figure>.
 *  2. Wraps an IntersectionObserver around them with a 200px rootMargin so
 *     the iframe is created just before the user scrolls into view.
 *  3. On intersection, swaps the placeholder for a real <iframe> with the
 *     hardened attributes (loading=lazy, title, sandbox, allow, etc.) the
 *     renderer baked into data-embed-*.
 *  4. Falls back to instant-loading if IntersectionObserver is unavailable
 *     (very old browsers); the iframe still uses loading="lazy" so the
 *     browser handles the rest.
 *
 * Security note: the script never sets innerHTML and only uses safe DOM
 * methods (createElement, setAttribute, replaceChildren) so there is no
 * sanitisation concern even though every input value comes from data-* on
 * the page itself (which the renderer wrote, not the user).
 *
 * Editable in `embed-lazy-loader.ts`; the exported string is the
 * deployable artefact. The byte budget is asserted in
 * `packages/renderer/test/embed-block.test.ts`.
 */

// Hand-minified single-statement loader. Keep variable names short.
export const EMBED_LAZY_LOAD_SCRIPT = `(function(){var s='figure[data-block="embed"][data-embed-src]';function h(f){var i=document.createElement('iframe');i.src=f.getAttribute('data-embed-src')||'';i.title=f.getAttribute('data-embed-title')||'';i.loading='lazy';i.allow=f.getAttribute('data-embed-allow')||'';i.setAttribute('sandbox',f.getAttribute('data-embed-sandbox')||'');i.referrerPolicy=f.getAttribute('data-embed-referrerpolicy')||'';i.setAttribute('allowfullscreen','');i.setAttribute('data-embed-provider',f.getAttribute('data-embed-provider')||'');i.style.cssText='border:0;width:100%;height:100%;display:block;';f.replaceChildren(i);}var l=document.querySelectorAll(s);if(!('IntersectionObserver' in window)){l.forEach(h);return;}var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){h(e.target);o.unobserve(e.target);}});},{rootMargin:'200px 0px'});l.forEach(function(f){o.observe(f);});})();`;
