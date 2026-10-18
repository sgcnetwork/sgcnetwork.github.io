(function(){
'use strict';
const M=window.SgcProductMedia;
const API='https://bxpexanyoyubxeqqlggh.supabase.co/functions/v1/website-publication';
const root=document.getElementById('site'),status=document.getElementById('site-status');
const node=(tag,text,parent,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;if(parent)parent.append(e);return e;};
const text=v=>typeof v==='string'?v:'';
const list=v=>Array.isArray(v)?v:[];
const lines=v=>text(v).split(/\n/).map(x=>x.trim()).filter(Boolean);
function url(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function link(label,destination,parent,cls){const safe=url(destination);if(!safe)return null;const a=node('a',label,parent,cls);a.href=safe;a.rel='noopener noreferrer';return a;}
function image(src,alt,parent){const safe=url(src);if(safe){const img=node('img',null,parent);img.src=safe;img.alt=text(alt);img.loading='lazy';img.referrerPolicy='no-referrer';}}
const money=v=>v!=null&&Number.isFinite(Number(v))?'R '+Number(v).toFixed(2):'Ask for details';
const colour=(v,fallback)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:fallback;
let site,p,main;
function section(title){const e=node('section',null,main);node('h2',title,e);return e;}
function contact(parent,item){
 if(item?.actionUrl&&link(item.actionType==='booking'?'Book this service':'Contact us',item.actionUrl,parent,'button'))return;
 if(url(p.whatsapp)){link('Enquire on WhatsApp',p.whatsapp,parent,'button');return;}
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||'')){const a=node('a','Enquire by email',parent,'button');a.href='mailto:'+encodeURIComponent(p.email)+'?subject='+encodeURIComponent(item?.name||'Business enquiry');return;}
 if(p.phone){const a=node('a','Call us',parent,'button');const number=String(p.phone).replace(/[^+0-9]/g,'');if(number.length>=5){a.href='tel:'+number;return;}a.remove();}
 node('p','Contact this business for more information.',parent,'muted');
}
function detail(item,kind){
 main.replaceChildren();const back=node('button','← Back',main);back.onclick=()=>{location.hash='';};
 const box=node('section',null,main,'detail');node('h1',item.name,box);const gallery=node('div',null,box);M.gallery(gallery,item.images,item.name);
 const description=node('p',item.description,box);const price=node('p',money(item.onSale&&item.salePrice!=null?item.salePrice:item.price),box,'price');
 if(kind==='products'&&list(item.variants).length){const label=node('label','Choose an option',box);const select=node('select',null,label);node('option','Select an option',select).value='';list(item.variants).forEach((v,i)=>node('option',v.label,select).value=String(i));select.onchange=()=>{const v=item.variants[select.value];price.textContent=money(v?.price??(item.onSale?item.salePrice:item.price));stock.textContent=item.trackStock&&Number(v?.stock??item.stock)<=0?'Currently out of stock':'';description.textContent=v?.description||item.description||'';M.gallery(gallery,M.variantImages(item,v),item.name);};}
 const stock=node('p',item.trackStock&&!list(item.variants).length&&Number(item.stock)<=0?'Currently out of stock':'',box,'muted');
 if(kind==='products')node('p','Please contact the business to order or ask about availability.',box,'muted');contact(box,item);
}
function catalogue(title,items,kind,parent){const target=parent||section(title);if(parent)node('h2',title,target);const grid=node('div',null,target,'grid');items.forEach(item=>{const card=node('article',null,grid,'card');image(list(item.images)[0],item.name,card);if(kind==='products')M.hover(card,card.querySelector('img'),item.images,()=>{location.hash=kind+'/'+encodeURIComponent(item.seoSlug||item.id);});node('h3',item.name,card);node('p',money(item.onSale&&item.salePrice!=null?item.salePrice:item.price),card,'price');node('p',text(item.description).slice(0,180),card);const a=node('a',kind==='products'?'View product':'View service',card,'button');a.href='#'+kind+'/'+encodeURIComponent(item.seoSlug||item.id);});return target;}
function home(){
 main.replaceChildren();const enabled=id=>!list(p.homeSections).length||p.homeSections.some(s=>s.id===id&&s.visible!==false);
 if(site.products.length&&enabled('Products')){const e=catalogue('Products',site.products,'products');e.id='products';if(p.delivery)node('p',p.delivery,e);}
 if(site.services.length&&p.servicesHomeVisible!=='No'&&enabled('Services')){const e=catalogue(p.servicesTitle||'Services',site.services,'services');e.id='services';if(p.servicesDescription)node('p',p.servicesDescription,e);}
 if(p.about&&enabled('About us')){const e=section('About us');e.id='about';node('p',p.about,e);if(p.team)node('p',p.team,e);}
 if(p.postTitle||p.postBody){const e=section(p.postTitle||'News');node('p',p.postBody,e);}
 if(p.photos&&enabled('Pictures')){const e=section('Gallery');e.id='gallery';const grid=node('div',null,e,'gallery');lines(p.photos).slice(0,30).forEach(src=>image(src,'Gallery image',grid));}
 if(p.media){const e=section('Media');lines(p.media).forEach((u,i)=>link('Open resource '+(i+1),u,e));}
 const e=section('Contact us');e.id='contact';if(p.email)node('p','Email: '+p.email,e);if(p.phone)node('p','Phone: '+p.phone,e);const links=node('div',null,e,'links');[['whatsapp','WhatsApp'],['instagram','Instagram'],['facebook','Facebook']].forEach(([k,l])=>link(l,p[k],links));contact(e);
}
function route(){const [kind,raw]=location.hash.slice(1).split('/');if(['products','services'].includes(kind)&&raw){let key;try{key=decodeURIComponent(raw);}catch{return home();}const item=site[kind].find(i=>(i.seoSlug||i.id)===key);if(item){detail(item,kind);main.scrollIntoView?.({block:'start'});return;}}home();if(['products','services','contact','about','gallery'].includes(kind))document.getElementById(kind)?.scrollIntoView?.();}
function render(data){
 site=data;p=site.preferences||{};site.products=list(site.products);site.services=list(site.services);
 document.title=text(site.business_name);document.querySelector('meta[name=description]').content=text(p.seo||site.description).slice(0,300);
 document.documentElement.style.setProperty('--primary',colour(site.primary_color,'#efdce6'));document.documentElement.style.setProperty('--accent',colour(site.accent_color,'#463445'));
 if(p.siteTheme==='Dark'){document.documentElement.style.setProperty('--bg','#211e24');document.documentElement.style.setProperty('--ink','#faf5f9');}else document.documentElement.style.setProperty('--bg',colour(p.siteBackground,'#ffffff'));
 const fonts={'Open Sans':'Arial,sans-serif','Arial':'Arial,sans-serif','Georgia':'Georgia,serif','Trebuchet MS':'Trebuchet MS,sans-serif','Verdana':'Verdana,sans-serif','Georgia,serif':'Georgia,serif'};document.body.style.fontFamily=fonts[p.siteFont]||fonts[site.font]||'Arial,sans-serif';
 root.replaceChildren();if(p.announcementEnabled==='Yes'&&p.announcementText)node('div',p.announcementText,root,'announcement');
 const header=node('header',null,root,'site-header'),brand=node('a',p.logoText||site.business_name,header,'brand');brand.href='#';if(p.logoStyle==='Logo / image'&&url(p.logo)){brand.textContent='';image(p.logo,site.business_name,brand);}if(p.logoStyle==='Hidden')brand.hidden=true;
 const nav=node('nav',null,header);nav.setAttribute('aria-label','Main navigation');
 header.style.background=p.menuBackgroundMode==='Custom color'?colour(p.menuBackground,'#ffffff'):'#ffffff';
 header.style.color=p.menuColorMode==='Custom color'?colour(p.menuColor,'#342b35'):'#342b35';
 header.style.position=p.stickyMenu==='Yes'?'sticky':'relative';
 header.style.top=p.stickyMenu==='Yes'?'0':'auto';
 header.style.zIndex='40';
 nav.style.display='flex';nav.style.alignItems='center';nav.style.flexWrap='wrap';nav.style.gap='10px';
 nav.style.justifyContent=p.menuPosition==='Left'?'flex-start':p.menuPosition==='Center'?'center':'flex-end';
 nav.style.fontSize=Math.max(8,Math.min(48,Number(p.menuSize)||14))+'px';
const entries=list(p.menuEntries).length?p.menuEntries:[{id:'Products',label:'Products'},{id:'Services',label:'Services'},{id:'About us',label:'About us'},{id:'Contact us',label:'Contact'}];const paths={'Products':'products','Services':'services','About us':'about','Contact us':'contact','Pictures':'gallery'};
 entries.filter(e=>e.visible!==false&&paths[e.id]).forEach(e=>{if(e.id==='Products'&&!site.products.length||e.id==='Services'&&(p.servicesMenuVisible==='No'||!site.services.length))return;const a=node('a',e.label||e.id,nav);a.href='#'+paths[e.id];a.style.color='inherit';a.style.fontSize='inherit';});
 const hero=node('div',null,root,'hero');node('h1',p.headline||site.business_name,hero);node('p',p.welcome||site.description,hero);const cta=node('a',p.homeButtonText||p.cta||'Get in touch',hero,'button');cta.href='#'+(paths[p.homeButtonTarget]||'contact');
 main=node('main',null,root);route();const footer=node('footer',null,root,'site-footer');if(p.footer)node('p',p.footer,footer);link('Hosted by SGC Network','https://sgcnetwork.co.za',footer);root.hidden=false;status.hidden=true;
}
const host=location.hostname.toLowerCase();const sub=host.endsWith('.sgcnetwork.co.za')&&host!=='www.sgcnetwork.co.za'?host.slice(0,-'.sgcnetwork.co.za'.length):null;
const slug=sub||new URLSearchParams(location.search).get('site');
if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){status.textContent='Website not found.';return;}
fetch(API+'?site='+encodeURIComponent(slug),{credentials:'omit',cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok||!data.site)throw Error(data.error||'Website unavailable');render(data.site);}).catch(e=>{status.textContent=e.message;});
window.addEventListener('hashchange',()=>{if(site)route();});
})();
