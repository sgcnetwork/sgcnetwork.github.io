const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {createHash,timingSafeEqual}=require('node:crypto');
const config={merchant_id:'12345678',merchant_key:'test-key',passphrase:'test-only-passphrase'};
function runtime(path,client,fetchImpl){let handle;const source=fs.readFileSync(path,'utf8').replace(/^import .*;\s*$/mg,'');vm.runInNewContext(stripTypeScriptTypes(source),{createClient:()=>client,createHash,timingSafeEqual,Buffer,Request,Response,URL,URLSearchParams,AbortSignal,console,Deno:{env:{get:()=> 'https://test.supabase.co'},serve:fn=>handle=fn},fetch:fetchImpl});return handle;}
const enc=v=>encodeURIComponent(v.trim()).replace(/%20/g,'+').replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const sign=entries=>createHash('md5').update(entries.filter(([k,v])=>k!=='signature'&&v!==''&&v!=='0').map(([k,v])=>k+'='+enc(v)).join('&')+'&passphrase='+enc(config.passphrase)).digest('hex');
function rowClient(rows){return {from:name=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:rows[name]})};return q;}};}
test('monthly checkout signs a monthly indefinite subscription without exposing passphrase',async()=>{
 const t={merchant_reference:'W-test',status:'pending',created_at:new Date().toISOString(),customer_name:'Test Buyer',product_name:'Website Builder',amount_zar:199,billing:'monthly',auto_recurring:true};
 const handler=runtime('supabase/functions/create-payfast-payment/index.ts',rowClient({sgc_stitch_transactions:t,sgc_gateway_secrets:{config}}));
 const result=await (await handler(new Request('https://test?reference=W-test'))).json();
 assert.equal(result.fields.subscription_type,'1');assert.equal(result.fields.frequency,'3');assert.equal(result.fields.cycles,'0');assert.equal(result.fields.recurring_amount,'199.00');assert.equal(result.fields.signature,sign(Object.entries(result.fields)));assert.ok(!JSON.stringify(result).includes(config.passphrase));
});
test('once-off checkout remains once-off',async()=>{
 const handler=runtime('supabase/functions/create-payfast-payment/index.ts',rowClient({sgc_stitch_transactions:{status:'pending',created_at:new Date().toISOString(),product_name:'Preview',amount_zar:20,billing:'once',auto_recurring:false},sgc_gateway_secrets:{config}}));
 const result=await (await handler(new Request('https://test?reference=P-test'))).json();assert.equal(result.fields.subscription_type,undefined);assert.equal(result.fields.recurring_amount,undefined);
});
function notification(provider='VALID'){
 const calls=[];const client={...rowClient({sgc_gateway_secrets:{config}}),rpc:async(name,args)=>{calls.push({name,args});return {error:null};}};
 const handler=runtime('supabase/functions/payfast-itn/index.ts',client,async()=>new Response(provider));
 const fields={m_payment_id:'W-test',pf_payment_id:'123',payment_status:'COMPLETE',amount_gross:'199.00',merchant_id:config.merchant_id,token:'test-subscription-token'};
 fields.signature=sign(Object.entries(fields));return {calls,send:overrides=>handler(new Request('https://test',{method:'POST',body:new URLSearchParams({...fields,...overrides})}))};
}
test('forged notification cannot grant access',async()=>{const h=notification();assert.equal((await h.send({signature:'0'.repeat(32)})).status,400);assert.equal(h.calls.length,0);});
test('provider rejection cannot grant access even with a valid signature',async()=>{const h=notification('INVALID');assert.equal((await h.send()).status,400);assert.equal(h.calls.length,0);});
test('verified notification enters the atomic recurring payment processor',async()=>{const h=notification();assert.equal((await h.send()).status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'sgc_apply_payfast_notification');assert.equal(h.calls[0].args.p_token,'test-subscription-token');assert.equal(h.calls[0].args.p_amount,199);});
test('subscription management rejects unsigned users',async()=>{const h=runtime('supabase/functions/payfast-subscriptions/index.ts',{auth:{getUser:async()=>({data:{user:null},error:{}})}});const result=await h(new Request('https://test',{method:'POST',body:JSON.stringify({action:'cancel',id:'other-subscription'})}));assert.equal(result.status,401);});
test('cancellation is restricted to the signed-in owner before PayFast is contacted',async()=>{
 const filters=[];const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},single:async()=>({data:null,error:{}})};
 let providerCalls=0;const h=runtime('supabase/functions/payfast-subscriptions/index.ts',{auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>q},async()=>{providerCalls++;});
 const result=await h(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'cancel',id:'other-subscription',userId:'victim'})}));assert.equal(result.status,404);assert.ok(filters.some(([k,v])=>k==='user_id'&&v==='owner'));assert.equal(providerCalls,0);
});
