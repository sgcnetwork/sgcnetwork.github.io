import { Webhook } from "https://esm.sh/svix@1.76.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("SGC Stitch webhook running", { status: 200 });
  }

  try {
    // -----------------------------
    // 1. VERIFY STITCH WEBHOOK
    // -----------------------------
    const webhookSecret = Deno.env.get("STITCH_WEBHOOK_SECRET");

    if (!webhookSecret) {
      throw new Error("Missing STITCH_WEBHOOK_SECRET");
    }

    const rawBody = await req.text();

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing webhook headers", { status: 400 });
    }

    const wh = new Webhook(webhookSecret);

    const event: any = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });

    console.log("Verified Stitch event received");

    if (event.status !== "PAID") {
      return Response.json({
        received: true,
        ignored: true,
      });
    }

    // -----------------------------
    // 2. GET STITCH PAYMENT DETAILS
    // -----------------------------
    const clientId = Deno.env.get("STITCH_CLIENT_ID");
    const clientSecret = Deno.env.get("STITCH_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("Missing Stitch credentials");
    }

    const tokenResponse = await fetch(
      "https://express.stitch.money/api/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          clientSecret,
          scope: "client_paymentrequest",
        }),
      }
    );

    const tokenResult = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenResult?.data?.accessToken) {
      console.error("Stitch token error:", tokenResponse.status);
      throw new Error("Could not authenticate with Stitch");
    }

    const accessToken = tokenResult.data.accessToken;

    if (!event.linkId) {
      throw new Error("Payment has no Stitch linkId");
    }

    const paymentResponse = await fetch(
      `https://express.stitch.money/api/v1/payment-links/${event.linkId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const paymentResult = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("Payment lookup failed:", paymentResponse.status);
      throw new Error("Could not retrieve Stitch payment");
    }

    const payment = paymentResult?.data?.payment;

    if (!payment) {
      throw new Error("Stitch payment details missing");
    }

    const merchantReference = payment.merchantReference;

    console.log("Merchant reference:", merchantReference);


    // Verified CFHP guest payments await manual business acceptance.
    if(typeof merchantReference==="string"&&merchantReference.startsWith("C-")){
      const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const {data:tx,error}=await db.from("sgc_stitch_transactions").select("*").eq("merchant_reference",merchantReference).single();
      if(error||!tx||!tx.product_id?.startsWith("cfhp-booking:"))throw Error("No tracked CFHP checkout");
      if(!tx.stitch_payment_id||String(tx.stitch_payment_id)!==String(event.linkId))throw Error("CFHP payment link mismatch");
      const expected=Math.round(Number(tx.amount_zar)*100);
      if(!Number.isSafeInteger(expected)||expected<1||Number(event.amount)!==expected)throw Error("CFHP paid amount mismatch");
      const {error:saveError}=await db.from("sgc_stitch_transactions").update({status:"paid",paid_at:tx.paid_at||new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",tx.id);
      if(saveError)throw saveError;
      return Response.json({received:true,verified:true,paymentRecorded:true,awaitingCfhpAcceptance:true});
    }

    // A payment reference identifies a tracked checkout, never the customer's UUID.
    if (typeof merchantReference === "string" && /^[MSBW]-/.test(merchantReference)) {
      const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if(!url||!key)throw new Error("Supabase server credentials missing");
      const db=createClient(url,key);
      const {data:tx,error:txError}=await db.from("sgc_stitch_transactions").select("*").eq("merchant_reference",merchantReference).single();
      if(txError||!tx)throw new Error("No tracked membership checkout");
      if(!tx.user_id)throw new Error("Membership buyer missing");
      if(tx.stitch_payment_id&&String(tx.stitch_payment_id)!==String(event.linkId))throw new Error("Payment link does not match membership checkout");
      const expected=Math.round(Number(tx.amount_zar)*100);
      if(!Number.isSafeInteger(expected)||Number(event.amount)!==expected)throw new Error("Paid amount does not match membership checkout");
      const paidAt=tx.paid_at||new Date().toISOString();
      const {error:paidError}=await db.from("sgc_stitch_transactions").update({status:"paid",paid_at:paidAt,updated_at:new Date().toISOString()}).eq("id",tx.id);
      if(paidError)throw paidError;
      const {data:activation,error:activationError}=await db.rpc("sgc_activate_paid_membership",{p_transaction_id:tx.id});
      if(activationError)throw activationError;
      return Response.json({received:true,verified:true,paymentRecorded:true,...activation});
    }

    // Dynamic product checkouts use the recorded transaction, never a UUID
    // parsed from a payment reference, to identify the buyer and purchased kit.
    if (typeof merchantReference === "string" && merchantReference.startsWith("X-")) {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) throw new Error("Supabase server credentials missing");
      const db = createClient(url, key);
      const { data: tx, error: txError } = await db.from("sgc_stitch_transactions")
        .select("*").eq("merchant_reference", merchantReference).single();
      if (txError || !tx) throw new Error("No tracked product checkout");
      if (tx.stitch_payment_id && String(tx.stitch_payment_id) !== String(event.linkId)) {
        throw new Error("Stitch payment link does not match checkout");
      }
      const expected = Math.round(Number(tx.amount_zar) * 100);
      if (!Number.isSafeInteger(expected) || Number(event.amount) !== expected) {
        throw new Error("Paid amount does not match checkout");
      }
      if (!tx.user_id || !tx.customer_email) throw new Error("Checkout customer missing");
      const { data: meta, error: metaError } = await db.from("sgc_product_settings")
        .select("category").eq("product_id", tx.product_id).maybeSingle();
      if (metaError) throw metaError;
      const paidAt = tx.paid_at || new Date().toISOString();
      const { error: paidError } = await db.from("sgc_stitch_transactions")
        .update({ status: "paid", paid_at: paidAt, updated_at: new Date().toISOString() }).eq("id", tx.id);
      if (paidError) throw paidError;
      const {data:activation,error:activationError}=await db.rpc("sgc_activate_paid_membership",{p_transaction_id:tx.id});
      if(activationError)throw activationError;
      if(activation?.membershipActivated||activation?.websiteBuilderActivated)return Response.json({received:true,verified:true,paymentRecorded:true,...activation});
      if (meta?.category !== "business-kits") {
        return Response.json({received:true,verified:true,paymentRecorded:true});
      }
      if (tx.kit_email_sent_at) {
        return Response.json({received:true,verified:true,kitEmailAlreadySent:true});
      }
      const now = new Date().toISOString();
      const { data: claimed, error: claimError } = await db.from("sgc_stitch_transactions")
        .update({kit_email_locked_until:new Date(Date.now()+600000).toISOString()})
        .eq("id",tx.id).is("kit_email_sent_at",null)
        .or("kit_email_locked_until.is.null,kit_email_locked_until.lt."+now)
        .select("id").maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return Response.json({received:false,retry:true},{status:503});
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("Email delivery credentials missing");
        const { data: files, error: fileError } = await db.from("sgc_product_files")
          .select("title,path,kind").eq("product_id",tx.product_id);
        if (fileError) throw fileError;
        const pdfs=(files||[]).filter(f=>/\.pdf$/i.test(f.path));
        if (!pdfs.length) throw new Error("Purchased kit PDF has not been uploaded");
        const attachments=[];
        let bytesTotal=0;
        for (let i=0;i<pdfs.length;i++) {
          const file=pdfs[i];
          const {data:blob,error:downloadError}=await db.storage.from("sgc-products").download(file.path);
          if(downloadError||!blob)throw new Error("Unable to load purchased kit PDF");
          bytesTotal+=blob.size;
          if(bytesTotal>20*1024*1024)throw new Error("Kit PDFs exceed email attachment limit");
          const bytes=new Uint8Array(await blob.arrayBuffer());
          if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("Kit attachment is not a valid PDF");
          let binary="";
          for(let offset=0;offset<bytes.length;offset+=8192){
            binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
          }
          const base=String(file.title||tx.product_name).replace(/[^a-zA-Z0-9 _-]/g,"").trim()||"SGC-Kit";
          attachments.push({filename:base+"-"+(i+1)+".pdf",content:btoa(binary),content_type:"application/pdf"});
        }
        const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
        const response=await fetch("https://api.resend.com/emails",{
          method:"POST",
          headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json",
            "Idempotency-Key":"sgc-kit-"+tx.id},
          body:JSON.stringify({
            from:Deno.env.get("SGC_KIT_EMAIL_FROM")||"SGC Network <waitlist@sgcnetwork.co.za>",
            to:[tx.customer_email],
            subject:"Your SGC kit: "+tx.product_name,
            html:'<div style="background:#faf7f2;padding:32px;font-family:Arial,sans-serif;color:#29242c"><div style="max-width:600px;margin:auto"><p style="letter-spacing:4px">SGC NETWORK</p><h1 style="font-family:Georgia,serif">Your next chapter starts here.</h1><p>Hi '+escape(tx.customer_name||"there")+',</p><p>Thank you for purchasing <strong>'+escape(tx.product_name)+'</strong>. Your kit PDF is attached to this email.</p><p>Payment received: R'+Number(tx.amount_zar).toFixed(2)+'</p><p>Reference: '+escape(tx.merchant_reference)+'</p><p>Save your PDF and work through the resources at your own pace.</p><p>SGC Network · Learn · Plan · Implement · Grow</p></div></div>',
            text:"Thank you for purchasing "+tx.product_name+". Your kit PDF is attached. Payment received: R"+Number(tx.amount_zar).toFixed(2)+". Reference: "+tx.merchant_reference,
            attachments
          })
        });
        const result=await response.json();
        if(!response.ok||!result.id)throw new Error("Kit delivery email could not be sent");
        const {error:sentError}=await db.from("sgc_stitch_transactions").update({
          kit_email_sent_at:new Date().toISOString(),kit_email_id:result.id,
          kit_email_locked_until:null,kit_email_error:null
        }).eq("id",tx.id);
        if(sentError)throw sentError;
        return Response.json({received:true,verified:true,paymentRecorded:true,kitEmailSent:true});
      } catch(deliveryError) {
        await db.from("sgc_stitch_transactions").update({
          kit_email_locked_until:null,
          kit_email_error:deliveryError instanceof Error?deliveryError.message:"Kit delivery failed"
        }).eq("id",tx.id);
        // Return a retryable failure rather than acknowledging missing delivery.
        return Response.json({received:false,paymentRecorded:true,kitEmailSent:false,retry:true},{status:503});
      }
    }

    // Legacy previews, R1 tests, kits and lay-by checkouts are also tracked.
    // Recording payment does not itself grant membership or deliver kit content.
    if (typeof merchantReference === "string" && /^[TPKGL]-/.test(merchantReference)) {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) throw new Error("Supabase server credentials missing");
      const db = createClient(url, key);
      const { data: tx, error } = await db.from("sgc_stitch_transactions")
        .select("*").eq("merchant_reference", merchantReference).single();
      if (error || !tx) throw new Error("No tracked checkout");
      if (!tx.stitch_payment_id || String(tx.stitch_payment_id) !== String(event.linkId)) {
        throw new Error("Payment link does not match checkout");
      }
      const expected = Math.round(Number(tx.amount_zar) * 100);
      if (!Number.isSafeInteger(expected) || expected < 1 || Number(event.amount) !== expected) {
        throw new Error("Paid amount does not match checkout");
      }
      const { error: saveError } = await db.from("sgc_stitch_transactions")
        .update({ status: "paid", paid_at: tx.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString() }).eq("id", tx.id);
      if (saveError) throw saveError;
      return Response.json({ received: true, verified: true, paymentRecorded: true,
        membershipActivated: false });
    }
    throw new Error("Unrecognised tracked checkout reference");

  } catch (error) {
    console.error("Webhook error:", error);

    return Response.json(
      {
        received: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook failed",
      },
      { status: 400 }
    );
  }
});