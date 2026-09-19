
/*
 SGC Network V2 Customer Base
 Payment buttons intentionally DO NOT route to enquiry.
 Replace the placeholder Paystack Payment Page URLs below with the
 actual Paystack URLs from your Paystack Dashboard.

 For the final live system:
 - SGC Start should use a Paystack Subscription Payment Page.
 - Each fixed-price Business Kit can use a Paystack Product/One-time Payment Page.
 - Lay-by payments should use a dedicated payment flow connected to your backend.
 - Do not put a Paystack secret key in this public JavaScript file.
*/

const SGC_PAYMENT_CONFIG = {
  startSubscriptionUrl: "PASTE_SGC_START_PAYSTACK_URL_HERE",
  kitPaymentPages: {
    "Beauty Business Kit": "PASTE_BEAUTY_KIT_PAYSTACK_URL_HERE",
    "Finance Business Kit": "PASTE_FINANCE_KIT_PAYSTACK_URL_HERE",
    "Clothing Business Kit": "PASTE_CLOTHING_KIT_PAYSTACK_URL_HERE",
    "Baking Business Kit": "PASTE_BAKING_KIT_PAYSTACK_URL_HERE",
    "Social Media Business Kit": "PASTE_SOCIAL_MEDIA_KIT_PAYSTACK_URL_HERE",
    "Cleaning Business Kit": "PASTE_CLEANING_KIT_PAYSTACK_URL_HERE",
    "Car Wash Business Kit": "PASTE_CAR_WASH_KIT_PAYSTACK_URL_HERE",
    "Digital Services Kit": "PASTE_DIGITAL_SERVICES_KIT_PAYSTACK_URL_HERE",
    "Online Store Kit": "PASTE_ONLINE_STORE_KIT_PAYSTACK_URL_HERE",
    "Gaming / RP Startup Kit": "PASTE_GAMING_RP_KIT_PAYSTACK_URL_HERE"
  },
  laybyUrl: "PASTE_SGC_KIT_LAYBY_PAYMENT_URL_HERE"
};

const demoCustomer = {
  name: "Amina Jacobs",
  kit: "Beauty Business Kit",
  total: 499,
  paid: 300,
  startActive: true
};

function money(n) {
  return `R${Number(n).toLocaleString("en-ZA")}`;
}

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function goToPayment(url, label) {
  if (!url || url.startsWith("PASTE_")) {
    toast(`Connect ${label} to its Paystack Payment Page first.`);
    return;
  }
  window.location.href = url;
}

function initCustomer() {
  const remaining = Math.max(demoCustomer.total - demoCustomer.paid, 0);
  const pct = Math.min((demoCustomer.paid / demoCustomer.total) * 100, 100);

  const name = document.getElementById("customerName");
  const paid = document.getElementById("paidAmount");
  const rem = document.getElementById("remainingAmount");
  const bar = document.getElementById("progressBar");
  const kitStatus = document.getElementById("kitStatus");
  const nextText = document.getElementById("nextText");
  const payBtn = document.getElementById("payBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (name) name.textContent = demoCustomer.name;
  if (paid) paid.textContent = money(demoCustomer.paid);
  if (rem) rem.textContent = money(remaining);
  if (bar) bar.style.width = `${pct}%`;

  if (remaining === 0) {
    if (kitStatus) {
      kitStatus.textContent = "UNLOCKED";
      kitStatus.classList.add("unlocked");
    }
    if (nextText) nextText.textContent = "Your Business Kit is fully paid and ready to access.";
    if (payBtn) {
      payBtn.textContent = "Access my kit";
      payBtn.onclick = () => toast("Live kit access will open after backend access control is connected.");
    }
    if (nextBtn) {
      nextBtn.textContent = "Access my kit";
      nextBtn.onclick = () => toast("Live kit access will open after backend access control is connected.");
    }
  } else {
    const layby = SGC_PAYMENT_CONFIG.laybyUrl;
    const handler = () => goToPayment(layby, "your Kit Lay-by");
    if (payBtn) payBtn.onclick = handler;
    if (nextBtn) nextBtn.onclick = handler;
    if (nextText) nextText.textContent =
      `You have ${money(remaining)} remaining on your ${demoCustomer.kit}. Make your next lay-by payment when you're ready.`;
  }

  const invoiceBtn = document.getElementById("invoiceBtn");
  if (invoiceBtn) invoiceBtn.onclick = () => toast("Your live invoice centre will connect to the customer database.");

  const buildBtn = document.getElementById("buildBtn");
  if (buildBtn) buildBtn.onclick = () => toast("SGC Build is available after the Business Kit is completed.");
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = () => toast("Logout will be connected to the live account system.");
}

function initAdmin() {
  const count = document.getElementById("customerCount");
  if (count) count.textContent = "127";

  const search = document.getElementById("search");
  const filter = document.getElementById("statusFilter");
  const rows = document.getElementById("customerRows");

  const data = [
    ["Amina Jacobs","Start","Beauty","R199","Lay-by"],
    ["Kyle Daniels","Start","Gaming / RP","R249","Lay-by"],
    ["Sarah Naidoo","Build","Clothing","R0","Kit complete"],
    ["Lerato Mokoena","Start","Finance","R499","Kit complete"]
  ];

  function render() {
    if (!rows) return;
    const q = (search?.value || "").toLowerCase();
    const f = filter?.value || "all";
    rows.innerHTML = data
      .filter(r => !q || r.join(" ").toLowerCase().includes(q))
      .filter(r => f === "all" ||
        (f === "active" && r[1] === "Start") ||
        (f === "layby" && r[4] === "Lay-by") ||
        (f === "complete" && r[4] === "Kit complete"))
      .map(r => `<div class="row"><span>${r[0]}</span><span>${r[1]}</span><span>${r[2]}</span><span>${r[3]}</span><span>${r[4]}</span></div>`)
      .join("");
  }

  search?.addEventListener("input", render);
  filter?.addEventListener("change", render);
  render();

  document.getElementById("invoiceCustomer")?.addEventListener("click", () =>
    toast("Live invoices will open from the connected customer database.")
  );
  document.getElementById("unlockDemo")?.addEventListener("click", () =>
    toast("Demo only — live unlocks happen automatically after verified payment.")
  );
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.querySelector(".admin-wrap")) initAdmin();
  else if (document.body.querySelector(".hero")) initCustomer();
});
