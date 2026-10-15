(() => {
  "use strict";

  const ACCESS_CODE = "931986";
  const STORAGE_KEY = "carequay_demo_v1";
  const todayKey = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const addDays = (date, count) => {
    const next = new Date(date);
    next.setDate(next.getDate() + count);
    return next;
  };

  const isoDate = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  const defaultState = () => {
    const now = new Date();
    return {
      profile: { patientName: "Jordan", admissionDay: 3 },
      visits: [
        { id: "confirmed-1", date: isoDate(addDays(now, 1)), type: "Home visit", time: "10:30 am – 11:30 am", status: "Confirmed", clinician: "Mental health nurse" },
        { id: "confirmed-2", date: isoDate(addDays(now, 2)), type: "Telehealth", time: "11:00 am – 11:30 am", status: "Confirmed", clinician: "Medical review" },
      ],
      visitRequests: [],
      messages: [],
      moodHistory: [
        { date: isoDate(addDays(now, -4)), score: 2 },
        { date: isoDate(addDays(now, -3)), score: 2 },
        { date: isoDate(addDays(now, -2)), score: 3 },
        { date: isoDate(addDays(now, -1)), score: 3 },
      ],
      goals: [
        { id: "goal-1", title: "Spend 10 minutes outside", why: "Fresh air helps me reset.", progress: 50 },
      ],
      safety: {
        reasons: "My family, my dog and getting back to my usual routine.",
        future: "Have coffee outside in the morning again.",
        warnings: "I stop replying to people, sleep less and skip meals.",
        triggers: "Feeling overwhelmed by several decisions at once.",
        selectedCoping: ["Music", "Walking", "Pets"],
        coping: "Sit outside with my dog and put on a familiar playlist.",
        firstAction: "Put on music and move to the back patio.",
        supporters: [],
        shareRequested: false,
        teamContact: "Rockingham General Hospital switchboard — 9599 4000",
        gpContact: "",
        otherProfessional: "",
        afterHours: "",
        environment: "",
        responsibility: "",
        urgentFirst: "",
        urgentSecond: "",
      },
      scaleHistory: {
        k10: [
          { date: isoDate(addDays(now, -10)), score: 30, max: 50 },
          { date: isoDate(addDays(now, -5)), score: 26, max: 50 },
        ],
        phq9: [],
        gad7: [],
        who5: [],
      },
    };
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaultState();
      const base = defaultState();
      return {
        ...base,
        ...saved,
        profile: { ...base.profile, ...(saved.profile || {}) },
        safety: { ...base.safety, ...(saved.safety || {}) },
        scaleHistory: { ...base.scaleHistory, ...(saved.scaleHistory || {}) },
      };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();
  let currentRole = "patient";
  let activeView = "home";
  let activeSafetyStep = 1;
  let selectedVisitDate = isoDate(addDays(new Date(), 1));

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(dateValue, options = {}) {
    const date = typeof dateValue === "string" ? new Date(`${dateValue}T12:00:00`) : dateValue;
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Perth",
      ...options,
    }).format(date);
  }

  function formatTimestamp(value) {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Perth",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function showToast(message, tone = "success") {
    $(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => $("button, input, textarea, select, a", modal)?.focus(), 20);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    if (!$(".modal-backdrop:not([hidden])")) document.body.classList.remove("modal-open");
  }

  function handleLogin(event) {
    event.preventDefault();
    const code = $("#access-code").value.trim();
    const role = $("input[name='role']:checked").value;
    const name = $("#display-name").value.trim();
    if (code !== ACCESS_CODE) {
      $("#login-error").textContent = "That access code was not recognised.";
      $("#access-code").focus();
      return;
    }
    $("#login-error").textContent = "";
    currentRole = role;
    if (role === "patient" && name) {
      state.profile.patientName = name;
      saveState();
    }
    $("#login-screen").hidden = true;
    $("#app-shell").hidden = false;
    configureRole(role, name);
    renderAll();
  }

  function configureRole(role, name) {
    const patient = role === "patient";
    $("#patient-nav").hidden = !patient;
    $("#team-nav").hidden = patient;
    const displayName = patient ? state.profile.patientName : (name || "Care team");
    $("#user-name").textContent = displayName;
    $("#user-role").textContent = patient ? "Patient portal" : "Care team portal";
    $("#user-avatar").textContent = (displayName[0] || "C").toUpperCase();
    $$('[data-patient-name]').forEach((node) => (node.textContent = state.profile.patientName));
    showView(patient ? "home" : "team-home");
  }

  function showView(viewName) {
    activeView = viewName;
    $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === viewName));
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
    $("#app-sidebar").classList.remove("open");
    $("#mobile-menu").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (viewName === "progress") renderProgress();
    if (viewName.startsWith("team")) renderTeamViews();
  }

  function renderToday() {
    $("#today-date").textContent = formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" });
    const next = [...state.visits].sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) {
      $("#next-visit-day").textContent = formatDate(next.date, { day: "2-digit" });
      $("#next-visit-month").textContent = formatDate(next.date, { month: "short" }).toUpperCase();
      $("#next-visit-time").textContent = next.time;
    }
    const goal = state.goals[0];
    if (goal) {
      $("#featured-goal-title").textContent = goal.title;
      $("#featured-goal-note").textContent = goal.why || "A gentle goal for this admission. It is okay to change it.";
      $("#goal-done-button").classList.toggle("completed", goal.progress >= 100);
      $("#goal-done-label").textContent = goal.progress >= 100 ? "Completed today" : "Mark as done today";
    }
    const todayMood = state.moodHistory.find((item) => item.date === todayKey());
    $$("[data-mood]").forEach((button) => button.classList.toggle("selected", Number(button.dataset.mood) === todayMood?.score));
    $("#mood-message").textContent = todayMood ? "Saved for the care team demo." : "Choose one if you would like your team to see it.";
  }

  function setMood(score) {
    state.moodHistory = state.moodHistory.filter((item) => item.date !== todayKey());
    state.moodHistory.push({ date: todayKey(), score });
    saveState();
    renderToday();
    renderTeamViews();
    showToast("Today’s check-in was saved to this demo.");
  }

  function renderWeekPicker() {
    const picker = $("#week-picker");
    picker.innerHTML = "";
    const now = new Date();
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(now, offset);
      const key = isoDate(date);
      const visit = state.visits.find((item) => item.date === key);
      const request = state.visitRequests.find((item) => item.date === key && item.status === "Requested");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day-button${key === selectedVisitDate ? " selected" : ""}${offset === 0 ? " today" : ""}`;
      button.innerHTML = `<span>${formatDate(date, { weekday: "short" })}</span><strong>${formatDate(date, { day: "numeric" })}</strong><small>${request ? "Requested" : visit ? "Booked" : "Available"}</small>`;
      button.addEventListener("click", () => {
        selectedVisitDate = key;
        renderWeekPicker();
      });
      picker.appendChild(button);
    }
  }

  function renderVisitTimeline() {
    const timeline = $("#visit-timeline");
    const items = [
      ...state.visits.map((visit) => ({ ...visit, sort: visit.date })),
      ...state.visitRequests.map((visit) => ({ ...visit, sort: visit.date })),
    ].sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 5);
    timeline.innerHTML = items.length ? items.map((visit) => `
      <div class="timeline-item">
        <strong>${escapeHtml(formatDate(visit.date, { weekday: "short", day: "numeric", month: "short" }))}</strong>
        <span>${escapeHtml(visit.type)} · ${escapeHtml(visit.time)}</span>
        <small>${escapeHtml(visit.status)}</small>
      </div>`).join("") : '<p class="empty-small">No visits saved.</p>';
  }

  function saveVisitPreference() {
    const type = $("input[name='visit-type']:checked")?.value || "Home visit";
    const time = $("input[name='visit-time']:checked")?.value || "10:00 am – 12:00 pm";
    const note = $("#visit-note").value.trim();
    state.visitRequests = state.visitRequests.filter((item) => !(item.date === selectedVisitDate && item.status === "Requested"));
    state.visitRequests.push({
      id: `request-${Date.now()}`,
      date: selectedVisitDate,
      type,
      time,
      note,
      status: "Requested",
      createdAt: new Date().toISOString(),
    });
    saveState();
    $("#visit-status").textContent = "Visit preference saved. The team would still need to confirm it.";
    $("#visit-note").value = "";
    renderVisits();
    renderTeamViews();
  }

  function renderVisits() {
    renderWeekPicker();
    renderVisitTimeline();
    $("#visit-badge").textContent = String(state.visits.length);
    $("#request-count").textContent = String(state.visitRequests.filter((item) => item.status === "Requested").length);
  }

  const safetyRules = [
    (s) => Boolean(s.reasons.trim() && s.future.trim()),
    (s) => Boolean(s.warnings.trim()),
    (s) => Boolean(s.selectedCoping.length || s.coping.trim() || s.firstAction.trim()),
    (s) => s.supporters.some((person) => person.name?.trim()),
    (s) => Boolean(s.teamContact.trim() && (s.gpContact.trim() || s.otherProfessional.trim() || s.afterHours.trim())),
    (s) => Boolean(s.environment.trim() && s.responsibility.trim()),
    (s) => Boolean(s.urgentFirst.trim() && s.urgentSecond.trim()),
  ];

  function safetyCompletion() {
    return safetyRules.map((rule) => rule(state.safety));
  }

  function renderSafetyProgress() {
    const completed = safetyCompletion();
    const count = completed.filter(Boolean).length;
    const percent = Math.round((count / completed.length) * 100);
    $("#safety-progress-bar").style.width = `${percent}%`;
    $("#safety-progress-text").textContent = `${count} of 7 sections complete`;
    $("#safety-progress-percent").textContent = `${percent}%`;
    $("#safety-heading-percent").textContent = `${percent}%`;
    $("#safety-nav-status").textContent = `${count}/7`;
    $("#metric-safety").textContent = `${percent}%`;
    $$(".safety-step").forEach((step, index) => step.classList.toggle("complete", completed[index]));
  }

  function showSafetyStep(step) {
    activeSafetyStep = Math.max(1, Math.min(7, step));
    $$(".safety-step").forEach((button) => button.classList.toggle("active", Number(button.dataset.safetyStep) === activeSafetyStep));
    $$(".safety-panel").forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.safetyPanel) === activeSafetyStep));
    $("#previous-safety").style.visibility = activeSafetyStep === 1 ? "hidden" : "visible";
    $("#next-safety").innerHTML = activeSafetyStep === 7 ? "Save plan <span>✓</span>" : "Save and continue <span>→</span>";
  }

  function populateSafetyInputs() {
    $$('[data-safety-key]').forEach((input) => {
      const key = input.dataset.safetyKey;
      input.value = state.safety[key] || "";
    });
    $$("[data-coping]").forEach((button) => button.classList.toggle("selected", state.safety.selectedCoping.includes(button.dataset.coping)));
    $("#share-safety-plan").checked = Boolean(state.safety.shareRequested);
    renderSupporters();
    renderSafetyProgress();
  }

  function captureSafetyInputs() {
    $$('[data-safety-key]').forEach((input) => {
      state.safety[input.dataset.safetyKey] = input.value.trim();
    });
    state.safety.shareRequested = $("#share-safety-plan").checked;
    state.safety.supporters = $$(".support-person").map((card) => ({
      id: card.dataset.id,
      name: $(".support-name", card).value.trim(),
      relationship: $(".support-relationship", card).value.trim(),
      phone: $(".support-phone", card).value.trim(),
      email: $(".support-email", card).value.trim(),
      share: $(".support-share", card).checked,
    }));
    saveState();
    renderSafetyProgress();
    $("#safety-saved-status").textContent = `Saved ${new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", hour: "numeric", minute: "2-digit" }).format(new Date())}`;
  }

  function addSupporter(person = {}) {
    state.safety.supporters.push({
      id: person.id || `support-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: person.name || "",
      relationship: person.relationship || "",
      phone: person.phone || "",
      email: person.email || "",
      share: Boolean(person.share),
    });
    saveState();
    renderSupporters();
  }

  function renderSupporters() {
    const list = $("#support-list");
    list.innerHTML = "";
    if (!state.safety.supporters.length) {
      const empty = document.createElement("p");
      empty.className = "empty-small";
      empty.textContent = "No support people added yet.";
      list.appendChild(empty);
      return;
    }
    state.safety.supporters.forEach((person) => {
      const card = $("#support-person-template").content.firstElementChild.cloneNode(true);
      card.dataset.id = person.id;
      $(".support-name", card).value = person.name;
      $(".support-relationship", card).value = person.relationship;
      $(".support-phone", card).value = person.phone;
      $(".support-email", card).value = person.email;
      $(".support-share", card).checked = person.share;
      $(".remove-support", card).addEventListener("click", () => {
        state.safety.supporters = state.safety.supporters.filter((item) => item.id !== person.id);
        saveState();
        renderSupporters();
        renderSafetyProgress();
      });
      $$("input", card).forEach((input) => input.addEventListener("change", captureSafetyInputs));
      list.appendChild(card);
    });
  }

  function showSafetyReview() {
    captureSafetyInputs();
    const s = state.safety;
    const supporters = s.supporters.filter((p) => p.name).map((p) => `<li>${escapeHtml(p.name)}${p.relationship ? ` — ${escapeHtml(p.relationship)}` : ""}${p.phone ? ` · ${escapeHtml(p.phone)}` : ""}</li>`).join("") || "<li>Not added yet</li>";
    const coping = [...s.selectedCoping, s.coping].filter(Boolean).map(escapeHtml).join(", ") || "Not added yet";
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop safety-review-backdrop";
    backdrop.innerHTML = `
      <section class="modal scale-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <button class="modal-close" aria-label="Close">×</button>
        <p class="overline">My safety plan</p>
        <h2 id="review-title">Review with my clinician</h2>
        <div class="score-history">
          <div class="score-row"><strong>What matters to me</strong><span>${escapeHtml(s.reasons || "Not added yet")}</span></div>
          <div class="score-row"><strong>Signs things are changing</strong><span>${escapeHtml(s.warnings || "Not added yet")}</span></div>
          <div class="score-row"><strong>Things I can do</strong><span>${coping}</span></div>
          <div class="score-row"><strong>People who support me</strong><span><ul>${supporters}</ul></span></div>
          <div class="score-row"><strong>Professional support</strong><span>${escapeHtml([s.teamContact, s.gpContact, s.otherProfessional].filter(Boolean).join(" · ") || "Not added yet")}</span></div>
          <div class="score-row"><strong>Making my space safer</strong><span>${escapeHtml(s.environment || "Not added yet")}</span></div>
          <div class="score-row"><strong>Urgent steps</strong><span>${escapeHtml([s.urgentFirst, s.urgentSecond].filter(Boolean).join(" → ") || "Not added yet")}</span></div>
        </div>
        <div class="scale-result-actions"><button class="button button-secondary" id="print-plan">Print or save PDF</button><button class="button button-primary" id="close-review">Return to plan</button></div>
      </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add("modal-open");
    const close = () => { backdrop.remove(); document.body.classList.remove("modal-open"); };
    $(".modal-close", backdrop).addEventListener("click", close);
    $("#close-review", backdrop).addEventListener("click", close);
    $("#print-plan", backdrop).addEventListener("click", () => window.print());
  }

  function renderMessages() {
    const recent = $("#recent-messages");
    recent.innerHTML = state.messages.length ? [...state.messages].reverse().slice(0, 5).map((message) => `
      <article class="recent-item"><strong>${escapeHtml(message.topic)}</strong><span>${escapeHtml(message.text)}</span><small>${escapeHtml(formatTimestamp(message.createdAt))} · Demo only</small></article>`).join("") : '<p class="empty-small">No updates saved yet.</p>';
    $("#message-count").textContent = String(state.messages.length);
    $("#metric-messages").textContent = String(state.messages.length);
  }

  function saveMessage(event) {
    event.preventDefault();
    const text = $("#team-message").value.trim();
    if (!text) {
      $("#message-status").textContent = "Add a short message before saving.";
      $("#team-message").focus();
      return;
    }
    const message = {
      id: `message-${Date.now()}`,
      topic: $("#message-topic").value,
      text,
      medication: $("#medication-name").value.trim(),
      supply: $("#medication-left").value.trim(),
      pharmacy: {
        name: $("#pharmacy-name").value.trim(),
        location: $("#pharmacy-location").value.trim(),
        phone: $("#pharmacy-phone").value.trim(),
        email: $("#pharmacy-email").value.trim(),
      },
      createdAt: new Date().toISOString(),
      status: "Demo — not sent",
    };
    state.messages.push(message);
    saveState();
    $("#message-form").reset();
    $("#message-topic").value = "Medication running low";
    $("#message-count-text").textContent = "0 / 1000";
    $("#pharmacy-result").hidden = true;
    $("#message-status").textContent = "Update saved locally for the care-team demonstration. Nothing was sent.";
    renderMessages();
    renderTeamViews();
  }

  function renderGoals() {
    const list = $("#goal-list");
    list.innerHTML = state.goals.length ? state.goals.map((goal) => `
      <article class="goal-item ${goal.progress >= 100 ? "completed" : ""}" data-goal-id="${escapeHtml(goal.id)}">
        <div class="goal-item-head"><h4>${escapeHtml(goal.title)}</h4><span class="status-pill">${goal.progress}%</span></div>
        <p>${escapeHtml(goal.why || "A patient-led goal.")}</p>
        <div class="goal-progress"><span style="width:${goal.progress}%"></span></div>
        <div class="goal-item-actions"><button data-progress-goal="${escapeHtml(goal.id)}">${goal.progress >= 100 ? "Start again" : "Make a little progress"}</button><span>${goal.progress >= 100 ? "Completed" : "Keep it gentle"}</span></div>
      </article>`).join("") : '<p class="empty-small">No goals added yet.</p>';
    $$('[data-progress-goal]').forEach((button) => button.addEventListener("click", () => {
      const goal = state.goals.find((item) => item.id === button.dataset.progressGoal);
      if (!goal) return;
      goal.progress = goal.progress >= 100 ? 0 : Math.min(100, goal.progress + 25);
      saveState();
      renderAll();
      showToast(goal.progress >= 100 ? "Goal marked complete." : "A small step was saved.");
    }));
  }

  function saveNewGoal() {
    const title = $("#new-goal-title").value.trim();
    if (!title) {
      $("#new-goal-title").focus();
      return;
    }
    state.goals.push({ id: `goal-${Date.now()}`, title, why: $("#new-goal-why").value.trim(), progress: 0 });
    saveState();
    $("#new-goal-title").value = "";
    $("#new-goal-why").value = "";
    closeModal("goal-modal");
    renderAll();
    showToast("Goal added to your demo plan.");
  }

  const scales = {
    k10: {
      code: "K10+",
      title: "Psychological distress",
      period: "During the past 4 weeks, about how often did you feel…",
      questions: [
        "tired out for no good reason?", "nervous?", "so nervous that nothing could calm you down?", "hopeless?", "restless or fidgety?", "so restless you could not sit still?", "depressed?", "that everything was an effort?", "so sad that nothing could cheer you up?", "worthless?",
      ],
      labels: ["None of the time", "A little of the time", "Some of the time", "Most of the time", "All of the time"],
      values: [1, 2, 3, 4, 5],
      max: 50,
      interpret(score) {
        if (score <= 19) return ["Lower distress range", "Your answers sit in the lower K10 range. Discuss the pattern with your team in the context of how you are travelling."];
        if (score <= 24) return ["Mild distress range", "Your answers suggest some psychological distress. This is useful to discuss with your treating team."];
        if (score <= 29) return ["Moderate distress range", "Your answers suggest a moderate level of psychological distress. Please review this with your treating team."];
        return ["Higher distress range", "Your answers suggest a higher level of psychological distress. Please discuss this result with your treating team."];
      },
    },
    phq9: {
      code: "PHQ-9",
      title: "Depression symptoms",
      period: "Over the last 2 weeks, how often have you been bothered by…",
      questions: [
        "little interest or pleasure in doing things?", "feeling down, depressed or hopeless?", "trouble falling or staying asleep, or sleeping too much?", "feeling tired or having little energy?", "poor appetite or overeating?", "feeling bad about yourself — or that you are a failure or have let yourself or your family down?", "trouble concentrating on things, such as reading or watching television?", "moving or speaking so slowly that other people could have noticed, or being so fidgety or restless that you have been moving a lot more than usual?", "thoughts that you would be better off dead, or of hurting yourself in some way?",
      ],
      labels: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
      values: [0, 1, 2, 3],
      max: 27,
      safetyIndex: 8,
      interpret(score) {
        if (score <= 4) return ["Minimal symptom range", "Use this result as one part of a broader conversation with your team."];
        if (score <= 9) return ["Mild symptom range", "Consider discussing any persistent or worsening symptoms with your team."];
        if (score <= 14) return ["Moderate symptom range", "Please discuss this result and its impact on daily life with your treating team."];
        if (score <= 19) return ["Moderately severe symptom range", "A timely clinical conversation is recommended."];
        return ["Severe symptom range", "Please discuss this result promptly with your treating team."];
      },
    },
    gad7: {
      code: "GAD-7",
      title: "Anxiety symptoms",
      period: "Over the last 2 weeks, how often have you been bothered by…",
      questions: [
        "feeling nervous, anxious or on edge?", "not being able to stop or control worrying?", "worrying too much about different things?", "trouble relaxing?", "being so restless that it is hard to sit still?", "becoming easily annoyed or irritable?", "feeling afraid as if something awful might happen?",
      ],
      labels: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
      values: [0, 1, 2, 3],
      max: 21,
      interpret(score) {
        if (score <= 4) return ["Minimal symptom range", "Use this result as one part of a broader conversation with your team."];
        if (score <= 9) return ["Mild symptom range", "Consider discussing persistent anxiety or its effect on daily life with your team."];
        if (score <= 14) return ["Moderate symptom range", "Please review this result with your treating team."];
        return ["Severe symptom range", "Please discuss this result promptly with your treating team."];
      },
    },
    who5: {
      code: "WHO-5",
      title: "Positive wellbeing",
      period: "Over the last 2 weeks…",
      questions: [
        "I have felt cheerful and in good spirits.", "I have felt calm and relaxed.", "I have felt active and vigorous.", "I woke up feeling fresh and rested.", "My daily life has been filled with things that interest me.",
      ],
      labels: ["At no time", "Some of the time", "Less than half", "More than half", "Most of the time", "All of the time"],
      values: [0, 1, 2, 3, 4, 5],
      max: 100,
      transform: (raw) => raw * 4,
      interpret(score) {
        if (score <= 28) return ["Low wellbeing score", "This result may be useful to review promptly with your treating team, alongside how you are feeling and functioning."];
        if (score <= 50) return ["Reduced wellbeing score", "Consider discussing what has changed and what support may help."];
        return ["Higher wellbeing score", "Notice what may be helping and consider adding it to your recovery goals or safety plan."];
      },
    },
  };

  function openScale(scaleKey) {
    const scale = scales[scaleKey];
    if (!scale) return;
    const content = $("#scale-content");
    content.innerHTML = `
      <div class="scale-intro">
        <p class="overline">Optional patient check-in</p>
        <h2 id="scale-title">${escapeHtml(scale.code)} · ${escapeHtml(scale.title)}</h2>
        <p>${escapeHtml(scale.period)} This is not monitored in real time and is not a diagnosis or safety assessment.</p>
      </div>
      <form id="scale-form" data-scale-key="${escapeHtml(scaleKey)}">
        <div class="question-list">
          ${scale.questions.map((question, index) => `
            <fieldset class="scale-question">
              <legend>${index + 1}. ${escapeHtml(question)}</legend>
              <div class="answer-scale" style="grid-template-columns:repeat(${scale.labels.length},1fr)">
                ${scale.labels.map((label, optionIndex) => `<label><input type="radio" name="q${index}" value="${scale.values[optionIndex]}" required /><span>${escapeHtml(label)}</span></label>`).join("")}
              </div>
            </fieldset>`).join("")}
        </div>
        <div class="scale-submit-row"><p>Please answer every question. You can stop at any time.</p><button class="button button-primary" type="submit">See my result</button></div>
      </form>`;
    $("#scale-form").addEventListener("submit", submitScale);
    openModal("scale-modal");
  }

  function submitScale(event) {
    event.preventDefault();
    const key = event.currentTarget.dataset.scaleKey;
    const scale = scales[key];
    const answers = scale.questions.map((_, index) => Number(new FormData(event.currentTarget).get(`q${index}`)));
    if (answers.some((answer) => Number.isNaN(answer))) return;
    const rawScore = answers.reduce((sum, value) => sum + value, 0);
    const score = scale.transform ? scale.transform(rawScore) : rawScore;
    const [label, explanation] = scale.interpret(score);
    const safetyResponse = typeof scale.safetyIndex === "number" && answers[scale.safetyIndex] > 0;
    state.scaleHistory[key].push({ date: todayKey(), score, max: scale.max, createdAt: new Date().toISOString() });
    saveState();
    $("#scale-content").innerHTML = `
      <div class="scale-intro"><p class="overline">Check-in saved locally</p><h2 id="scale-title">${escapeHtml(scale.code)} result</h2></div>
      <div class="scale-result">
        <div class="scale-result-score"><strong>${score}</strong><span>out of ${scale.max}</span></div>
        <h3>${escapeHtml(label)}</h3><p>${escapeHtml(explanation)}</p>
      </div>
      ${safetyResponse ? `<div class="notice notice-amber" style="margin-top:14px"><strong>Important</strong><span>You indicated some thoughts of death or self-harm. A questionnaire cannot assess your safety. If you feel unable to keep yourself safe, use urgent support now; otherwise discuss this answer with your treating team.</span></div>` : ""}
      <div class="scale-result-actions">
        ${safetyResponse ? '<button class="button button-danger" id="scale-urgent-help">Urgent support</button>' : ""}
        <button class="button button-primary" id="finish-scale">Return to progress</button>
      </div>`;
    $("#finish-scale").addEventListener("click", () => {
      closeModal("scale-modal");
      renderProgress();
      renderTeamViews();
    });
    $("#scale-urgent-help")?.addEventListener("click", () => openModal("unsafe-modal"));
  }

  function pointsForChart(values, width = 720, height = 230) {
    const left = 44;
    const right = 20;
    const top = 20;
    const bottom = 38;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const max = Math.max(...values.map((item) => item.max || 5), 5);
    return values.map((item, index) => ({
      x: left + (values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth),
      y: top + chartHeight - (item.score / max) * chartHeight,
      ...item,
    }));
  }

  function renderChart(svg, values, emptyCaption) {
    if (!svg) return;
    const data = values.length ? values : [
      { date: isoDate(addDays(new Date(), -6)), score: 2, max: 5 },
      { date: isoDate(addDays(new Date(), -4)), score: 2, max: 5 },
      { date: isoDate(addDays(new Date(), -2)), score: 3, max: 5 },
      { date: todayKey(), score: 3, max: 5 },
    ];
    const points = pointsForChart(data);
    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    const grid = [20, 63, 106, 149, 192].map((y) => `<line x1="44" y1="${y}" x2="700" y2="${y}" stroke="#dfe5e2" stroke-width="1" />`).join("");
    svg.innerHTML = `
      ${grid}
      <polyline points="${polyline}" fill="none" stroke="#25616a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#fff" stroke="#25616a" stroke-width="3"><title>${point.score} on ${formatDate(point.date, { day: "numeric", month: "short" })}</title></circle><text x="${point.x}" y="220" text-anchor="middle" fill="#718386" font-size="10">${escapeHtml(formatDate(point.date, { day: "numeric", month: "short" }))}</text>${index === points.length - 1 ? `<text x="${point.x}" y="${Math.max(14, point.y - 12)}" text-anchor="middle" fill="#153d43" font-size="11" font-weight="700">${point.score}</text>` : ""}`).join("")}
      ${!values.length ? `<text x="372" y="118" text-anchor="middle" fill="#7a8b8d" font-size="12">${escapeHtml(emptyCaption)}</text>` : ""}`;
  }

  function renderProgress() {
    renderGoals();
    const key = $("#chart-scale").value;
    const values = key === "mood" ? state.moodHistory.map((item) => ({ ...item, max: 5 })) : state.scaleHistory[key];
    renderChart($("#progress-chart"), values, "Example trend — complete a check-in to add your result");
    $("#chart-caption").textContent = values.length ? "Each point is a saved demo check-in. Review changes with your treating team." : "Demo values are shown until you add your own check-ins.";
  }

  function renderTeamViews() {
    const latestMood = [...state.moodHistory].sort((a, b) => b.date.localeCompare(a.date))[0];
    const safetyDone = safetyCompletion().filter(Boolean).length;
    const patientRows = [
      { name: `${state.profile.patientName} M.`, admission: "Day 3", visit: state.visits[0]?.type || "Home visit", time: state.visits[0]?.time || "10:30 am", mood: latestMood ? `${latestMood.score}/5` : "—", plan: `${safetyDone}/7` },
      { name: "Alex R.", admission: "Day 6", visit: "Telehealth", time: "9:00 am", mood: "4/5", plan: "7/7" },
      { name: "Morgan T.", admission: "Day 2", visit: "Home visit", time: "1:30 pm", mood: "3/5", plan: "2/7" },
      { name: "Casey B.", admission: "Day 8", visit: "Home visit", time: "3:00 pm", mood: "4/5", plan: "7/7" },
    ];
    $("#today-patient-table").innerHTML = patientRows.map((patient) => `<tr><td>${escapeHtml(patient.name)}<br /><small>${escapeHtml(patient.admission)}</small></td><td>${escapeHtml(patient.visit)}</td><td>${escapeHtml(patient.time)}</td><td>${escapeHtml(patient.mood)}</td><td>${escapeHtml(patient.plan)}</td></tr>`).join("");
    $("#patient-cards").innerHTML = patientRows.map((patient, index) => `<article class="patient-card"><div class="patient-card-top"><div class="patient-identity"><span class="patient-avatar">${escapeHtml(patient.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(patient.name)}</strong><span>${escapeHtml(patient.admission)} · ${index === 0 ? "Patient-entered demo" : "Sample profile"}</span></div></div><span class="status-pill status-confirmed">Active</span></div><div class="patient-card-grid"><div><span>Today</span><strong>${escapeHtml(patient.visit)}</strong></div><div><span>Check-in</span><strong>${escapeHtml(patient.mood)}</strong></div><div><span>Safety plan</span><strong>${escapeHtml(patient.plan)}</strong></div></div></article>`).join("");

    const alerts = [];
    if (state.visitRequests.some((request) => request.status === "Requested")) alerts.push({ title: "Visit preference awaiting review", detail: `${state.profile.patientName} requested a schedule change.`, tone: "" });
    if (state.messages.length) alerts.push({ title: state.messages.at(-1).topic, detail: `${state.profile.patientName} saved a new portal update.`, tone: state.messages.at(-1).topic.includes("Medication") ? "red" : "" });
    if (latestMood?.score <= 2) alerts.push({ title: "Lower daily check-in", detail: `${state.profile.patientName} recorded ${latestMood.score}/5 today. Review in clinical context.`, tone: "" });
    $("#team-alert-list").innerHTML = alerts.length ? alerts.map((alert) => `<div class="team-alert ${alert.tone}"><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.detail)}</span></div>`).join("") : '<p class="empty-small">No new items in this local demo.</p>';

    const requests = [...state.visitRequests].reverse();
    $("#team-visit-requests").innerHTML = requests.length ? requests.map((request) => `<article class="request-item" data-request-id="${escapeHtml(request.id)}"><div><strong>${escapeHtml(state.profile.patientName)} M.</strong><small>${escapeHtml(formatTimestamp(request.createdAt))}</small></div><div><strong>${escapeHtml(formatDate(request.date, { weekday: "long", day: "numeric", month: "long" }))}</strong><span>${escapeHtml(request.type)} · ${escapeHtml(request.time)}</span></div><div><span>${escapeHtml(request.note || "No note added")}</span><small>${escapeHtml(request.status)}</small></div><div class="request-actions">${request.status === "Requested" ? `<button data-request-action="decline" data-id="${escapeHtml(request.id)}">Decline</button><button class="primary" data-request-action="confirm" data-id="${escapeHtml(request.id)}">Confirm</button>` : ""}</div></article>`).join("") : '<p class="empty-small">No visit requests saved in the patient demo.</p>';
    $$('[data-request-action]').forEach((button) => button.addEventListener("click", () => handleRequestAction(button.dataset.id, button.dataset.requestAction)));

    const messages = [...state.messages].reverse();
    $("#team-message-list").innerHTML = messages.length ? messages.map((message) => `<article class="request-item"><div><strong>${escapeHtml(state.profile.patientName)} M.</strong><small>${escapeHtml(formatTimestamp(message.createdAt))}</small></div><div><strong>${escapeHtml(message.topic)}</strong><span>${escapeHtml(message.text)}</span></div><div><span>${message.medication ? `Medication: ${escapeHtml(message.medication)} · ${escapeHtml(message.supply)}` : "General update"}</span><small>${escapeHtml(message.status)}</small></div><div class="request-actions"><button class="primary">Mark reviewed</button></div></article>`).join("") : '<p class="empty-small">No updates saved in the patient demo.</p>';

    $("#team-goal-list").innerHTML = state.goals.length ? state.goals.map((goal) => `<div class="recent-item"><strong>${escapeHtml(goal.title)}</strong><span>${escapeHtml(goal.why || "Patient-led goal")}</span><small>${goal.progress}% progress</small></div>`).join("") : '<p class="empty-small">No goals added.</p>';
    const allScores = Object.entries(state.scaleHistory).flatMap(([key, values]) => values.map((value) => ({ ...value, key }))).sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
    $("#team-score-history").innerHTML = allScores.length ? allScores.slice(0, 6).map((item) => `<div class="score-row"><strong>${escapeHtml(scales[item.key]?.code || item.key.toUpperCase())}</strong><span>${item.score}/${item.max} · ${escapeHtml(formatDate(item.date, { day: "numeric", month: "short" }))}</span></div>`).join("") : '<p class="empty-small">No patient questionnaires completed.</p>';
    renderChart($("#team-progress-chart"), state.moodHistory.map((item) => ({ ...item, max: 5 })), "No daily check-ins yet");

    $("#metric-requests").textContent = String(state.visitRequests.filter((item) => item.status === "Requested").length);
    $("#request-count").textContent = String(state.visitRequests.filter((item) => item.status === "Requested").length);
    $("#metric-messages").textContent = String(state.messages.length);
    $("#message-count").textContent = String(state.messages.length);
  }

  function handleRequestAction(id, action) {
    const request = state.visitRequests.find((item) => item.id === id);
    if (!request) return;
    request.status = action === "confirm" ? "Confirmed" : "Declined";
    if (action === "confirm" && !state.visits.some((visit) => visit.date === request.date && visit.time === request.time)) {
      state.visits.push({ id: `confirmed-${Date.now()}`, date: request.date, type: request.type, time: request.time, status: "Confirmed", clinician: "Care team" });
    }
    saveState();
    renderAll();
    showToast(`Visit request ${request.status.toLowerCase()}.`);
  }

  function renderAll() {
    $$('[data-patient-name]').forEach((node) => (node.textContent = state.profile.patientName));
    renderToday();
    renderVisits();
    populateSafetyInputs();
    showSafetyStep(activeSafetyStep);
    renderMessages();
    renderProgress();
    renderTeamViews();
  }

  function bindEvents() {
    $("#login-form").addEventListener("submit", handleLogin);
    $("#show-code").addEventListener("click", () => {
      const input = $("#access-code");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      $("#show-code").textContent = show ? "Hide" : "Show";
    });
    $$('input[name="role"]').forEach((input) => input.addEventListener("change", () => {
      $("#display-name").value = input.value === "team" ? "Dr Lee" : state.profile.patientName;
    }));
    $("#sign-out").addEventListener("click", () => {
      $("#app-shell").hidden = true;
      $("#login-screen").hidden = false;
      $("#access-code").value = "";
      $("#access-code").focus();
    });
    $("#mobile-menu").addEventListener("click", () => {
      const open = $("#app-sidebar").classList.toggle("open");
      $("#mobile-menu").setAttribute("aria-expanded", String(open));
    });
    $$('[data-view]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
    $$('[data-view-link]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewLink)));
    $$('[data-nav="home"]').forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); showView(currentRole === "patient" ? "home" : "team-home"); }));
    $$('[data-action="unsafe"]').forEach((button) => button.addEventListener("click", () => openModal("unsafe-modal")));
    $$('[data-close-modal]').forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
    $$(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(modal.id); }));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".modal-backdrop:not([hidden])").forEach((modal) => closeModal(modal.id)); });

    $$("[data-mood]").forEach((button) => button.addEventListener("click", () => setMood(Number(button.dataset.mood))));
    $("#goal-done-button").addEventListener("click", () => {
      if (!state.goals[0]) return;
      state.goals[0].progress = state.goals[0].progress >= 100 ? 50 : 100;
      saveState();
      renderAll();
      showToast(state.goals[0].progress >= 100 ? "Nice work. Your small step is marked done." : "Goal reopened.");
    });
    $$('[data-request-telehealth]').forEach((button) => button.addEventListener("click", () => {
      showView("visits");
      $("input[name='visit-type'][value='Telehealth']").checked = true;
    }));
    $("#save-visit").addEventListener("click", saveVisitPreference);

    $$(".safety-step").forEach((button) => button.addEventListener("click", () => { captureSafetyInputs(); showSafetyStep(Number(button.dataset.safetyStep)); }));
    $("#previous-safety").addEventListener("click", () => { captureSafetyInputs(); showSafetyStep(activeSafetyStep - 1); });
    $("#next-safety").addEventListener("click", () => {
      captureSafetyInputs();
      if (activeSafetyStep < 7) showSafetyStep(activeSafetyStep + 1);
      else showToast("Your safety plan was saved locally. Review it with your clinician.");
    });
    $$('[data-safety-key]').forEach((input) => input.addEventListener("change", captureSafetyInputs));
    $("#share-safety-plan").addEventListener("change", captureSafetyInputs);
    $$("[data-coping]").forEach((button) => button.addEventListener("click", () => {
      const value = button.dataset.coping;
      if (state.safety.selectedCoping.includes(value)) state.safety.selectedCoping = state.safety.selectedCoping.filter((item) => item !== value);
      else state.safety.selectedCoping.push(value);
      saveState();
      button.classList.toggle("selected");
      renderSafetyProgress();
    }));
    $("#add-support-person").addEventListener("click", () => addSupporter());
    $("#review-safety-plan").addEventListener("click", showSafetyReview);

    $("#message-form").addEventListener("submit", saveMessage);
    $("#team-message").addEventListener("input", () => { $("#message-count-text").textContent = `${$("#team-message").value.length} / 1000`; });
    $("#message-topic").addEventListener("change", () => { $("#medication-fields").hidden = !$("#message-topic").value.toLowerCase().includes("medication"); });
    $("#find-pharmacy").addEventListener("click", () => {
      $("#pharmacy-result").hidden = false;
      if (!$("#pharmacy-name").value.trim()) $("#pharmacy-name").focus();
    });

    $("#add-goal-button").addEventListener("click", () => openModal("goal-modal"));
    $$('[data-goal-suggestion]').forEach((button) => button.addEventListener("click", () => { $("#new-goal-title").value = button.dataset.goalSuggestion; }));
    $("#save-goal").addEventListener("click", saveNewGoal);
    $$('[data-scale]').forEach((button) => button.addEventListener("click", () => openScale(button.dataset.scale)));
    $("#chart-scale").addEventListener("change", renderProgress);

    $("#reset-demo").addEventListener("click", () => {
      const confirmed = window.confirm("Reset all CareQuay demo entries stored in this browser?");
      if (!confirmed) return;
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      renderAll();
      showToast("Demo data reset.");
    });
  }

  bindEvents();
  populateSafetyInputs();
  showSafetyStep(1);
})();
