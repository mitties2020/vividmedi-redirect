/* CareQuay Casino — core client: API, balances, shared UI. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) n.style.setProperty(sk, sv); else n.style[sk] = sv; } }
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = window.CQTables;

  /* ---------- Money ---------- */
  const fmtUSD = (v, opts = {}) => {
    const n = Number(v) || 0;
    return `${opts.sign && n > 0 ? "+" : ""}${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const cents = (v) => Math.floor((Number(v) || 0) * 100 + 1e-6) / 100;

  /* ---------- State ---------- */
  const state = { me: null, bal: { fun: 0, real: 0, wagerRemaining: 0 }, mode: null };
  const listeners = new Set();
  function setBalances(r) {
    if (!r) return;
    for (const k of ["fun", "real", "wagerRemaining"]) if (typeof r[k] === "number") state.bal[k] = r[k];
    listeners.forEach((fn) => fn(state.bal));
  }
  const onBalance = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const balance = (mode = state.mode) => state.bal[mode] || 0;

  /* ---------- API ---------- */
  class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data; } }
  async function api(path, body, method, opts = {}) {
    const req = { method: method || (body ? "POST" : "GET"), headers: {}, credentials: "same-origin" };
    if (body) { req.headers["Content-Type"] = "application/json"; req.body = JSON.stringify(body); }
    let r;
    try { r = await fetch(path, req); } catch { throw new ApiError("Can't reach the server. Check your connection.", 0); }
    let data = {};
    try { data = await r.json(); } catch { /* empty */ }
    if (r.status === 401 && state.me && !path.startsWith("/api/auth/")) { state.me = null; window.CQAuth?.show("Your session has ended. Please log in again."); throw new ApiError(data.error || "Please log in.", 401, data); }
    if (!r.ok) throw new ApiError(data.error || `Request failed (${r.status})`, r.status, data);
    if (!opts.noBalance) setBalances(data);
    return data;
  }
  const play = async (game, body) => {
    // Result arrives before the animation: show the stake taken now, reveal the win when settle() is called.
    const mode = state.mode;
    const d = await api(`/api/play/${game}`, { ...body, mode }, null, { noBalance: true });
    setBalances({ [mode]: d[mode] - d.payout, wagerRemaining: d.wagerRemaining });
    let done = false;
    d.settle = () => { if (!done) { done = true; setBalances(d); } };
    return d;
  };
  const act = (game, action, body = {}) => api(`/api/g/${game}/${action}`, { ...body, mode: state.mode });
  const gameState = (game) => api(`/api/g/${game}/state`);

  /* ---------- Toasts ---------- */
  function toast(msg, kind = "info") {
    let host = $("#toasts");
    if (!host) { host = el("div", { id: "toasts", "aria-live": "polite" }); document.body.append(host); }
    const t = el("div", { class: `toast toast-${kind}` }, msg);
    host.append(t);
    setTimeout(() => t.classList.add("out"), 3200);
    setTimeout(() => t.remove(), 3700);
  }
  const fail = (e) => { if (e && e.status !== 401) toast(e.message || "Something went wrong.", "warn"); };

  /* ---------- Shared controls ---------- */
  function betInput({ label = "Bet amount", value = 1, max: MAX = T.MAX_BET } = {}) {
    const input = el("input", { type: "number", min: String(T.MIN_BET), max: String(MAX), step: "0.01", inputmode: "decimal", class: "bet-input", value: String(value) });
    const clamp = (v) => Math.max(T.MIN_BET, Math.min(MAX, cents(v)));
    const bump = (v) => { input.value = clamp(v).toFixed(2); input.dispatchEvent(new Event("input")); };
    const half = el("button", { type: "button", class: "chip-btn", onclick: () => bump(+input.value / 2) }, "½");
    const dbl = el("button", { type: "button", class: "chip-btn", onclick: () => bump(+input.value * 2) }, "2×");
    const max = el("button", { type: "button", class: "chip-btn", onclick: () => bump(Math.min(balance(), MAX)) }, "Max");
    const wrap = el("label", { class: "field" }, el("span", { class: "field-label" }, label), el("div", { class: "bet-row" }, el("span", { class: "coin-glyph" }, "$"), input, half, dbl, max));
    return {
      el: wrap, input,
      get value() { return cents(input.value); },
      set value(v) { input.value = Number(v).toFixed(2); },
      disable(d) { [input, half, dbl, max].forEach((n) => (n.disabled = d)); },
      destroy() {},
    };
  }
  const field = (labelText, control) => el("label", { class: "field" }, el("span", { class: "field-label" }, labelText), control);
  function segmented(options, value, onChange) {
    const wrap = el("div", { class: "segmented", role: "radiogroup" });
    const render = () => wrap.replaceChildren(...options.map((o) => el("button", { type: "button", role: "radio", "aria-checked": String(o.value === value), class: o.value === value ? "on" : "", onclick: () => { if (wrap.dataset.locked) return; value = o.value; render(); onChange(value); } }, o.label)));
    render();
    return { el: wrap, get value() { return value; }, lock(l) { if (l) wrap.dataset.locked = "1"; else delete wrap.dataset.locked; wrap.classList.toggle("locked", l); } };
  }
  const statRow = (label, valueEl) => el("div", { class: "stat-row" }, el("span", {}, label), valueEl);
  const mfmt = (m) => (m >= 1000 ? Math.round(m).toLocaleString("en-US") : Number(m).toFixed(2)) + "×";

  function frame() {
    const controls = el("div", { class: "gcontrols" });
    const board = el("div", { class: "gboard" });
    const popEl = el("div", { class: "result-pop" }, el("b"), el("small"));
    board.append(popEl);
    let tm;
    return {
      root: el("div", { class: "gframe" }, controls, board), controls, board,
      pop(mult, payout, won) {
        popEl.classList.toggle("lose", !won);
        popEl.querySelector("b").textContent = mfmt(mult);
        popEl.querySelector("small").textContent = won ? fmtUSD(payout, { sign: true }) : "No win";
        popEl.classList.add("show"); clearTimeout(tm); tm = setTimeout(() => popEl.classList.remove("show"), 1600);
      },
      hidePop() { popEl.classList.remove("show"); },
    };
  }

  /* ---------- Cards ---------- */
  let cardQ = 0, cardT = 0;
  function cardSound(i) {
    // one swish per dealt card, spaced out so a full hand sounds like dealing
    const now = performance.now(); const at = Math.max(now, cardT + 90); cardT = at;
    cardQ++; setTimeout(() => { cardQ--; window.CQSound && CQSound.play("card"); }, at - now);
  }
  function cardEl(c, i = 0, extra = "") {
    if (/\bdeal\b/.test(extra) && cardQ < 8) cardSound(i);
    if (!c || c.down) return el("div", { class: `pcard down ${extra}`, style: { "--i": i } }, el("span", { class: "back" }));
    const red = c.s === "♥" || c.s === "♦";
    return el("div", { class: `pcard${red ? " red" : ""} ${extra}`, style: { "--i": i } },
      el("span", { class: "tl" }, c.r, el("br"), c.s), el("span", { class: "mid" }, c.s), el("span", { class: "br" }, c.r, el("br"), c.s));
  }

  /* ---------- Games registry ---------- */
  const games = [];
  const registerGame = (g) => games.push(g);

  window.CQ = { $, $$, el, sleep, T, fmtUSD, cents, state, setBalances, onBalance, balance, api, play, act, gameState, ApiError, toast, fail, betInput, field, segmented, statRow, mfmt, frame, cardEl, games, registerGame };
})();
