
const URL_BASE=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY=Deno.env.get('RESEND_API_KEY');
const DESTINATION='documentjourneyprocessing@outlook.com';
const esc=(s:unknown)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const value=(s:unknown)=>String(s??'').trim()||'Not provided';
const jsonHeaders={apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,'Content-Type':'application/json'};
async function db(path:string,body:unknown,method='POST'){
 const r=await fetch(URL_BASE+'/rest/v1/'+path,{method,headers:{...jsonHeaders,Prefer:'return=representation'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Database request failed ('+r.status+')');
 return await r.json();
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 let id:string,token:string;
 try{const raw=await req.text();if(raw.length>1000)throw new Error();const b=JSON.parse(raw);id=b.id;token=b.token;
  if(!/^[0-9a-f-]{36}$/i.test(id)||typeof token!=='string'||token.length!==72)throw new Error();
 }catch{return Response.json({error:'Invalid request'},{status:400});}
 let claimed:any;
 try{claimed=await db('rpc/djp_claim_email',{p_id:id,p_token:token});}
 catch{return Response.json({error:'Queue unavailable'},{status:503});}
 if(!claimed)return Response.json({accepted:false},{status:202});
 const row=claimed.enquiry;
 const filter='djp_email_outbox?enquiry_id=eq.'+id+'&attempt_token=eq.'+claimed.attempt_token;
 try{
  if(!RESEND_KEY)throw new Error('Email credentials are not configured');
  const type=String(row.enquiry_type||row.service).replace(/[\r\n\x00-\x1f\x7f]/g,' ').trim().slice(0,150);
  const subject='Enquiry: '+type;
  const fields=[
   ['Name',row.name],['Email',row.email],['Phone number',row.phone],
   ['Service enquired for',type],['Service category',row.service],['Destination / country of use',row.destination],
   ['Preferred deadline',row.deadline],['Notes / message',row.message],
   ['Enquiry reference',row.lead_number?'DJP NQ'+row.lead_number:row.id],['Submitted',new Date(row.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})+' SAST'],
   ['Enquiry status at submission','New'],['Contact consent',row.consent?'Yes':'No']
  ];
  const text='DJP — Document Journey Processing\nNew website enquiry\n\n'+fields.map(([k,v])=>k+': '+value(v)).join('\n\n')+
   '\n\nReply to this email to contact the enquirer.\nStaff inbox: https://djp.sgcnetwork.co.za/djp/manage.html';
  const html='<!doctype html><html><body style="margin:0;background:#f3f1eb;font-family:Arial,sans-serif;color:#102e3b"><div style="max-width:650px;margin:25px auto;background:white;border:1px solid #e3e3db;border-radius:12px;overflow:hidden">'+
   '<div style="padding:30px;background:#102e3b;color:white"><div style="color:#d6b77c;font-size:11px;letter-spacing:2px">DOCUMENT JOURNEY PROCESSING</div><h1 style="font-family:Georgia,serif;font-size:31px;margin:15px 0 0">New enquiry</h1><p style="margin-bottom:0;color:#d4dfe2">'+esc(type)+'</p></div>'+
   '<div style="padding:28px"><table style="width:100%;border-collapse:collapse">'+fields.map(([k,v])=>'<tr><th align="left" style="width:35%;vertical-align:top;padding:13px 12px 13px 0;border-bottom:1px solid #eee;font-size:12px;color:#647780">'+esc(k)+'</th><td style="padding:13px 0;border-bottom:1px solid #eee;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere">'+esc(value(v))+'</td></tr>').join('')+
   '</table><p style="font-size:12px;color:#6a7d85;line-height:1.7">Reply to this email to contact the enquirer directly.</p><a href="https://djp.sgcnetwork.co.za/djp/manage.html" style="display:inline-block;padding:13px 20px;background:#102e3b;color:white;text-decoration:none;border-radius:6px;font-size:12px">Open DJP staff inbox</a></div></div></body></html>';
  const payload:any={from:'DJP Enquiries <noreply@sgcnetwork.co.za>',to:[DESTINATION],subject,text,html};
  if(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.email)&&!/[\r\n]/.test(row.email))payload.reply_to=row.email;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+RESEND_KEY,'Content-Type':'application/json','Idempotency-Key':'djp-enquiry/'+id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Email provider returned '+response.status);
  const sent=await response.json();if(!sent.id)throw new Error('Email provider did not confirm acceptance');
  await db(filter,{status:'sent',sent_at:new Date().toISOString(),provider_id:sent.id,last_error:null,locked_until:null},'PATCH');
  return Response.json({sent:true});
 }catch(error){
  const failed=claimed.attempts>=12;
  const delay=Math.min(30,2**Math.min(claimed.attempts,5))*60000;
  try{await db(filter,{status:failed?'failed':'pending',last_error:error instanceof Error?error.message:'Delivery failed',locked_until:null,next_attempt_at:new Date(Date.now()+delay).toISOString()},'PATCH');}catch{/* Lease expiry permits recovery with the same provider idempotency key. */}
  console.error('DJP email delivery retry needed',{id,attempt:claimed.attempts});
  return Response.json({sent:false,retry:!failed},{status:503});
 }
});
