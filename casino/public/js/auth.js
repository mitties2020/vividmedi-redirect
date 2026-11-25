/* CareQuay Casino — sign in, register, confirm, forgot & reset password. */
(() => {
  "use strict";
  const { el, $, api } = CQ;

  function logo(size = 34, id = "lg") {
    return `<svg class="cq-mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${id}" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c8fff6"/><stop offset=".5" stop-color="#5ee6d2"/><stop offset="1" stop-color="#f5c451"/></linearGradient></defs><path d="M23.5 15a9 9 0 1 0 6.4 15.4" fill="none" stroke="#9ff3e6" stroke-width="4" stroke-linecap="round" opacity=".55"/><path class="cq-arc" d="M23.5 5a19 19 0 1 0 12.8 33" fill="none" stroke="url(#${id})" stroke-width="5" stroke-linecap="round"/><path d="m28 28 11 11" fill="none" stroke="url(#${id})" stroke-width="5" stroke-linecap="round"/></svg>`;
  }
  CQ.logo = logo;

  const root = () => $("#auth");
  let view = "login", notice = null, pendingEmail = "";

  function input(name, type, label, attrs = {}) {
    const i = el("input", { name, type, class: "auth-input", required: true, ...attrs });
    const wrap = el("label", { class: "auth-field" }, el("span", {}, label), i);
    if (type === "password") {
      const t = el("button", { type: "button", class: "auth-eye", "aria-label": "Show password", onclick: () => { i.type = i.type === "password" ? "text" : "password"; t.textContent = i.type === "password" ? "Show" : "Hide"; } }, "Show");
      wrap.append(t);
    }
    return wrap;
  }
  const msg = () => el("p", { class: "auth-msg", role: "alert" });
  function busy(form, on) { form.querySelectorAll("button, input").forEach((n) => (n.disabled = on)); form.classList.toggle("busy", on); }
  function setMsg(form, text, kind = "error") { const m = form.querySelector(".auth-msg"); m.textContent = text || ""; m.className = `auth-msg ${kind}`; }

  function loginForm() {
    const f = el("form", { class: "auth-form", novalidate: true },
      input("email", "email", "Email", { autocomplete: "email", value: pendingEmail }),
      input("password", "password", "Password", { autocomplete: "current-password" }),
      msg(),
      el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Log in"),
      el("button", { type: "button", class: "auth-link", onclick: () => go("forgot") }, "I forgot my password"));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(); pendingEmail = email;
      busy(f, true); setMsg(f, "");
      try {
        await api("/api/auth/login", { email, password: f.password.value });
        history.replaceState(null, "", location.pathname + (location.hash || "#/"));
        location.reload();
      } catch (err) {
        busy(f, false);
        setMsg(f, err.message);
        if (err.data && err.data.unconfirmed) {
          const r = el("button", { type: "button", class: "auth-link", onclick: async () => { r.disabled = true; try { await api("/api/auth/resend", { email }); setMsg(f, `We've sent a new confirmation link to ${email}.`, "ok"); } catch (e2) { setMsg(f, e2.message); } } }, "Resend confirmation email");
          f.querySelector(".auth-msg").after(r);
        }
      }
    });
    return f;
  }

  function registerForm() {
    const terms = el("input", { type: "checkbox", name: "terms" });
    const f = el("form", { class: "auth-form", novalidate: true },
      input("email", "email", "Email", { autocomplete: "email", value: pendingEmail }),
      input("password", "password", "Password", { autocomplete: "new-password", minlength: "8" }),
      input("password2", "password", "Repeat password", { autocomplete: "new-password", minlength: "8" }),
      el("p", { class: "auth-hint" }, "At least 8 characters, with a letter and a number."),
      el("label", { class: "auth-check" }, terms, el("span", {}, "I'm 18 or older and I accept the ", el("button", { type: "button", class: "auth-inline", onclick: () => window.CQPages?.termsModal() }, "Terms & Conditions"), ".")),
      msg(),
      el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Create account"));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(); pendingEmail = email;
      if (f.password.value !== f.password2.value) return setMsg(f, "Passwords don't match.");
      busy(f, true); setMsg(f, "");
      try {
        await api("/api/auth/register", { email, password: f.password.value, password2: f.password2.value, terms: terms.checked });
        go("sent");
      } catch (err) { busy(f, false); setMsg(f, err.message); }
    });
    return f;
  }

  function sentView() {
    const resend = el("button", { type: "button", class: "btn btn-ghost btn-block" }, "Resend email");
    const m = msg();
    resend.addEventListener("click", async () => { resend.disabled = true; try { await api("/api/auth/resend", { email: pendingEmail }); m.textContent = "Sent again. Check your inbox and spam folder."; m.className = "auth-msg ok"; } catch (e) { m.textContent = e.message; m.className = "auth-msg error"; } setTimeout(() => (resend.disabled = false), 20000); });
    return el("div", { class: "auth-form" },
      el("div", { class: "auth-icon" }, "✉"),
      el("h2", {}, "Check your inbox"),
      el("p", { class: "auth-p" }, "We've sent a confirmation link to ", el("b", {}, pendingEmail), ". Click it to activate your account, then log in here."),
      m, resend,
      el("button", { type: "button", class: "auth-link", onclick: () => go("login") }, "Back to log in"));
  }

  function forgotForm() {
    const f = el("form", { class: "auth-form", novalidate: true },
      el("h2", {}, "Reset your password"),
      el("p", { class: "auth-p" }, "Enter the email you signed up with and we'll send you a link to choose a new password."),
      input("email", "email", "Email", { autocomplete: "email", value: pendingEmail }),
      msg(),
      el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Send reset link"),
      el("button", { type: "button", class: "auth-link", onclick: () => go("login") }, "Back to log in"));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      pendingEmail = f.email.value.trim();
      busy(f, true);
      try { await api("/api/auth/forgot", { email: pendingEmail }); busy(f, false); setMsg(f, `If an account exists for ${pendingEmail}, a reset link is on its way. It's valid for 1 hour.`, "ok"); }
      catch (err) { busy(f, false); setMsg(f, err.message); }
    });
    return f;
  }

  function resetForm(token) {
    const f = el("form", { class: "auth-form", novalidate: true },
      el("h2", {}, "Choose a new password"),
      input("password", "password", "New password", { autocomplete: "new-password" }),
      input("password2", "password", "Repeat new password", { autocomplete: "new-password" }),
      el("p", { class: "auth-hint" }, "At least 8 characters, with a letter and a number."),
      msg(),
      el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Save password"));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (f.password.value !== f.password2.value) return setMsg(f, "Passwords don't match.");
      busy(f, true);
      try {
        await api("/api/auth/reset", { token, password: f.password.value, password2: f.password2.value });
        history.replaceState(null, "", location.pathname);
        notice = { text: "Password updated. Log in with your new password.", kind: "ok" };
        go("login");
      } catch (err) { busy(f, false); setMsg(f, err.message); }
    });
    return f;
  }

  function go(v) { view = v; render(); }

  function render() {
    const tabs = view === "login" || view === "register"
      ? el("div", { class: "auth-tabs", role: "tablist" },
          el("button", { type: "button", role: "tab", class: view === "login" ? "on" : "", "aria-selected": String(view === "login"), onclick: () => go("login") }, "Log in"),
          el("button", { type: "button", role: "tab", class: view === "register" ? "on" : "", "aria-selected": String(view === "register"), onclick: () => go("register") }, "Register"))
      : null;
    const token = new URLSearchParams(location.search).get("reset");
    const body = token && view !== "login" ? resetForm(token) : view === "register" ? registerForm() : view === "forgot" ? forgotForm() : view === "sent" ? sentView() : loginForm();
    const card = el("div", { class: "auth-card" },
      el("div", { class: "auth-brand" }, el("span", { html: logo(54, "lga") }), el("div", {}, el("b", {}, "CareQuay"), el("small", {}, "Casino"))),
      notice ? el("p", { class: `auth-notice ${notice.kind}` }, notice.text) : null,
      tabs, body);
    notice = null;
    root().replaceChildren(
      el("div", { class: "auth-bg", "aria-hidden": "true" }, el("div", { class: "auth-grid" }), el("div", { class: "auth-orbit o1" }, el("i")), el("div", { class: "auth-orbit o2" }, el("i")), el("div", { class: "auth-glow" })),
      card,
      el("p", { class: "auth-foot" }, el("span", { class: "age" }, "18+"), "Gamble responsibly. ", el("button", { type: "button", class: "auth-inline", onclick: () => window.CQPages?.termsModal() }, "Terms & Conditions")));
    setTimeout(() => root().querySelector("input:not([type=checkbox])")?.focus(), 30);
  }

  function show(text) {
    document.body.classList.add("signed-out");
    $("#app").hidden = true; root().hidden = false;
    const q = new URLSearchParams(location.search);
    if (text) notice = { text, kind: "warn" };
    if (q.get("confirmed") === "1") { notice = { text: "Email confirmed — you can log in now.", kind: "ok" }; history.replaceState(null, "", location.pathname); }
    if (q.get("confirmed") === "0") { notice = { text: "That confirmation link is invalid or has expired. Log in to get a new one.", kind: "warn" }; history.replaceState(null, "", location.pathname); }
    view = q.get("reset") ? "reset" : "login";
    render();
  }

  window.CQAuth = { show };
})();
