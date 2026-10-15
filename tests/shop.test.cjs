const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const settle=()=>new Promise(r=>setImmediate(r));
function shop(){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','shop.html'),'utf8'),{url:'https://sgcnetwork.co.za/shop.html?category=extras',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;const records={sgc_products:[{id:'p1',name:'Manual',price_zar:20,billing:'once',active:true,deleted_at:null}],sgc_product_settings:[{product_id:'p1',category:'extras'}],sgc_studio_product_media:[{product_id:'p1',image_url:'https://example.com/old.jpg'}]};let variants=[];
 const db={auth:{getUser:async()=>({data:{user:null}})},from(table){let filters=[];const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},is(k,v){filters.push(row=>(row[k]??null)===v);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},order(){return q},then(resolve){return Promise.resolve({data:(records[table]||[]).filter(row=>filters.every(f=>f(row))),error:null}).then(resolve)}};return q},rpc:async()=>({data:variants,error:null})};
 w.supabase={createClient:()=>db};w.setInterval=()=>0;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 const script=[...w.document.scripts].find(s=>s.textContent.includes('catalogueSignature'));w.eval(script.textContent+';window.refreshCatalogue=refreshCatalogue;window.presentationChanged=presentationChanged;');
 return {w,records,setVariants:v=>variants=v};
}
test('Shop refresh reflects image-only, category-only, variant-only and deleted product changes',async()=>{
 const e=shop(),w=e.w;await settle();assert.equal(w.document.querySelector('#catalogue img').src,'https://example.com/old.jpg');
 e.records.sgc_studio_product_media[0].image_url='https://example.com/new.jpg';await w.eval('refreshCatalogue()');assert.equal(w.document.querySelector('#catalogue img').src,'https://example.com/new.jpg');
 e.setVariants([{id:'v1',product_id:'p1',name:'Premium',price_zar:50}]);assert.equal(await w.eval('presentationChanged('+JSON.stringify(e.records.sgc_products)+')'),true);await w.eval('refreshCatalogue()');assert.equal(await w.eval('presentationChanged('+JSON.stringify(e.records.sgc_products)+')'),false);
 e.records.sgc_product_settings[0].category='manuals';await w.eval('refreshCatalogue()');assert.equal(w.document.querySelector('#catalogue .product-card'),null);
 e.records.sgc_product_settings[0].category='extras';await w.eval('refreshCatalogue()');assert.ok(w.document.querySelector('#catalogue .product-card'));
 e.records.sgc_products[0].deleted_at='2026-10-15T00:00:00Z';await w.eval('refreshCatalogue()');assert.equal(w.document.querySelector('#catalogue .product-card'),null);
 w.close();
});
