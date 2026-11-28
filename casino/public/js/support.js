/* CareQuay live support chat — messages go to the team's Telegram; replies appear here. */
(() => {
  if (window.__cqSupport) return;
  window.__cqSupport = true;

  const KEY = "cq-sup-conv", SEEN = "cq-sup-seen";
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "/css/support.css";
  document.head.append(css);

  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  };
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="supg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c8fff6"/><stop offset=".5" stop-color="#5ee6d2"/><stop offset="1" stop-color="#f5c451"/></linearGradient></defs><path d="M23.5 7a17 17 0 1 0 11.5 29.5" fill="none" stroke="url(#supg)" stroke-width="5" stroke-linecap="round"/><path d="m27.5 27.5 10 10" fill="none" stroke="url(#supg)" stroke-width="5" stroke-linecap="round"/></svg>';

  let conv = ls.get(KEY), lastId = 0, open = false, timer = 0, busy = false, loaded = false;
  const seenId = () => Number(ls.get(SEEN)) || 0;

  const badge = h("span", { class: "sup-badge", hidden: true });
  const fab = h("button", { type: "button", class: "sup-fab", "aria-label": "Open live chat", "data-silent": "" }, h("span", { class: "sup-fab-ic" }, "💬"), h("span", { class: "sup-fab-tx" }, "Live chat"), badge);
  const msgs = h("div", { class: "sup-msgs", role: "log", "aria-live": "polite" });
  const email = h("input", { class: "sup-email", type: "email", placeholder: "Your email (optional — so we can follow up)", autocomplete: "email", maxlength: "120" });
  const text = h("textarea", { class: "sup-text", rows: "1", placeholder: "Type your message…", maxlength: "1000", "aria-label": "Message" });
  const send = h("button", { type: "submit", class: "sup-send", "aria-label": "Send", "data-silent": "" }, "➤");
  const err = h("p", { class: "sup-err", role: "alert" });
  const head = h("div", { class: "sup-head" });
  head.innerHTML = `<span class="sup-av">${LOGO}</span>`;
  head.append(
    h("div", { class: "sup-who" }, h("b", {}, "CareQuay Support"), h("small", {}, h("i", { class: "sup-dot" }), "Usually replies in a few minutes")),
    h("button", { type: "button", class: "sup-x", "aria-label": "Close chat", "data-silent": "", onclick: () => toggle(false) }, "×"));
  const form = h("form", { class: "sup-form" }, email, h("div", { class: "sup-row" }, text, send));
  const panel = h("section", { class: "sup-panel", hidden: true, "aria-label": "Live support chat" }, head, msgs, err, form);
  document.body.append(fab, panel);

  const time = (at) => { try { return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; } };
  const greet = () => h("div", { class: "sup-m from-bot" }, h("p", {}, "Hi 👋 Questions about deposits, withdrawals, bonuses or anything else? Send us a message and we'll reply right here."));
  msgs.append(greet());

  function add(list) {
    let agentNew = 0;
    for (const m of list) {
      if (m.id <= lastId) continue;
      lastId = m.id;
      if (m.from === "agent" && m.id > seenId()) agentNew++;
      msgs.append(h("div", { class: `sup-m from-${m.from}` }, h("p", {}, m.text), h("time", {}, m.from === "agent" ? `Support · ${time(m.at)}` : time(m.at))));
    }
    if (list.length) msgs.scrollTop = msgs.scrollHeight;
    return agentNew;
  }
  function unread(n) {
    badge.hidden = !n; badge.textContent = n > 9 ? "9+" : String(n || "");
    fab.classList.toggle("has-new", !!n);
  }
  const markSeen = () => { if (lastId > seenId()) ls.set(SEEN, String(lastId)); unread(0); };

  async function api(path, body) {
    const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong — please try again.");
    return j;
  }
  function setConv(c) {
    if (c && c !== conv && c.startsWith("g:")) ls.set(KEY, c);
    if (c && conv && c !== conv) { lastId = 0; msgs.replaceChildren(greet()); }
    conv = c || conv;
    email.hidden = !!(c && c.startsWith("u:")) || lastId > 0;
  }
  async function poll() {
    if (busy) return;
    try {
      const r = await api("/api/support/poll", { conv, after: lastId });
      if (r.conv) setConv(r.conv);
      else email.hidden = lastId > 0;
      const n = add(r.messages || []);
      loaded = true;
      if (open) markSeen();
      else if (n) {
        unread(Number(badge.textContent) + n || n);
        try { window.CQSound && window.CQSound.play("click"); } catch { /* no sound */ }
      }
    } catch { /* offline — try again next tick */ }
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!conv) return;
    const ms = open ? (document.hidden ? 15e3 : 4e3) : (lastId ? 30e3 : 60e3);
    timer = setTimeout(poll, ms);
  }
  function toggle(v) {
    open = v;
    panel.hidden = !v; fab.hidden = v;
    document.body.classList.toggle("sup-open", v);
    if (v) { markSeen(); msgs.scrollTop = msgs.scrollHeight; setTimeout(() => text.focus(), 50); poll(); }
    else schedule();
  }
  fab.addEventListener("click", () => toggle(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) toggle(false); });

  const grow = () => { text.style.height = "auto"; text.style.height = Math.min(text.scrollHeight, 120) + "px"; };
  text.addEventListener("input", grow);
  text.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = text.value.trim();
    if (!t || busy) return;
    busy = true; send.disabled = true; err.textContent = "";
    try {
      const r = await api("/api/support/send", { conv, text: t, email: email.hidden ? "" : email.value.trim(), page: location.pathname + location.hash, after: lastId });
      text.value = ""; grow();
      setConv(r.conv);
      add(r.messages || []); markSeen();
      email.hidden = true;
    } catch (x) { err.textContent = x.message; }
    busy = false; send.disabled = false; text.focus();
    schedule();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && (open || conv)) poll(); });

  // Load history (logged-in players and returning guests) after the page settles.
  setTimeout(poll, 1500);
})();
