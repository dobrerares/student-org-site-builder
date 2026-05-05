/**
 * FAQ block — vanilla-JS accordion enhancement.
 *
 * The block's *functionality* (expand / collapse, keyboard nav, screen-reader
 * announcement) comes for free from the native `<details>`/`<summary>`
 * elements emitted by the renderer; the block works with JS disabled. This
 * script is a *progressive enhancement* that adds a smooth open/close height
 * transition. It is intentionally tiny (well under the 2 kb minified
 * budget from #18 AC).
 *
 * Behaviour:
 *
 *  1. Find every `[data-block="faq"] details.faq__item` on the page.
 *  2. Intercept the user's click / keyboard activation. When the element is
 *     about to open, measure the answer height and animate from `0` to that
 *     height. When closing, animate back to `0` then set `open=false`.
 *  3. Respect `prefers-reduced-motion: reduce` — when the user has asked
 *     for reduced motion, skip the animation and let the browser's default
 *     instant toggle stand.
 *
 * The script is exported as a string constant `FAQ_ACCORDION_SCRIPT_SOURCE`
 * so the build pipeline (#5) can inline it into the dist HTML once per page
 * that contains a faq block. This avoids shipping a separate `.js` file for
 * a tiny enhancement and keeps the v1 budget rules (≤10 kb total JS) easy
 * to verify.
 *
 * Self-installing IIFE: the script runs immediately on parse. It is
 * idempotent — re-running on the same DOM is a no-op (we tag installed
 * elements with `data-faq-enhanced="1"`). The editor preview iframe
 * re-injects the script after every render; the idempotency contract makes
 * that safe.
 */

export const FAQ_ACCORDION_SCRIPT_SOURCE = `(function(){
var d=document,prm;
try{prm=window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){prm=false}
function enhance(el){
if(el.getAttribute("data-faq-enhanced")==="1")return;
el.setAttribute("data-faq-enhanced","1");
var sum=el.querySelector("summary"),ans=el.querySelector(".faq__answer");
if(!sum||!ans)return;
function animate(opening){
if(prm)return;
var h=ans.scrollHeight;
ans.style.overflow="hidden";
ans.style.height=(opening?0:h)+"px";
ans.offsetHeight;
ans.style.transition="height 180ms ease";
ans.style.height=(opening?h:0)+"px";
function done(){
ans.style.transition="";
ans.style.height="";
ans.style.overflow="";
ans.removeEventListener("transitionend",done);
if(!opening)el.open=false;
}
ans.addEventListener("transitionend",done);
}
sum.addEventListener("click",function(e){
if(prm)return;
e.preventDefault();
if(el.open){animate(false)}
else{el.open=true;animate(true)}
});
}
function init(){
var nodes=d.querySelectorAll('[data-block="faq"] details.faq__item');
for(var i=0;i<nodes.length;i++)enhance(nodes[i]);
}
if(d.readyState==="loading"){d.addEventListener("DOMContentLoaded",init)}
else{init()}
})();`;

/**
 * Sentinel attribute used by the script to mark elements it has already
 * enhanced. Exposed as a constant so tests can assert idempotency without
 * hard-coding the string in two places.
 */
export const FAQ_ENHANCED_ATTR = "data-faq-enhanced" as const;
