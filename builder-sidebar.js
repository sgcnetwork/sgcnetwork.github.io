(function(){
'use strict';
const css=document.createElement('style');
css.textContent=`
#sgc-builder-sidebar{position:fixed;top:83px;left:12px;bottom:18px;width:225px;overflow-y:auto;z-index:30;background:#fff;border:1px solid #e9dfe6;border-radius:19px;box-shadow:0 12px 32px #60445a16;padding:13px}
#sgc-builder-sidebar h2{font:20px Georgia,serif;margin:8px 9px 16px}
#sgc-builder-sidebar details{border-bottom:1px solid #eee5ed;padding:4px 0}
#sgc-builder-sidebar summary{font-weight:700;cursor:pointer;padding:11px 9px;list-style:none;border-radius:9px}
#sgc-builder-sidebar summary::after{content:'⌄';float:right}
#sgc-builder-sidebar details[open]>summary::after{content:'⌃'}
#sgc-builder-sidebar button{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:9px;padding:10px 12px;font:13px Arial,sans-serif;color:#4b3d4d;cursor:pointer}
#sgc-builder-sidebar button:hover,#sgc-builder-sidebar button:focus-visible{background:#f3e2e9}
@media(min-width:1200px){body:has(#builder:not(.hidden)) main{margin-left:255px;max-width:none;margin-right:24px}}
@media(max-width:1199px){#sgc-builder-sidebar{position:static;width:auto;max-height:320px;margin:16px 20px 0}#sgc-builder-sidebar details[open]{max-height:250px;overflow-y:auto}}
`;
document.head.append(css);
function setup(){
 const builder=document.getElementById('builder'),menu=document.getElementById('studio-menu');
 if(!builder||!menu||document.getElementById('sgc-builder-sidebar'))return;
 const side=document.createElement('nav');side.id='sgc-builder-sidebar';side.setAttribute('aria-label','Website builder navigation');
 const title=document.createElement('h2');title.textContent='Website Builder';side.append(title);
 const group=document.createElement('details');group.open=true;
 const summary=document.createElement('summary');summary.textContent='Edit your website';group.append(summary);
 const entries=[
 ['Logo','logo'],['Menu','menu'],['Colour theme','colour-theme'],['Font','font'],
 ['Home page preferences','homepage'],['Services','services'],['Products + online store options','products'],
 ['Photo gallery','gallery'],['Media: audio, video, PDF files','medias'],
 ['News + blog posts','posts'],['About us + team members','about'],
 ['Contact + live chat + social media','contact'],['Other sections: donations, forms','other-sections'],
 ['Other settings: newsletter, footer','settings'],['Advanced options: custom code','advanced'],
 ['Advanced store options: Google Shopping','advanced-store'],['Site name','site-name']
 ];
 entries.forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{location.href='website-builder-'+id+'.html';};group.append(b);});
 side.append(group);
 [['Dashboard','site-preview-panel'],['Visitors','site-analytics'],['Orders','site-orders'],['Domain','domain-settings']].forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.fontWeight='700';b.onclick=()=>jump(document.getElementById(id));side.append(b);});
 document.body.insertBefore(side,document.querySelector('main'));
 const obs=new MutationObserver(()=>{side.hidden=builder.classList.contains('hidden');});obs.observe(builder,{attributes:true,attributeFilter:['class']});side.hidden=builder.classList.contains('hidden');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();