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

    get("email").textContent = user.user_metadata?.username || user.user_metadata?.full_name || user.email;
    if (get("member-username")) get("member-username").textContent = user.email || "";

    const [entryResult,academyResult,builderResult,demoResult] = await Promise.all([
      sb.rpc('sgc_start_purchased'),sb.rpc('sgc_academy_access'),sb.rpc('sgc_builder_access'),sb.rpc('sgc_extra_is_demo')
    ]);
    for(const result of [entryResult,academyResult,builderResult,demoResult])if(result.error)throw result.error;
    const joined=entryResult.data===true,academy=academyResult.data||{},unlocked=academy.active===true,isDemo=demoResult.data===true;
    get('academy-access-title').textContent=unlocked?'Your Academy is open':'Academy Full Access';
    get('academy-access-copy').textContent=unlocked?(isDemo?'All published learning is available for your demo.':academy.modulesUnlocked+' modules released · Two more each membership month.'):'R450/month for courses and learning materials, after the R150 once-off joining fee.';
    get('academy-access-status').textContent=unlocked?'Academy active':joined?'Subscription required':'Join SGC first';
    for(const link of document.querySelectorAll('[data-academy-entry]')){link.href=unlocked?'academy.html':'shop.html?category=memberships';link.textContent=unlocked?'Enter Academy →':joined?'Explore Academy · R450/month →':'Join SGC · R150 once-off →';}
    if(get('builder-access-title')){
      const available=builderResult.data===true;
      get('builder-access-title').textContent=available?'Your Website Builder is ready':'My Web Build';
      get('builder-access-copy').textContent=available?'Build, preview and publish your business website.':'R199/month after joining SGC. The R450 Academy subscription is optional.';
      const action=get('builder-access-link');action.href=available?'website-builder.html':'shop.html?category=memberships';action.textContent=available?'Manage my website →':joined?'Explore Website Builder →':'Join SGC first →';
      get('builder-access-status').textContent=available?(isDemo?'Demo access':'Subscription active'):(joined?'Subscription required':'Joining fee required');
      if(available){const website=await sb.from('sgc_student_websites').select('business_name,slug').eq('user_id',user.id).maybeSingle();if(!website.error&&website.data)get('builder-access-copy').textContent=website.data.business_name+' · '+(website.data.slug?website.data.slug+'.sgcnetwork.co.za':'Choose your website address');if(sb.functions?.invoke){const publication=await sb.functions.invoke('website-publication',{body:{action:'status'}});if(!publication.error&&publication.data?.available){get('builder-access-status').textContent='Published · Subscription active';const link=document.createElement('a');link.className='btn alt';link.textContent='View published website ↗';link.href=publication.data.subdomainUrl||publication.data.url;link.target='_blank';link.rel='noopener';action.after(link);}}}
    }

    if (isDemo === true) {
      get("membership-title").textContent =
        "SGC Network — Full demo access";

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
    const [membershipResult, kitResult, purchasedMembershipResult] = await Promise.all([
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
        .order("created_at", { ascending: false }),
      sb.rpc("sgc_my_purchased_memberships")
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

    const purchasedMemberships = purchasedMembershipResult.error ? [] : (purchasedMembershipResult.data || []);
    if (purchasedMemberships.length) {
      get("membership-title").textContent = purchasedMemberships.map(plan => plan.name).join(" · ");
      get("membership-copy").textContent = "Your confirmed purchases unlock the features included in these memberships.";
    } else if (membership) {
      const plan =
        membership.membership_type === "build"
          ? "Build"
          : "Start";

      get("membership-title").textContent =
        `SGC ${plan === "Build" ? "Academy Full Access — Active" : "Membership — Joined"}`;

      get("membership-copy").textContent =
        "Your joining fee and optional subscriptions are managed separately. View each feature’s access below.";
    } else {
      get("membership-title").textContent =
        "No active membership";

      get("membership-copy").textContent =
        "Explore memberships in the shop. A confirmed purchase unlocks the access included in your chosen membership.";
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
