(function(){
'use strict';
const css=document.createElement('style');
css.textContent=`
#sgc-builder-sidebar{position:fixed;top:83px;left:12px;bottom:18px;width:252px;overflow-y:auto;z-index:30;background:#fff;border:1px solid #e9dfe6;border-radius:21px;box-shadow:0 14px 36px #60445a18;padding:14px}
#sgc-builder-sidebar h2{font:20px Georgia,serif;margin:8px 9px 16px}
#sgc-builder-sidebar details{border-bottom:1px solid #eee5ed;padding:4px 0}
#sgc-builder-sidebar summary{font-weight:700;cursor:pointer;padding:13px 14px;list-style:none;border-radius:13px;background:#f6eef5;color:#3f3040;transition:background .2s,box-shadow .2s}
#sgc-builder-sidebar summary::after{content:'⌄';float:right}
#sgc-builder-sidebar details[open]>summary::after{content:'⌃'}
#sgc-builder-sidebar button{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:11px;padding:12px 13px;font:500 13px Arial,sans-serif;color:#4b3d4d;cursor:pointer;transition:background .18s,transform .18s,box-shadow .18s;margin:3px 0}
#sgc-builder-sidebar button:hover,#sgc-builder-sidebar button:focus-visible{background:#f3e2e9;transform:translateX(2px);box-shadow:0 2px 8px #60445a12;outline:none}
#sgc-builder-sidebar summary:hover,#sgc-builder-sidebar summary:focus-visible{background:#eedfeb;outline:2px solid #d9bed0;outline-offset:2px}
#sgc-builder-sidebar details[open]>summary{background:#eee0ec;margin-bottom:9px}
#sgc-builder-sidebar details>button{padding-left:18px;font-size:12.5px}
#sgc-builder-sidebar details>button::before{content:none!important;display:none!important}
#sgc-builder-sidebar details>button{padding:11px 13px!important;background:#fcf9fb;border:1px solid transparent;border-radius:12px;line-height:1.45;font-size:13px!important;letter-spacing:.01em;color:#473b49;overflow-wrap:break-word}
#sgc-builder-sidebar details>button:nth-of-type(even){background:#f8f2f7}
#sgc-builder-sidebar details>button:hover,#sgc-builder-sidebar details>button:focus-visible{background:#efe1eb;border-color:#e5cddd;transform:translateX(2px);box-shadow:0 3px 10px #69476114}
#sgc-builder-sidebar details>button:active{background:#e8d5e3;transform:translateX(1px)}
#sgc-builder-sidebar>button{background:#fbf8fc;border:1px solid #f0e6ef;margin-top:9px;font-weight:650!important;padding:13px 14px}
#sgc-builder-sidebar>button::after{content:'→';float:right;color:#98758e}
#sgc-builder-sidebar .sgc-published-website-link{display:block;margin:10px 0;padding:13px 14px;border-radius:12px;background:#f5ebdb;border:1px solid #dfc49f;color:#61482c;text-decoration:none;font-weight:650;font-size:13px;overflow-wrap:anywhere}
#sgc-builder-sidebar .sgc-published-website-link[hidden]{display:none}
@media(min-width:1200px){body:has(#builder:not(.hidden)) main{margin-left:282px;max-width:none;margin-right:24px}}
@media(max-width:1199px){#sgc-builder-sidebar{position:static;width:auto;max-height:320px;margin:16px 20px 0}#sgc-builder-sidebar details[open]{max-height:250px;overflow-y:auto}}
`;
document.head.append(css);
function setup(){
 const builder=document.getElementById('builder'),menu=document.getElementById('studio-menu');
 if(!builder||!menu||document.getElementById('sgc-builder-sidebar'))return;
 const side=document.createElement('nav');side.id='sgc-builder-sidebar';side.setAttribute('aria-label','Website builder navigation');
 const title=document.createElement('h2');title.textContent='Website Builder';side.append(title);const published=document.createElement('a');published.id='sgc-published-website-link';published.className='sgc-published-website-link';published.hidden=true;published.target='_blank';published.rel='noopener noreferrer';side.append(published);
const syncPublished=()=>{const data=window.sgcPublishedWebsite;const url=data?.subdomainUrl||data?.url;if(!data?.published||!url){published.hidden=true;published.removeAttribute('href');return;}try{const parsed=new URL(url,location.origin);if(!['https:','http:'].includes(parsed.protocol))throw Error('Invalid address');published.href=parsed.href;published.textContent='↗ '+(document.getElementById('name')?.value?.trim()||parsed.hostname)+' — Published Website';published.hidden=false;}catch{published.hidden=true;}};
window.addEventListener('sgc-published-website-change',syncPublished);document.getElementById('name')?.addEventListener('input',syncPublished);syncPublished();

 const jump=el=>el?.scrollIntoView({behavior:'smooth',block:'start'});
 const group=document.createElement('details');group.open=false;
 const summary=document.createElement('summary');summary.textContent='Edit your website';group.append(summary);
 const entries=[
 ['Logo','logo'],['Menu','menu'],['Announcement bar','announcement-bar'],['Colour theme','colour-theme'],['Font','font'],
 ['Home page preferences','homepage'],['Services','services'],['Products + online store options','products'],
 ['Photo gallery','gallery'],['Media: audio, video, PDF files','medias'],
 ['News + blog posts','posts'],['About us + team members','about'],
 ['Contact + live chat + social media','contact'],['Other sections: donations, forms','other-sections'],
 ['Other settings: newsletter, footer','settings'],['Advanced options: custom code','advanced'],
 ['Advanced store options: Google Shopping','advanced-store'],['Site name','site-name']
 ];
 entries.forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{location.href='website-builder-'+id+'.html';};group.append(b);});
 side.append(group);
 [['Dashboard','dashboard'],['Visitors','visitors'],['Orders','orders'],['Domain','domain']].forEach(([label,id])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.fontWeight='700';b.onclick=()=>{location.href='website-builder-'+id+'.html';};side.append(b);});
 document.body.insertBefore(side,document.querySelector('main'));
 const obs=new MutationObserver(()=>{side.hidden=builder.classList.contains('hidden');});obs.observe(builder,{attributes:true,attributeFilter:['class']});side.hidden=builder.classList.contains('hidden');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();