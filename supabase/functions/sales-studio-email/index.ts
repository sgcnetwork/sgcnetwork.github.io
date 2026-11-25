const site = "https://sgcnetwork.co.za";
const cors = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (data: unknown, status=200) =>
  new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json"}});
const escape = (value: string) => value.replace(/[&<>"']/g, char =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char] ?? char));

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({message:"Method not allowed"},405);
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer "))return json({message:"Sign in first"},401);
  const url=Deno.env.get("SUPABASE_URL");
  const apiKey=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resend=Deno.env.get("RESEND_API_KEY");
  if(!url||!apiKey||!service||!resend)return json({message:"Email provider is not configured"},503);
  const headers={apikey:apiKey,Authorization:authorization,"Content-Type":"application/json"};
  try{
    const {lead,subject,body,key}=await req.json();
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(typeof lead!=="string"||!uuid.test(lead)||typeof key!=="string"||!uuid.test(key)||
      typeof subject!=="string"||!subject.trim()||subject.length>200||/[\r\n]/.test(subject)||
      typeof body!=="string"||!body.trim()||body.length>12000)return json({message:"Check the draft fields"},400);
    const user=await fetch(url+"/auth/v1/user",{headers});
    if(!user.ok)return json({message:"Sign in again"},401);
    const {id}=await user.json();
    const read=async (path:string, init:RequestInit={})=>{
      const response=await fetch(url+"/rest/v1/"+path,{headers,...init});
      if(!response.ok)throw new Error("Database request failed");
      return response.json();
    };
    const [[member],[customer],[settings]]=await Promise.all([
      read("sales_team?select=sender&id=eq."+id),
      read("sales_leads?select=email&id=eq."+lead),
      read("sales_outreach_settings?select=bcc&id=eq.1"),
    ]);
    if(!member?.sender||!customer?.email||!settings?.bcc)return json({message:"A verified sender, lead email and central BCC mailbox are required"},409);
    if(!await read("rpc/sales_outreach_allowed",{method:"POST",body:JSON.stringify({lead_id:lead,contact_channel:"email"})}))return json({message:"Outreach approval and current email permission are required"},403);
    const content=escape(body).replace(/https:\/\/[^\s<]+/g, candidate=>{
      try{
        const parsed=new URL(candidate.replaceAll("&amp;","&"));
        if(parsed.hostname==="sgcnetwork.co.za"||parsed.hostname.endsWith(".sgcnetwork.co.za"))return '<a href="'+escape(parsed.href)+'">'+candidate+'</a>';
      }catch{/* Leave malformed links as text. */}
      return candidate;
    }).replaceAll("\n","<br>");
    const sent=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{Authorization:"Bearer "+resend,"Content-Type":"application/json","Idempotency-Key":"sales-studio/"+id+"/"+key},
      body:JSON.stringify({from:member.sender,to:[customer.email],bcc:[settings.bcc],subject,text:body,
        html:'<div style="font:16px Arial,sans-serif;color:#381d38;max-width:620px;margin:auto"><p style="background:#ffd8e8;padding:20px"><b>SGC Network</b></p><p style="padding:16px;line-height:1.6">'+content+'</p><p><a href="'+site+'/privacy.html">Privacy notice</a></p></div>'})
    });
    if(!sent.ok)return json({message:"The email provider did not accept this message"},502);
    const receipt=await sent.json();
    const logged=await fetch(url+"/rest/v1/sales_activity",{
      method:"POST", headers:{apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json"},
      body:JSON.stringify({lead,actor:id,channel:"email",status:"Accepted by provider",detail:receipt.id+" · "+subject+"\n"+body})
    });
    if(!logged.ok)return json({message:"Provider accepted this email, but the activity log failed. Check the provider before resending.",id:receipt.id},202);
    return json({message:"Accepted by email provider. Delivery is pending.",id:receipt.id});
  }catch{
    return json({message:"Email request failed. Check the provider before resending."},500);
  }
});
