import {createClient} from "npm:@supabase/supabase-js@2.117.3";
import { Buffer } from "node:buffer";
import {createHash,timingSafeEqual} from "node:crypto";
const enc=(v:string)=>encodeURIComponent(v.trim()).replace(/%20/g,"+").replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
Deno.serve(async req=>{
 if(req.method!=="POST")return new Response("POST required",{status:405});
 try{
  const raw=await req.text(); if(raw.length>20000)return new Response("Too large",{status:413});
  const params=new URLSearchParams(raw);
  const entries=[...params.entries()];
  if(new Set(entries.map(([k])=>k)).size!==entries.length)return new Response("Duplicate fields",{status:400});
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:secret,error:se}=await sb.from("sgc_gateway_secrets").select("config").eq("provider","payfast").single();
  if(se||!secret)throw Error("Configuration unavailable");
  const c=secret.config;
  const payload=entries.filter(([k,v])=>k!=="signature"&&v!=="").map(([k,v])=>k+"="+enc(v)).join("&");
  const expected=createHash("md5").update(payload+"&passphrase="+enc(c.passphrase)).digest("hex");
  const provided=params.get("signature")||"";
  if(!/^[a-f0-9]{32}$/i.test(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided.toLowerCase())))return new Response("Invalid signature",{status:400});
  if(params.get("merchant_id")!==c.merchant_id)return new Response("Invalid merchant",{status:400});
  const validation=await fetch("https://www.payfast.co.za/eng/query/validate",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:payload,signal:AbortSignal.timeout(15000)});
  if(!validation.ok||(await validation.text()).trim()!=="VALID")return new Response("Provider validation failed",{status:400});
  const {error:applyError}=await sb.rpc("sgc_apply_payfast_notification",{
    p_reference:params.get("m_payment_id"),p_payment_id:params.get("pf_payment_id"),
    p_token:params.get("token"),p_amount:Number(params.get("amount_gross")),p_status:params.get("payment_status")
  });
  if(applyError)throw Error("Could not record verified payment");
  return new Response("OK");
 }catch(e){console.error("PayFast ITN processing failed",e instanceof Error?e.message:"Unknown error");return new Response("Notification temporarily unavailable",{status:500});}
});
