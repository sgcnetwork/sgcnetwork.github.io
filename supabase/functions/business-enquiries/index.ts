import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 try{
 const raw=await req.text();if(new TextEncoder().encode(raw).length>18000)return respond({error:'Your enquiry is too long.'},413);
 const body=JSON.parse(raw);if(typeof body.slug!=='string'||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug)||body.slug.length<3||body.slug.length>40||!body.fields||typeof body.fields!=='object'||Array.isArray(body.fields))return respond({error:'Invalid enquiry'},400);
 const fields:Record<string,string>={};for(const [key,value] of Object.entries(body.fields)){if(Object.keys(fields).length>=20||typeof value!=='string'||key.length>120||value.length>6000)return respond({error:'Please shorten your enquiry.'},400);fields[key]=value.trim();}
 if(!Object.values(fields).some(Boolean))return respond({error:'Please enter your enquiry.'},400);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:published,error:resolveError}=await admin.rpc('sgc_resolve_published_website',{p_slug:body.slug});if(resolveError)throw resolveError;if(!published)return respond({error:'This website is unavailable.'},404);
 const {data:site,error:siteError}=await admin.from('sgc_student_websites').select('user_id').eq('slug',body.slug).single();if(siteError||!site)throw siteError;
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.slug+':'+ip));const fingerprint=Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
 const {count,error:rateError}=await admin.from('sgc_business_enquiries').select('id',{count:'exact',head:true}).eq('website_slug',body.slug).eq('fingerprint',fingerprint).gte('created_at',new Date(Date.now()-3600000).toISOString());if(rateError)throw rateError;if((count||0)>=5)return respond({error:'Please wait before sending another enquiry.'},429);
 const {error}=await admin.from('sgc_business_enquiries').insert({user_id:site.user_id,website_slug:body.slug,fields,fingerprint});if(error)throw error;
 return respond({sent:true});
 }catch{return respond({error:'Unable to send your enquiry. Please try again.'},503);}
});
