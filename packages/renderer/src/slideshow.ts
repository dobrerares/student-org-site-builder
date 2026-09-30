/** Native scroll snapping supplies touch swiping, including without JavaScript. */
export const SLIDESHOW_CSS = `
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__grid {
 display:flex; gap:0; overflow-x:auto; scroll-snap-type:x mandatory;
 padding:0; margin-inline:auto; list-style:none; scrollbar-width:none;
 columns:auto; overscroll-behavior-x:contain;
}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__grid::-webkit-scrollbar {display:none}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__item {
 flex:0 0 100%; width:100%; min-width:0; scroll-snap-align:start; margin:0;
}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__figure {margin:0}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__trigger {display:block;width:100%;padding:0;border:0;background:transparent}
[data-block="imageGallery"][data-layout="slideshow"] img {display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:contain}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__caption {padding:12px;text-align:center}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__controls {display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:12px}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__dots {display:flex;flex-wrap:wrap;justify-content:center}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__controls button {min-width:44px;min-height:44px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__dots button {border:0;opacity:.5}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__dots button[aria-current="true"] {opacity:1}
[data-block="imageGallery"][data-layout="slideshow"] :focus-visible {outline:2px solid currentColor;outline-offset:2px}
[data-block="imageGallery"][data-layout="slideshow"] .image-gallery__status {width:100%;text-align:center;font-size:.875em}
`;

/** Delegation also handles galleries added or edited by the preview morph. */
export const SLIDESHOW_SCRIPT = `(function(){
var selector='[data-block="imageGallery"][data-layout="slideshow"]';
function parts(g){return g.querySelector('.image-gallery__grid');}
function index(t){var items=Array.from(t.children),x=t.getBoundingClientRect().left;return items.reduce(function(best,e,i){return Math.abs(e.getBoundingClientRect().left-x)<Math.abs(items[best].getBoundingClientRect().left-x)?i:best;},0);}
function sync(g){var t=parts(g),i=index(t);g.querySelectorAll('[data-slide-to]').forEach(function(b,n){if(n===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});var s=g.querySelector('.image-gallery__status'),text=(i+1)+' / '+t.children.length;if(s&&s.textContent!==text)s.textContent=text;}
function go(g,i){var t=parts(g),n=t.children.length;if(!n)return;i=(i+n)%n;var rect=t.children[i].getBoundingClientRect();t.scrollBy({left:rect.left-t.getBoundingClientRect().left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-slide-step],[data-slide-to]');if(!b)return;var g=b.closest(selector);if(!g)return;go(g,b.hasAttribute('data-slide-to')?Number(b.getAttribute('data-slide-to')):index(parts(g))+Number(b.getAttribute('data-slide-step')));});
document.addEventListener('keydown',function(e){var g=e.target.closest&&e.target.closest(selector);if(!g||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();var t=parts(g);go(g,e.key==='Home'?0:e.key==='End'?t.children.length-1:index(t)+(e.key==='ArrowRight'?1:-1));});
document.addEventListener('scroll',function(e){var t=e.target;if(t.matches&&t.matches(selector+' .image-gallery__grid'))sync(t.closest(selector));},true);
})();`;
