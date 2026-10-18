(function(){
'use strict';
const M=window.SgcProductMedia;
const root=document.getElementById('preview'),old=window.sgcRenderFullPreview,C=window.SgcCatalogue;
const node=(tag,text,parent,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
const btn=(label,parent,fn)=>{const b=node('button',label,parent,'button soft');b.type='button';b.onclick=fn;return b;};
let current={},route={type:'home'};
function image(url,parent,name){try{if(new URL(url).protocol!=='https:')return;}catch{return;}const img=node('img',null,parent,'sgc-detail-image');img.src=url;img.alt=name;}
function priceText(price){return price==null?'Ask for details':'R '+price.toFixed(2);}
function safePrice(item,variant){try{return C.effectivePrice(item,variant);}catch{return null;}}
function detail(kind,item,parent){
 const product=kind==='products';btn('← Back to '+kind,parent,()=>navigate({type:kind}));node('h2',item.name,parent);const gallery=node('div',null,parent,'sgc-detail-gallery');M.gallery(gallery,item.images,item.name);
 const description=node('div',null,parent);description.innerHTML=window.sgcSanitizeDescription(item.descriptionHtml||'');if(!item.descriptionHtml)description.textContent=item.description||'';
 const price=node('p',priceText(safePrice(item)),parent,'sgc-detail-price');
 if(item.onSale&&item.price!=null)node('del','R '+Number(item.price).toFixed(2),parent);
 if(product){let selected=null;const choose=node('select',null,parent);choose.setAttribute('aria-label','Select a product variant');choose.hidden=!item.variants?.length;
  if(item.variants?.length){node('option','Select an option',choose).value='';item.variants.forEach((v,i)=>node('option',v.label||[v.option,v.value].filter(Boolean).join(' / '),choose).value=i);}
  const stock=node('p',null,parent);const update=()=>{selected=choose.value===''?null:item.variants?.[Number(choose.value)];const amount=safePrice(item,selected);price.textContent=priceText(amount);stock.textContent=item.trackStock?((selected?.stock??item.stock)>0?'In stock: '+(selected?.stock??item.stock):'Out of stock'):'';M.gallery(gallery,M.variantImages(item,selected),item.name);if(selected?.description){description.textContent=selected.description;}else{description.innerHTML=window.sgcSanitizeDescription(item.descriptionHtml||'');if(!item.descriptionHtml)description.textContent=item.description||'';}};choose.onchange=update;update();
  const quantity=node('input',null,parent);quantity.type='number';quantity.min=1;quantity.step=1;quantity.value=1;quantity.setAttribute('aria-label','Quantity');
  if(item.requestDetails){node('label',item.detailsPrompt||'Additional details',parent);const input=node('textarea',null,parent);input.setAttribute('aria-label',item.detailsPrompt||'Additional details');}
  node('p','Private product-page preview. Checkout will be enabled after payment verification and publishing are configured.',parent,'muted');
 }else{const label=item.actionType==='booking'?'Book this service':item.actionType==='contact'?'Contact us':'Enquire about this service';const action=btn(label,parent,()=>{const box=node('section',null,parent,'sgc-preview-enquiry');node('h4',label,box);if(current.email)node('p','Email: '+current.email,box);if(current.phone)node('p','Phone: '+current.phone,box);if(item.actionUrl)node('p','Destination: '+item.actionUrl,box);node('p','Preview only — no message or booking has been submitted.',box);action.disabled=true;});}
}
function listing(kind,parent){const key=kind==='products'?'productItems':'serviceItems';node('h2',kind==='services'?(current.servicesTitle||'Our services'):'Our products',parent);const items=(current[key]||[]).filter(x=>x.active!==false);if(!items.length){node('p','More coming soon.',parent);return;}const grid=node('div',null,parent,'sgc-customer-grid');if(kind==='services'){grid.style.setProperty('--desktop-columns',Math.max(1,Math.min(4,Number(current.servicesDesktopColumns)||3)));grid.style.setProperty('--mobile-columns',Math.max(1,Math.min(2,Number(current.servicesMobileColumns)||1)));}items.forEach(item=>{const card=node('article',null,grid,'sgc-service-card');if(item.images?.[0]){image(item.images[0],card,item.name);if(kind==='products')M.hover(card,card.querySelector('img'),item.images,()=>navigate({type:'detail',kind,id:item.id}));}node('strong',item.name,card);node('p',priceText(C.effectivePrice(item)),card);btn('View '+(kind==='products'?'product':'service'),card,()=>navigate({type:'detail',kind,id:item.id}));});}
function navigate(next){route=next;window.sgcRenderFullPreview(current);}
window.sgcNavigatePreview=function(label){
 const entry=(current.menuEntries||[]).find(e=>e.label===label||e.id===label);
 const key=(entry?.id||label).toLowerCase();
 navigate({type:key});
};
function draw(){
 old(current);root.querySelectorAll('.sgc-preview-page').forEach(x=>x.remove());const home=route.type==='home';root.querySelector('#hero').hidden=!home;root.querySelector('.product-row').hidden=true;root.querySelector('.sgc-preview-custom').hidden=!home;
 const nav=root.querySelector('.sgc-preview-navlinks')||node('nav',null,root.querySelector('.preview-top'),'sgc-preview-navlinks');const entries=current.menuEntries||[{id:'Products',label:'Products',visible:true},{id:'Services',label:'Services',visible:true},{id:'Contact us',label:'Contact',visible:true}];nav.replaceChildren();btn('Home',nav,()=>navigate({type:'home'}));entries.filter(e=>e.visible!==false).forEach(e=>{if(e.id==='Services'&&(current.servicesMenuVisible==='No'||(current.servicesHideEmpty==='Yes'&&!(current.serviceItems||[]).some(x=>x.active!==false))))return;btn(e.id==='Services'?(current.servicesMenuLabel||e.label):e.label,nav,()=>navigate({type:e.id.toLowerCase()}));});
 const shop=root.querySelector('#shop');shop.setAttribute('role','button');shop.tabIndex=0;shop.onclick=()=>navigate({type:(current.homeButtonTarget||'Products').toLowerCase()});shop.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();shop.click();}};
 root.querySelectorAll('.sgc-preview-product').forEach((card,i)=>{const item=(current.productItems||[]).filter(x=>x.active!==false)[i];if(item){M.hover(card,card.querySelector('img'),item.images,()=>navigate({type:'detail',kind:'products',id:item.id}));btn('View product',card,()=>navigate({type:'detail',kind:'products',id:item.id}));}});root.querySelectorAll('.sgc-service-card').forEach((card,i)=>{const item=(current.serviceItems||[]).filter(x=>x.active!==false)[i];if(item)btn('View service',card,()=>navigate({type:'detail',kind:'services',id:item.id}));});
 if(home)return;const page=node('section',null,root,'sgc-preview-page');
 if(route.type==='search'){
 node('h2','Search',page);
 const input=node('input',null,page);input.type='search';input.placeholder='Search products and services';input.setAttribute('aria-label','Search products and services');
 const results=node('div',null,page);results.setAttribute('aria-live','polite');
 const search=()=>{results.replaceChildren();const term=input.value.trim().toLowerCase();if(!term){node('p','Enter a product or service name.',results);return;}let count=0;for(const kind of ['products','services'])for(const item of current[kind==='products'?'productItems':'serviceItems']||[]){if(item.active===false||![item.name,item.description].filter(Boolean).join(' ').toLowerCase().includes(term))continue;count++;const card=node('article',null,results,'sgc-service-card');node('strong',item.name,card);node('p',priceText(safePrice(item)),card);btn('View '+(kind==='products'?'product':'service'),card,()=>navigate({type:'detail',kind,id:item.id}));}if(!count)node('p','No matching products or services.',results);};
 input.addEventListener('input',search);search();
}else if(route.type==='cart'){
 node('h2','Your cart',page);node('p','Your cart is empty.',page);btn('Browse products',page,()=>navigate({type:'products'}));
}else if(route.type==='products'||route.type==='services')listing(route.type,page);
 else if(route.type==='detail'){const item=(current[route.kind==='products'?'productItems':'serviceItems']||[]).find(x=>x.id===route.id&&x.active!==false);if(item)detail(route.kind,item,page);else{node('p','This item is no longer visible.',page);btn('Back to home',page,()=>navigate({type:'home'}));}}
 else if(route.type==='contact us'){node('h2','Contact us',page);[current.email,current.phone].filter(Boolean).forEach(x=>node('p',x,page));}
 else if(route.type==='about us'){node('h2','About us',page);node('p',current.about||'',page);}
 else{node('h2',route.type.charAt(0).toUpperCase()+route.type.slice(1),page);node('p','This section is being configured.',page);}
}
window.sgcRenderFullPreview=function(p){current=p||{};draw();};
window.sgcPreviewCatalogueItem=function(kind,item){const key=kind==='products'?'productItems':'serviceItems';const draft=window.sgcGetBuilderDraft?.()||{};const items=(draft[key]||[]).filter(x=>x.id!==item.id);current={...draft,[key]:[...items,{...item,active:true}]};route={type:'detail',kind,id:item.id};draw();};
})();
