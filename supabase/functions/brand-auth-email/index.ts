import {buildEmails, verifyHook} from './email.mjs';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const raw=await req.text();if(raw.length>262144)return json({error:'Payload too large'},413);
  if(!await verifyHook(raw,req.headers,Deno.env.get('BABM_AUTH_EMAIL_ROUTER_SECRET')))return json({error:'Invalid webhook signature'},401);
  const key=Deno.env.get('RESEND_API_KEY');if(!key)return json({error:{http_code:500,message:'Account email service is not configured'}},500);
  try{
    const event=JSON.parse(raw);const emails=buildEmails(event,Deno.env.get('SUPABASE_URL'));
    let redirectHost='';try{redirectHost=new URL(event.email_data.redirect_to).hostname;}catch{}
    console.info('Account email routing',{brand:emails[0].from.startsWith('BABM ')?'babm':'sgc',action:event.email_data.email_action_type,redirectHost});
    const results=await Promise.all(emails.map((email,index)=>fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':`auth/${req.headers.get('webhook-id')}/${index}`},body:JSON.stringify(email),signal:AbortSignal.timeout(4000)})));
    if(results.some(r=>!r.ok)){console.error('Account email provider rejected delivery',results.map(r=>r.status));return json({error:{http_code:502,message:'Account email could not be sent. Please try again.'}},502);}
    const deliveries=await Promise.all(results.map(r=>r.json()));
    console.info('Account email accepted',{count:emails.length,sender:emails[0].from,subject:emails[0].subject,providerIds:deliveries.map(d=>d.id)});return json({});
  }catch{console.error('Account email processing failed');return json({error:{http_code:500,message:'Account email could not be sent. Please try again.'}},500);}
});
