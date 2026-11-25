/* CareQuay Casino — shell, lobby, routing */
(() => {
  "use strict";
  const { $, $$, el, wallet, games, fmt, state, COINS } = CQ;

  const CATS = {
    originals: { title: "Crypto games", sub: "Fast CareQuay originals", icon: "⚡" },
    slots: { title: "Slots", sub: "20 original reels", icon: "🎰" },
    tables: { title: "Table games", sub: "Blackjack & roulette", icon: "🃏" },
  };

  let cleanup = null;
  const view = () => $("#view");

  /* ---------- Tiles ---------- */
  function tile(g) {
    return el("a", { class: "tile", href: `#/play/${g.id}`, style: { "--tile-bg": g.art.bg, "--tile-accent": g.art.accent || "#5ee6d2" }, "aria-label": g.name },
      el("span", { class: "tile-glow" }),
      el("span", { class: "tile-emoji", "aria-hidden": "true" }, g.art.emoji),
      g.tag ? el("span", { class: "tile-tag" }, g.tag) : null,
      el("span", { class: "tile-name" }, g.name),
      el("span", { class: "tile-play" }, "Play"));
  }

  function section(cat, list, { limit, filters } = {}) {
    const meta = CATS[cat];
    const grid = el("div", { class: `tile-grid grid-${cat}` });
    const paint = (items) => grid.replaceChildren(...items.slice(0, limit || items.length).map(tile));
    paint(list);
    let chips = null;
    if (filters) {
      const styles = ["All", ...new Set(list.map((g) => g.tag).filter(Boolean))];
      let active = "All";
      chips = el("div", { class: "chips" }, styles.map((s) => el("button", {
        type: "button", class: s === active ? "chip on" : "chip",
        onclick: (e) => { active = s; $$(".chip", chips).forEach((c) => c.classList.toggle("on", c === e.currentTarget)); paint(s === "All" ? list : list.filter((g) => g.tag === s)); },
      }, s)));
    }
    return el("section", { class: "lobby-section" },
      el("div", { class: "section-head" },
        el("div", { class: "section-title" }, el("span", { class: "section-icon" }, meta.icon), el("div", {}, el("h2", {}, meta.title), el("p", {}, meta.sub))),
        limit && list.length > limit ? el("a", { class: "view-all", href: `#/${cat}` }, "View all ›") : null),
      chips, grid);
  }

  function hero() {
    const coins = Object.entries(COINS).map(([k, c]) => el("span", { class: "accept-coin", style: { "--c": c.color } }, el("b", {}, c.glyph), k));
    return el("section", { class: "hero" },
      el("div", { class: "hero-copy" },
        el("p", { class: "hero-kicker" }, "CareQuay crypto casino"),
        el("h1", {}, "Spin. Crash.", el("br"), el("span", {}, "Cash out instantly.")),
        el("div", { class: "hero-cta" },
          el("a", { class: "btn btn-primary", href: "#/originals" }, "Play crypto games"),
          el("a", { class: "btn btn-ghost", href: "#/slots" }, "Browse slots")),
        el("div", { class: "accept" }, el("span", { class: "accept-label" }, "Play with"), coins)),
      el("div", { class: "hero-art", "aria-hidden": "true" },
        el("div", { class: "orb orb-1" }, "₿"), el("div", { class: "orb orb-2" }, "Ł"), el("div", { class: "orb orb-3" }, "Ξ"),
        el("div", { class: "hero-ring r1" }), el("div", { class: "hero-ring r2" }),
        el("div", { class: "hero-logo", html: logoSvg(120) })));
  }

  function historyTable(filterGame) {
    const rows = state.history.filter((h) => !filterGame || h.game === filterGame).slice(0, 12);
    const body = rows.length
      ? rows.map((h) => el("tr", { class: h.payout > 0 ? "won" : "lost" },
          el("td", {}, h.game),
          el("td", {}, new Date(h.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })),
          el("td", { class: "num" }, `${fmt(h.bet, h.coin)} ${h.coin}`),
          el("td", { class: "num" }, `${h.mult.toFixed(2)}×`),
          el("td", { class: "num pay" }, `${h.payout > 0 ? "+" : ""}${fmt(h.payout - h.bet, h.coin)} ${h.coin}`)))
      : [el("tr", {}, el("td", { colspan: "5", class: "empty" }, "No bets yet — pick a game and play."))];
    return el("section", { class: "lobby-section bets" },
      el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, "🧾"), el("div", {}, el("h2", {}, "Your recent bets"), el("p", {}, "Stored in this browser only")))),
      el("div", { class: "table-wrap" }, el("table", { class: "bets-table" },
        el("thead", {}, el("tr", {}, el("th", {}, "Game"), el("th", {}, "Time"), el("th", { class: "num" }, "Bet"), el("th", { class: "num" }, "Multiplier"), el("th", { class: "num" }, "Profit"))),
        el("tbody", {}, body))));
  }

  /* ---------- Views ---------- */
  const byCat = (c) => games.filter((g) => g.cat === c);

  function renderLobby(query = "") {
    const q = query.trim().toLowerCase();
    if (q) {
      const hits = games.filter((g) => g.name.toLowerCase().includes(q) || (g.tag || "").toLowerCase().includes(q));
      view().replaceChildren(el("section", { class: "lobby-section" },
        el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, "🔎"), el("div", {}, el("h2", {}, `Results for “${query}”`), el("p", {}, `${hits.length} game${hits.length === 1 ? "" : "s"}`)))),
        hits.length ? el("div", { class: "tile-grid" }, hits.map(tile)) : el("p", { class: "empty-state" }, "No games match that search.")));
      return;
    }
    view().replaceChildren(
      hero(),
      section("originals", byCat("originals")),
      section("slots", byCat("slots"), { limit: 10 }),
      section("tables", byCat("tables")),
      historyTable());
  }

  function renderCategory(cat) {
    view().replaceChildren(
      el("nav", { class: "crumbs" }, el("a", { href: "#/" }, "Lobby"), el("span", {}, "›"), el("span", {}, CATS[cat].title)),
      section(cat, byCat(cat), { filters: cat === "slots" }));
  }

  function renderGame(id) {
    const g = games.find((x) => x.id === id);
    if (!g) { location.hash = "#/"; return; }
    const stage = el("div", { class: "game-stage" });
    const others = games.filter((x) => x.cat === g.cat && x.id !== g.id).slice(0, 6);
    view().replaceChildren(
      el("nav", { class: "crumbs" }, el("a", { href: "#/" }, "Lobby"), el("span", {}, "›"), el("a", { href: `#/${g.cat}` }, CATS[g.cat].title), el("span", {}, "›"), el("span", {}, g.name)),
      el("div", { class: "game-head" },
        el("span", { class: "game-badge", style: { background: g.art.bg } }, g.art.emoji),
        el("div", {}, el("h1", {}, g.name), el("p", {}, g.blurb || ""))),
      stage,
      g.rules ? el("details", { class: "rules" }, el("summary", {}, "How it works"), el("div", { html: g.rules })) : null,
      el("section", { class: "lobby-section" },
        el("div", { class: "section-head" }, el("div", { class: "section-title" }, el("span", { class: "section-icon" }, CATS[g.cat].icon), el("div", {}, el("h2", {}, "More like this")))),
        el("div", { class: "tile-grid" }, others.map(tile))),
      historyTable(g.name));
    cleanup = g.mount(stage) || null;
  }

  function route() {
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;
    const hash = location.hash.replace(/^#\/?/, "");
    const [page, arg] = hash.split("/");
    $$(".nav-link").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#/${hash}` || (!hash && a.getAttribute("href") === "#/")));
    document.body.classList.remove("nav-open");
    if (page === "play" && arg) renderGame(arg);
    else if (CATS[page]) renderCategory(page);
    else renderLobby($("#search").value);
    window.scrollTo({ top: 0 });
    const g = page === "play" ? games.find((x) => x.id === arg) : null;
    document.title = g ? `${g.name} · CareQuay Casino` : "CareQuay Casino";
  }

  /* ---------- Wallet UI ---------- */
  function paintWallet() {
    const c = COINS[wallet.coin];
    $("#wallet-coin").textContent = c.glyph;
    $("#wallet-coin").style.color = c.color;
    $("#wallet-balance").textContent = fmt(wallet.balance);
    $("#wallet-code").textContent = wallet.coin;
  }

  function openWallet() {
    const list = el("div", { class: "coin-list" }, Object.entries(COINS).map(([k, c]) => el("button", {
      type: "button", class: `coin-row${k === wallet.coin ? " on" : ""}`,
      onclick: () => { wallet.setCoin(k); close(); },
    }, el("span", { class: "coin-dot", style: { background: c.color } }, c.glyph),
      el("span", { class: "coin-name" }, el("b", {}, k), el("small", {}, c.name)),
      el("span", { class: "coin-bal" }, fmt(state.balances[k], k)))));
    const modal = el("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === modal) close(); } },
      el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Wallet" },
        el("div", { class: "modal-head" }, el("h2", {}, "Wallet"), el("button", { type: "button", class: "icon-btn", "aria-label": "Close", onclick: () => close() }, "✕")),
        el("p", { class: "modal-note" }, "Choose the coin you play with. Balances are play coins only and have no cash value."),
        list,
        el("div", { class: "modal-actions" },
          el("button", { type: "button", class: "btn btn-primary", onclick: () => { wallet.topUp(); CQ.toast(`${wallet.coin} play balance topped up.`, "win"); close(); } }, `Top up ${wallet.coin}`),
          el("button", { type: "button", class: "btn btn-ghost", onclick: () => close() }, "Done"))));
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close() { modal.remove(); document.removeEventListener("keydown", onKey); }
    document.addEventListener("keydown", onKey);
    document.body.append(modal);
    $(".coin-row.on", modal)?.focus();
  }

  function logoSvg(size = 34) {
    return `<svg class="cq-mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="cqg${size}" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c8fff6"/><stop offset=".5" stop-color="#5ee6d2"/><stop offset="1" stop-color="#f5c451"/></linearGradient></defs><path d="M23.5 15a9 9 0 1 0 6.4 15.4" fill="none" stroke="#9ff3e6" stroke-width="4" stroke-linecap="round" opacity=".55"/><path class="cq-arc" d="M23.5 5a19 19 0 1 0 12.8 33" fill="none" stroke="url(#cqg${size})" stroke-width="5" stroke-linecap="round"/><path d="m28 28 11 11" fill="none" stroke="url(#cqg${size})" stroke-width="5" stroke-linecap="round"/></svg>`;
  }
  CQ.logoSvg = logoSvg;

  /* ---------- Boot ---------- */
  function boot() {
    $("#brand-mark").innerHTML = logoSvg(34);
    const nav = $("#nav");
    const link = (href, icon, label) => el("a", { class: "nav-link", href }, el("span", { class: "nav-icon" }, icon), el("span", {}, label));
    nav.replaceChildren(
      link("#/", "🏠", "Lobby"),
      el("p", { class: "nav-label" }, "Crypto games"),
      ...byCat("originals").map((g) => link(`#/play/${g.id}`, g.art.emoji, g.name)),
      el("p", { class: "nav-label" }, "Casino"),
      link("#/slots", "🎰", "Slots"),
      ...byCat("tables").map((g) => link(`#/play/${g.id}`, g.art.emoji, g.name)));
    $("#wallet-btn").addEventListener("click", openWallet);
    $("#wallet-pill").addEventListener("click", openWallet);
    $("#menu-btn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    $("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
    let t;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { if (location.hash && location.hash !== "#/") location.hash = "#/"; else renderLobby(e.target.value); }, 120);
    });
    wallet.onChange(paintWallet);
    paintWallet();
    window.addEventListener("hashchange", route);
    route();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
