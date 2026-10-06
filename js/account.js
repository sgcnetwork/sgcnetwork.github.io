(function () {
  const sb = window.sgcSupabase;
  const get = id => document.getElementById(id);

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  async function init() {
    if (!sb) {
      location.href = "login.html";
      return;
    }

    const {
      data: { user },
      error: userError
    } = await sb.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      location.href = "login.html";
      return;
    }

    get("email").textContent = user.email;

    // Supabase verifies the authenticated demo account.
    const { data: isDemo, error: demoError } =
      await sb.rpc("sgc_extra_is_demo");

    if (demoError) throw demoError;

    if (isDemo === true) {
      get("membership-title").textContent =
        "SGC Build — Full demo access";

      get("membership-copy").textContent =
        "Highest student membership demo. All published courses and modules unlocked. No real subscription or payment.";

      get("kit-title").textContent =
        "All Business & Gaming Kits — Demo unlocked";

      get("kit-copy").textContent =
        "Full kit access for your demo account. R0 outstanding demo balance.";

      get("kits-list").innerHTML = `
        <div class="row">
          <div>
            <strong>Full student demo</strong>
            <div class="muted">
              Build membership · All kits · All published courses
              <br>
              R0 demo balance · No actual payment recorded
            </div>
          </div>
          <a class="btn soft" href="academy.html">
            Open Academy →
          </a>
        </div>
      `;

      return;
    }

    // Other customers use their real purchase records.
    const [membershipResult, kitResult] = await Promise.all([
      sb.from("memberships")
        .select(
          "membership_type,status,started_at,current_period_end"
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false }),

      sb.from("customer_kits")
        .select(
          "id,total_price_zar,amount_paid_zar,status,kits(name)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    ]);

    if (membershipResult.error) throw membershipResult.error;
    if (kitResult.error) throw kitResult.error;

    const now = new Date();

    const membership = (membershipResult.data || []).find(
      item =>
        new Date(item.started_at) <= now &&
        (
          !item.current_period_end ||
          new Date(item.current_period_end) > now
        )
    );

    if (membership) {
      const plan =
        membership.membership_type === "build"
          ? "Build"
          : "Start";

      get("membership-title").textContent =
        `SGC ${plan} — Active`;

      get("membership-copy").textContent =
        "Your purchased membership controls which Academy content you can access.";
    } else {
      get("membership-title").textContent =
        "No active membership";

      get("membership-copy").textContent =
        "Purchase SGC Start or SGC Build to unlock the corresponding learning level.";
    }

    const kits = kitResult.data || [];

    if (!kits.length) {
      get("kits-list").innerHTML = `
        <div class="empty">
          No Business Kits are linked to your account yet.
        </div>
      `;
      return;
    }

    get("kits-list").innerHTML = kits.map(item => {
      const total = Number(item.total_price_zar || 0);
      const paid = Number(item.amount_paid_zar || 0);
      const remaining = Math.max(0, total - paid);

      const unlocked =
        total > 0 &&
        paid >= total &&
        ["active", "unlocked"].includes(item.status);

      const percentage = total > 0
        ? Math.max(0, Math.min(100, paid / total * 100))
        : 0;

      return `
        <div class="row">
          <div>
            <strong>
              ${escapeHTML(item.kits?.name || "Business Kit")}
            </strong>
            <div class="muted">
              R${paid.toFixed(2)} paid ·
              R${remaining.toFixed(2)} remaining
            </div>
            <div class="progress"
                 style="width:min(420px,55vw);margin-top:10px">
              <span style="width:${percentage}%"></span>
            </div>
          </div>
          <div>
            <span class="tag">
              ${unlocked ? "Unlocked" : "Locked"}
            </span>
            <br>
            <a class="btn soft"
               href="${unlocked ? "academy.html" : "payments.html"}">
              ${unlocked ? "Open Academy" : "Manage payment"}
            </a>
          </div>
        </div>
      `;
    }).join("");

    get("kit-title").textContent =
      kits[0].kits?.name || "Business Kit";

    get("kit-copy").textContent =
      "Only fully paid eligible kits unlock their learning resources.";
  }

  get("signout")?.addEventListener("click", async () => {
    if (sb) await sb.auth.signOut();
    sessionStorage.removeItem("sgc-extra-session");
    location.href = "index.html";
  });

  init().catch(error => {
    get("kits-list").textContent =
      "Unable to load your account: " + error.message;
  });
})();
