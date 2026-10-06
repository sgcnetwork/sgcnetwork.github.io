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

  function activeMembership(item) {
    const now = new Date();

    return item.status === "active" &&
      new Date(item.started_at) <= now &&
      (
        !item.current_period_end ||
        new Date(item.current_period_end) > now
      );
  }

  function paidKit(item) {
    const total = Number(item.total_price_zar);
    const paid = Number(item.amount_paid_zar);

    return total > 0 &&
      Number.isFinite(paid) &&
      paid >= total &&
      ["active", "unlocked"].includes(item.status);
  }

  function card(title, description, link, colour, demo) {
    return `
      <div class="card ${colour}">
        <span class="pill">
          ${demo ? "Demo unlocked" : "Unlocked"}
        </span>
        <h3>${escapeHTML(title)}</h3>
        <p class="muted">${escapeHTML(description)}</p>
        <a class="btn" href="${link}">Open →</a>
      </div>
    `;
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

    // The database verifies the demo account.
    const { data: demoResult, error: demoError } =
      await sb.rpc("sgc_extra_is_demo");

    if (demoError) throw demoError;

    const demo = demoResult === true;

    const [membershipResult, kitResult, courseResult, studioResult] =
      await Promise.all([
        sb.from("memberships")
          .select(
            "membership_type,status,started_at,current_period_end"
          )
          .eq("user_id", user.id)
          .eq("status", "active"),

        sb.from("customer_kits")
          .select(
            "status,total_price_zar,amount_paid_zar,kits(name)"
          )
          .eq("user_id", user.id),

        sb.from("courses")
          .select(
            "id,title,description,membership_required,unlock_month"
          )
          .eq("status", "published")
          .order("sort_order", { ascending: true }),

        sb.from("sgc_extra_lessons")
          .select("id")
          .eq("published", true)
          .limit(1)
      ]);

    for (const result of [
      membershipResult,
      kitResult,
      courseResult,
      studioResult
    ]) {
      if (result.error) throw result.error;
    }

    const memberships =
      (membershipResult.data || []).filter(activeMembership);

    const purchasedKits =
      (kitResult.data || []).filter(paidKit);

    const hasBuild =
      memberships.some(item => item.membership_type === "build");

    const hasStart =
      hasBuild ||
      memberships.some(item => item.membership_type === "start");

    const cards = [];

    if (demo) {
      cards.push(card(
        "Full student demo",
        "SGC Build, all kit levels and all published modules. No real payment or subscription.",
        "sgc-academy-extra/index.html",
        "butter",
        true
      ));
    } else {
      if (hasStart) {
        cards.push(card(
          hasBuild ? "SGC Build" : "SGC Start",
          "Your purchased membership unlocks its eligible learning content.",
          "#courses",
          hasBuild ? "lav" : "blush",
          false
        ));
      }

      for (const kit of purchasedKits) {
        cards.push(card(
          kit.kits?.name || "Business Kit",
          "Fully paid kit. Eligible resources are available in your classroom.",
          "sgc-academy-extra/index.html",
          "butter",
          false
        ));
      }
    }

    if (studioResult.data?.length) {
      cards.push(card(
        "Implementation classroom",
        "Lessons, videos, workbooks and activities published through your Academy admin.",
        "sgc-academy-extra/index.html",
        "lav",
        demo
      ));
    }

    get("academy-grid").innerHTML = cards.length
      ? cards.join("")
      : `
        <div class="empty">
          No purchased learning access is linked to this account.
          Purchase the required membership or fully pay a kit
          to unlock its content.
        </div>
      `;

    // Database policies enforce purchase and release-date restrictions.
    const courses = (courseResult.data || []).filter(course => {
      if (demo) return true;

      if (course.membership_required === "start") {
        return hasStart;
      }

      if (course.membership_required === "build") {
        return hasBuild;
      }

      return false;
    });

    get("courses").innerHTML = courses.length
      ? courses.map(course => `
        <div class="row">
          <div>
            <strong>${escapeHTML(course.title)}</strong>
            <div class="muted">
              ${escapeHTML(course.description || "SGC Academy course")}
            </div>
          </div>
          <a class="btn soft"
             href="course.html?id=${encodeURIComponent(course.id)}">
            Open course →
          </a>
        </div>
      `).join("")
      : `
        <div class="empty">
          ${demo
            ? "No published courses yet. Use the Implementation classroom above for your admin-published lessons."
            : "No published courses are available for your purchased level or current release date."}
        </div>
      `;
  }

  get("signout")?.addEventListener("click", async () => {
    if (sb) await sb.auth.signOut();
    sessionStorage.removeItem("sgc-extra-session");
    location.href = "index.html";
  });

  init().catch(error => {
    get("academy-grid").textContent =
      "Unable to load Academy: " + error.message;

    get("courses").textContent = "";
  });
})();
