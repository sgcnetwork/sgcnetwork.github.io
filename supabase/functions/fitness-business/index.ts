import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const clean=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
const round=(n:number)=>Math.round(n*100)/100;
function variants(p:any){let out=[{label:'Standard',price:Number(p.onSale?p.salePrice:p.price),attributes:{}}];for(const group of (p.options||[]).slice(0,3)){const next=[];for(const prior of out)for(const value of(group.values||[]).slice(0,12)){const attrs={...prior.attributes,[group.name]:value.label};next.push({label:Object.values(attrs).join(' / '),price:prior.price+Number(value.price||0),attributes:attrs})}out=next;}return out;}
function receipt(row:any){const d=row.data,expired=row.kind==='membership'&&row.status==='Active'&&new Date(d.endsAt||0).getTime()<=Date.now();return {number:d.number,title:d.title,total:d.total||0,status:expired?'Expired':row.status,paymentStatus:d.paymentStatus||'pending',kind:row.kind,date:d.date,time:d.time,classId:d.classId,duration:d.duration,unlimited:d.unlimited,credits:d.credits,endsAt:d.endsAt,billing:d.billing,createdAt:row.created_at};}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 try{
 const raw=await req.text();if(new TextEncoder().encode(raw).length>32000)return respond({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid request'},400)}
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 if(['list','status'].includes(body.action)){
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return respond({error:'Sign in to manage your studio'},401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);if(authError||!user)return respond({error:'Please sign in again'},401);
  if(body.action==='list'){const {data,error}=await admin.from('sgc_fitness_records').select('id,kind,status,fields,data,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(250);if(error)throw error;return respond({records:data})}
  if(!uuid(body.id))return respond({error:'Invalid record'},400);const {data:record,error:readError}=await admin.from('sgc_fitness_records').select('*').eq('id',body.id).eq('owner_id',user.id).maybeSingle();if(readError)throw readError;if(!record)return respond({error:'Record not found'},404);
  const allowed=record.kind==='membership'?['Pending','Active','Paused','Cancelled','Expired']:record.kind==='booking'?['Confirmed','Cancelled','Completed']:['Received','Confirmed','Processing','Ready','Completed','Cancelled'];if(!allowed.includes(body.status))return respond({error:'Invalid status'},400);
  // A cancelled booking is rebooked through the capacity-checked customer workflow.
  if(record.kind==='booking'&&record.status==='Cancelled'&&body.status!=='Cancelled')return respond({error:'Create a new booking to reserve a place again.'},400);
  const data={...record.data,paymentStatus:body.paid===true?'paid':'pending'};
  if(record.kind==='membership'&&body.status==='Active'){
   if(!body.paid)return respond({error:'Verify payment before activation'},400);
   if(!data.endsAt||new Date(data.endsAt).getTime()<=Date.now()){const start=new Date();const end=new Date(start);if(data.billing==='annual')end.setUTCFullYear(end.getUTCFullYear()+1);else end.setUTCMonth(end.getUTCMonth()+1);data.startsAt=start.toISOString();data.endsAt=end.toISOString();}
  }
  const {error}=await admin.from('sgc_fitness_records').update({status:body.status,data}).eq('id',body.id).eq('owner_id',user.id);if(error)throw error;return respond({ok:true});
 }
 if(typeof body.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)||body.slug.length<3||body.slug.length>40)return respond({error:'Invalid studio address'},400);
 const {data:ctx,error:contextError}=await admin.rpc('sgc_fitness_publication_context',{p_slug:body.slug});if(contextError)throw contextError;if(!ctx)return respond({error:'This studio is not currently available'},404);const d=ctx.snapshot.preferences.fitnessStudio;
 if(body.action==='availability'){
  if(typeof body.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.date))return respond({error:'Choose a valid date'},400);const c=d.classes.find((c:any)=>c.id===body.classId&&c.active);if(!c)return respond({error:'Class unavailable'},404);
  const weekday=new Date(body.date+'T12:00:00+02:00').getUTCDay();const sessions=d.schedule.filter((s:any)=>s.active&&s.classId===c.id&&Number(s.day)===weekday);const {data:bookings,error}=await admin.from('sgc_fitness_records').select('data').eq('website_id',ctx.website_id).eq('kind','booking').in('status',['Confirmed','Completed']).eq('data->>classId',c.id).eq('data->>date',body.date);if(error)throw error;
  return respond({sessions:sessions.map((s:any)=>({id:s.id,time:s.time,remaining:String(d.blockedDates||'').split(',').map((v:string)=>v.trim()).includes(body.date)||new Date(body.date+'T'+s.time+':00+02:00').getTime()<Date.now()+Number(d.bookingCutoff||0)*3600000?0:Math.max(0,Number(c.capacity)-(bookings||[]).filter((b:any)=>b.data.time===s.time).length)}))});
 }
 if(!uuid(body.key))return respond({error:'Invalid private booking reference'},400);
 if(body.action==='track'){
  const {data:record,error}=await admin.from('sgc_fitness_records').select('*').eq('website_id',ctx.website_id).eq('request_key',body.key).maybeSingle();if(error)throw error;if(!record)return respond({error:'Record not found'},404);const result:any=receipt(record);
  if(record.kind==='membership'){const cycle=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}).slice(0,7);const {count,error}=await admin.from('sgc_fitness_records').select('id',{count:'exact',head:true}).eq('website_id',ctx.website_id).eq('kind','booking').in('status',['Confirmed','Completed']).eq('data->>membershipKey',body.key).eq('data->>creditMonth',cycle);if(error)throw error;result.remainingCredits=Math.max(0,Number(record.data.credits||0)-(count||0))}
  return respond({record:result});
 }
 if(body.action==='cancel'){
  const {data,error}=await admin.rpc('sgc_fitness_write',{p_slug:body.slug,p_key:body.key,p_kind:'booking',p_fields:{},p_data:{},p_action:'cancel'});if(error)return respond({error:error.message},400);return respond({record:receipt(data)});
 }
 if(!['submit','reschedule'].includes(body.action))return respond({error:'Unknown action'},400);const kind=body.action==='reschedule'?'booking':body.kind;
 if(!['booking','membership','coaching','order','contact','newsletter'].includes(kind))return respond({error:'Unknown request type'},400);
 const {data:existing,error:existingError}=await admin.from('sgc_fitness_records').select('*').eq('website_id',ctx.website_id).eq('request_key',body.key).maybeSingle();if(existingError)throw existingError;if(existing&&body.action==='submit')return respond({record:receipt(existing)});
 const fields:Record<string,string>={};if(!body.fields||typeof body.fields!=='object'||Array.isArray(body.fields))return respond({error:'Enter your details'},400);for(const name of ['name','email','phone','date','session','notes','trainer','package','format','fulfilment','address','payment','startDate','terms','consent'])if(body.fields[name]!=null)fields[name]=clean(body.fields[name],name==='notes'?2000:500);fields.email=clean(fields.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)||kind!=='newsletter'&&(!fields.name||fields.name.length<2||!fields.phone||fields.phone.length>40))return respond({error:'Enter a valid name, email and phone number'},400);
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||fields.email;const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ctx.website_id+':'+ip));const ipHash=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');const {count,error:countError}=await admin.from('sgc_fitness_records').select('id',{count:'exact',head:true}).eq('website_id',ctx.website_id).eq('ip_hash',ipHash).gte('created_at',new Date(Date.now()-3600000).toISOString());if(countError)throw countError;if((count||0)>=25)return respond({error:'Too many requests. Please try again later.'},429);
 const data:any={number:'VITAL-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase(),paymentStatus:'pending',total:0};let memberKey=null;
 if(kind==='booking'){
  const c=d.classes.find((c:any)=>c.id===body.classId&&c.active),session=d.schedule.find((s:any)=>s.id===fields.session&&s.classId===body.classId&&s.active);if(!c||!session||!/^\d{4}-\d{2}-\d{2}$/.test(fields.date||''))return respond({error:'Choose a valid scheduled class'},400);
  const start=new Date(fields.date+'T'+session.time+':00+02:00');if(!Number.isFinite(start.getTime())||start.getUTCDay()!==Number(session.day)||start.getTime()<Date.now()+Number(d.bookingCutoff||0)*3600000||String(d.blockedDates||'').split(',').map((v:string)=>v.trim()).includes(fields.date))return respond({error:'This session is not available for booking'},400);
  if(fields.consent!=='on')return respond({error:'Accept the booking and cancellation policy'},400);if(body.membershipKey&&!uuid(body.membershipKey))return respond({error:'Invalid membership reference'},400);memberKey=body.membershipKey||null;
  Object.assign(data,{title:c.name,classId:c.id,date:fields.date,time:session.time,sessionId:session.id,duration:c.duration,capacity:c.capacity,total:Number(c.price),cancelHours:Number(d.cancelHours||0)});
 }else if(kind==='membership'){
  const p=d.plans.find((p:any)=>p.id===body.planId&&p.active);if(!p||!['monthly','annual'].includes(body.billing)||fields.terms!=='on')return respond({error:'Choose a valid plan and accept the membership terms'},400);
  Object.assign(data,{title:p.name,planId:p.id,billing:body.billing,total:Number(body.billing==='annual'?p.annual:p.monthly),credits:Number(p.credits||0),unlimited:!!p.unlimited});
 }else if(kind==='coaching'){
  const p=d.coachingPackages.find((p:any)=>p.id===fields.package),trainer=d.trainers.find((t:any)=>t.id===fields.trainer&&t.active);if(!p||!trainer||!/^\d{4}-\d{2}-\d{2}$/.test(fields.date||'')||fields.date<new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}))return respond({error:'Choose a valid coach, package and future date'},400);Object.assign(data,{title:p.name+' · '+trainer.name,total:Number(p.price),date:fields.date});
 }else if(kind==='order'){
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)return respond({error:'Add between 1 and 50 products'},400);if(!(['Collection','Delivery'].includes(fields.fulfilment))||(fields.fulfilment==='Delivery'&&(!d.deliveryEnabled||!fields.address))||(fields.fulfilment==='Collection'&&!d.collectionEnabled))return respond({error:'Choose an available delivery method and address'},400);
  let subtotal=0;const lines=[],seen=new Set();for(const line of body.items){const p=d.items.find((p:any)=>p.id===line.productId&&p.active);if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||!Number.isInteger(line.variantIndex))return respond({error:'A product or option is unavailable'},400);const option=variants(p)[line.variantIndex];if(!option||option.price<0||!Number.isFinite(option.price)||option.price>100000)return respond({error:'Invalid product option'},400);const key=p.id+':'+line.variantIndex;if(seen.has(key))return respond({error:'Combine duplicate product lines'},400);seen.add(key);subtotal+=option.price*line.quantity;lines.push({productId:p.id,name:p.name,option:option.label,quantity:line.quantity,price:option.price,total:round(option.price*line.quantity),trackStock:!!p.trackStock,stock:Number(p.stock||0)});}if(subtotal<Number(d.minimumOrder||0))return respond({error:'Minimum order is R'+d.minimumOrder},400);const delivery=fields.fulfilment==='Delivery'?Math.max(0,Number(d.deliveryFee||0)):0;Object.assign(data,{title:'Studio shop order',lines,subtotal:round(subtotal),delivery,total:round(subtotal+delivery)});
 }else data.title=kind==='newsletter'?'Newsletter subscription':'Contact enquiry';
 if(['order','membership'].includes(kind)&&!String(d.paymentMethods||'').split(',').map((p:string)=>p.trim()).includes(fields.payment))return respond({error:'Choose an available payment method'},400);
 if(!Number.isFinite(data.total)||data.total<0)return respond({error:'Please contact the studio to confirm this price'},400);
 const {data:record,error:writeError}=await admin.rpc('sgc_fitness_write',{p_slug:body.slug,p_key:body.key,p_kind:kind,p_fields:fields,p_data:data,p_action:body.action,p_member_key:memberKey,p_ip:ipHash});if(writeError)return respond({error:writeError.message},400);return respond({record:receipt(record)});
 }catch(error){console.error('fitness-business error',error instanceof Error?error.message:'unknown');return respond({error:'Could not complete this request. Please try again.'},503)}
});
