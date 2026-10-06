<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SGC Academy | SGC Network</title>

<style>
:root {
  --ink:#171516;
  --cream:#fbf5ea;
  --paper:#fffaf2;
  --lav:#e7def4;
  --butter:#f4e7a8;
  --line:rgba(23,21,22,.12);
  --muted:#756e69;
}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font-family:Arial,sans-serif}
a{color:inherit;text-decoration:none}
button,input,textarea{font:inherit}
button,a,input,textarea{touch-action:manipulation}
.wrap{width:min(1180px,calc(100% - 40px));margin:auto}
.nav{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px 0;border-bottom:1px solid var(--line)}
.brand{font:30px Georgia,serif;letter-spacing:.08em}
.brand small{display:block;font:10px Arial,sans-serif;letter-spacing:.28em;margin-top:4px}
.links{display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-size:13px}
.hero{padding:60px 0 35px;display:grid;grid-template-columns:1.4fr .8fr;gap:30px;align-items:center}
.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted)}
h1{font:clamp(48px,7vw,82px)/1 Georgia,serif;margin:14px 0 20px;letter-spacing:-.04em}
h2{font:32px Georgia,serif;margin:12px 0 20px}
h3{font:23px Georgia,serif;margin:16px 0 10px}
p{line-height:1.7}
.lead{font-size:17px;color:#5f5955}
.card{background:var(--paper);border:1px solid var(--line);border-radius:24px;padding:26px}
.account{background:var(--butter);overflow-wrap:anywhere}
.account strong{display:block;margin:18px 0}
.muted{font-size:13px;color:var(--muted);line-height:1.6}
.pill{display:inline-block;padding:8px 12px;border-radius:999px;background:#ffffff80;border:1px solid var(--line);font-size:12px}
.btn{display:inline-flex;justify-content:center;align-items:center;padding:13px 18px;border-radius:999px;border:1px solid var(--ink);background:var(--ink);color:white;font-size:13px;cursor:pointer}
.btn.soft{background:var(--lav);color:var(--ink);border-color:transparent}
.btn.alt{background:transparent;color:var(--ink)}
button:disabled{opacity:.55;cursor:wait}
.section{padding:25px 0}
.section-head{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.lesson-card{display:flex;flex-direction:column}
.lesson-card .btn{margin-top:auto;align-self:flex-start}
.lesson-card p{margin-bottom:22px}
.empty{grid-column:1/-1;padding:30px;border:1px dashed var(--line);border-radius:20px;color:var(--muted);line-height:1.7}
.reader{padding:30px 0}
.lesson-body{white-space:pre-wrap;line-height:1.8;font-size:16px}
.resources{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}
video{display:block;width:100%;border-radius:16px;margin:22px 0;background:#171516}
textarea{display:block;width:100%;padding:16px;border:1px solid var(--line);border-radius:14px;background:white;line-height:1.6;margin:12px 0 18px;resize:vertical}
.completion{display:flex;align-items:center;gap:10px;margin-bottom:20px}
.completion input{width:18px;height:18px}
.notice{white-space:pre-wrap;overflow-wrap:anywhere}
footer{padding:30px 0;border-top:1px solid var(--line);font-size:12px;color:var(--muted);margin-top:45px}
[hidden]{display:none!important}
@media(max-width:800px){
  .hero{grid-template-columns:1fr;padding-top:35px}
  .grid{grid-template-columns:1fr}
  .nav{align-items:flex-start}
  .links{justify-content:flex-end;gap:12px}
  .wrap{width:calc(100% - 28px)}
}
</style>
</head>

<body>
<div class="wrap">
  <header class="nav">
    <a class="brand" href="index.html">
      SGC<small>NETWORK</small>
    </a>
    <nav class="links" aria-label="Account navigation">
      <a href="dashboard.html">My SGC</a>
      <a href="academy.html" aria-current="page">Academy</a>
      <a href="community.html">Community</a>
      <a id="admin-link" href="sgc-academy-extra/admin.html" hidden>Admin</a>
      <button id="signout" class="btn alt" type="button">Sign out</button>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="eyebrow">Learn · Apply · Build</div>
        <h1>Your SGC Academy.</h1>
        <p class="lead">
          Practical lessons, activities and resources to help you
          build your business, one step at a time.
        </p>
      </div>
      <div class="card account">
        <span id="access-badge" class="pill">Checking access…</span>
        <strong id="account-email">Checking your account…</strong>
        <p id="access-description" class="muted">
          Loading your available learning.
        </p>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="eyebrow">Your learning space</div>
          <h2>Available lessons</h2>
        </div>
        <button id="refresh" class="btn soft" type="button">
          Refresh lessons
        </button>
      </div>
      <p id="status" class="muted notice" role="status" aria-live="polite"></p>
      <div id="lessons" class="grid">
        <div class="empty">Loading your Academy…</div>
      </div>
    </section>

    <section id="reader" class="reader" hidden aria-label="Selected lesson">
      <div class="card">
        <div class="section-head">
          <span id="lesson-module" class="eyebrow"></span>
          <button id="close-lesson" class="btn alt" type="button">
            Close lesson
          </button>
        </div>

        <h2 id="lesson-title"></h2>
        <div id="lesson-body" class="lesson-body"></div>
        <div id="lesson-media"></div>
        <div id="lesson-resources" class="resources"></div>

        <section id="activity" hidden>
          <h3>Practical activity</h3>
          <div id="lesson-prompt" class="lesson-body"></div>
        </section>

        <form id="response-form">
          <h3>Your work</h3>
          <label for="answer">Your notes or activity answer</label>
          <textarea id="answer" rows="7"></textarea>
          <label class="completion">
            <input id="completed" type="checkbox">
            <span>Mark this lesson completed</span>
          </label>
          <button id="save-work" class="btn" type="submit">
            Save my work
          </button>
          <p id="save-status" class="muted" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>
  </main>

  <footer>SGC Academy · Learn • Build • Grow</footer>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
(function () {
  "use strict";

  const SUPABASE_URL = "https://bxpexanyoyubxeqqlggh.supabase.co";
  const SUPABASE_PUBLIC_KEY =
    "sb_publishable_Z0_Y-Bj_G5qw4hMgDbQlgA__jj8rGGq";

  const $ = id => document.getElementById(id);
  let sb;
  let user;
  let selected = null;
  let lessons = [];
  let completedLessons = new Set();
  let loading = false;
  let opening = false;
  let saving = false;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function checked(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  function report(error) {
    $("status").textContent =
      "Academy error: " + (error.message || String(error));
  }

  async function findUser() {
    const existing = await sb.auth.getUser();

    if (!existing.error && existing.data.user) {
      return existing.data.user;
    }

    // Share an existing login from the separate Academy admin page.
    const raw = sessionStorage.getItem("sgc-extra-session");
    if (!raw) return null;

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("sgc-extra-session");
      return null;
    }

    if (!session.access_token || !session.refresh_token) return null;

    const adopted = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    if (adopted.error) throw adopted.error;

    const verified = checked(await sb.auth.getUser());
    return verified.user;
  }

  function renderLessons() {
    $("lessons").replaceChildren();

    if (!lessons.length) {
      $("lessons").append(
        element(
          "div",
          "No published lessons are available for your current access. " +
          "If you have purchased a level, its active entitlement must be " +
          "linked to your account in Supabase.",
          "empty"
        )
      );
      return;
    }

    for (const lesson of lessons) {
      const card = element("article", undefined, "card lesson-card");

      card.append(
        element(
          "span",
          "Module " + lesson.module_no + " · Section " + lesson.position,
          "eyebrow"
        ),
        element("h3", lesson.title),
        element(
          "p",
          completedLessons.has(lesson.id)
            ? "Completed ✓"
            : "Learn · Apply · Implement",
          "muted"
        )
      );

      const open = element("button", "Open lesson →", "btn soft");
      open.type = "button";
      open.disabled = opening || saving;
      open.onclick = () => openLesson(lesson.id).catch(report);
      card.append(open);
      $("lessons").append(card);
    }
  }

  async function loadAcademy() {
    if (loading || !user) return;

    loading = true;
    $("refresh").disabled = true;
    $("status").textContent = "Checking your published lessons…";

    try {
      const demo = checked(
        await sb.rpc("sgc_extra_is_demo")
      ) === true;

      // Purchase access is enforced by Supabase RLS, not by an email
      // comparison in the browser.
      lessons = checked(
        await sb
          .from("sgc_extra_lessons")
          .select("id,title,module_no,position")
          .eq("published", true)
          .order("module_no", { ascending: true })
          .order("position", { ascending: true })
      ) || [];

      const responses = checked(
        await sb
          .from("sgc_extra_responses")
          .select("lesson_id,completed")
          .eq("user_id", user.id)
      ) || [];

      completedLessons = new Set(
        responses.filter(r => r.completed).map(r => r.lesson_id)
      );

      $("access-badge").textContent =
        demo ? "Full student demo" : "Your purchased learning";

      $("access-description").textContent = demo
        ? "All published admin lessons are available to this demo account. No real payment is recorded."
        : "Your purchased levels and release dates determine which lessons are available.";

      renderLessons();

      $("status").textContent = lessons.length
        ? lessons.length + " published lessons available. Admin changes appear when you refresh."
        : demo
          ? "No published lessons were returned. Publish a lesson in your admin dashboard, then refresh."
          : "No eligible published lessons were returned.";
    } finally {
      loading = false;
      $("refresh").disabled = false;
    }
  }

  async function openLesson(id) {
    if (opening || saving) return;

    opening = true;
    selected = null;
    $("reader").hidden = true;
    $("status").textContent = "Opening lesson…";
    renderLessons();

    try {
      // Recheck access when opening; old cards never grant access.
      const lesson = checked(
        await sb
          .from("sgc_extra_lessons")
          .select("id,title,body,prompt,module_no,position")
          .eq("id", id)
          .eq("published", true)
          .single()
      );

      const resources = checked(
        await sb
          .from("sgc_extra_resources")
          .select("title,path,kind")
          .eq("lesson_id", id)
          .neq("kind", "admin")
      ) || [];

      const response = checked(
        await sb
          .from("sgc_extra_responses")
          .select("answer,completed")
          .eq("user_id", user.id)
          .eq("lesson_id", id)
          .maybeSingle()
      );

      $("lesson-module").textContent =
        "Module " + lesson.module_no + " · Section " + lesson.position;
      $("lesson-title").textContent = lesson.title;
      $("lesson-body").textContent = lesson.body || "";
      $("lesson-prompt").textContent = lesson.prompt || "";
      $("activity").hidden = !lesson.prompt;
      $("lesson-media").replaceChildren();
      $("lesson-resources").replaceChildren();

      let resourceFailures = 0;

      for (const resource of resources) {
        try {
          const signed = checked(
            await sb.storage
              .from("sgc-academy-extra")
              .createSignedUrl(resource.path, 3600)
          );

          if (resource.kind === "video") {
            const video = element("video");
            video.controls = true;
            video.preload = "metadata";
            video.src = signed.signedUrl;
            video.setAttribute("aria-label", resource.title || "Lesson video");
            $("lesson-media").append(video);
          } else {
            const link = element(
              "a",
              resource.title || "Open resource",
              "btn soft"
            );
            link.href = signed.signedUrl;
            link.target = "_blank";
            link.rel = "noopener";
            $("lesson-resources").append(link);
          }
        } catch {
          resourceFailures++;
        }
      }

      $("answer").value = response?.answer || "";
      $("completed").checked = response?.completed === true;
      $("save-status").textContent = "";
      selected = lesson.id;
      $("reader").hidden = false;

      $("status").textContent = resourceFailures
        ? "Lesson opened. " + resourceFailures +
          " resources could not load. Check their files and storage permissions."
        : "Lesson opened.";

      $("reader").scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      opening = false;
      renderLessons();
    }
  }

  $("response-form").onsubmit = async function (event) {
    event.preventDefault();
    if (!selected || saving || opening) return;

    const lessonId = selected;
    saving = true;
    $("save-work").disabled = true;
    $("close-lesson").disabled = true;
    $("save-status").textContent = "Saving your work…";
    renderLessons();

    try {
      checked(
        await sb.from("sgc_extra_responses").upsert(
          {
            user_id: user.id,
            lesson_id: lessonId,
            answer: $("answer").value,
            completed: $("completed").checked,
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id,lesson_id" }
        )
      );

      if ($("completed").checked) {
        completedLessons.add(lessonId);
      } else {
        completedLessons.delete(lessonId);
      }

      $("save-status").textContent = "Your work is saved.";
    } catch (error) {
      $("save-status").textContent =
        "Could not save: " + (error.message || String(error));
    } finally {
      saving = false;
      $("save-work").disabled = false;
      $("close-lesson").disabled = false;
      renderLessons();
    }
  };

  $("close-lesson").onclick = function () {
    if (saving) return;
    selected = null;
    $("reader").hidden = true;
  };

  $("refresh").onclick = function () {
    loadAcademy().catch(report);
  };

  $("signout").onclick = async function () {
    if (!sb || saving) return;

    try {
      checked(await sb.auth.signOut());
      sessionStorage.removeItem("sgc-extra-session");
      location.href = "login.html";
    } catch (error) {
      report(error);
    }
  };

  async function start() {
    if (!window.supabase) {
      throw new Error("The Supabase login library could not load.");
    }

    sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    user = await findUser();

    if (!user) {
      location.href = "login.html";
      return;
    }

    $("account-email").textContent = user.email || "Your SGC account";

    await loadAcademy();

    // Showing the admin link does not grant admin permissions.
    // The admin page verifies the account against the admin table.
    const role = await sb
      .from("sgc_extra_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    $("admin-link").hidden = !!role.error || !role.data;
  }

  start().catch(function (error) {
    report(error);
    $("lessons").replaceChildren(
      element(
        "div",
        "The Academy could not load. See the error message above.",
        "empty"
      )
    );
  });
})();
</script>
</body>
</html>
