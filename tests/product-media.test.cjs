const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const M=require('../product-media.js');
const C=require('../builder-catalogue-core.js');
const shared='https://example.com/size.jpg',green='https://example.com/green.jpg',green2='https://example.com/green-back.jpg',red='https://example.com/red.jpg';
const dress={id:'dress',name:'Dress',price:100,description:'Base dress',images:[green,green2,red,shared],variants:[{attributes:{Colour:'Green'},label:'Green',price:120,description:'Green cotton dress',image:green,images:[green,green2],stock:2},{attributes:{Colour:'Red'},label:'Red',price:150,image:red,images:[red],stock:0}],active:true,trackStock:true};
test('A variant shows its own images first, shared images next, and no other colour',()=>{
 assert.deepEqual(M.variantImages(dress,dress.variants[0]),[green,green2,shared]);
 assert.deepEqual(M.variantImages(dress,dress.variants[1]),[red,shared]);
 assert.deepEqual(M.variantImages(dress,null),dress.images);
 const saved=C.validate(dress);assert.equal(saved.variants[0].description,'Green cotton dress');assert.deepEqual(saved.variants[0].images,[green,green2]);
 assert.equal(C.effectivePrice(dress,{price:''}),100);
 const regenerated=C.combinations([{name:'Colour',values:['Green','Red']}],saved.variants);assert.deepEqual(regenerated[0].images,[green,green2]);assert.equal(regenerated[0].description,'Green cotton dress');
});
test('Hover rotates a single cover, resets on leave and respects reduced motion',()=>{
 const dom=new JSDOM('<article><img></article>',{runScripts:'outside-only'}),w=dom.window;
 let tick,cleared=0;w.setInterval=fn=>{tick=fn;return 1;};w.clearInterval=()=>cleared++;w.eval(fs.readFileSync('product-media.js','utf8'));
 const card=w.document.querySelector('article'),img=card.firstChild;img.src=green;w.SgcProductMedia.hover(card,img,dress.images,()=>{});
 card.dispatchEvent(new w.Event('mouseenter'));tick();assert.equal(img.src,green2);assert.equal(card.querySelectorAll('img').length,1);
 card.dispatchEvent(new w.Event('mouseleave'));assert.equal(img.src,green);assert.equal(cleared,1);
 tick=null;w.matchMedia=()=>({matches:true});card.dispatchEvent(new w.Event('mouseenter'));assert.equal(tick,null);dom.window.close();
});
test('Gallery thumbnails change the main image',()=>{
 const dom=new JSDOM('<div id="gallery"></div>',{runScripts:'outside-only'}),w=dom.window;w.eval(fs.readFileSync('product-media.js','utf8'));
 const gallery=w.document.getElementById('gallery');w.SgcProductMedia.gallery(gallery,[green,green2],'Dress');
 gallery.querySelectorAll('button')[1].click();assert.equal(gallery.querySelector('.sgc-product-main').src,green2);assert.equal(gallery.querySelectorAll('[aria-pressed=true]').length,1);dom.window.close();
});
test('Public product page switches image, price, description and stock, then restores the base',async()=>{
 const dom=new JSDOM('<meta name="description"><p id="site-status"></p><div id="site"></div>',{url:'https://sgcnetwork.co.za/published-site.html?site=dress',runScripts:'outside-only'}),w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({site:{business_name:'Dresses',preferences:{},products:[dress],services:[]}})});
 w.eval(fs.readFileSync('product-media.js','utf8'));w.eval(fs.readFileSync('business.js','utf8'));await new Promise(r=>setImmediate(r));
 w.location.hash='products/dress';w.dispatchEvent(new w.Event('hashchange'));
 const select=w.document.querySelector('select');select.value='0';select.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelector('.sgc-product-main').src,green);assert.equal(w.document.querySelector('.price').textContent,'R 120.00');assert.match(w.document.querySelector('.detail').textContent,/Green cotton dress/);assert.equal(w.document.querySelectorAll('.sgc-product-thumbnails button').length,3);
 select.value='1';select.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelector('.sgc-product-main').src,red);assert.equal(w.document.querySelector('.price').textContent,'R 150.00');assert.match(w.document.querySelector('.detail').textContent,/Currently out of stock/);assert.match(w.document.querySelector('.detail').textContent,/Base dress/);
 select.value='';select.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelector('.price').textContent,'R 100.00');assert.equal(w.document.querySelectorAll('.sgc-product-thumbnails button').length,4);w.close();
});
test('Editor assigns uploaded images to a variant or all variants and saves descriptions',async()=>{
 const dom=new JSDOM('<div id="fields"></div><p id="status"></p>',{url:'https://sgcnetwork.co.za/website-builder.html',runScripts:'outside-only'}),w=dom.window;
 for(const f of ['builder-catalogue-core.js','builder-catalogue.js'])w.eval(fs.readFileSync(f,'utf8'));
 let saved;w.sgcSaveBuilderPreferences=async p=>{saved=p;};w.sgcPreviewCatalogueItem=()=>{};
 w.sgcCatalogueEditor('products',{productItems:[dress]},w.document.getElementById('fields'),w.document.getElementById('status'));
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Edit').click();
 // Assign the fourth (shared) image to Green using an uploaded thumbnail.
 const scope=w.document.querySelector('[aria-label="Image 4 applies to"]');scope.value='0';scope.dispatchEvent(new w.Event('change'));
 const desc=w.document.querySelector('[aria-label="Green description"]');desc.value='Green satin dress';desc.dispatchEvent(new w.Event('input',{bubbles:true}));
 w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.ok(saved.productItems[0].variants[0].images.includes(shared));assert.equal(saved.productItems[0].variants[0].description,'Green satin dress');
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Edit').click();const reset=w.document.querySelector('[aria-label="Image 4 applies to"]');reset.value='';reset.dispatchEvent(new w.Event('change'));
 w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.ok(saved.productItems[0].variants.every(v=>!v.images.includes(shared)));w.close();
});
test('Variant picture picker selects existing pictures and bulk uploads directly to the variant',async()=>{
 const dom=new JSDOM('<div id="fields"></div><p id="status"></p>',{url:'https://sgcnetwork.co.za/website-builder.html',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const f of ['builder-catalogue-core.js','builder-catalogue.js'])w.eval(fs.readFileSync(f,'utf8'));
 let saved;w.sgcSaveBuilderPreferences=async p=>{saved=p;};w.sgcUploadBuilderImage=async f=>'https://example.com/'+f.name;
 w.sgcCatalogueEditor('products',{productItems:[dress]},w.document.getElementById('fields'),w.document.getElementById('status'));
 const button=t=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===t);button('Edit').click();button('Add / choose pictures').click();
 const dialog=w.document.querySelector('dialog');assert.ok(dialog.open);const checks=dialog.querySelectorAll('input[type=checkbox]');assert.equal(checks[0].checked,true);checks[3].checked=true;checks[3].dispatchEvent(new w.Event('change'));
 const upload=dialog.querySelector('input[type=file]');Object.defineProperty(upload,'files',{value:[new w.File(['x'],'green-side.jpg',{type:'image/jpeg'}),new w.File(['x'],'green-detail.jpg',{type:'image/jpeg'})]});upload.dispatchEvent(new w.Event('change'));await new Promise(r=>setImmediate(r));
 assert.equal(dialog.querySelectorAll('input[type=checkbox]').length,6);button('Use selected pictures').click();assert.equal(w.document.querySelector('dialog'),null);
 w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));
 const variant=saved.productItems[0].variants[0];assert.ok(variant.images.includes(shared));assert.ok(variant.images.includes('https://example.com/green-side.jpg'));assert.ok(variant.images.includes('https://example.com/green-detail.jpg'));assert.equal(saved.productItems[0].images.length,6);w.close();
});
