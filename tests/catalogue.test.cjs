const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../builder-catalogue-core.js');
test('Cartesian variants preserve values and enforce unique options and size limit',()=>{
 const options=[{name:'Size',values:['S','M']},{name:'Colour',values:['Pink','Black']}];
 const rows=C.combinations(options);assert.equal(rows.length,4);rows[2].price=125;rows[2].stock=7;
 assert.equal(C.combinations(options,rows)[2].price,125);
 assert.throws(()=>C.combinations([{name:'Size',values:['S']},{name:'size',values:['M']}]),/unique/);
 assert.throws(()=>C.combinations([{name:'N',values:Array.from({length:101},(_,i)=>String(i))}]),/100/);
});
test('Blank and zero prices, sale validation, stock and malicious image URLs',()=>{
 assert.equal(C.effectivePrice({price:null}),null);assert.equal(C.effectivePrice({price:0}),0);
 assert.equal(C.effectivePrice({price:100,onSale:true,salePrice:70},{price:50}),50);
 assert.throws(()=>C.validate({name:'Kit',price:80,salePrice:90,onSale:true}),/lower/);
 assert.throws(()=>C.quantity(1.5),/whole/);
 const v=C.validate({name:'A dress',price:null,images:['javascript:alert(1)','https://example.com/image.jpg']});assert.equal(v.images.length,1);assert.equal(v.seoSlug,'a-dress');
});
const {JSDOM}=require(process.env.SGC_JSDOM_PATH||'jsdom');
function environment(initial={},kind='products'){
 const dom=new JSDOM('<div id="fields"></div><p id="status"></p>',{url:'https://sgcnetwork.co.za/website-builder.html?editor='+kind+'&'+(kind==='products'?'product':'service')+'=new',runScripts:'outside-only'});
 const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(fs.readFileSync(path.join(__dirname,'..','builder-catalogue-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'..','builder-catalogue.js'),'utf8'));
 let saved=JSON.parse(JSON.stringify(initial));let renders=0;w.sgcSaveBuilderPreferences=async p=>{saved=JSON.parse(JSON.stringify(p));};w.sgcRenderFullPreview=()=>renders++;w.sgcCacheBuilderDraft=()=>{};
 const draft=JSON.parse(JSON.stringify(initial));w.sgcCatalogueEditor(kind,draft,w.document.getElementById('fields'),w.document.getElementById('status'));
 return {w,draft,dom,saved:()=>saved,renders:()=>renders};
}
const byText=(w,t)=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===t);
const settle=()=>new Promise(r=>setImmediate(r));
test('Create, save, reload, edit, duplicate and cancel product deletion',async()=>{
 const e=environment({otherSetting:'kept'}),w=e.w;
 w.document.getElementById('catalogue-name').value='Lip gloss';w.document.getElementById('catalogue-price').value='99';w.document.getElementById('catalogue-stock').value='8';
 const form=w.document.querySelector('form');form.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
 assert.equal(e.saved().productItems[0].price,99);assert.equal(e.saved().otherSetting,'kept');assert.equal(form.hidden,true);
 const reload=environment(e.saved());assert.match(reload.w.document.getElementById('fields').textContent,/Lip gloss/);byText(reload.w,'Edit').click();reload.w.document.getElementById('catalogue-price').value='80';reload.w.document.querySelector('form').dispatchEvent(new reload.w.Event('submit',{cancelable:true}));await settle();assert.equal(reload.saved().productItems[0].price,80);
 byText(reload.w,'Duplicate').click();await settle();assert.equal(reload.saved().productItems.length,2);assert.equal(reload.saved().productItems[1].active,false);assert.notEqual(reload.saved().productItems[0].seoSlug,reload.saved().productItems[1].seoSlug);
 byText(reload.w,'Delete').click();byText(reload.w,'No, keep it').click();await settle();assert.equal(reload.saved().productItems.length,2);
 byText(reload.w,'Delete').click();byText(reload.w,'Yes, delete').click();await settle();assert.equal(reload.saved().productItems.length,1);
});
test('Failed cloud save keeps previous records and unsaved editor open',async()=>{
 const e=environment();e.w.sgcSaveBuilderPreferences=async()=>{throw Error('permission denied');};e.w.document.getElementById('catalogue-name').value='Kit';const form=e.w.document.querySelector('form');form.dispatchEvent(new e.w.Event('submit',{cancelable:true}));await settle();assert.equal(e.draft.productItems.length,0);assert.equal(form.hidden,false);assert.match(form.textContent,/permission denied/);
});
test('Description sanitiser strips executable markup and event handlers',()=>{
 const e=environment();const value=e.w.sgcSanitizeDescription('<p onclick="alert(1)"><b>Safe</b><script>alert(1)</script><img src=x onerror=alert(1)></p>');assert.equal(value,'<p><b>Safe</b></p>');
});
test('Integrated studio loads catalogue controls and navigable variant detail preview',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','website-builder.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://sgcnetwork.co.za/website-builder.html',runScripts:'outside-only'});const w=dom.window;const errors=[];w.addEventListener('error',e=>errors.push(e.message));w.HTMLElement.prototype.scrollIntoView=function(){};w.ResizeObserver=class{observe(){} disconnect(){}};w.requestAnimationFrame=()=>0;
 w.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:null},error:null})}})};
 for(const s of w.document.querySelectorAll('script')){if(s.src){const file=path.basename(new URL(s.src).pathname);if(file.startsWith('builder-')||file==='product-media.js')w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));}else w.eval(s.textContent);}
 w.sgcInitBuilderSections('test-user');w.sgcSaveBuilderPreferences=async()=>{};
 const catalogue=[...w.document.querySelectorAll('#studio-menu button')].find(b=>b.textContent.includes('Products & online store'));catalogue.click();assert.ok(byText(w,'+ Add product'));
 const draft={productItems:[{id:'one',name:'Dress',price:100,stock:10,trackStock:true,active:true,images:['https://example.com/s.jpg','https://example.com/m.jpg'],variants:[{attributes:{Size:'S'},label:'S',price:80,stock:2,image:'https://example.com/s.jpg',description:'Small dress'},{attributes:{Size:'M'},label:'M',price:90,stock:0,image:'https://example.com/m.jpg',description:'Medium dress'}]}]};w.sgcRenderFullPreview(draft);
 byText(w,'View product').click();const select=w.document.querySelector('#preview select');assert.equal(select.options.length,3);select.value='0';select.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelector('.sgc-detail-price').textContent,'R 80.00');assert.equal(w.document.querySelector('.sgc-product-main').src,'https://example.com/s.jpg');assert.match(w.document.querySelector('.sgc-preview-page').textContent,/Small dress/);assert.match(w.document.querySelector('.sgc-preview-page').textContent,/In stock: 2/);
 select.value='1';select.dispatchEvent(new w.Event('change'));assert.match(w.document.querySelector('.sgc-preview-page').textContent,/Out of stock/);assert.equal(w.document.querySelector('.sgc-product-main').src,'https://example.com/m.jpg');assert.match(w.document.querySelector('.sgc-preview-page').textContent,/Medium dress/);byText(w,'← Back to products').click();assert.match(w.document.querySelector('.sgc-preview-page').textContent,/Our products/);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.document.getElementById('view-tablet').click();assert.ok(w.document.getElementById('preview-shell').classList.contains('tablet'));w.document.getElementById('view-mobile').click();assert.ok(w.document.getElementById('preview-shell').classList.contains('mobile'));assert.equal(w.document.getElementById('preview-shell').classList.contains('tablet'),false);assert.deepEqual(errors,[]);
});
test('Service create, edit and booking URL persist without product variants',async()=>{
 const e=environment({},'services'),w=e.w;w.document.getElementById('catalogue-name').value='Business consultation';w.document.getElementById('catalogue-actionType').value='booking';w.document.getElementById('catalogue-actionUrl').value='https://example.com/book';w.document.getElementById('catalogue-categories').value='Business, Coaching';w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();assert.equal(e.saved().serviceItems[0].actionType,'booking');assert.equal(e.saved().serviceItems[0].actionUrl,'https://example.com/book');assert.deepEqual(e.saved().serviceItems[0].categories,['Business','Coaching']);assert.deepEqual(e.saved().serviceItems[0].variants,[]);
});
