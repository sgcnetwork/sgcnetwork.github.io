(function(root){
'use strict';
const urls=values=>[...new Set((Array.isArray(values)?values:[]).filter(value=>{try{return new URL(value).protocol==='https:';}catch{return false;}}))];
function variantImages(item,variant){
 const all=urls(item.images);if(!variant)return all;
 const own=urls([variant.image,...(variant.images||[])]).filter(u=>all.includes(u));
 const assigned=new Set((item.variants||[]).flatMap(v=>[v.image,...(v.images||[])]));
 const shared=all.filter(u=>!assigned.has(u));return [...new Set([...own,...shared])];
}
function hover(card,img,values,open){
 const images=urls(values);if(!img||!images.length)return;
 let timer=null,index=0;const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;index=0;img.src=images[0];};
 const start=()=>{if(timer!==null||images.length<2||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;timer=setInterval(()=>{if(!card.isConnected){stop();return;}index=(index+1)%images.length;img.src=images[index];},1000);};
 card.addEventListener('mouseenter',start);card.addEventListener('mouseleave',stop);card.addEventListener('focusin',start);card.addEventListener('focusout',e=>{if(!card.contains(e.relatedTarget))stop();});
 if(typeof open==='function')img.addEventListener('click',open);img.style.cursor='pointer';
 return stop;
}
function gallery(host,values,name){
 host.replaceChildren();host.classList.add('sgc-product-gallery');const images=urls(values);
 if(!images.length){const p=document.createElement('p');p.textContent='No images for this option.';host.append(p);return;}
 const main=document.createElement('img');main.className='sgc-product-main';main.src=images[0];main.alt=name;host.append(main);
 const thumbs=document.createElement('div');thumbs.className='sgc-product-thumbnails';thumbs.setAttribute('aria-label','Product pictures');host.append(thumbs);
 images.forEach((url,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Show picture '+(i+1));b.setAttribute('aria-pressed',String(i===0));const img=document.createElement('img');img.src=url;img.alt='';b.append(img);b.onclick=()=>{main.src=url;[...thumbs.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};thumbs.append(b);});
}
function card(host,item,price,open){
 const doc=host.ownerDocument,make=(tag,text,parent,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 const entry=make('article',null,host,'sgc-store-card');const media=make('button',null,entry,'sgc-store-image');media.type='button';media.setAttribute('aria-label','View '+item.name);media.onclick=open;
 const images=urls(item.images);if(images.length){const img=make('img',null,media);img.src=images[0];img.alt=item.name;img.loading='lazy';hover(entry,img,images);}else make('span','Image coming soon',media,'sgc-store-placeholder');
 const variants=(item.variants||[]).filter(v=>v.image||(v.images||[]).length);const pictures=[...new Set(variants.map(v=>v.image||v.images[0]))];
 if(pictures.length>1){const strip=make('span',null,media,'sgc-store-swatches');pictures.slice(0,4).forEach(src=>{const img=make('img',null,strip);img.src=src;img.alt='';});}
 const title=make('button',item.name,entry,'sgc-store-name');title.type='button';title.onclick=open;
 const footer=make('div',null,entry,'sgc-store-card-footer');make('strong',price,footer,'sgc-store-price');const view=make('button','View product',footer,'sgc-store-view');view.type='button';view.onclick=open;
 return entry;
}
function options(select,variants){
 if(!variants?.length)return;select.hidden=true;const doc=select.ownerDocument,group=doc.createElement('div');group.className='sgc-product-options';group.setAttribute('role','group');group.setAttribute('aria-label','Choose a product option');select.after(group);
 const buttons=variants.map((v,i)=>{const b=doc.createElement('button');b.type='button';b.textContent=v.label||'Option '+(i+1);b.setAttribute('aria-pressed','false');const src=urls([v.image,...(v.images||[])])[0];if(src){const img=doc.createElement('img');img.src=src;img.alt='';b.prepend(img);}b.onclick=()=>{select.value=String(i);select.dispatchEvent(new root.Event('change',{bubbles:true}));};group.append(b);return b;});
 select.addEventListener('change',()=>buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(select.value===String(i)))));
}
const api={variantImages,hover,gallery,card,options};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SgcProductMedia=api;
})(typeof window!=='undefined'?window:globalThis);
