const base = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins = new Set(['https://sgcnetwork.co.za','https://revenue-fpg.netsgcwork.chatgpt.site','https://revenuefpg.sgcnetwork.co.za']);
function response(data: unknown, status=200, origin='') { return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://revenue-fpg.netsgcwork.chatgpt.site','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}}) }
async function rest(path: string, data?: unknown, method='POST', token=service) {const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:data===undefined?undefined:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw Error(d.message||'Database request failed');return d}
async function gateway(p: unknown){return rest('rpc/fpg_customer_gateway',{p})}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return response({},200,origin);
 if(req.method!=='POST')return response({error:'POST required'},405,origin);
 try{
  const p=await req.json();
  if(['customer_info','customer_upload','customer_complete'].includes(p.action)){
   if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token))throw Error('Invalid upload link');
   const info=await gateway({action:'inspect',token:p.token});
   if(p.action==='customer_info')return response(info,200,origin);
   if(p.action==='customer_upload'){
    if(!['application/pdf','image/jpeg','image/png'].includes(p.type)||!Number.isInteger(p.size)||p.size<=0||p.size>10485760)throw Error('PDF, JPG or PNG up to 10 MB required');
    const name=String(p.name||'evidence').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120);
    // Deterministic per-link upload path limits an unused link to one object.
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const path=info.id+'/customer-'+hash+'/evidence';
    const r=await fetch(base+'/storage/v1/object/upload/sign/fpg-evidence/'+path,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({})});const d=await r.json();if(!r.ok)throw Error(d.message||'Upload link creation failed');
    return response({path,url:base+'/storage/v1'+d.url},200,origin);
   }
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   if(typeof p.path!=='string'||!p.path.startsWith(info.id+'/customer-'+hash+'/'))throw Error('Upload does not belong to this link');
   return response(await gateway({action:'complete',token:p.token,path:p.path,name:String(p.name||'Customer evidence').slice(0,120),last4:p.last4}),200,origin);
  }
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
  const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:'Bearer '+token}});if(!auth.ok)return response({error:'Sign in required'},401,origin);const user=await auth.json();
  const members=await rest('fpg_members?user_id=eq.'+user.id+'&select=role,active',undefined,'GET');if(!members.some((m:{role:string;active:boolean})=>m.active&&m.role==='admin'))return response({error:'Finance administrator required'},403,origin);
  const settings=await rest('fpg_settings?id=eq.operations_routing&select=value',undefined,'GET');const routing=settings[0]?.value||{};const key=Deno.env.get('RESEND_API_KEY');
  const ready=Boolean(key&&routing.from&&routing.controller);
  if(p.action==='email_readiness')return response({ready,reason:ready?'Configured':'Configure a verified sender, controller copy mailbox and the project RESEND_API_KEY before delivery.'},200,origin);
  if(p.action!=='dispatch')throw Error('Unknown service action');
  if(!ready)throw Error('Email delivery is not configured. Configure the verified sender, controller mailbox and RESEND_API_KEY. No messages were sent.');
  const messages=await rest('fpg_mail_outbox?status=eq.Awaiting%20email%20service&order=created_at&limit=10',undefined,'GET');let sent=0,failed=0;
  for(const m of messages){
   // Claim before sending. Unknown outcomes require review, never an automatic resend.
   const claimed=await rest('fpg_mail_outbox?id=eq.'+m.id+'&status=eq.Awaiting%20email%20service',{status:'Sending'},'PATCH');if(!claimed.length)continue;
   try{
    const isReport=m.subject.startsWith('Unanswered variances');
    const body:{[key:string]:unknown}={from:routing.from,to:[m.recipient],cc:m.recipient===routing.controller?[]:[routing.controller],subject:m.subject,text:isReport?'Please find the unanswered variances CSV attached. Controller inspection required.':m.body};
    if(isReport)body.attachments=[{filename:'unanswered-variances.csv',content:btoa(unescape(encodeURIComponent(m.body)))}];
    const rr=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'fpg-'+m.id},body:JSON.stringify(body)});if(!rr.ok)throw Error('Email provider rejected dispatch (HTTP '+rr.status+')');
    await rest('fpg_mail_outbox?id=eq.'+m.id,{status:'Sent',sent_at:new Date().toISOString(),error:null},'PATCH');sent++;
   }catch(e){await rest('fpg_mail_outbox?id=eq.'+m.id,{status:'Needs delivery review',error:String(e).slice(0,250)},'PATCH');failed++}
  }return response({sent,failed},200,origin);
 }catch(e){return response({error:e instanceof Error?e.message:'Request failed'},400,origin)}
});
