/* CareQuay Casino — shell, lobby, routing, fun/real picker. */
(() => {
  "use strict";
  const { $, $$, el, api, games, fmtUSD, state, onBalance, fail } = CQ;
  const CATS = {
    sports: { title: "Sports", sub: "Pre-match betting on soccer, basketball, tennis and cricket", icon: "🏟️" },
    originals: { title: "Crypto games", sub: "Fast CareQuay originals", icon: "⚡" },
    slots: { title: "Slots", sub: "Premium video slots", icon: "🎰" },
    tables: { title: "Table games", sub: "Cards and roulette", icon: "🃏" },
  };
  const PAGES = { wallet: "Wallet", bonus: "Bonuses", invite: "Invite friends", faq: "Help & FAQ", terms: "Terms & Conditions", history: "Bet history", admin: "Admin" };
  let cleanup = null;
  const view = () => $("#view");
  const byCat = (c) => games.filter((g) => g.cat === c);

  /* ---------- Tiles ---------- */
  function tileArt(g) {
    if (g.art.sym) return el("span", { class: "tile-sym", html: CQSym.html(g.art.sym, "sym") });
    return el("span", { class: "tile-emoji", "aria-hidden": "true" }, g.art.emoji);
  }
  function tile(g) {
    return el("a", { class: "tile", href: `#/play/${g.id}`, style: { "--tile-bg": g.art.bg, "--tile-accent": g.art.accent || "#5ee6d2" }, "aria-label": g.name },
      el("span", { class: "tile-glow" }), tileArt(g),
      g.tag ? el("span", { class: "tile-tag" }, g.tag) : null,
      el("span", { class: "tile-name" }, g.name),
      el("span", { class: "tile-play" }, "Play"));
  }
  function section(cat, list, { filters } = {}) {
    const m = CATS[cat];
    const grid = el("div", { class: `tile-grid grid-${cat}` });
    const paint = (items) => grid.replaceChildren(...items.map(tile));
    paint(list);
    let chips = null;
    if (filters) {
      const styles = ["All", ...new Set(list.map((g) => g.tag))];
      chips = el("div", { class: "chips" }, styles.map((s) => el("button", { type: "button", class: s === "All" ? "chip on" : "chip", onclick: (e) => { $$(".chip", chips).forEach((c) => c.classList.toggle("on", c === e.currentTarget)); paint(s === "All" ? list : list.filter((g) => g.tag === s)); } }, s)));
    }
    return el("section", { class: "lobby-section" },
      el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, m.icon), el("div", {}, el("h2", {}, m.title), el("p", {}, m.sub))), el("a", { class: "view-all", href: `#/${cat}` }, "View all ›")),
      chips, grid);
  }
  function hero() {
    const coins = ["BTC", "ETH", "LTC", "BNB", "TRX"].map((s) => CQPages.coinIcon(s));
    return el("section", { class: "hero" },
      el("div", { class: "hero-copy" },
        el("p", { class: "hero-kicker" }, el("span", { class: "kyc-badge big" }, "No KYC Casino"), el("span", { class: "kyc-badge big gold" }, "Fast withdrawals"), "CareQuay crypto casino"),
        el("h1", {}, "Bet. Spin. Deal.", el("br"), el("span", {}, "Cash out in crypto.")),
        el("div", { class: "hero-cta" }, el("a", { class: "btn btn-gold", href: "#/wallet" }, "Deposit"), el("a", { class: "btn btn-ghost", href: "#/sports" }, "⚽ Sportsbook"), el("a", { class: "btn btn-tg", href: "https://t.me/carequay", target: "_blank", rel: "noopener" }, "✈️ Telegram"), el("a", { class: "btn btn-ghost", href: "#/bonus" }, "20% weekly cashback")),
        el("div", { class: "accept" }, el("span", { class: "accept-label" }, "We accept"), coins)),
      el("div", { class: "hero-art", "aria-hidden": "true" },
        el("div", { class: "hero-ring r1" }), el("div", { class: "hero-ring r2" }),
        el("div", { class: "hero-sym s1", html: CQSym.html("seven", "sym") }), el("div", { class: "hero-sym s2", html: CQSym.html("cherry", "sym") }), el("div", { class: "hero-sym s3", html: CQSym.html("sapphire", "sym") }),
        el("div", { class: "hero-logo", html: CQ.logo(84, "lgh") })));
  }
  function perks() {
    const items = [
      ["🛡️", "No KYC", "Sign up with just an email"],
      ["💸", "20% cashback", "On weekly net losses, every Sunday"],
            ["⚡", "Fast withdrawals", "Usually processed in under 10 minutes"],
      ["🔒", "Secure RNG", "Results decided on our servers"],
    ];
    return el("section", { class: "perks" }, items.map(([i, t, s]) => el("div", { class: "perk" }, el("span", { class: "perk-icon", "aria-hidden": "true" }, i), el("div", {}, el("b", {}, t), el("small", {}, s)))));
  }
  async function recent() {
    const body = el("tbody", {}, el("tr", {}, el("td", { colspan: "5", class: "empty" }, "Loading…")));
    const sec = el("section", { class: "lobby-section" },
      el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, "🧾"), el("div", {}, el("h2", {}, "Your recent bets"))), el("a", { class: "view-all", href: "#/history" }, "Full history ›")),
      el("div", { class: "table-wrap" }, el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Game"), el("th", {}, "Mode"), el("th", {}, "Time"), el("th", { class: "num" }, "Type"), el("th", { class: "num" }, "Amount"))), body)));
    api("/api/history").then(({ rows }) => {
      const r = rows.filter((x) => x.type === "bet" || x.type === "win").slice(0, 10);
      body.replaceChildren(...(r.length ? r.map((x) => el("tr", { class: x.type === "win" ? "won" : "" }, el("td", {}, x.game || "–"), el("td", {}, el("span", { class: `mode-tag ${x.mode}` }, x.mode)), el("td", {}, new Date(x.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })), el("td", { class: "num" }, x.type === "win" ? "Win" : "Bet"), el("td", { class: "num pay" }, `${x.type === "win" ? "+" : "−"}${fmtUSD(x.amount)}`))) : [el("tr", {}, el("td", { colspan: "5", class: "empty" }, "No bets yet — pick a game and play."))]));
    }).catch(() => {});
    return sec;
  }

  /* ---------- Views ---------- */
  async function renderLobby(q = "") {
    q = q.trim().toLowerCase();
    if (q) {
      const hits = games.filter((g) => g.name.toLowerCase().includes(q) || (g.tag || "").toLowerCase().includes(q));
      view().replaceChildren(el("section", { class: "lobby-section" }, el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, "🔎"), el("div", {}, el("h2", {}, `Results for “${q}”`), el("p", {}, `${hits.length} game${hits.length === 1 ? "" : "s"}`)))), hits.length ? el("div", { class: "tile-grid" }, hits.map(tile)) : el("p", { class: "muted" }, "No games match that search.")));
      return;
    }
    view().replaceChildren(hero(), perks(), section("sports", byCat("sports")), section("tables", byCat("tables")), section("originals", byCat("originals")), section("slots", byCat("slots")), await recent());
  }
  function renderCategory(cat) {
    view().replaceChildren(el("nav", { class: "crumbs" }, el("a", { href: "#/" }, "Lobby"), el("span", {}, "›"), el("span", {}, CATS[cat].title)), section(cat, byCat(cat), { filters: cat === "slots" }));
  }

  /* ---------- Fun / real picker ---------- */
  function pickMode(g) {
    return new Promise((resolve) => {
      const close = (v) => { m.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") close(null); };
      const realOk = state.bal.real >= CQ.T.MIN_BET;
      const realBtn = el("button", { type: "button", class: "mode-btn real" }, el("span", { class: "mode-ico" }, "💰"), el("b", {}, "Play for real"), el("small", {}, realOk ? `Balance ${fmtUSD(state.bal.real)}` : "Deposit crypto to play"));
      const funBtn = el("button", { type: "button", class: "mode-btn fun" }, el("span", { class: "mode-ico" }, "🎮"), el("b", {}, "Play for fun"), el("small", {}, "$1,000 practice balance"));
      const note = el("p", { class: "mode-note" });
      funBtn.addEventListener("click", async () => { funBtn.disabled = true; try { await api("/api/fun", {}); close("fun"); } catch (e) { fail(e); funBtn.disabled = false; } });
      realBtn.addEventListener("click", () => {
        if (state.bal.real >= CQ.T.MIN_BET) return close("real");
        note.replaceChildren("Your real balance is ", el("b", {}, fmtUSD(state.bal.real)), ". Deposit crypto in your wallet to play for real money.", el("br"), el("a", { class: "btn btn-gold", href: "#/wallet", onclick: () => close("wallet") }, "Go to wallet"));
      });
      const m = el("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === m) close(null); } },
        el("div", { class: "modal mode-modal", role: "dialog", "aria-modal": "true", "aria-label": `Play ${g.name}` },
          el("button", { type: "button", class: "icon-btn modal-x", "aria-label": "Close", onclick: () => close(null) }, "✕"),
          el("div", { class: "mode-game", style: { background: g.art.bg } }, tileArt(g)),
          el("h2", {}, g.name),
          el("div", { class: "mode-choices" }, funBtn, realBtn),
          note));
      document.addEventListener("keydown", onKey);
      document.body.append(m);
      funBtn.focus();
    });
  }

  async function renderGame(id, mode) {
    const g = games.find((x) => x.id === id);
    if (!g) { location.hash = "#/"; return; }
    await api("/api/me").catch(() => {});
    if (mode !== "fun" && mode !== "real") {
      const last = sessionStorage.getItem("cq-prev") || "#/";
      const chosen = await pickMode(g);
      if (chosen === "fun" || chosen === "real") location.replace(`#/play/${id}/${chosen}`);
      else if (chosen !== "wallet") location.replace(last);
      return;
    }
    if (mode === "real" && state.bal.real < CQ.T.MIN_BET) { const chosen = await pickMode(g); if (chosen === "fun" || chosen === "real") location.replace(`#/play/${id}/${chosen}`); else if (chosen !== "wallet") location.replace("#/"); return; }
    state.mode = mode;
    document.body.dataset.mode = mode;
    paintBalances();
    const stage = el("div", { class: "game-stage" });
    const others = games.filter((x) => x.cat === g.cat && x.id !== g.id).slice(0, 6);
    view().replaceChildren(
      el("nav", { class: "crumbs" }, el("a", { href: "#/" }, "Lobby"), el("span", {}, "›"), el("a", { href: `#/${g.cat}` }, CATS[g.cat].title), el("span", {}, "›"), el("span", {}, g.name)),
      el("div", { class: "game-head" },
        el("span", { class: "game-badge", style: { background: g.art.bg } }, tileArt(g)),
        el("div", { class: "grow" }, el("h1", {}, g.name), el("p", {}, g.blurb || "")),
        el("div", { class: `mode-switch ${mode}` },
          el("a", { href: `#/play/${id}/fun`, class: mode === "fun" ? "on" : "" }, "Fun"),
          el("a", { href: `#/play/${id}/real`, class: mode === "real" ? "on" : "" }, "Real"))),
      stage,
      g.rules ? el("details", { class: "rules" }, el("summary", {}, "How it works"), el("div", { html: g.rules })) : null,
      others.length ? el("section", { class: "lobby-section" }, el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, CATS[g.cat].icon), el("div", {}, el("h2", {}, "More like this")))), el("div", { class: "tile-grid" }, others.map(tile))) : null);
    cleanup = g.mount(stage) || null;
  }

  async function route() {
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;
    CQ.$$(".modal-backdrop").forEach((m) => m.remove());
    const hash = location.hash.replace(/^#\/?/, "");
    const [page, arg, mode] = hash.split("/");
    if (page !== "play") { state.mode = null; delete document.body.dataset.mode; sessionStorage.setItem("cq-prev", location.hash || "#/"); }
    $$(".nav-link").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#/${page === "play" ? `play/${arg}` : hash}` || (!hash && a.getAttribute("href") === "#/")));
    document.body.classList.remove("nav-open");
    window.scrollTo({ top: 0 });
    paintBalances();
    const g = page === "play" ? games.find((x) => x.id === arg) : null;
    document.title = g ? `${g.name} · CareQuay Casino` : PAGES[page] ? `${PAGES[page]} · CareQuay Casino` : "CareQuay Casino";
    try {
      if (page === "play" && arg) await renderGame(arg, mode);
      else if (CATS[page]) renderCategory(page);
      else if (PAGES[page]) { api("/api/me").catch(() => {}); cleanup = (await CQPages[page](view())) || null; }
      else renderLobby($("#search").value);
    } catch (e) { console.error(e); fail(e); }
  }

  /* ---------- Header balances ---------- */
  function paintBalances() {
    const b = state.bal;
    $("#bal-real").textContent = fmtUSD(b.real);
    $("#bal-fun").textContent = fmtUSD(b.fun);
    $("#pill-real").classList.toggle("on", state.mode === "real");
    $("#pill-fun").classList.toggle("on", state.mode === "fun");
    $("#pill-fun").hidden = state.mode !== "fun";
  }

  /* ---------- Boot ---------- */
  async function boot() {
    CQSym.inject();
    let me;
    try { me = await api("/api/me"); }
    catch (e) { if (e.status !== 401) { document.body.innerHTML = `<p style="padding:30px;color:#fff">${e.message}</p>`; } else CQAuth.show(); return; }
    if (new URLSearchParams(location.search).get("reset")) { CQAuth.show(); return; }
    state.me = me;
    document.body.classList.remove("signed-out");
    $("#auth").hidden = true; $("#app").hidden = false;
    $("#brand-mark").innerHTML = CQ.logo(34, "lgb");
    $("#user-email").textContent = me.email;
    $("#foot-coins").replaceChildren(...["BTC", "ETH", "LTC", "BNB", "TRX"].map((c) => CQPages.coinIcon(c)));
    const nav = $("#nav");
    const link = (href, icon, label) => el("a", { class: "nav-link", href }, el("span", { class: "nav-icon" }, icon), el("span", {}, label));
    nav.replaceChildren(
      link("#/", "🏠", "Lobby"),
      el("p", { class: "nav-label" }, "Sports"),
      ...byCat("sports").map((g) => link(`#/play/${g.id}`, g.navIcon, g.name)),
      el("p", { class: "nav-label" }, "Casino"),
      link("#/slots", "🎰", "Slots"),
      ...byCat("tables").map((g) => link(`#/play/${g.id}`, g.navIcon || "🃏", g.name)),
      el("p", { class: "nav-label" }, "Crypto games"),
      ...byCat("originals").map((g) => link(`#/play/${g.id}`, g.art.emoji, g.name)),
      el("p", { class: "nav-label" }, "Account"),
      link("#/wallet", "👛", "Wallet"),
      link("#/bonus", "🎁", "Bonuses"),
      link("#/invite", "🤝", "Invite friends"),
      link("#/history", "🧾", "Bet history"),
      link("#/faq", "❓", "Help & FAQ"),
      link("#/terms", "📜", "Terms & Conditions"),
      el("button", { type: "button", class: "nav-link nav-logout", onclick: () => logout() }, el("span", { class: "nav-icon" }, "⎋"), el("span", {}, "Log out")));
    const logout = async () => { try { await api("/api/auth/logout", {}); } catch { /* ignore */ } location.replace("/"); };
    $("#logout").addEventListener("click", logout);
    $("#menu-btn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    $("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
    let t;
    $("#search").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { if (location.hash && location.hash !== "#/") location.hash = "#/"; else renderLobby(e.target.value); }, 150); });
    onBalance(paintBalances);
    window.addEventListener("hashchange", route);
    setInterval(() => { if (!state.mode) api("/api/me").catch(() => {}); }, 60000);
    route();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
