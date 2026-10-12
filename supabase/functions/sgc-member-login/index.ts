import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"https://sgcnetwork.co.za","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const body=await req.json();
  const identifier=String(body.identifier||"").trim().toLowerCase().replace(/\s+/g," ");
  const password=String(body.password||"");
  if(!identifier||identifier.length>200||!password||password.length>1000)return reply({error:"Enter your email or username and password."},400);
  const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  for(const value of ["username:"+identifier,"ip:"+ip]){
   const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
   const rateKey=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
   const {data:allowed,error:limitError}=await admin.rpc("sgc_login_attempt",{p_key:rateKey});
   if(limitError||!allowed)return reply({error:"Too many sign-in attempts. Try again in 10 minutes."},429);
  }
  let email=identifier;
  if(!identifier.includes("@")){
   const {data,error}=await admin.from("sgc_login_names").select("user_id").eq("username",identifier).limit(2);
   if(error)throw error;
   if(data&&data.length>1)return reply({error:"More than one member uses this name. Please use your email address to log in."},409);
   if(data&&data.length===1){const user=await admin.auth.admin.getUserById(data[0].user_id);email=user.data.user?.email||"invalid@sgcnetwork.co.za";}
   else email="invalid@sgcnetwork.co.za";
  }
  // Authentication is still performed by Supabase's password endpoint.
  const auth=await admin.auth.signInWithPassword({email,password});
  if(auth.error||!auth.data.session)return reply({error:"Email, username or password is incorrect. Check that your email is confirmed."},401);
  return reply({access_token:auth.data.session.access_token,refresh_token:auth.data.session.refresh_token});
 }catch{return reply({error:"Unable to sign in. Please try again."},400);}
});