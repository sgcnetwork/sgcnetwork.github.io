const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function handler(file,{event={},tx={},row=null,user=null,invalidSignature=false,entryAllowed=false}={}){
 const writes=[],filters=[],requests=[],logs=[];let serve;
 const db={auth:{getUser:async()=>({data:{user}})},from(table){
  let update=null;const query={select(){return query},eq(k,v){filters.push([table,k,v]);return query},is(k,v){filters.push([table,k,v]);return query},update(data){update=data;return query},insert(data){writes.push({table,data});return query},single:async()=>({data:table==='sgc_stitch_transactions'?tx:row,error:null}),then(resolve){if(update)writes.push({table,data:update});return Promise.resolve({data:null,error:null}).then(resolve)}};return query;
 },rpc:async(name)=>{if(name==='sgc_checkout_membership_allowed')return {data:entryAllowed,error:null};throw Error('Unexpected membership activation')}};
 const context={Request,Response,URL,Date,TextDecoder,Uint8Array,crypto,console:{log:(...v)=>logs.push(v),error:(...v)=>logs.push(v)},Deno:{env:{get:()=> 'test-only'},serve:fn=>serve=fn},createClient:()=>db,Webhook:class{verify(){if(invalidSignature)throw Error('Invalid signature');return event}},fetch:async(url,options)=>{requests.push({url,options});return Response.json(url.endsWith('/token')?{data:{accessToken:'TEST_TOKEN'}}:{data:{payment:{id:'link-1',link:'https://example.com/pay',merchantReference:event.reference}}})}};
 const source=fs.readFileSync(require('node:path').join(__dirname,'..','supabase','functions',file,'index.ts'),'utf8').replace(/^import .*;\s*$/mg,'');
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 return {serve,writes,filters,requests,logs};
}
const headers={'svix-id':'test','svix-timestamp':'test','svix-signature':'test'};
function webhook(h){return h.serve(new Request('https://example.com',{method:'POST',headers,body:'{}'}));}
test('Verified R1 and preview webhooks record payment without activating membership',async()=>{
 for(const code of ['T','P','K','G','L']){const tx={id:'checkout',stitch_payment_id:'link-1',amount_zar:1,paid_at:'2026-10-01T00:00:00Z'};const h=handler('rapid-task',{event:{status:'PAID',linkId:'link-1',amount:100,reference:code+'-tracked'},tx});const r=await webhook(h);assert.equal(r.status,200);assert.equal((await r.json()).membershipActivated,false);assert.equal(h.writes.length,1);assert.equal(h.writes[0].data.paid_at,tx.paid_at);}
});
test('Mismatched amounts, links, missing tracking and invalid signatures cannot record paid',async()=>{
 for(const change of [{amount_zar:2},{stitch_payment_id:'other'},{stitch_payment_id:null},null]){const tx=change===null?null:{id:'checkout',stitch_payment_id:'link-1',amount_zar:1,...change};const h=handler('rapid-task',{event:{status:'PAID',linkId:'link-1',amount:100,reference:'T-tracked'},tx});assert.equal((await webhook(h)).status,400);assert.equal(h.writes.length,0);}
 const h=handler('rapid-task',{invalidSignature:true});assert.equal((await webhook(h)).status,400);assert.equal(h.requests.length,0);
});
test('Non-paid events do not query provider or mutate payment records',async()=>{
 const h=handler('rapid-task',{event:{status:'FAILED'}});assert.equal((await webhook(h)).status,200);assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
});
test('Deleted products and membership plans are excluded before any provider request',async()=>{
 for(const [field,table] of [['productId','sgc_products'],['membershipId','sgc_named_membership_plans']]){
  const h=handler('create-stitch-payment',{user:{id:'buyer',email:'buyer@example.com'},row:null});const r=await h.serve(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({[field]:'deleted-id'})}));assert.equal(r.status,400);assert.ok(h.filters.some(f=>f[0]===table&&f[1]==='deleted_at'&&f[2]===null));assert.equal(h.requests.length,0);
 }
});

test('Monthly checkout requires verified entry membership before contacting Stitch',async()=>{
 for(const product of ['sgc-build-lab','website-builder']){
  const h=handler('create-stitch-payment',{user:{id:'buyer',email:'buyer@example.com'}});
  const response=await h.serve(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({product,amount:1})}));
  assert.equal(response.status,403);assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
 }
});
test('Academy and builder checkout use independent server prices and entitlement snapshots',async()=>{
 for(const [product,amount,entitlement] of [['sgc-build-lab',450,'build'],['website-builder',199,'website_builder']]){
  const h=handler('create-stitch-payment',{user:{id:'buyer',email:'buyer@example.com'},entryAllowed:true,tx:{id:'checkout'}});
  const response=await h.serve(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({product,amount:1,userId:'someone-else'})}));
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.amount,amount);assert.equal(result.billing,'monthly');
  const record=h.writes[0].data;assert.equal(record.entitlement_key,entitlement);assert.equal(record.user_id,'buyer');assert.equal(record.status,'pending');
  assert.equal(JSON.parse(h.requests[1].options.body).amount,amount*100);
 }
});
