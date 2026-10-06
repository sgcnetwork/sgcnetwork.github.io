(function () {
  "use strict";

  const sb = window.sgcSupabase;
  const grid = document.getElementById("academy-grid");
  const courses = document.getElementById("courses");
  const email = document.getElementById("email");

  let user;
  let selectedLesson;
  let loading = false;

  function make(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function check(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  function showError(error) {
    grid.replaceChildren(
      make(
        "div",
        "Academy could not load: " + error.message,
        "empty"
      )
    );
  }

  const reader = make("section", undefined, "section");
  reader.hidden = true;
  courses.after(reader);

  async function getLogin() {
    const current = await sb.auth.getUser();

    if (!current.error && current.data.user) {
      return current.data.user;
    }

    // Also accept an existing login from the separate admin/classroom.
    const saved = sessionStorage.getItem("sgc-extra-session");

    if (saved) {
      let session;

      try {
        session = JSON.parse(saved);
      } catch {
        sessionStorage.removeItem("sgc-extra-session");
      }

      if (session?.access_token && session?.refresh_token) {
        const result = await sb.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });

        if (!result.error) {
          const verified = await sb.auth.getUser();

          if (!verified.error && verified.data.user) {
            return verified.data.user;
          }
        }
      }
    }

    return null;
  }

  async function loadAcademy() {
    if (loading) return;
    loading = true;

    try {
      const isDemo = check(
        await sb.rpc("sgc_extra_is_demo")
      ) === true;

      // Supabase RLS determines which purchased lessons are readable.
      // Published is checked explicitly, including for the admin demo.
      const lessons = check(
        await sb
          .from("sgc_extra_lessons")
          .select("id,module_no,position,title")
          .eq("published", true)
          .order("module_no", { ascending: true })
          .order("position", { ascending: true })
      ) || [];

      grid.replaceChildren();
      courses.replaceChildren();

      const card = make(
        "div",
        undefined,
        isDemo ? "card lav" : "card blush"
      );

      card.append(
        make(
          "span",
          isDemo ? "Full demo access" : "Your learning access",
          "pill"
        ),
        make(
          "h3",
          isDemo ? "SGC Build demo" : "Your Academy"
        ),
        make(
          "p",
          isDemo
            ? "All published admin lessons are available to your demo account."
            : "Published lessons available through your purchased levels appear below.",
          "muted"
        )
      );

      const refresh = make("button", "Refresh lessons", "btn soft");
      refresh.type = "button";
      refresh.onclick = () => loadAcademy();
      card.append(refresh);
      grid.append(card);

      if (!lessons.length) {
        courses.append(
          make(
            "div",
            isDemo
              ? "No published admin lessons were returned. Publish a lesson in the admin dashboard and refresh."
              : "No published lessons are available for your current purchases.",
            "empty"
          )
        );
        return;
      }

      for (const lesson of lessons) {
        const row = make("div", undefined, "row");
        const details = make("div");

        details.append(
          make("strong", lesson.title),
          make(
            "div",
            "Module " + lesson.module_no +
              " · Section " + lesson.position,
            "muted"
          )
        );

        const button = make("button", "Open lesson", "btn soft");
        button.type = "button";
        button.onclick = () => {
          openLesson(lesson.id).catch(showError);
        };

        row.append(details, button);
        courses.append(row);
      }
    } catch (error) {
      showError(error);
    } finally {
      loading = false;
    }
  }

  async function openLesson(id) {
    // Recheck database access whenever a lesson is opened.
    const lesson = check(
      await sb
        .from("sgc_extra_lessons")
        .select("id,title,body,prompt,module_no,position")
        .eq("id", id)
        .eq("published", true)
        .single()
    );

    selectedLesson = lesson.id;
    reader.hidden = false;
    reader.replaceChildren();

    const panel = make("div", undefined, "card");

    panel.append(
      make(
        "div",
        "Module " + lesson.module_no +
          " · Section " + lesson.position,
        "eyebrow"
      ),
      make("h2", lesson.title)
    );

    const body = make("div", lesson.body || "");
    body.style.whiteSpace = "pre-wrap";
    body.style.lineHeight = "1.7";
    panel.append(body);

    // Facilitator/admin-only files are excluded from the student view.
    const resources = check(
      await sb
        .from("sgc_extra_resources")
        .select("title,path,kind")
        .eq("lesson_id", lesson.id)
        .neq("kind", "admin")
    ) || [];

    for (const resource of resources) {
      const signed = check(
        await sb.storage
          .from("sgc-academy-extra")
          .createSignedUrl(resource.path, 3600)
      );

      if (resource.kind === "video") {
        const video = make("video");
        video.controls = true;
        video.preload = "metadata";
        video.src = signed.signedUrl;
        video.style.width = "100%";
        video.style.marginTop = "20px";
        panel.append(video);
      } else {
        const link = make("a", resource.title, "btn soft");
        link.href = signed.signedUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.style.margin = "16px 8px 0 0";
        panel.append(link);
      }
    }

    if (lesson.prompt) {
      panel.append(
        make("h3", "Practical activity"),
        make("p", lesson.prompt)
      );
    }

    const saved = check(
      await sb
        .from("sgc_extra_responses")
        .select("answer,completed")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .maybeSingle()
    );

    const form = make("form");
    const answerLabel = make("label", "Your notes or activity answer");
    const answer = make("textarea");
    answer.id = "academy-answer";
    answerLabel.htmlFor = answer.id;
    answer.value = saved?.answer || "";
    answer.rows = 7;
    answer.style.cssText =
      "display:block;width:100%;margin:12px 0;padding:14px;" +
      "box-sizing:border-box;border-radius:12px;font:inherit;";

    const completedLabel = make("label");
    const completed = make("input");
    completed.type = "checkbox";
    completed.checked = saved?.completed === true;
    completedLabel.append(
      completed,
      document.createTextNode(" Mark lesson completed")
    );

    const save = make("button", "Save my work", "btn");
    save.type = "submit";
    save.style.cssText = "display:block;margin-top:16px;";

    const message = make("p", "", "muted");
    message.setAttribute("role", "status");

    const lessonId = lesson.id;

    form.onsubmit = async function (event) {
      event.preventDefault();
      if (selectedLesson !== lessonId) return;

      save.disabled = true;
      message.textContent = "Saving…";

      try {
        check(
          await sb.from("sgc_extra_responses").upsert(
            {
              user_id: user.id,
              lesson_id: lessonId,
              answer: answer.value,
              completed: completed.checked,
              updated_at: new Date().toISOString()
            },
            { onConflict: "user_id,lesson_id" }
          )
        );

        message.textContent = "Your work is saved.";
      } catch (error) {
        message.textContent = "Could not save: " + error.message;
      } finally {
        save.disabled = false;
      }
    };

    form.append(
      answerLabel,
      answer,
      completedLabel,
      save,
      message
    );

    panel.append(form);
    reader.append(panel);
    reader.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("signout")?.addEventListener(
    "click",
    async function () {
      const result = await sb.auth.signOut();

      if (result.error) {
        showError(result.error);
        return;
      }

      sessionStorage.removeItem("sgc-extra-session");
      location.href = "login.html";
    }
  );

  async function start() {
    if (!sb) {
      throw new Error(
        "Supabase is not configured. Check js/config.js and js/supabase-client.js."
      );
    }

    user = await getLogin();

    if (!user) {
      location.href = "login.html";
      return;
    }

    email.textContent = user.email;
    await loadAcademy();
  }

  start().catch(showError);
})();
