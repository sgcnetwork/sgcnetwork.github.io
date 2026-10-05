import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "https://sgcnetwork.co.za",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) throw new Error("Server configuration missing");

    const { email: rawEmail, password } = await req.json();
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email || !password || String(password).length < 8) throw new Error("Valid email and password of at least 8 characters required");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Create Auth user server-side as already confirmed, preventing Supabase's normal confirmation email.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { signup_source: "academy_waitlist" }
    });

    let userId = created?.user?.id || null;

    if (createError) {
      // If email already exists in Auth, do not expose account existence details.
      const { data: existing } = await admin.from("sgc_academy_waitlist").select("user_id").eq("email", email).maybeSingle();
      if (!existing?.user_id) throw new Error("This email cannot be added to the waitlist");
      userId = existing.user_id;
    }

    const { error: upsertError } = await admin.from("sgc_academy_waitlist").upsert({
      user_id: userId,
      email,
      status: "pending_confirmation",
      email_confirmed: false
    }, { onConflict: "email" });
    if (upsertError) throw upsertError;

    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");

    const { error: tokenError } = await admin.from("sgc_academy_waitlist").update({
      confirmation_token_hash: tokenHash,
      confirmation_expires_at: new Date(Date.now()+24*60*60*1000).toISOString()
    }).eq("email", email);
    if (tokenError) throw tokenError;

    const confirmationUrl = `${supabaseUrl}/functions/v1/confirm-waitlist?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

    const mail = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{Authorization:`Bearer ${resendApiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        from:"SGC Network Waitlist <waitlist@sgcnetwork.co.za>",
        to:[email],
        subject:"Confirm your SGC Academy Waitlist",
        html:`<div style="background:#FFF9F2;padding:45px 20px;font-family:Arial;color:#171515"><div style="max-width:600px;margin:auto;background:#fff;padding:42px;border-radius:24px"><div style="text-align:center;font-family:Georgia;font-size:40px;font-weight:bold">SGC</div><div style="text-align:center;font-size:9px;letter-spacing:5px;margin-bottom:35px">NETWORK</div><div style="font-size:10px;letter-spacing:3px;color:#756E69">SGC NETWORK ACADEMY</div><h1 style="font-family:Georgia;font-size:38px;line-height:1.05">Confirm your place on the waitlist.</h1><p style="color:#756E69;line-height:1.7">You're almost in. Confirm your email address to complete your SGC Academy Waitlist registration.</p><div style="text-align:center;margin:35px 0"><a href="${confirmationUrl}" style="background:#171515;color:white;text-decoration:none;padding:17px 28px;border-radius:30px;font-size:12px;font-weight:bold">CONFIRM WAITLIST EMAIL →</a></div><p style="font-size:12px;color:#8A817B">This link expires in 24 hours.</p></div><p style="text-align:center;font-size:9px;letter-spacing:2px;color:#8A817B">LEARN • PLAN • IMPLEMENT • GROW</p></div>`
      })
    });
    const mailResult = await mail.json();
    if (!mail.ok) throw new Error(mailResult?.message || "Confirmation email could not be sent");

    return new Response(JSON.stringify({success:true}),{status:200,headers:{...cors,"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({success:false,error:e instanceof Error?e.message:"Something went wrong"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});