(function(){
'use strict';
const M=window.SgcProductMedia;
const preview=document.documentElement.dataset.builderPreview==='true';
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
 const layout=node('section',null,main,'detail sgc-product-layout');const gallery=node('div',null,layout);const box=node('div',null,layout,'sgc-product-summary');node('h1',item.name,box);M.gallery(gallery,item.images,item.name);
 let purchase=null;const description=node('p',item.description,box);const price=node('p',money(item.onSale&&item.salePrice!=null?item.salePrice:item.price),box,'price');
 if(kind==='products'&&list(item.variants).length){const label=node('label','Choose an option',box);const select=node('select',null,label);node('option','Select an option',select).value='';list(item.variants).forEach((v,i)=>node('option',v.label,select).value=String(i));select.onchange=()=>{const v=item.variants[select.value];price.textContent=money(v?.price??(item.onSale?item.salePrice:item.price));purchase?.update(v);stock.textContent=item.trackStock&&Number(v?.stock??item.stock)<=0?'Currently out of stock':'';description.textContent=v?.description||item.description||'';M.gallery(gallery,M.variantImages(item,v),item.name);};M.options(select,item.variants);}
 const stock=node('p',item.trackStock&&!list(item.variants).length&&Number(item.stock)<=0?'Currently out of stock':'',box,'muted');
 if(kind==='products')purchase=window.SgcProductPurchase.controls(box,item,{preferences:p,preview});const info=node('details',null,box,'sgc-product-description');node('summary','Product details',info);info.open=true;info.append(description);if(kind!=='products')contact(box,item);
}
function catalogue(title,items,kind,parent){const target=parent||section(title);if(parent)node('h2',title,target);const grid=node('div',null,target,kind==='products'?'sgc-store-grid':'grid');if(kind==='services'){grid.classList.add('service-grid');grid.style.setProperty('--service-columns',Math.max(1,Math.min(4,Number(p.servicesDesktopColumns)||3)));grid.style.setProperty('--service-mobile-columns',Math.max(1,Math.min(2,Number(p.servicesMobileColumns)||1)));}items.forEach(item=>{if(kind==='products'){M.card(grid,item,money(item.onSale&&item.salePrice!=null?item.salePrice:item.price),()=>{location.hash=kind+'/'+encodeURIComponent(item.seoSlug||item.id);});return;}const card=node('article',null,grid,'card');image(list(item.images)[0],item.name,card);if(kind==='products')M.hover(card,card.querySelector('img'),item.images,()=>{location.hash=kind+'/'+encodeURIComponent(item.seoSlug||item.id);});node('h3',item.name,card);node('p',money(item.onSale&&item.salePrice!=null?item.salePrice:item.price),card,'price');node('p',text(item.description).slice(0,180),card);const a=node('a',kind==='products'?'View product':'View service',card,'button');a.href='#'+kind+'/'+encodeURIComponent(item.seoSlug||item.id);});return target;}
function home(){
 main.replaceChildren();const enabled=id=>!list(p.homeSections).length||p.homeSections.some(s=>s.id===id&&s.visible!==false);
 if(site.products.length&&enabled('Products')){const e=catalogue('Products',site.products,'products');e.id='products';if(p.delivery)node('p',p.delivery,e);}
 if(site.services.length&&p.servicesHomeVisible!=='No'&&enabled('Services')){const e=catalogue(p.servicesTitle||'Services',site.services,'services');e.id='services';if(p.servicesDescription)node('p',p.servicesDescription,e);}
 if(p.about&&enabled('About us')){const e=section('About us');e.id='about';node('p',p.about,e);if(p.team)node('p',p.team,e);}
 if(p.postTitle||p.postBody){const e=section(p.postTitle||'News');e.id='news';node('p',p.postBody,e);}
 if(p.photos&&enabled('Pictures')){const e=section('Gallery');e.id='gallery';const grid=node('div',null,e,'gallery');lines(p.photos).slice(0,30).forEach(src=>image(src,'Gallery image',grid));}
 if(p.media){const e=section('Media');lines(p.media).forEach((u,i)=>link('Open resource '+(i+1),u,e));}
 const e=section('Contact us');e.id='contact';if(p.email)node('p','Email: '+p.email,e);if(p.phone)node('p','Phone: '+p.phone,e);const links=node('div',null,e,'links');[['whatsapp','WhatsApp'],['instagram','Instagram'],['facebook','Facebook']].forEach(([k,l])=>link(l,p[k],links));contact(e);
 const order={'Products':'products','Services':'services','Pictures':'gallery','About us':'about','Contact us':'contact','News':'news'};if(Array.isArray(p.homeSections))p.homeSections.forEach(entry=>{const block=document.getElementById(order[entry.id]);if(block){block.hidden=entry.visible===false;main.append(block);}});
}
function route(){const [kind,raw]=location.hash.slice(1).split('/');const hero=root.querySelector('.hero');if(hero)hero.hidden=['products','services','cart','search'].includes(kind);if(['products','services'].includes(kind)&&raw){let key;try{key=decodeURIComponent(raw);}catch{return home();}const item=site[kind].find(i=>(i.seoSlug||i.id)===key);if(item){detail(item,kind);main.scrollIntoView?.({block:'start'});return;}}home();if(['products','services','contact','about','gallery'].includes(kind))document.getElementById(kind)?.scrollIntoView?.();}
function render(data){
 site=data;p=site.preferences||{};site.products=list(site.products);site.services=list(site.services);
 document.title=text(site.business_name);document.querySelector('meta[name=description]').content=text(p.seo||site.description).slice(0,300);
 document.documentElement.style.setProperty('--primary',colour(site.primary_color,'#efdce6'));document.documentElement.style.setProperty('--accent',colour(site.accent_color,'#463445'));
 document.documentElement.style.setProperty('--ink','#302830');
 if(p.siteTheme==='Dark'){document.documentElement.style.setProperty('--bg','#211e24');document.documentElement.style.setProperty('--ink','#faf5f9');}else document.documentElement.style.setProperty('--bg',colour(p.siteBackground,'#ffffff'));
 const fontNames=['Open Sans','Arial','Georgia','Trebuchet MS','Verdana','Lato','Montserrat','Roboto Condensed','Source Sans Pro','Lora','Playfair Display','Oswald','Merriweather','Raleway','Kalam','Dancing Script'];
 const chosen=fontNames.includes(p.siteFont)?p.siteFont:(site.font==='Georgia,serif'?'Georgia':'Arial');
 document.body.style.fontFamily='"'+chosen+'",'+(['Georgia','Lora','Playfair Display','Merriweather'].includes(chosen)?'serif':'sans-serif');
 let fontLink=document.getElementById('sgc-site-font');if(!fontLink){fontLink=document.createElement('link');fontLink.id='sgc-site-font';fontLink.rel='stylesheet';document.head.append(fontLink);}
 fontLink.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(chosen)+':wght@400;600;700&display=swap';
 let favicon=document.querySelector('link[rel=icon]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.append(favicon);}if(url(p.favicon))favicon.href=url(p.favicon);else favicon.removeAttribute('href');
 document.documentElement.style.setProperty('--primary',colour(p.themePrimary||site.primary_color,'#efdce6'));
 document.documentElement.style.setProperty('--accent',colour(p.themeSecondary||site.accent_color,'#463445'));

 root.replaceChildren();if(p.contactBarEnabled==='Yes'){const bar=node('div',[p.email,p.phone].filter(Boolean).join(' • '),root,'contact-bar');bar.hidden=!bar.textContent;}
 if(p.announcementEnabled==='Yes'&&p.announcementText){const bar=node('div',p.announcementText,root,'announcement');bar.style.background=p.announcementBgMode==='Custom color'?colour(p.announcementBg,'#f3e2e9'):'var(--accent)';bar.style.color=colour(p.announcementTextColor,'#ffffff');}
 const header=node('header',null,root,'site-header'),brand=node('a',p.logoText||site.business_name,header,'brand');brand.href='#';brand.style.fontSize=Math.max(8,Math.min(120,Number(p.logoSize)||25))+'px';brand.style.letterSpacing=Math.max(-20,Math.min(20,Number(p.logoSpacing)||0))+'px';brand.style.color=p.logoColorMode==='Custom color'?colour(p.logoColor,'#342b35'):'inherit';if(p.logoStyle==='Logo / image'&&url(p.logo)){brand.textContent='';image(p.logo,site.business_name,brand);}if(p.logoStyle==='Hidden')brand.hidden=true;
 const nav=node('nav',null,header);nav.id='site-menu';nav.setAttribute('aria-label','Main navigation');
 header.style.background=p.menuBackgroundMode==='Custom color'?colour(p.menuBackground,'#ffffff'):'#ffffff';
 header.style.color=p.menuColorMode==='Custom color'?colour(p.menuColor,'#342b35'):'#342b35';
 header.style.position=p.stickyMenu==='Yes'?'sticky':'relative';
 header.style.top=p.stickyMenu==='Yes'?'0':'auto';
 header.style.zIndex='40';
 nav.style.display='flex';nav.style.alignItems='center';nav.style.flexWrap='wrap';nav.style.gap='10px';
 nav.style.justifyContent=p.menuPosition==='Left'?'flex-start':p.menuPosition==='Center'?'center':'flex-end';
 nav.style.fontSize=Math.max(8,Math.min(48,Number(p.menuSize)||14))+'px';
const entries=Array.isArray(p.menuEntries)?p.menuEntries:[{id:'Products',label:'Products'},{id:'Services',label:'Services'},{id:'About us',label:'About us'},{id:'Contact us',label:'Contact'}];const paths={'Products':'products','Services':'services','About us':'about','Contact us':'contact','Pictures':'gallery'};
 entries.filter(e=>e.visible!==false&&paths[e.id]).forEach(e=>{if(e.id==='Products'&&!site.products.length||e.id==='Services'&&(p.servicesMenuVisible==='No'||!site.services.length))return;const a=node('a',e.id==='Services'?(p.servicesMenuLabel||e.label||e.id):(e.label||e.id),nav);a.href='#'+paths[e.id];a.style.color='inherit';a.style.fontSize='inherit';});
 const actions=node('div',null,header,'site-header-actions');
 const toggle=node('button',p.hamburgerIcon||'☰',actions,'site-menu-toggle');toggle.type='button';toggle.setAttribute('aria-label','Open navigation menu');toggle.setAttribute('aria-controls','site-menu');toggle.setAttribute('aria-expanded','false');
 toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');nav.classList.toggle('is-open',open);};
 nav.addEventListener('click',()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');});
 header.classList.toggle('always-collapsed',p.alwaysCollapsed==='Yes');header.dataset.hamburgerPosition=['Left','Center','Right'].includes(p.hamburgerPosition)?p.hamburgerPosition:'Right';
 if(p.showSearch==='Yes'){const search=node('button','Search',actions);search.type='button';search.onclick=()=>{location.hash='search';};}
 if(p.showCart!=='No'&&site.products.length){const cart=node('button','Cart',actions);cart.type='button';cart.onclick=()=>{location.hash='cart';};}
 const hero=node('div',null,root,'hero');
 if(p.homeBackgroundType==='Custom color')hero.style.background=colour(p.homeBackground,'#efdce6');
 if(url(p.homeMediaUrl)){
  const video=p.homeMediaType==='Video';const media=node(video?'video':'img',null,hero,'hero-media');media.src=url(p.homeMediaUrl);media.style.objectPosition=Math.max(0,Math.min(100,Number(p.homeMediaX??50)))+'% '+Math.max(0,Math.min(100,Number(p.homeMediaY??50)))+'%';
  if(video){media.autoplay=true;media.muted=true;media.loop=true;media.playsInline=true;media.setAttribute('muted','');}else media.alt='';
  hero.classList.add('has-media');
  if(preview){
   hero.style.touchAction='none';hero.style.cursor='move';hero.title='Drag to position your header media';let drag=null;
   hero.addEventListener('pointerdown',event=>{if(event.target.closest('a,button'))return;drag={x:event.clientX,y:event.clientY,startX:Number(p.homeMediaX??50),startY:Number(p.homeMediaY??50)};hero.setPointerCapture?.(event.pointerId);event.preventDefault();});
   hero.addEventListener('pointermove',event=>{if(!drag)return;const bounds=hero.getBoundingClientRect();p.homeMediaX=Math.max(0,Math.min(100,drag.startX+(event.clientX-drag.x)/Math.max(1,bounds.width)*100));p.homeMediaY=Math.max(0,Math.min(100,drag.startY+(event.clientY-drag.y)/Math.max(1,bounds.height)*100));media.style.objectPosition=p.homeMediaX+'% '+p.homeMediaY+'%';});
   const finish=()=>{if(!drag)return;drag=null;window.parent.postMessage({type:'sgc-preview-media-position',x:p.homeMediaX,y:p.homeMediaY},location.origin);};hero.addEventListener('pointerup',finish);hero.addEventListener('pointercancel',finish);
  }
 }
 if(text(p.headline))node('h1',p.headline,hero);if(text(p.welcome))node('p',p.welcome,hero);
 const ctaText=p.homeButtonText??p.cta??'';if(ctaText){const cta=node('a',ctaText,hero,'button');cta.href='#'+(paths[p.homeButtonTarget]||'contact');}

 main=node('main',null,root);route();const footer=node('footer',null,root,'site-footer');if(p.footer)node('p',p.footer,footer);link('Hosted by SGC Network','https://sgcnetwork.co.za',footer);root.hidden=false;status.hidden=true;
}
if(preview){
 // Drafts are accepted only in the dedicated same-origin preview document, from its parent.
 window.addEventListener('message',event=>{if(window.parent===window||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='sgc-preview-render')return;try{render(event.data.site);if(event.data.route){location.hash=event.data.route;route();}}catch(error){status.hidden=false;status.textContent='Preview could not render: '+error.message;}});
 if(window.parent!==window)window.parent.postMessage({type:'sgc-preview-ready'},location.origin);
}else{
const host=location.hostname.toLowerCase();const sub=host.endsWith('.sgcnetwork.co.za')&&host!=='www.sgcnetwork.co.za'?host.slice(0,-'.sgcnetwork.co.za'.length):null;
const slug=sub||new URLSearchParams(location.search).get('site');
if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){status.textContent='Website not found.';return;}
fetch(API+'?site='+encodeURIComponent(slug),{credentials:'omit',cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok||!data.site)throw Error(data.error||'Website unavailable');render(data.site);}).catch(e=>{status.textContent=e.message;});
}
window.addEventListener('hashchange',()=>{if(site)route();});
})();
