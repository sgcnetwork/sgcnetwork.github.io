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
 img.addEventListener('click',open);img.style.cursor='pointer';
 return stop;
}
function gallery(host,values,name){
 host.replaceChildren();host.classList.add('sgc-product-gallery');const images=urls(values);
 if(!images.length){const p=document.createElement('p');p.textContent='No images for this option.';host.append(p);return;}
 const main=document.createElement('img');main.className='sgc-product-main';main.src=images[0];main.alt=name;host.append(main);
 const thumbs=document.createElement('div');thumbs.className='sgc-product-thumbnails';thumbs.setAttribute('aria-label','Product pictures');host.append(thumbs);
 images.forEach((url,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Show picture '+(i+1));b.setAttribute('aria-pressed',String(i===0));const img=document.createElement('img');img.src=url;img.alt='';b.append(img);b.onclick=()=>{main.src=url;[...thumbs.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};thumbs.append(b);});
}
const api={variantImages,hover,gallery};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SgcProductMedia=api;
})(typeof window!=='undefined'?window:globalThis);
