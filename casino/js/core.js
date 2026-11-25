/* CareQuay Casino — core: wallet, RNG, routing, shared UI. Play money only. */
(() => {
  "use strict";

  const STORE = "cq_casino_v1";
  const COINS = {
    BTC:  { name: "Bitcoin",  dp: 8, start: 0.05,   color: "#f7931a", glyph: "₿" },
    ETH:  { name: "Ethereum", dp: 6, start: 1.5,    color: "#8c8cff", glyph: "Ξ" },
    LTC:  { name: "Litecoin", dp: 4, start: 40,     color: "#b8c4d6", glyph: "Ł" },
    USDT: { name: "Tether",   dp: 2, start: 3000,   color: "#26a17b", glyph: "₮" },
    SOL:  { name: "Solana",   dp: 4, start: 20,     color: "#14f195", glyph: "◎" },
    DOGE: { name: "Dogecoin", dp: 2, start: 20000,  color: "#c2a633", glyph: "Ð" },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) node.style.setProperty(sk, sv); else node.style[sk] = sv; } }
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(kid));
    return node;
  };

  /* ---------- RNG (crypto-grade) ---------- */
  const buf = new Uint32Array(1);
  const rng = {
    float() { crypto.getRandomValues(buf); return buf[0] / 4294967296; },
    int(n) { return Math.floor(rng.float() * n); },
    pick(arr) { return arr[rng.int(arr.length)]; },
    weighted(items, weightKey = "w") {
      const total = items.reduce((s, it) => s + it[weightKey], 0);
      let r = rng.float() * total;
      for (const it of items) { r -= it[weightKey]; if (r < 0) return it; }
      return items[items.length - 1];
    },
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rng.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  };

  /* ---------- Persistent state ---------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s && s.balances) return s;
    } catch { /* ignore */ }
    return null;
  }
  const state = load() || {
    coin: "USDT",
    balances: Object.fromEntries(Object.entries(COINS).map(([k, c]) => [k, c.start])),
    history: [],
    stats: { bets: 0, wagered: {}, won: {} },
  };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } };

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());

  const round = (v, coin) => {
    const f = 10 ** COINS[coin].dp;
    return Math.floor(v * f + 1e-7) / f;
  };
  const fmt = (v, coin = state.coin) => {
    const c = COINS[coin];
    const dp = c.dp;
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: Math.min(dp, 2), maximumFractionDigits: dp });
  };

  const wallet = {
    get coin() { return state.coin; },
    get balance() { return state.balances[state.coin]; },
    info(coin = state.coin) { return COINS[coin]; },
    coins: COINS,
    setCoin(coin) { if (COINS[coin]) { state.coin = coin; save(); emit(); } },
    debit(amount) {
      amount = round(amount, state.coin);
      if (!(amount > 0)) { toast("Enter a bet amount.", "warn"); return false; }
      if (amount > state.balances[state.coin] + 1e-12) { toast("Not enough play coins. Use Top up in the wallet.", "warn"); return false; }
      state.balances[state.coin] = round(state.balances[state.coin] - amount, state.coin);
      save(); emit(); return true;
    },
    credit(amount) {
      if (!(amount > 0)) return;
      state.balances[state.coin] = round(state.balances[state.coin] + amount, state.coin);
      save(); emit();
    },
    topUp(coin = state.coin) {
      state.balances[coin] = Math.max(state.balances[coin], COINS[coin].start);
      save(); emit();
    },
    defaultBet(coin = state.coin) { const v = COINS[coin].start / 300, p = 10 ** Math.floor(Math.log10(v)), m = v / p; return round((m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, coin) || 10 ** -COINS[coin].dp; },
    minBet(coin = state.coin) { return 10 ** -COINS[coin].dp; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  /* ---------- Bet history ---------- */
  function record(game, bet, payout) {
    const coin = state.coin;
    const mult = bet > 0 ? payout / bet : 0;
    state.history.unshift({ t: Date.now(), game, coin, bet, payout, mult });
    state.history = state.history.slice(0, 60);
    state.stats.bets += 1;
    state.stats.wagered[coin] = (state.stats.wagered[coin] || 0) + bet;
    state.stats.won[coin] = (state.stats.won[coin] || 0) + payout;
    save(); emit();
    if (payout > 0 && mult >= 10) toast(`Big win! ${mult.toFixed(2)}× on ${game}`, "win");
  }

  /* ---------- Toasts ---------- */
  function toast(msg, kind = "info") {
    let host = $("#toasts");
    if (!host) { host = el("div", { id: "toasts", "aria-live": "polite" }); document.body.append(host); }
    const t = el("div", { class: `toast toast-${kind}` }, msg);
    host.append(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /* ---------- Shared bet input ---------- */
  function betInput({ label = "Bet amount", value } = {}) {
    const coin = () => state.coin;
    const input = el("input", { type: "number", min: "0", step: "any", inputmode: "decimal", class: "bet-input" });
    const glyph = el("span", { class: "coin-glyph" });
    const paint = () => { const c = COINS[coin()]; glyph.textContent = c.glyph; glyph.style.color = c.color; };
    input.value = value ?? wallet.defaultBet();
    paint();
    const half = el("button", { type: "button", class: "chip-btn", onclick: () => { input.value = Math.max(wallet.minBet(), round(+input.value / 2, coin())); input.dispatchEvent(new Event("input")); } }, "½");
    const dbl = el("button", { type: "button", class: "chip-btn", onclick: () => { input.value = round(Math.min(wallet.balance, (+input.value || 0) * 2), coin()); input.dispatchEvent(new Event("input")); } }, "2×");
    const max = el("button", { type: "button", class: "chip-btn", onclick: () => { input.value = wallet.balance; input.dispatchEvent(new Event("input")); } }, "Max");
    const wrap = el("label", { class: "field" },
      el("span", { class: "field-label" }, label),
      el("div", { class: "bet-row" }, glyph, input, half, dbl, max));
    let lastCoin = coin();
    const off = wallet.onChange(() => { if (coin() !== lastCoin) { lastCoin = coin(); input.value = wallet.defaultBet(); paint(); } });
    return {
      el: wrap, input,
      get value() { return round(+input.value || 0, coin()); },
      set value(v) { input.value = v; },
      disable(d) { [input, half, dbl, max].forEach((n) => (n.disabled = d)); },
      destroy: off,
    };
  }

  function field(labelText, control) {
    return el("label", { class: "field" }, el("span", { class: "field-label" }, labelText), control);
  }

  function segmented(options, value, onChange) {
    const wrap = el("div", { class: "segmented", role: "radiogroup" });
    const render = () => {
      wrap.replaceChildren(...options.map((o) => el("button", {
        type: "button", role: "radio", "aria-checked": String(o.value === value),
        class: o.value === value ? "on" : "", onclick: () => { if (wrap.dataset.locked) return; value = o.value; render(); onChange(value); },
      }, o.label)));
    };
    render();
    return { el: wrap, get value() { return value; }, lock(l) { if (l) wrap.dataset.locked = "1"; else delete wrap.dataset.locked; wrap.classList.toggle("locked", l); } };
  }

  /* ---------- Game registry ---------- */
  const games = [];
  function registerGame(game) { games.push(game); }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.CQ = { $, $$, el, rng, wallet, record, toast, betInput, field, segmented, registerGame, games, fmt, round, sleep, state, COINS };
})();
