import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {checkSaps} from './saps.ts';
const URL_BASE=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(URL_BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const ALLOWED=new Set(['https://visaservices.sgcnetwork.co.za','https://sgcnetwork.co.za','http://terminal.local:4173']);
const roles=['admin','manager','consultant','pta','finance','viewer'];
function reply(req:Request,body:unknown,status=200){const origin=req.headers.get('Origin');return Response.json(body,{status,headers:{...(origin&&ALLOWED.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Vary':'Origin','Cache-Control':'no-store'}})}
async function performCheck(id:string){const {data:c,error}=await admin.from('visa_cases').select('id,saps_reference,saps_identity,saps_status,saps_checked_at').eq('id',id).single();if(error||!c)throw Error('Client reference not found');if(!c.saps_reference||!c.saps_identity)throw Error('Save the SAPS enquiry number and client identifier first');const result=await checkSaps(c.saps_reference,c.saps_identity);const {error:saveError}=await admin.rpc('visa_record_saps_result',{p_case:id,p_status:result.status,p_message:result.message,p_finalised:result.finalised_on||null});if(saveError)throw saveError;return result;}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin');if(origin&&!ALLOWED.has(origin))return reply(req,{error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'https://visaservices.sgcnetwork.co.za','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
 if(req.method!=='POST')return reply(req,{error:'Method not allowed'},405);
 let body:any;try{const raw=await req.text();if(raw.length>25000)return reply(req,{error:'Request too large'},413);body=JSON.parse(raw)}catch{return reply(req,{error:'Invalid request'},400)}
 try{
  if(body.action==='scheduled_saps'){
   if(origin||typeof body.job_token!=='string'||!/^[a-f0-9]{64}$/.test(body.job_token)||typeof body.job_id!=='string')return reply(req,{error:'Invalid scheduled request'},401);
   const {data:id,error}=await admin.rpc('visa_claim_saps_job',{p_id:body.job_id,p_token:body.job_token});if(error||!id)return reply(req,{error:'Expired or already used job'},401);
   return reply(req,{result:await performCheck(id)});
  }
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return reply(req,{error:'Sign in required'},401);
  const {data:auth,error:authError}=await admin.auth.getUser(token);if(authError||!auth.user)return reply(req,{error:'Your session could not be verified. Sign in again.'},401);
  const {data:actor}=await admin.from('visa_users').select('*').eq('user_id',auth.user.id).single();if(!actor?.active)return reply(req,{error:'Your Visa Services account is not active'},403);
  if(body.action==='change_password'){
   const current=String(body.current_password||''),next=String(body.password||'');if(next.length<12||next===current)return reply(req,{error:'Use a new password of at least 12 characters'},400);
   const verifier=createClient(URL_BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});const verified=await verifier.auth.signInWithPassword({email:auth.user.email!,password:current});if(verified.error||verified.data.user?.id!==actor.user_id)return reply(req,{error:'Your current password could not be verified'},400);
   const changed=await admin.auth.admin.updateUserById(actor.user_id,{password:next});if(changed.error)throw changed.error;const cleared=await admin.rpc('visa_password_gate_clear',{p_user:actor.user_id});if(cleared.error)throw cleared.error;return reply(req,{ok:true});
  }
  if(actor.must_change_password)return reply(req,{error:'Change your temporary password before opening client records'},403);
  if(body.action==='save_user'){
   if(actor.role!=='admin')return reply(req,{error:'Administrator access required'},403);
   const email=String(body.email||'').trim().toLowerCase(),name=String(body.display_name||'').trim(),role=String(body.role||'');const companies=Array.isArray(body.companies)?[...new Set(body.companies.map(String))]:[];
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||name.length<2||name.length>120||!roles.includes(role)||role!=='admin'&&!companies.length)return reply(req,{error:'Enter a full name, valid email, role and company access'},400);
   if(companies.length){const {data:cos}=await admin.from('visa_companies').select('id').in('id',companies).eq('active',true);if(cos?.length!==companies.length)return reply(req,{error:'One of the selected companies is not active'},400)}
   if(body.user_id){const {data:existing}=await admin.from('visa_users').select('email').eq('user_id',body.user_id).single();if(!existing||existing.email.toLowerCase()!==email)return reply(req,{error:'The selected account email cannot be changed here'},400);}
   const lookup=await admin.rpc('visa_auth_user_lookup',{p_email:email});if(lookup.error)throw lookup.error;let id=lookup.data;let created=false;
   if(!id){if(String(body.temporary_password||'').length<12)return reply(req,{error:'New accounts require a temporary password of at least 12 characters'},400);const result=await admin.auth.admin.createUser({email,password:String(body.temporary_password),email_confirm:true,user_metadata:{display_name:name}});if(result.error)throw result.error;id=result.data.user.id;created=true;}
   if(body.user_id&&id!==body.user_id)return reply(req,{error:'The selected account email cannot be changed here'},400);
   const result=await admin.rpc('visa_admin_save_access',{p_actor:actor.user_id,p_user:id,p_name:name,p_email:email,p_role:role,p_companies:companies,p_active:body.active!==false,p_new_password:created,p_accepting:body.accepting_leads!==false});if(result.error)throw result.error;
   return reply(req,{ok:true,created,user_id:id,message:created?'Account created. Give the temporary password to the intended user securely; they must change it at first sign-in.':'Existing account access updated. Their password was not changed.'});
  }
  if(body.action==='check_saps'){
   if(!['admin','manager','consultant','pta'].includes(actor.role))return reply(req,{error:'This role cannot check SAPS'},403);
   const id=String(body.case_id||'');const userClient=createClient(URL_BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});const {data:c,error}=await userClient.from('visa_cases').select('id,saps_checked_at,saps_status').eq('id',id).single();if(error||!c)return reply(req,{error:'Client reference not available'},403);
   if(c.saps_checked_at&&Date.now()-new Date(c.saps_checked_at).getTime()<30000)return reply(req,{result:{status:c.saps_status,message:'This case was checked recently. Please wait 30 seconds before checking again.'}});
   return reply(req,{result:await performCheck(id)});
  }
  return reply(req,{error:'Unknown action'},400);
 }catch(e:any){return reply(req,{error:String(e?.message||'The request could not be completed').slice(0,400)},400)}
});
