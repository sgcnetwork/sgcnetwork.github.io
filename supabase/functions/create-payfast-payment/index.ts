
import { createHash } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sgcnetwork.co.za",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

type LegacyProduct = {
  code: string;
  price: number;
  flexible?: boolean;
};

const legacyProducts: Record<string, LegacyProduct> = {
  "sgc-start-foundations": { code: "S", price: 150 },
  start: { code: "S", price: 150 },

  "sgc-build-lab": { code: "B", price: 450 },
  build: { code: "B", price: 450 },

  "website-builder": { code: "W", price: 199 },
  preview: { code: "P", price: 20 },
  "r20-preview": { code: "P", price: 20 },


  "business-kit": { code: "K", price: 499 },
  kit: { code: "K", price: 499 },

  "gaming-kit": { code: "G", price: 699 },

  "kit-layby": {
    code: "L",
    price: 0,
    flexible: true,
  },

  layby: {
    code: "L",
    price: 0,
    flexible: true,
  },
};

async function readJson(response: Response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 500) };
  }
}

const encode=(v:string)=>encodeURIComponent(v.trim()).replace(/%20/g,"+").replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
const signature=(fields:Record<string,string>,passphrase:string)=>createHash("md5").update(Object.entries(fields).filter(([k,v])=>k!=="signature"&&v!==""&&v!=="0").map(([k,v])=>k+"="+encode(v)).join("&")+"&passphrase="+encode(passphrase)).digest("hex");
const escapeHtml=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
async function renderCheckout(req:Request){
 const reference=new URL(req.url).searchParams.get("reference");
 if(!reference||!/^[-a-zA-Z0-9]{3,80}$/.test(reference))return new Response("Invalid checkout",{status:400});
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const {data:t}=await sb.from("sgc_stitch_transactions").select("*").eq("merchant_reference",reference).eq("payment_provider","payfast").single();
 if(!t||t.status!=="pending"||Date.now()-new Date(t.created_at).getTime()>3600000)return new Response("Checkout expired or completed. Please start again.",{status:410});
 const {data:secret}=await sb.from("sgc_gateway_secrets").select("config").eq("provider","payfast").single();
 if(!secret)return new Response("Payment configuration unavailable",{status:503});
 const c=secret.config;
 const fields:Record<string,string>={merchant_id:c.merchant_id,merchant_key:c.merchant_key,
 return_url:"https://sgcnetwork.co.za/payfast-return.html?reference="+encodeURIComponent(reference),
 cancel_url:"https://sgcnetwork.co.za/payfast-return.html?cancelled=1",
 notify_url:Deno.env.get("SUPABASE_URL")+"/functions/v1/payfast-itn",
 name_first:String(t.customer_name||"SGC Customer").slice(0,100),
 email_address:String(t.customer_email||""),m_payment_id:reference,
 amount:Number(t.amount_zar).toFixed(2),item_name:String(t.product_name).slice(0,100)};
 if(t.auto_recurring){
  if(t.billing!=="monthly"||Number(t.amount_zar)<5)return new Response("Invalid subscription",{status:400});
  Object.assign(fields,{subscription_type:"1",recurring_amount:Number(t.amount_zar).toFixed(2),frequency:"3",cycles:"0"});
 }
 fields.signature=signature(fields,c.passphrase);
 return new Response(JSON.stringify({action:"https://www.payfast.co.za/eng/process",fields}),{headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});

}
Deno.serve(async (req) => {
 if(req.method==="GET")return renderCheckout(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respond(
      { success: false, error: "POST required" },
      405
    );
  }

  try {
    // =========================================
    // 1. ENVIRONMENT CREDENTIALS
    // =========================================

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );


    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase credentials are missing");
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // =========================================
    // 2. READ REQUEST
    // =========================================

    const body = await req.json();

    const product = String(body.product || "").trim();
    const productId = String(body.productId || "").trim();
    const variantId = String(body.variantId || "").trim();
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return respond({success:false,error:"Invalid quantity (1–100)."},400);
    if ((variantId || quantity !== 1) && !productId) return respond({success:false,error:"Variant and quantity checkout requires a product."},400);
    const membershipId = String(
      body.membershipId || ""
    ).trim();

    // =========================================
    // 3. CUSTOMER AUTHENTICATION
    // =========================================

    const authorization =
      req.headers.get("Authorization") || "";

    const jwt = authorization.replace(
      /^Bearer\s+/i,
      ""
    );

    let authenticatedUser: any = null;

    if (jwt) {
      const { data, error } =
        await supabase.auth.getUser(jwt);

      if (!error && data?.user) {
        authenticatedUser = data.user;
      }
    }

    // =========================================
    // 4. DETERMINE PRODUCT AND PRICE
    // =========================================

    let finalAmount = 0;
    let selectedName = "";
    let selectedId = "";
    let referenceCode = "";
    let billing = "once";
    let entitlementKey: string | null = null;

    if (membershipId) {
      if (!authenticatedUser) {
        return respond(
          {
            success: false,
            error:
              "Please sign in before purchasing a membership",
          },
          401
        );
      }

      const { data, error } = await supabase
        .from("sgc_named_membership_plans")
        .select("id,name,price_zar,billing,state")
        .eq("id", membershipId)
        .eq("state", "published")
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        throw new Error(
          "Membership is not available for purchase"
        );
      }

      finalAmount = Number(data.price_zar);
      selectedName = data.name;
      selectedId = data.id;
      referenceCode = "M";
      billing = data.billing || "once";

    } else if (productId) {
      if (!authenticatedUser) {
        return respond(
          {
            success: false,
            error: "Please sign in before purchasing",
          },
          401
        );
      }

      const { data, error } = await supabase
        .from("sgc_products")
        .select("id,name,price_zar,billing,active,access_level")
        .eq("id", productId)
        .eq("active", true)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        throw new Error(
          "Product is not available for purchase"
        );
      }

      let unitPrice = Number(data.price_zar);
      if (variantId) {
        const { data: variant, error: variantError } = await supabase.from("sgc_kit_variants")
          .select("id,name,price_zar").eq("id",variantId).eq("product_id",data.id).eq("active",true).single();
        if (variantError || !variant) return respond({success:false,error:"Selected variant is unavailable."},400);
        unitPrice = Number(variant.price_zar);
        selectedName = data.name + " — " + variant.name;
      } else selectedName = data.name;
      if (data.billing === "monthly" && quantity !== 1) return respond({success:false,error:"Subscriptions require quantity one."},400);
      finalAmount = Math.round(unitPrice * 100) * quantity / 100;
      selectedId = data.id;
      referenceCode = "X";
      entitlementKey = data.access_level || null;
      billing = data.billing || "once";

    } else {
      const selected = legacyProducts[product];

      if (!selected) {
        throw new Error(
          `Invalid SGC product: ${product}`
        );
      }

      finalAmount = selected.flexible
        ? Number(body.amount)
        : selected.price;

      selectedName = product;
      selectedId = product;
      referenceCode = selected.code;
      entitlementKey = ({S:"start",B:"build",W:"website_builder"} as Record<string,string>)[selected.code] || null;
      if (["S","B","W"].includes(selected.code) && !authenticatedUser) {
        return respond({success:false,error:"Please sign in before purchasing a membership"},401);
      }

      if (
        product === "build" ||
        product === "sgc-build-lab" || product === "website-builder"
      ) {
        billing = "monthly";
      }
    }

    if (entitlementKey === "build" || entitlementKey === "website_builder") {
      const { data: allowed, error } = await supabase.rpc("sgc_checkout_membership_allowed", { p_user: authenticatedUser.id });
      if (error) throw new Error("Unable to verify SGC membership. Please try again.");
      if (allowed !== true) return respond({success:false,error:"Purchase the R150 once-off SGC Membership first."},403);
    }

    // =========================================
    // 5. VALIDATE PRICE
    // =========================================

    if (
      !Number.isFinite(finalAmount) ||
      finalAmount < 1
    ) {
      throw new Error(
        "Invalid product or membership price"
      );
    }

    if(billing==="monthly"){
      if(!authenticatedUser)return respond({success:false,error:"Please sign in before subscribing."},401);
      if(finalAmount<5)return respond({success:false,error:"Monthly subscriptions require at least R5."},400);
      let existingQuery=supabase.from("sgc_payfast_subscriptions").select("id").eq("user_id",authenticatedUser.id).in("status",["active","past_due"]);
      existingQuery=entitlementKey?existingQuery.eq("entitlement_key",entitlementKey):existingQuery.eq("product_id",selectedId);
      const {data:existing,error:subscriptionError}=await existingQuery.limit(1);
      if(subscriptionError)throw Error("Could not check existing subscriptions.");
      if(existing?.length)return respond({success:false,error:"You already have an automatic subscription for this plan. Manage it under Payments."},409);
      let pendingQuery=supabase.from("sgc_stitch_transactions").select("id,checkout_url,amount_zar,created_at").eq("user_id",authenticatedUser.id).eq("payment_provider","payfast").eq("auto_recurring",true).eq("status","pending");
      pendingQuery=entitlementKey?pendingQuery.eq("entitlement_key",entitlementKey):pendingQuery.eq("product_id",selectedId);
      const {data:pending,error:pendingError}=await pendingQuery.order("created_at",{ascending:false}).limit(1);
      if(pendingError)throw Error("Could not check pending subscription checkout.");
      if(pending?.[0]){
        if(Date.now()-new Date(pending[0].created_at).getTime()<3600000&&Number(pending[0].amount_zar)===finalAmount)return respond({success:true,checkoutUrl:pending[0].checkout_url,amount:finalAmount,billing});
        const {error:expireError}=await supabase.from("sgc_stitch_transactions").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",pending[0].id).eq("status","pending");
        if(expireError)throw Error("Could not refresh subscription checkout.");
      }
    }

    const amountInCents = Math.round(
      finalAmount * 100
    );

    if (
      !Number.isSafeInteger(amountInCents) ||
      amountInCents > 2147483647
    ) {
      throw new Error(
        "Payment amount exceeds supported limit"
      );
    }

    // =========================================
    // 6. CUSTOMER DETAILS
    // =========================================

    const userId = authenticatedUser?.id || null;

    const payerName = authenticatedUser
      ? String(
          authenticatedUser.user_metadata?.full_name ||
          body.payerName ||
          authenticatedUser.email ||
          "SGC Customer"
        ).slice(0, 150)
      : String(body.payerName || "").trim();

    const email = authenticatedUser?.email ||
      String(body.email || "").trim();

    // Preserve existing legacy checkout requirements.
    // Never trust a supplied userId as authenticated identity.

    if (
      !payerName ||
      (!authenticatedUser && !String(body.userId || "").trim())
    ) {
      throw new Error(
        "Missing customer payment information"
      );
    }

    // =========================================
    // 7. CREATE UNIQUE PAYMENT REFERENCE
    // =========================================

    const merchantReference =
      `${referenceCode}-${crypto.randomUUID()}`;

    // =========================================
    // PayFast checkout is generated server-side; secrets never enter the response.
    const {data:gateway,error:gatewayError}=await supabase.from("sgc_gateway_secrets").select("provider").eq("provider","payfast").single();
    if(gatewayError||!gateway)throw new Error("PayFast is not configured.");
    const checkoutUrl = "https://sgcnetwork.co.za/payfast-checkout.html#reference="+encodeURIComponent(merchantReference);
    const { data: transaction, error: saveError } =
      await supabase
        .from("sgc_stitch_transactions")
        .insert({
          merchant_reference: merchantReference,
          payment_provider: "payfast",
          auto_recurring: billing === "monthly",
          user_id: userId,
          customer_name: payerName,
          customer_email: email || null,
          product_id: selectedId,
          product_name: selectedName,
          amount_zar: finalAmount,
          billing,
          entitlement_key: entitlementKey,
          variant_id: variantId || null,
          quantity,
          checkout_url: checkoutUrl,
          status: "pending",
        })
        .select("id,merchant_reference,status")
        .single();

    if (saveError || !transaction) {
      console.error(
        "SGC TRANSACTION TRACKING FAILED",
        saveError?.message || "No row returned",
        merchantReference
      );

      // Do not return an untracked checkout URL.
      // The Stitch payment link may already exist.
      return respond(
        {
          success: false,
          error:
            "Checkout was created but could not be recorded. Please contact SGC support before retrying.",
          merchantReference,
        },
        500
      );
    }

    // =========================================
    // 11. RETURN EXISTING CHECKOUT RESPONSE
    // =========================================

    console.log(
      "SGC PAYFAST CHECKOUT TRACKED",
      merchantReference
    );

    return respond({
      success: true,
      checkoutUrl,
      product: selectedName,
      productId: selectedId,
      amount: finalAmount,
      quantity,
      variantId: variantId || null,
      billing,
      merchantReference,
    });

  } catch (error) {
    console.error(
      "SGC PAYMENT ERROR",
      error instanceof Error
        ? error.message
        : String(error)
    );

    return respond(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment failed",
      },
      400
    );
  }
});

