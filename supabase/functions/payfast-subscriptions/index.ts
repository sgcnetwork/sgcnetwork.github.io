import {createClient} from "npm:@supabase/supabase-js@2.117.3";
import {createHash} from "node:crypto";
const cors={"Access-Control-Allow-Origin":"https://sgcnetwork.co.za","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const enc=(v:string)=>encodeURIComponent(v.trim()).replace(/%20/g,"+").replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const {data:auth,error:authError}=await sb.auth.getUser(jwt);
  if(authError||!auth.user)return json({error:"Please sign in."},401);
  const body=await req.json();
  if(body.action==="list"){
   const {data,error}=await sb.from("sgc_payfast_subscriptions").select("id,product_name,amount_zar,status,last_payment_at,last_failure_at,cancelled_at,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false});
   if(error)throw Error("List unavailable");
   return json({subscriptions:data});
  }
  if(body.action!=="cancel"||typeof body.id!=="string")return json({error:"Invalid request."},400);
  const {data:subscription,error:lookupError}=await sb.from("sgc_payfast_subscriptions").select("id,token,status").eq("id",body.id).eq("user_id",auth.user.id).single();
  if(lookupError||!subscription)return json({error:"Subscription not found."},404);
  if(subscription.status==="cancelled")return json({cancelled:true});
  const {data:secret,error:secretError}=await sb.from("sgc_gateway_secrets").select("config").eq("provider","payfast").single();
  if(secretError||!secret)throw Error("Configuration unavailable");
  const c=secret.config;
  const headers:Record<string,string>={"merchant-id":c.merchant_id,version:"v1",timestamp:new Date().toISOString().slice(0,19)};
  const signing={...headers,passphrase:c.passphrase};
  headers.signature=createHash("md5").update(Object.keys(signing).sort().map(k=>k+"="+enc(signing[k])).join("&")).digest("hex");
  const response=await fetch("https://api.payfast.co.za/subscriptions/"+encodeURIComponent(subscription.token)+"/cancel",{method:"PUT",headers,signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok||result.status!=="success")return json({error:"PayFast could not confirm cancellation. Please try again or contact SGC support."},502);
  const {error:updateError}=await sb.from("sgc_payfast_subscriptions").update({status:"cancelled",cancelled_at:new Date().toISOString()}).eq("id",subscription.id).eq("user_id",auth.user.id);
  if(updateError)throw Error("Cancellation was sent; status refresh unavailable");
  return json({cancelled:true});
 }catch(error){console.error("PayFast subscription management failed",error instanceof Error?error.message:"Unknown error");return json({error:"Subscription management is temporarily unavailable. Please contact SGC support if you have requested cancellation."},500);}
});
