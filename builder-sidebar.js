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
 ['Logo','branding'],['Menu','menu-content'],['Colour theme','theme'],['Font','theme'],
 ['Home page preferences','homepage'],['Home page layout','home-layout'],
 ['Services','services'],['Products','products'],['Photo gallery','gallery'],
 ['Media & files','media'],['News & blog','blog'],['About us & team','team'],
 ['Contact & social media','contact'],['Announcement bar','bars'],
 ['Donations & forms','extras'],['Newsletter & footer','settings'],
 ['Online store settings','shopping'],['Advanced options','advanced'],['Site name','site-name']
 ];
 const jump=el=>{el?.scrollIntoView({behavior:'smooth',block:'start'});};
 entries.forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{
 const buttons=Array.from(menu.querySelectorAll('button.studio-option'));
 const titles={'branding':'Logo, menu, colours & fonts','menu-content':'Edit menu content','theme':'Colour theme & font','homepage':'Homepage preferences','home-layout':'Homepage header & sections','services':'Edit / add services','products':'Products & online store','gallery':'Photo gallery','media':'Media: video, audio & PDF','blog':'News & blog posts','team':'About us & team members','contact':'Contact, chat & social media','bars':'Announcement & contact bars','extras':'Other sections: donations & forms','settings':'Newsletter, footer & settings','shopping':'Google Shopping & store options','advanced':'Advanced options & custom code','site-name':'Site name & address'};
 const match=buttons.find(x=>x.textContent.includes(titles[id]));
 if(match){match.click();jump(document.getElementById('studio-editor'));}else jump(menu);
 };group.append(b);});
 side.append(group);
 [['Dashboard','site-preview-panel'],['Visitors','site-analytics'],['Orders','site-orders'],['Domain','domain-settings']].forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.fontWeight='700';b.onclick=()=>jump(document.getElementById(id));side.append(b);});
 document.body.insertBefore(side,document.querySelector('main'));
 const obs=new MutationObserver(()=>{side.hidden=builder.classList.contains('hidden');});obs.observe(builder,{attributes:true,attributeFilter:['class']});side.hidden=builder.classList.contains('hidden');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();