
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

  "sgc-build-lab": { code: "B", price: 250 },
  build: { code: "B", price: 250 },

  preview: { code: "P", price: 20 },
  "r20-preview": { code: "P", price: 20 },

  "stitch-r1-test": { code: "T", price: 1 },

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

Deno.serve(async (req) => {
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

    const clientId = Deno.env.get("STITCH_CLIENT_ID");
    const clientSecret = Deno.env.get("STITCH_CLIENT_SECRET");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!clientId || !clientSecret) {
      throw new Error("Stitch credentials are missing");
    }

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
        .select("id,name,price_zar,billing,active")
        .eq("id", productId)
        .eq("active", true)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        throw new Error(
          "Product is not available for purchase"
        );
      }

      finalAmount = Number(data.price_zar);
      selectedName = data.name;
      selectedId = data.id;
      referenceCode = "X";
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
      if (["S","B"].includes(selected.code) && !authenticatedUser) {
        return respond({success:false,error:"Please sign in before purchasing a membership"},401);
      }

      if (
        product === "build" ||
        product === "sgc-build-lab"
      ) {
        billing = "monthly";
      }
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
    // 8. AUTHENTICATE WITH STITCH
    // =========================================

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

    const tokenData = await readJson(tokenResponse);

    if (
      !tokenResponse.ok ||
      !tokenData?.data?.accessToken
    ) {
      console.error(
        "STITCH TOKEN ERROR",
        tokenResponse.status
      );

      throw new Error(
        "Could not authenticate with Stitch"
      );
    }

    const accessToken =
      tokenData.data.accessToken;

    // =========================================
    // 9. CREATE STITCH PAYMENT LINK
    // =========================================

    const paymentResponse = await fetch(
      "https://express.stitch.money/api/v1/payment-links",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: amountInCents,
          payerName,
          merchantReference,
          payerEmailAddress: email || undefined,
          collectDeliveryDetails: false,
          skipCheckoutPage: false,
        }),
      }
    );

    const paymentData =
      await readJson(paymentResponse);

    if (
      !paymentResponse.ok ||
      !paymentData?.data?.payment?.link
    ) {
      console.error(
        "STITCH PAYMENT LINK ERROR",
        paymentResponse.status
      );

      throw new Error(
        "Could not create Stitch payment"
      );
    }

    const payment =
      paymentData.data.payment;

    const checkoutUrl = payment.link;

    // =========================================
    // 10. RECORD CHECKOUT IN SGC STUDIO
    // =========================================

    // This is only a payment request.
    // It must NOT be recorded as paid yet.

    const stitchPaymentId =
      payment.id == null
        ? null
        : String(payment.id);

    const { data: transaction, error: saveError } =
      await supabase
        .from("sgc_stitch_transactions")
        .insert({
          merchant_reference: merchantReference,
          stitch_payment_id: stitchPaymentId,
          user_id: userId,
          customer_name: payerName,
          customer_email: email || null,
          product_id: selectedId,
          product_name: selectedName,
          amount_zar: finalAmount,
          billing,
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
      "SGC STITCH CHECKOUT TRACKED",
      merchantReference
    );

    return respond({
      success: true,
      checkoutUrl,
      payment,
      product: selectedName,
      productId: selectedId,
      amount: finalAmount,
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
