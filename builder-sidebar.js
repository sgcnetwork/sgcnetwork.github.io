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
css.textContent+=\`
#sgc-builder-sidebar .sgc-published-sites-list{padding:6px 2px 10px}
#sgc-builder-sidebar .sgc-published-site-item{display:block;padding:11px 12px;margin:5px 0;border-radius:11px;background:#fbf7f3;border:1px solid #eee4dd;text-decoration:none;font:600 13px Arial,sans-serif;color:#483a45;overflow-wrap:anywhere}
#sgc-builder-sidebar .sgc-published-site-item:hover{background:#f4e9e3}
#sgc-builder-sidebar .sgc-sites-note{font:12px/1.5 Arial,sans-serif;color:#796b75;padding:6px 12px}
#sgc-builder-sidebar .sgc-academy-back{display:block;margin:14px 0 9px;padding:12px;border-radius:12px;background:#3e3141;color:#fff;text-decoration:none;text-align:center;font:600 13px Arial,sans-serif}
\`;document.head.append(css);
function setup(){
 const builder=document.getElementById('builder'),menu=document.getElementById('studio-menu');
 if(!builder||!menu||document.getElementById('sgc-builder-sidebar'))return;
 const side=document.createElement('nav');side.id='sgc-builder-sidebar';side.setAttribute('aria-label','Website builder navigation');
 const title=document.createElement('h2');title.textContent='Website Builder';side.append(title);
 const sitesGroup=document.createElement('details');sitesGroup.className='sgc-published-sites';
 const sitesSummary=document.createElement('summary');sitesSummary.textContent='Published Websites';sitesGroup.append(sitesSummary);
 const sitesList=document.createElement('div');sitesList.className='sgc-published-sites-list';sitesList.setAttribute('aria-live','polite');sitesGroup.append(sitesList);side.append(sitesGroup);
 const academy=document.createElement('a');academy.className='sgc-academy-back';academy.href='dashboard.html';academy.textContent='← Back to Academy Portal';side.append(academy);
 const syncPublished=async()=>{
  sitesList.replaceChildren();
  const note=document.createElement('p');note.className='sgc-sites-note';note.textContent='Loading published websites…';sitesList.append(note);
  try{
   const sb=window.sgcSupabase;
   if(!sb){note.textContent='Sign in to view your published websites.';return;}
   const {data:{user},error:authError}=await sb.auth.getUser();
   if(authError||!user){note.textContent='Sign in to view your published websites.';return;}
   const {data:sites,error}=await sb.from('sgc_student_websites').select('*').eq('user_id',user.id);
   if(error)throw error;
   const current=window.sgcPublishedWebsite;
   const published=(sites||[]).filter(site=>site.published===true||site.is_published===true||!!site.published_at||!!site.publishedAt||(current?.published&&current?.slug===site.slug));
   sitesList.replaceChildren();
   if(!published.length){note.textContent='No published websites yet.';sitesList.append(note);return;}
   for(const site of published){
    const slug=String(site.slug||'').trim().toLowerCase();
    const candidate=site.published_url||site.public_url||site.subdomain_url||(slug&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)?'https://'+slug+'.sgcnetwork.co.za':'');
    if(!candidate)continue;
    let url;try{url=new URL(candidate);if(url.protocol!=='https:'&&url.protocol!=='http:')continue;}catch{continue;}
    const link=document.createElement('a');link.className='sgc-published-site-item';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=site.business_name||site.name||slug||url.hostname;sitesList.append(link);
   }
   if(!sitesList.children.length){note.textContent='No published websites yet.';sitesList.append(note);}
  }catch(e){note.textContent='Unable to load websites. Please try again.';sitesList.replaceChildren(note);}
 };
 window.addEventListener('sgc-published-website-change',syncPublished);
 window.addEventListener('sgc-builder-sites-refresh',syncPublished);
 syncPublished();

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