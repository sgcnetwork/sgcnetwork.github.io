import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';
const url=Deno.env.get('SUPABASE_URL')!,service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=new Set(['https://cfhp.sgcnetwork.co.za','https://sgcnetwork.co.za']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://cfhp.sgcnetwork.co.za','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
 if(origin&&!origins.has(origin))return reply({error:'Origin not allowed'},403);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const {data,error}=await service.auth.getUser(token);
 if(error||!data.user?.email_confirmed_at)return reply({error:'Sign in to the business admin.'},401);
 const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
 const admin=await client.rpc('sgc_extra_is_admin');
 const sgcAdmin=!admin.error&&admin.data===true;
 const cfhpOwner=data.user.email?.toLowerCase()==='cfhpurpose@gmail.com';
 const body=await req.json();
 if(!sgcAdmin&&!(cfhpOwner&&body.action==='bookings'))return reply({error:'Admin access required'},403);
 const offset=Number(body.offset||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return reply({error:'Invalid page'},400);
 let query;
 if(body.action==='contacts')query=service.from('sgc_business_contacts').select('company,client_name,email,phone').eq('company','CFHP').order('client_name');
 else if(body.action==='bookings')query=service.from('cfhp_bookings').select('id,customer_name,customer_email,phone,service_name,starts_at,ends_at,status,created_at').order('starts_at',{ascending:false});
 else return reply({error:'Unknown action'},400);
 const result=await query.range(offset,offset+199);if(result.error)throw Error('Records could not load');
 return reply({rows:result.data});
 }catch{return reply({error:'Unable to load records. Please try again.'},400)}
});
