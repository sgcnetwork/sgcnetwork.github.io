import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const clean=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
const money=(n:unknown)=>{const v=Number(n);if(!Number.isFinite(v)||v<0||v>100000)throw Error('Invalid price');return Math.round(v*100)/100};
const table='sgc_education_records';
function receipt(row:any){return {number:row.data.number,title:row.data.title,total:row.data.total||0,kind:row.kind,status:row.kind==='membership'&&row.status==='Active'&&new Date(row.data.endsAt||0).getTime()<=Date.now()?'Paused':row.status,paymentStatus:row.data.paymentStatus||'pending',courseId:row.data.courseId,courseIds:row.data.courseIds,endsAt:row.data.endsAt,progress:row.data.progress||{},createdAt:row.created_at};}
function variants(p:any){const sizes=p.sizes?.length?p.sizes:[{name:'Standard',price:p.onSale?p.salePrice:p.price}],extras=(p.extras||[]).slice(0,5),out=[];for(let size=0;size<sizes.length;size++)for(let mask=0;mask<2**extras.length;mask++){const chosen=extras.filter((_:any,i:number)=>mask&(1<<i));out.push({label:[sizes[size].name,...chosen.map((e:any)=>e.name)].join(' + '),price:money(Number(sizes[size].price)+chosen.reduce((a:number,e:any)=>a+Number(e.price),0))})}return out;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 try{
 const raw=await req.text();if(new TextEncoder().encode(raw).length>32000)return respond({error:'Request too large'},413);let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid request'},400)}
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 if(['list','status'].includes(body.action)){
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return respond({error:'Sign in to manage your academy'},401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);if(authError||!user)return respond({error:'Please sign in again'},401);
  if(body.action==='list'){const {data,error}=await admin.from(table).select('id,kind,status,fields,data,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(250);if(error)throw error;return respond({records:data})}
  if(!uuid(body.id))return respond({error:'Invalid record'},400);const {data:record,error:readError}=await admin.from(table).select('*').eq('id',body.id).eq('owner_id',user.id).maybeSingle();if(readError)throw readError;if(!record)return respond({error:'Record not found'},404);
  const allowed=['enrolment','membership'].includes(record.kind)?['Pending','Active','Paused','Cancelled']:['Received','Confirmed','Processing','Ready','Completed','Cancelled'];if(!allowed.includes(body.status))return respond({error:'Invalid status'},400);
  if(body.status==='Active'&&body.paid!==true)return respond({error:'Verify payment before activating learning access'},400);
  const data={...record.data,paymentStatus:body.paid===true?'paid':'pending'};
  if(record.kind==='membership'&&body.status==='Active'&&new Date(data.endsAt||0).getTime()<=Date.now()){const end=new Date();end.setUTCMonth(end.getUTCMonth()+1);data.endsAt=end.toISOString();}
  const {error}=await admin.from(table).update({status:body.status,data}).eq('id',record.id).eq('owner_id',user.id);if(error)throw error;return respond({ok:true});
 }
 if(typeof body.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)||body.slug.length<3||body.slug.length>40||!uuid(body.key))return respond({error:'Invalid academy or access reference'},400);
 const {data:ctx,error:contextError}=await admin.rpc('sgc_education_publication_context',{p_slug:body.slug});if(contextError)throw contextError;if(!ctx)return respond({error:'This academy is not currently available'},404);const d=ctx.snapshot.preferences.educationStudio;
 const find=()=>admin.from(table).select('*').eq('website_id',ctx.website_id).eq('request_key',body.key).maybeSingle();const {data:record,error:recordError}=await find();if(recordError)throw recordError;
 const sign=async(value:string)=>{if(!value)return '';if(value.startsWith('private:')){const path=value.slice(8);if(!path.startsWith(ctx.owner_id+'/'))throw Error('Invalid protected content');const {data,error}=await admin.storage.from('sgc-education-content').createSignedUrl(path,600);if(error)throw error;return data.signedUrl}try{const url=new URL(value);return url.protocol==='https:'?url.href:''}catch{return ''}};
 if(body.action==='track')return record?respond({record:receipt(record)}):respond({error:'Access reference not found'},404);
 if(body.action==='library'){
  if(!record||record.kind!=='order'||record.data.paymentStatus!=='paid'||record.status==='Cancelled')return respond({error:'This purchase unlocks after payment confirmation'},403);
  const downloads=[];for(const line of record.data.lines||[]){const item=d.items.find((p:any)=>p.id===line.id&&p.active);if(item?.resource)downloads.push({name:item.name,url:await sign(item.resource)})}return respond({downloads});
 }
 if(['classroom','complete','certificate'].includes(body.action)){
  const course=d.courses.find((c:any)=>c.id===body.courseId&&c.active);if(!course)return respond({error:'Course unavailable'},404);
  const active=record?.status==='Active'&&record?.data.paymentStatus==='paid'&&((record.kind==='enrolment'&&record.data.courseId===course.id)||(record.kind==='membership'&&record.data.courseIds?.includes(course.id)&&new Date(record.data.endsAt).getTime()>Date.now()));
  if(!active)return respond({error:'Learning access is pending, paused or expired. Contact the academy to confirm payment and activation.'},403);
  const progress=record.data.progress?.[course.id]||{};
  if(body.action==='certificate'){
   if(!course.lessons.length||!course.lessons.every((l:any)=>progress[l.id]))return respond({error:'Complete all lessons and required quizzes first'},403);
   return respond({name:record.fields.name,course:course.name,number:record.data.number+'-'+course.id,date:new Date(record.data.completedAt?.[course.id]||record.created_at).toLocaleDateString('en-ZA')});
  }
  const index=Number(body.index);if(!Number.isInteger(index)||index<0||!course.lessons[index])return respond({error:'Lesson unavailable'},404);
  if(course.lessons.slice(0,index).some((l:any)=>!progress[l.id]))return respond({error:'Complete the previous lessons and required quizzes first'},403);
  const lesson=course.lessons[index];
  if(body.action==='classroom')return respond({lesson:{id:lesson.id,title:lesson.title,body:lesson.body,video:await sign(lesson.video),resource:await sign(lesson.resource),reflection:lesson.reflection,quiz:(lesson.quiz||[]).map((q:any)=>({question:q.question,options:q.options}))},progress});
  const quiz=lesson.quiz||[],answers=body.answers||[];if(!Array.isArray(answers)||answers.length!==quiz.length||quiz.some((q:any,i:number)=>!Number.isInteger(answers[i])||answers[i]<0||answers[i]>=q.options.length))return respond({error:'Answer every question'},400);
  const results=quiz.map((q:any,i:number)=>({question:q.question,yourAnswer:q.options[answers[i]],correctAnswer:q.options[q.correct]}));const count=quiz.filter((q:any,i:number)=>Number(q.correct)===answers[i]).length,score=quiz.length?Math.round(count/quiz.length*100):100,passed=count===quiz.length;
  if(passed){progress[lesson.id]=true;const data={...record.data,progress:{...(record.data.progress||{}),[course.id]:progress},completedAt:{...(record.data.completedAt||{}),...(course.lessons.every((l:any)=>progress[l.id])?{[course.id]:record.data.completedAt?.[course.id]||new Date().toISOString()}:{})}};const {error}=await admin.from(table).update({data}).eq('id',record.id).eq('request_key',body.key);if(error)throw error;}
  return respond({passed,score,results,progress});
 }
 if(body.action!=='submit')return respond({error:'Unknown request'},400);if(record)return respond({record:receipt(record)});
 const kind=body.kind==='reservation'?'booking':body.kind;if(!['order','booking','enrolment','membership','event','contact','newsletter','catering'].includes(kind))return respond({error:'Unknown request type'},400);
 if(!body.fields||typeof body.fields!=='object'||Array.isArray(body.fields)||body.fields.website)return respond({error:'Invalid contact details'},400);
 const fields:Record<string,string>={};for(const name of ['name','email','phone','address','date','time','guests','seating','package','budget','dietary','notes','fulfilment','payment'])if(body.fields[name]!=null)fields[name]=clean(body.fields[name],name==='notes'?2000:500);fields.email=clean(fields.email,254).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)||kind!=='newsletter'&&(fields.name?.length<2||!fields.name||!fields.phone))return respond({error:'Enter a valid name, email and phone number'},400);
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||fields.email;const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ctx.website_id+':'+ip)),ipHash=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');const {count,error:countError}=await admin.from(table).select('id',{count:'exact',head:true}).eq('website_id',ctx.website_id).eq('ip_hash',ipHash).gte('created_at',new Date(Date.now()-3600000).toISOString());if(countError)throw countError;if((count||0)>=25)return respond({error:'Too many requests. Please try again later.'},429);
 const data:any={number:'LEARN-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase(),paymentStatus:'pending',total:0,title:kind};let status=['enrolment','membership'].includes(kind)?'Pending':'Received';
 if(['enrolment','membership','event'].includes(kind)){
  const list=kind==='enrolment'?d.courses:kind==='membership'?d.plans:d.events,item=list.find((v:any)=>v.id===body.id&&v.active);if(!item)return respond({error:'This offering is unavailable'},404);
  if(!d.paymentMethods.split(',').map((v:string)=>v.trim()).includes(fields.payment))return respond({error:'Choose an available payment method'},400);
  data.title=item.name;data.total=money(item.price);if(kind==='enrolment')data.courseId=item.id;if(kind==='membership')data.courseIds=item.courseIds;data.progress={};
  if(kind==='event'){if(new Date(item.date+'T'+item.time+':00+02:00').getTime()<Date.now())return respond({error:'This event has ended'},400);data.date=item.date;data.time=item.time;}
 }else if(kind==='order'){
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)return respond({error:'Add between 1 and 50 resources'},400);
  if(!({Delivery:d.deliveryEnabled,Collection:d.collectionEnabled})[fields.fulfilment]||fields.fulfilment==='Delivery'&&!fields.address)return respond({error:'Choose an available fulfilment method and address'},400);
  if(!d.paymentMethods.split(',').map((v:string)=>v.trim()).includes(fields.payment))return respond({error:'Choose an available payment method'},400);
  const lines=[],seen=new Set();for(const line of body.items){const p=d.items.find((p:any)=>p.id===line.productId&&p.active);if(!p||!Number.isInteger(line.variantIndex)||line.variantIndex<0||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)return respond({error:'A resource or option changed. Refresh your cart.'},400);const option=variants(p)[line.variantIndex],key=p.id+':'+line.variantIndex;if(!option||seen.has(key))return respond({error:'Invalid or duplicate resource option'},400);seen.add(key);lines.push({id:p.id,name:p.name,option:option.label,quantity:line.quantity,total:money(option.price*line.quantity),notes:clean(line.notes,1000)})}
  const subtotal=lines.reduce((a,l)=>a+l.total,0);if(subtotal<Number(d.minimumOrder||0))return respond({error:'Minimum order not reached'},400);data.lines=lines;data.total=money(subtotal+(fields.fulfilment==='Delivery'?Number(d.deliveryFee):0));data.title='Learning resources';
 }else if(['booking','catering'].includes(kind)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.date||'')||fields.date<new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}))return respond({error:'Choose a future date'},400);
  if(kind==='booking'){if(!d.reservationEnabled||!d.reservationTimes.split(',').map((v:string)=>v.trim()).includes(fields.time)||String(d.closedDates).split(',').map((v:string)=>v.trim()).includes(fields.date))return respond({error:'Choose an available coaching time'},400);const service=d.services.find((s:any)=>s.name===fields.seating);if(!service)return respond({error:'Choose a coaching service'},400);if(new Date(fields.date+'T'+fields.time+':00+02:00').getTime()<Date.now()+Number(d.bookingLead||0)*86400000)return respond({error:'Choose a later session'},400);data.title=service.name;data.total=money(service.price)}else{const guests=Number(fields.guests);if(!Number.isInteger(guests)||guests<1||guests>5000)return respond({error:'Enter a valid attendee count'},400);data.title='Event catering request';}
 }
 const {data:saved,error}=await admin.from(table).insert({website_id:ctx.website_id,owner_id:ctx.owner_id,request_key:body.key,kind,status,fields,data,ip_hash:ipHash}).select('*').single();if(error){if(error.code==='23505'){const {data:found}=await find();if(found)return respond({record:receipt(found)});}throw error;}return respond({record:receipt(saved),ok:true});
 }catch(error){console.error('education-business error',error instanceof Error?error.message:'unknown');return respond({error:'Could not complete this request. Please try again.'},503)}
});
