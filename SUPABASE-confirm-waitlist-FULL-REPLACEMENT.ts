import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server credentials are missing");
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    if (!token || !email) {
      return Response.redirect("https://sgcnetwork.co.za/join-academy/", 302);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const tokenBytes = new TextEncoder().encode(token);
    const tokenHashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes);
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: member, error: findError } = await supabaseAdmin
      .from("sgc_academy_waitlist")
      .select("id,email,status,email_confirmed,confirmation_expires_at")
      .eq("email", email.trim().toLowerCase())
      .eq("confirmation_token_hash", tokenHash)
      .single();

    if (findError || !member) {
      return Response.redirect("https://sgcnetwork.co.za/join-academy/", 302);
    }

    if (!member.confirmation_expires_at ||
        new Date(member.confirmation_expires_at) < new Date()) {
      return Response.redirect("https://sgcnetwork.co.za/join-academy/", 302);
    }

    const { error: updateError } = await supabaseAdmin
      .from("sgc_academy_waitlist")
      .update({
        email_confirmed: true,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmation_token_hash: null,
        confirmation_expires_at: null
      })
      .eq("id", member.id);

    if (updateError) throw updateError;

    return Response.redirect(
      "https://sgcnetwork.co.za/join-academy/welcome.html",
      302
    );
  } catch (error) {
    console.error("Waitlist confirmation error:", error);
    return Response.redirect("https://sgcnetwork.co.za/join-academy/", 302);
  }
});