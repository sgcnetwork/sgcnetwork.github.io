import {defaults,seed,categories,Settings,Product} from './data.ts';
const allowed=new Set(['https://al-habib.sgcnetwork.co.za','https://sgcnetwork.co.za']);
Deno.serve(async (request:Request)=>{
 const origin=request.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://al-habib.sgcnetwork.co.za','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
 if(origin&&!allowed.has(origin))return new Response('Forbidden',{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'};
 async function rest(table:string,params:Record<string,string>={},method='GET',body?:unknown){
  const response=await fetch(base+'/rest/v1/alhabib_'+table+'?'+new URLSearchParams(params),{method,headers:{...headers,'Prefer':method==='POST'?'resolution=merge-duplicates,return=minimal':'return=minimal'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){console.error('Store database request failed',response.status,table);throw new Error('Store database temporarily unavailable');}
  return response.status===204||response.headers.get('content-length')==='0'?null:response.text().then(t=>t?JSON.parse(t):null);
 }
 async function admin(){const token=request.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return false;const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});if(!r.ok)return false;const u=await r.json();return u.id==='df627f92-e256-47eb-8a92-590ee9cf7d59';}
 function prepare(sql:string){let args:any[]=[];const statement={bind(...a:any[]){args=a;return statement},async all<T>(){return {results:await execute() as T[]}},async first<T>(){return (await execute())[0] as T||null},async run(){await execute();return {success:true}}};
 async function execute(){
  if(sql==='SELECT data FROM catalogue')return await rest('catalogue',{select:'data'})||[];
  if(sql==="SELECT data FROM settings WHERE id='store'")return await rest('settings',{select:'data',id:'eq.store'})||[];
  const rate=/SELECT count\(\*\) as n FROM (orders|enquiries) WHERE source=\? AND created>\?/.exec(sql);
  if(rate){const rows=await rest(rate[1],{select:'id',source:'eq.'+args[0],created:'gt.'+args[1],limit:'12'});return [{n:rows.length}]}
  if(sql.startsWith('SELECT id,data,status,created FROM orders WHERE'))return await rest('orders',{select:'id,data,status,created',id:'eq.'+args[0],token_hash:'eq.'+args[1]})||[];
  if(sql.startsWith('SELECT id,data,status,created FROM orders ORDER'))return await rest('orders',{select:'id,data,status,created',order:'created.desc',limit:'250'})||[];
  if(sql.startsWith('SELECT id,data,created FROM enquiries ORDER'))return await rest('enquiries',{select:'id,data,created',order:'created.desc',limit:'100'})||[];
  if(sql.startsWith('INSERT INTO orders')){await rest('orders',{},'POST',{id:args[0],token_hash:args[1],data:args[2],status:args[3],created:args[4],source:args[5]});return []}
  if(sql.startsWith('INSERT INTO enquiries')){await rest('enquiries',{},'POST',{id:args[0],data:args[1],created:args[2],source:args[3]});return []}
  if(sql.startsWith('INSERT INTO catalogue')){await rest('catalogue',{},'POST',{id:args[0],data:args[1]});return []}
  if(sql.startsWith('INSERT INTO settings')){await rest('settings',{},'POST',{id:'store',data:args[0]});return []}
  if(sql.startsWith('UPDATE orders SET status')){await rest('orders',{id:'eq.'+args[1]},'PATCH',{status:args[0]});return []}
  throw new Error('Unsupported store query');
 }
 return statement;
 }
 const db=()=>({prepare,batch:async (statements:any[])=>Promise.all(statements.map(s=>s.run()))});
async function catalogue(){const r=await db().prepare('SELECT data FROM catalogue').all<{data:string}>();return r.results.length?r.results.map(x=>JSON.parse(x.data) as Product):seed}
async function settings(){const r=await db().prepare("SELECT data FROM settings WHERE id='store'").first<{data:string}>();return {...defaults,...(r?JSON.parse(r.data):{})} as Settings}
const sha=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const text=(v:unknown,n=300)=>String(v??'').trim().slice(0,n);
const safeUrl=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return ''}};
async function guard(r:Request){if(Number(r.headers.get('content-length')||0)>2000000)throw new Error('Request too large');if(r.headers.get('origin')&&!allowed.has(r.headers.get('origin')!))throw new Error('Invalid request origin');}
async function source(r:Request){return sha(r.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')}
async function limit(r:Request,table:'orders'|'enquiries'){const s=await source(r);const since=new Date(Date.now()-3600000).toISOString();const count=await db().prepare(`SELECT count(*) as n FROM ${table} WHERE source=? AND created>?`).bind(s,since).first<{n:number}>();if((count?.n||0)>=12)throw new Error('Too many requests. Please try again later.');return s}

async function orderPOST(r:Request){try{await guard(r);const src=await limit(r,'orders');const b:any=await r.json();const s=await settings();const all=await catalogue();
if(!Array.isArray(b.items)||!b.items.length||b.items.length>60)throw new Error('Your basket is empty or too large.');
const name=text(b.name,100),phone=text(b.phone,40),email=text(b.email,150);if(name.length<2||!/^\+?[\d\s()-]{7,25}$/.test(phone))throw new Error('Enter your name and a valid phone number.');
if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
const method=b.method==='delivery'?'delivery':'collection';if(method==='delivery'&&!s.deliveryEnabled||method==='collection'&&!s.collectionEnabled)throw new Error('This fulfilment option is unavailable.');
const address=text(b.address,700);if(method==='delivery'&&address.length<10)throw new Error('Enter your full delivery address.');
const seen=new Set();const items=b.items.map((v:any)=>{if(seen.has(v.id))throw new Error('Duplicate product');seen.add(v.id);const p=all.find(p=>p.id===v.id&&p.active);const quantity=Number(v.quantity);if(!p||!Number.isInteger(quantity)||quantity<1||quantity>Math.min(99,p.stock))throw new Error('A product is unavailable or exceeds available stock.');return {id:p.id,name:p.name,unit:p.unit,price:Math.round(p.price*100),quantity};});
const subtotal=items.reduce((a:number,x:any)=>a+x.price*x.quantity,0),delivery=method==='delivery'?Math.round(s.deliveryFee*100):0;
if(b.expectedTotal!==subtotal+delivery)throw new Error('Prices have changed. Refresh the store and review your basket before ordering.');
const id='AH-'+crypto.randomUUID().slice(0,8).toUpperCase(),token=crypto.randomUUID()+crypto.randomUUID(),created=new Date().toISOString();const data={name,phone,email,address,method,notes:text(b.notes,1500),items,subtotal,delivery,total:subtotal+delivery,sample:!s.live,payment:'Not paid — arrange with store',paymentInstructions:s.paymentInstructions};
await db().prepare('INSERT INTO orders(id,token_hash,data,status,created,source) VALUES(?,?,?,?,?,?)').bind(id,await sha(token),JSON.stringify(data),s.live?'Received':'Sample request',created,src).run();return Response.json({id,token,data,status:s.live?'Received':'Sample request',created});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to submit order'},{status:400})}}
async function orderGET(r:Request){const u=new URL(r.url),id=u.searchParams.get('id')||'',token=u.searchParams.get('token')||'';if(!id||token.length<30)return Response.json({error:'Order reference and private tracking key required'},{status:400});const row=await db().prepare('SELECT id,data,status,created FROM orders WHERE id=? AND token_hash=?').bind(id,await sha(token)).first<any>();if(!row)return Response.json({error:'Order not found. Check your reference and private tracking key.'},{status:404});return Response.json({...row,data:JSON.parse(row.data)},{headers:{'Cache-Control':'no-store'}})}
async function adminGET(){if(!await admin())return Response.json({error:'Owner sign-in required'},{status:403});const [products,config,orders,enquiries]=await Promise.all([catalogue(),settings(),db().prepare('SELECT id,data,status,created FROM orders ORDER BY created DESC LIMIT 250').all<any>(),db().prepare('SELECT id,data,created FROM enquiries ORDER BY created DESC LIMIT 100').all<any>()]);return Response.json({products,config,orders:orders.results.map(x=>({...x,data:JSON.parse(x.data)})),enquiries:enquiries.results.map(x=>({...x,data:JSON.parse(x.data)}))},{headers:{'Cache-Control':'no-store'}})}
async function adminPOST(r:Request){try{await guard(r);if(!await admin())return Response.json({error:'Owner sign-in required'},{status:403});const b:any=await r.json();if(b.action==='catalogue'){if(!Array.isArray(b.products)||!b.products.length||b.products.length>300)throw new Error('Add between 1 and 300 products.');const seen=new Set();const products=b.products.map((p:any)=>{const id=text(p.id,80);if(!/^[a-zA-Z0-9-]+$/.test(id)||seen.has(id))throw new Error('Product IDs must be unique.');seen.add(id);const price=Number(p.price),was=Number(p.was),stock=Number(p.stock);if(!Number.isFinite(price)||price<0||price>100000||!Number.isFinite(was)||was<0||!Number.isInteger(stock)||stock<0||stock>100000)throw new Error('Check product prices and stock.');if(!categories.includes(p.category)||!text(p.name,100))throw new Error('Each product needs a name and department.');return {...p,id,name:text(p.name,100),unit:text(p.unit,80),description:text(p.description,3000),image:safeUrl(p.image),price:Math.round(price*100)/100,was:Math.round(was*100)/100,stock,active:!!p.active,special:!!p.special}});await db().batch(products.map((p:any)=>db().prepare('INSERT INTO catalogue(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(p.id,JSON.stringify(p))));
// Omitted products are retired rather than silently reintroducing seed products.
const ids=products.map((p:any)=>p.id);const old=await catalogue();const omitted=old.filter(p=>!ids.includes(p.id));if(omitted.length)await db().batch(omitted.map(p=>db().prepare('INSERT INTO catalogue(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(p.id,JSON.stringify({...p,active:false}))));
}else if(b.action==='settings'){const old=await settings(),v=b.config;const fee=Number(v.deliveryFee);if(!Number.isFinite(fee)||fee<0||fee>10000)throw new Error('Invalid delivery fee');const c={...old};for(const k of ['brand','tagline','heroTitle','heroText','phone','email','address','hours','deliveryText','paymentInstructions','about']) (c as any)[k]=text(v[k],k==='about'?4000:1500);for(const k of ['accent','highlight'])if(/^#[0-9a-f]{6}$/i.test(v[k]))(c as any)[k]=v[k];c.heroImage=safeUrl(v.heroImage);c.video=safeUrl(v.video);c.deliveryFee=fee;c.deliveryEnabled=!!v.deliveryEnabled;c.collectionEnabled=!!v.collectionEnabled;c.live=!!v.live;if(c.live&&(!c.phone||!c.address||!c.hours))throw new Error('Add store phone, address and hours before enabling live orders.');if(!c.collectionEnabled&&!c.deliveryEnabled)throw new Error('Enable collection or delivery.');await db().prepare("INSERT INTO settings(id,data) VALUES('store',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify(c)).run();
}else if(b.action==='status'){if(!['Received','Confirmed','Preparing','Ready for collection','Out for delivery','Completed','Cancelled','Sample request'].includes(b.status))throw new Error('Invalid order status');await db().prepare('UPDATE orders SET status=? WHERE id=?').bind(b.status,text(b.id,30)).run();}else throw new Error('Unknown action');return Response.json({ok:true});}catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save'},{status:400})}}
async function enquiryPOST(r:Request){try{await guard(r);const src=await limit(r,'enquiries');const b:any=await r.json();const data={name:text(b.name,100),email:text(b.email,150),message:text(b.message,2500)};if(data.name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||data.message.length<10)throw new Error('Enter your name, email and a message of at least 10 characters.');await db().prepare('INSERT INTO enquiries(id,data,created,source) VALUES(?,?,?,?)').bind(crypto.randomUUID(),JSON.stringify(data),new Date().toISOString(),src).run();return Response.json({ok:true})}catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to send enquiry'},{status:400})}}
 try{
  const route=new URL(request.url).searchParams.get('path')||'/api/catalogue';let response:Response;
  if(route==='/api/catalogue'&&request.method==='GET')response=Response.json({products:await catalogue(),config:await settings(),isAdmin:await admin()});
  else if(route==='/api/order')response=request.method==='POST'?await orderPOST(request):request.method==='GET'?await orderGET(request):new Response('Method not allowed',{status:405});
  else if(route==='/api/admin')response=request.method==='POST'?await adminPOST(request):request.method==='GET'?await adminGET():new Response('Method not allowed',{status:405});
  else if(route==='/api/enquiry'&&request.method==='POST')response=await enquiryPOST(request);
  else response=new Response('Not found',{status:404});
  const h=new Headers(response.headers);for(const [k,v]of Object.entries(cors))h.set(k,v);h.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers:h});
 }catch(e){return Response.json({error:'The store is temporarily unavailable. Please try again.'},{status:503,headers:cors})}
});
