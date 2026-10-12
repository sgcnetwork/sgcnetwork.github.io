(function(){
const KEY='sgc-display-theme';
const root=document.documentElement;
function current(){try{return localStorage.getItem(KEY)||'light'}catch(e){return 'light'}}
function apply(mode){root.setAttribute('data-sgc-theme',mode);root.style.colorScheme=mode;document.querySelectorAll('[data-sgc-theme-toggle]').forEach(b=>{b.textContent=mode==='dark'?'☀ Light mode':'☾ Dark mode';b.setAttribute('aria-label','Switch to '+(mode==='dark'?'light':'dark')+' mode');b.setAttribute('aria-pressed',String(mode==='dark'))})}
apply(current());
window.addEventListener('storage',e=>{if(e.key===KEY)apply(current())});
document.addEventListener('DOMContentLoaded',()=>{
 const b=document.createElement('button');b.type='button';b.setAttribute('data-sgc-theme-toggle','');b.className='sgc-theme-switch';b.onclick=()=>{const next=current()==='dark'?'light':'dark';try{localStorage.setItem(KEY,next)}catch(e){}apply(next);document.querySelectorAll('iframe').forEach(f=>{try{f.contentWindow.postMessage({type:'sgc-theme',mode:next},location.origin)}catch(e){}})};
 document.body.appendChild(b);apply(current());
});
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='sgc-theme')return;apply(e.data.mode==='dark'?'dark':'light')});
})();