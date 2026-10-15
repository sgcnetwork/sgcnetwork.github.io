const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','payment.html'),'utf8');
const settle=()=>new Promise(r=>setImmediate(r));
function page(query,product){
 const dom=new JSDOM(source,{url:'https://sgcnetwork.co.za/payment.html?'+query,runScripts:'outside-only'}),w=dom.window;
 w.sgcSupabase={from(){const q={select:()=>q,eq:()=>q,is:()=>q,single:async()=>({data:product,error:null})};return q}};
 w.eval([...w.document.scripts].find(s=>s.textContent.includes('const FUNCTION_URL')).textContent);return dom;
}
test('Checkout displays the confirmed entry, Academy and builder prices',()=>{
 for(const [type,price] of [['start','R150 once-off'],['build','R450 / month'],['builder','R199 / month']]){
  const dom=page('type='+type);assert.equal(dom.window.document.getElementById('price').textContent,price);
  if(type!=='start')assert.match(dom.window.document.getElementById('checkoutCopy').textContent,/Automatic debit renewals are not enabled/);dom.window.close();
 }
});
test('Dynamic monthly checkout also discloses payment-based renewal',async()=>{
 const dom=page('productId=builder',{id:'builder',name:'Website Builder',price_zar:199,billing:'monthly',active:true});await settle();
 assert.equal(dom.window.document.getElementById('price').textContent,'R199.00 / month');assert.match(dom.window.document.getElementById('checkoutCopy').textContent,/one month of access automatically/);dom.window.close();
});
