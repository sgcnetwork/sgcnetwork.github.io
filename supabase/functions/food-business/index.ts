import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const clean=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const round=(v:number)=>Math.round(v*100)/100;
function variants(p:any){const sizes=p.sizes?.length?p.sizes:[{name:'Regular',price:p.onSale?p.salePrice:p.price}],extras=(p.extras||[]).slice(0,5),out=[];for(let size=0;size<sizes.length;size++)for(let mask=0;mask<2**extras.length;mask++){const chosen=extras.filter((_:any,i:number)=>mask&(1<<i));out.push({label:[sizes[size].name,...chosen.map((e:any)=>e.name)].join(' + '),price:Number(sizes[size].price)+chosen.reduce((a:number,e:any)=>a+Number(e.price),0)});}return out;}
function receipt(row:any){return {number:row.data.number||'',total:row.data.total||0,status:row.status,paymentStatus:row.data.paymentStatus||'pending',createdAt:row.created_at};}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return response({error:'Method not allowed'},405);
 try{
 const text=await req.text();if(new TextEncoder().encode(text).length>32000)return response({error:'Request too large'},413);let body;try{body=JSON.parse(text)}catch{return response({error:'Invalid request'},400)}
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 if(['list','status'].includes(body.action)){
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return response({error:'Sign in to manage requests'},401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);if(authError||!user)return response({error:'Please sign in again'},401);
  if(body.action==='list'){const {data,error}=await admin.from('sgc_food_requests').select('id,kind,status,fields,data,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(250);if(error)throw error;return response({records:data})}
  if(!uuid(body.id)||!['Received','Preparing','Ready','Confirmed','Declined','Completed','Cancelled'].includes(body.status))return response({error:'Invalid status update'},400);
  const {data,error}=await admin.from('sgc_food_requests').update({status:body.status}).eq('id',body.id).eq('owner_id',user.id).select('id').maybeSingle();if(error)throw error;if(!data)return response({error:'Request not found'},404);return response({ok:true});
 }
 if(!['submit','track'].includes(body.action)||typeof body.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)||body.slug.length<3||body.slug.length>40||!uuid(body.key))return response({error:'Invalid website request'},400);
 const {data:ctx,error:contextError}=await admin.rpc('sgc_food_publication_context',{p_slug:body.slug});if(contextError)throw contextError;if(!ctx)return response({error:'This food website is not currently available'},404);
 const {data:existing,error:readError}=await admin.from('sgc_food_requests').select('*').eq('website_id',ctx.website_id).eq('request_key',body.key).maybeSingle();if(readError)throw readError;
 if(body.action==='track')return existing?.kind==='order'?response({record:receipt(existing)}):response({error:'Order not found'},404);
 if(existing)return response({record:receipt(existing),ok:true});
 const kind=body.kind;if(!['order','reservation','catering','contact','newsletter'].includes(kind))return response({error:'Unknown request type'},400);
 const raw=body.fields;if(!raw||typeof raw!=='object'||Array.isArray(raw))return response({error:'Enter your contact details'},400);if(raw.website)return response({error:'Unable to submit this request'},400);
 const fields:Record<string,string>={};for(const name of ['name','email','phone','address','date','time','guests','seating','package','budget','dietary','notes','fulfilment','payment'])if(raw[name]!=null)fields[name]=clean(raw[name],name==='notes'?2000:500);
 fields.email=clean(fields.email,254).toLowerCase();if(!validEmail(fields.email)||kind!=='newsletter'&&(clean(fields.name,120).length<2||!fields.phone||fields.phone.length>40))return response({error:'Enter a valid name, email and phone number'},400);
 const food=ctx.snapshot.preferences.foodStudio;if(!food)return response({error:'Food website unavailable'},404);
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||fields.email;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ctx.website_id+':'+ip));const ipHash=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const {count,error:countError}=await admin.from('sgc_food_requests').select('id',{count:'exact',head:true}).eq('website_id',ctx.website_id).eq('ip_hash',ipHash).gte('created_at',new Date(Date.now()-3600000).toISOString());if(countError)throw countError;if((count||0)>=20)return response({error:'Too many requests. Please try again later.'},429);
 const data:any={};
 if(kind==='order'){
  if(!Array.isArray(body.items)||body.items.length<1||body.items.length>50)return response({error:'Add between 1 and 50 items'},400);
  const enabled:any={Delivery:food.deliveryEnabled,Collection:food.collectionEnabled,'Dine-in':food.dineInEnabled};if(!enabled[fields.fulfilment])return response({error:'Choose an available order method'},400);
  if(fields.fulfilment==='Delivery'&&!fields.address)return response({error:'Enter a delivery address'},400);
  const methods=String(food.paymentMethods||'Cash on collection,EFT').split(',').map(v=>v.trim());if(!methods.includes(fields.payment))return response({error:'Choose an available payment method'},400);
  const lines=[];let subtotal=0;const seen=new Set();
  for(const line of body.items){const product=(food.items||[]).find((p:any)=>p.id===line.productId&&p.active);if(!product||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||!Number.isInteger(line.variantIndex)||line.variantIndex<0)return response({error:'A menu item or option changed. Refresh your cart.'},400);const option=variants(product)[line.variantIndex];if(!option||!Number.isFinite(option.price)||option.price<0||option.price>100000)return response({error:'This item option is unavailable'},400);const key=product.id+':'+line.variantIndex;if(seen.has(key))return response({error:'Combine duplicate cart lines'},400);seen.add(key);const total=round(option.price*line.quantity);subtotal+=total;lines.push({id:product.id,name:product.name,option:option.label,price:option.price,quantity:line.quantity,total,notes:clean(line.notes,1000)});}
  if(subtotal<Number(food.minimumOrder||0))return response({error:'Minimum order is R'+Number(food.minimumOrder)},400);
  const delivery=fields.fulfilment==='Delivery'?Math.max(0,Number(food.deliveryFee)||0):0;data.number='FOOD-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase();data.lines=lines;data.subtotal=round(subtotal);data.delivery=round(delivery);data.total=round(subtotal+delivery);data.paymentStatus='pending';
 }else if(kind==='reservation'||kind==='catering'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.date||''))return response({error:'Choose a valid date'},400);
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'});if(fields.date<today)return response({error:'Choose a future date'},400);
  const guests=Number(fields.guests);if(!Number.isInteger(guests)||guests<1||guests>(kind==='reservation'?Number(food.maxGuests||12):5000))return response({error:'Choose a valid number of guests'},400);
  if(kind==='reservation'){
   if(!food.reservationEnabled)return response({error:'Online table requests are unavailable'},400);
   const slots=String(food.reservationTimes||'').split(',').map(v=>v.trim());if(!slots.includes(fields.time))return response({error:'Choose an available time'},400);
   if(String(food.closedDates||'').split(',').map(v=>v.trim()).includes(fields.date))return response({error:'The restaurant is closed on this date'},400);
   const earliest=new Date(Date.now()+Math.max(0,Number(food.bookingLead)||0)*86400000).toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'});if(fields.date<earliest)return response({error:'Please choose a later booking date'},400);
  }
 }
 const {data:record,error}=await admin.from('sgc_food_requests').insert({website_id:ctx.website_id,owner_id:ctx.owner_id,request_key:body.key,kind,fields,data,ip_hash:ipHash}).select('*').single();
 if(error){if(error.code==='23505'){const {data:found}=await admin.from('sgc_food_requests').select('*').eq('website_id',ctx.website_id).eq('request_key',body.key).single();if(found)return response({record:receipt(found),ok:true});}throw error;}
 return response({ok:true,record:receipt(record)});
 }catch(error){console.error('food-business error',error instanceof Error?error.message:'unknown');return response({error:'Could not complete this request. Please try again.'},503)}
});
