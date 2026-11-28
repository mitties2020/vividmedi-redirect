/* CareQuay Casino — pre-match sportsbook UI. Odds, bet acceptance and settlement all happen on the server. */
(() => {
  "use strict";
  const { el, api, registerGame, fmtUSD, state, toast, fail, betInput } = CQ;
  const SPORTS = [
    { id: "soccer", name: "Soccer", emoji: "⚽", bg: "linear-gradient(160deg,#4be38f,#118a47 52%,#04230f)", accent: "#b6ffd2", draw: true },
    { id: "basketball", name: "Basketball", emoji: "🏀", bg: "linear-gradient(160deg,#ffb36b,#e2561b 52%,#3a1100)", accent: "#ffe0b3" },
    { id: "tennis", name: "Tennis", emoji: "🎾", bg: "linear-gradient(160deg,#e6ff6b,#4fae2a 52%,#0d2a06)", accent: "#f4ffc2" },
    { id: "cricket", name: "Cricket", emoji: "🏏", bg: "linear-gradient(160deg,#7fc8ff,#1f5fd1 52%,#071a45)", accent: "#d2ecff" },
  ];
  const RULES = {
    common: "<p><b>Pre-match only.</b> Betting on a match closes just before it starts; there is no in-play betting. Odds are based on the live betting market with a small margin, and the percentage under each price is the market's estimated chance. The price you see when you place a bet is locked in — if it moves before you confirm, you'll be asked to accept the new price. Maximum stake $500 and maximum return $5,000 per bet.</p><p><b>Handicap</b> bets add the handicap to your team's score: −1.5 means your team must win by 2 or more; +1.5 means your team wins if it wins, draws or loses by 1. Whole-number handicaps that end level are refunded.</p><p>If a match is abandoned, postponed or not completed, bets are void and stakes are refunded.</p>",
    soccer: "<p><b>Soccer</b> bets are settled on the result after 90 minutes plus stoppage time. Extra time and penalties don't count.</p>",
    basketball: "<p><b>Basketball</b> bets include overtime.</p>",
    tennis: "<p><b>Tennis</b> bets are on the match winner. If a player retires or is disqualified before the match is completed, bets are void.</p>",
    cricket: "<p><b>Cricket</b> bets are settled on the official result. In matches with no draw price, a tie or no result is void.</p>",
  };

  let meta = null, metaAt = 0;
  async function loadMeta() { if (!meta || Date.now() - metaAt > 5 * 60e3) { meta = await api("/api/sports", null, null, { noBalance: true }); metaAt = Date.now(); } return meta; }

  const time = (d) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function dayLabel(d) {
    const t = new Date(d), now = new Date(), tm = new Date(now); tm.setDate(now.getDate() + 1);
    if (t.toDateString() === now.toDateString()) return "Today";
    if (t.toDateString() === tm.toDateString()) return "Tomorrow";
    return t.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  }
  function startsIn(d) {
    const ms = new Date(d) - Date.now();
    if (ms <= 0) return "Started";
    const m = Math.floor(ms / 60e3), h = Math.floor(m / 60);
    if (h >= 24) return null;
    return h ? `in ${h}h ${m % 60}m` : m < 1 ? "Starting" : `in ${m}m`;
  }
  const ago = (iso) => { if (!iso) return "never"; const m = Math.round((Date.now() - new Date(iso)) / 60e3); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
  const fmtPoint = (p) => (p > 0 ? `+${p}` : `${p}`);
  function hcapHint(p) {
    if (p === 0) return "Draw = refund";
    const a = Math.abs(p), whole = Number.isInteger(p);
    if (p < 0) return whole ? `Win by ${a + 1}+ · refund at ${a}` : `Win by ${Math.ceil(a)}+`;
    if (whole) return `Lose by ${a - 1} or less · refund at ${a}`;
    const f = Math.floor(a);
    return f === 0 ? "Win or draw" : `Lose by ${f} or less`;
  }
  const selLabel = (s) => (s.market === "spreads" ? `${s.selection} ${fmtPoint(s.point)}` : s.selection === "Draw" ? "Draw" : `${s.selection} to win`);
  const marketName = (m) => (m === "spreads" ? "Handicap" : "Match result");

  function mount(sport, stage) {
    let alive = true, league = null, data = null, slip = null, tab = "slip", bets = [], timer = 0;
    const chips = el("div", { class: "chips sb-leagues" });
    const info = el("div", { class: "sb-info" });
    const list = el("div", { class: "sb-events" }, el("div", { class: "sb-empty" }, el("span", { class: "spinner" }), "Loading matches…"));
    const slipBody = el("div", { class: "sb-slip-body" });
    const tabs = el("div", { class: "segmented sb-tabs" });
    const slipEl = el("aside", { class: "sb-slip" }, tabs, slipBody);
    const fab = el("button", { type: "button", class: "sb-fab", hidden: true, onclick: () => slipEl.scrollIntoView({ behavior: "smooth", block: "start" }) });
    stage.append(fab);
    const io = new IntersectionObserver(([e]) => fab.classList.toggle("away", e.isIntersecting), { threshold: 0.25 }); io.observe(slipEl);
    stage.append(el("div", { class: "sb", style: { "--accent": sport.accent } }, el("div", { class: "sb-main" }, chips, info, list), slipEl));

    /* ---------- Bet slip / My bets ---------- */
    function paintTabs() {
      const open = bets.filter((b) => b.status === "open").length;
      tabs.replaceChildren(
        el("button", { type: "button", class: tab === "slip" ? "on" : "", onclick: () => { tab = "slip"; paintSlip(); } }, "Bet slip", slip ? el("span", { class: "sb-count" }, "1") : null),
        el("button", { type: "button", class: tab === "mine" ? "on" : "", onclick: () => { tab = "mine"; paintSlip(); loadBets(); } }, "My bets", open ? el("span", { class: "sb-count" }, String(open)) : null));
    }
    function paintFab() {
      const open = bets.filter((b) => b.status === "open").length;
      fab.hidden = !slip && !open;
      fab.replaceChildren(el("span", {}, "🎟️"), slip ? el("b", {}, `${selLabel(slip)} @ ${slip.odds.toFixed(2)}`) : el("b", {}, `My bets · ${open} open`), el("span", { class: "sb-fab-go" }, slip ? "Bet slip ›" : "View ›"));
    }
    function paintSlip() {
      paintTabs(); paintFab();
      if (tab === "mine") return paintBets();
      if (!slip) {
        slipBody.replaceChildren(el("div", { class: "sb-slip-empty" }, el("span", { class: "sb-slip-ico" }, "🎟️"), el("b", {}, "Your bet slip is empty"), el("p", {}, "Tap any price to add a selection.")));
        return;
      }
      const stake = betInput({ label: "Stake", value: slip.stake || 10 });
      const ret = el("b", { class: "sb-return" });
      const btn = el("button", { type: "button", class: "btn btn-gold btn-lg btn-block sb-place" });
      const upd = () => { slip.stake = stake.value; ret.textContent = fmtUSD(Math.floor(stake.value * slip.odds * 100) / 100); btn.textContent = `Place bet · ${fmtUSD(stake.value)}`; };
      stake.input.addEventListener("input", upd);
      const quick = el("div", { class: "sb-quick" }, [5, 10, 25, 50, 100].map((v) => el("button", { type: "button", class: "chip-btn", onclick: () => { stake.value = v; upd(); } }, `$${v}`)));
      btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Placing…";
        try {
          await api("/api/sports/bet", { mode: state.mode, league: slip.league, eventId: slip.eventId, market: slip.market, selection: slip.selection, point: slip.point, odds: slip.odds, stake: stake.value });
          toast(`Bet placed: ${selLabel(slip)} @ ${slip.odds.toFixed(2)}`, "win");
          slip = null; tab = "mine"; paintEvents(); paintSlip(); loadBets();
          return;
        } catch (e) {
          if (e.status === 409 && e.data && e.data.odds) { slip.odds = e.data.odds; slip.pct = e.data.pct; toast(e.message, "warn"); paintSlip(); return; }
          fail(e); if (e.status === 409) { load(true); }
        }
        btn.disabled = false; upd();
      });
      slipBody.replaceChildren(
        el("div", { class: "sb-pick" },
          el("button", { type: "button", class: "icon-btn sb-x", "aria-label": "Remove selection", onclick: () => { slip = null; paintEvents(); paintSlip(); } }, "✕"),
          el("small", {}, `${slip.leagueTitle} · ${marketName(slip.market)}`),
          el("b", { class: "sb-pick-sel" }, selLabel(slip)),
          el("span", { class: "sb-pick-ev" }, `${slip.home} v ${slip.away}`),
          el("span", { class: "sb-pick-time" }, `${dayLabel(slip.commence)} · ${time(slip.commence)}`),
          el("div", { class: "sb-pick-odds" }, el("span", {}, slip.odds.toFixed(2)), el("small", {}, `${slip.pct}% chance`))),
        stake.el, quick,
        el("div", { class: "sb-ret-row" }, el("span", {}, "Potential return"), ret),
        btn,
        el("p", { class: "sb-mode-note" }, `Using your ${state.mode === "real" ? "real" : "fun"} balance · ${fmtUSD(CQ.balance())} available`));
      upd();
    }
    const STATUS = { open: "Open", won: "Won", lost: "Lost", push: "Refunded", void: "Void" };
    function paintBets() {
      if (!bets.length) { slipBody.replaceChildren(el("div", { class: "sb-slip-empty" }, el("span", { class: "sb-slip-ico" }, "📋"), el("b", {}, "No bets yet"), el("p", {}, "Bets you place show here until they're settled."))); return; }
      slipBody.replaceChildren(el("div", { class: "sb-mybets" }, bets.map((b) => el("div", { class: `sb-bet st-${b.status}` },
        el("div", { class: "sb-bet-top" }, el("span", { class: `sb-st st-${b.status}` }, STATUS[b.status] || b.status), el("span", { class: `mode-tag ${b.mode}` }, b.mode)),
        el("b", {}, selLabel(b), " @ ", b.odds.toFixed(2)),
        el("span", { class: "sb-bet-ev" }, `${b.home} v ${b.away}`),
        el("span", { class: "sb-bet-meta" }, b.result && b.result.homeScore != null ? `Final ${b.result.homeScore}–${b.result.awayScore}` : `${dayLabel(b.commence)} · ${time(b.commence)}`),
        el("div", { class: "sb-bet-money" }, el("span", {}, `Stake ${fmtUSD(b.stake)}`), el("span", {}, b.status === "open" ? `Returns ${fmtUSD(b.potential)}` : `Paid ${fmtUSD(b.payout)}`))))));
    }
    async function loadBets() {
      try { const r = await api("/api/sports/bets", null, null, { noBalance: true }); if (!alive) return; bets = r.bets; if (tab === "mine") paintBets(); paintTabs(); paintFab(); } catch (e) { fail(e); }
    }

    /* ---------- Events ---------- */
    function pick(ev, market, o) {
      if (!ev.open) return;
      const same = slip && slip.eventId === ev.id && slip.market === market && slip.selection === o.name;
      slip = same ? null : { league: league.key, leagueTitle: league.title, eventId: ev.id, home: ev.home, away: ev.away, commence: ev.commence, market, selection: o.name, point: o.point, odds: o.price, pct: o.pct, stake: slip && slip.stake };
      tab = "slip"; paintEvents(); paintSlip();
      if (slip && window.innerWidth < 980) slipEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function oddsBtn(ev, market, o, label, hint) {
      const on = slip && slip.eventId === ev.id && slip.market === market && slip.selection === o.name;
      return el("button", { type: "button", class: `odds-btn${on ? " on" : ""}`, disabled: !ev.open, onclick: () => pick(ev, market, o), "aria-pressed": String(!!on) },
        el("span", { class: "ob-label" }, label), el("b", { class: "ob-price" }, o.price.toFixed(2)), el("small", { class: "ob-pct" }, hint || `${o.pct}%`));
    }
    function eventCard(ev) {
      const h2h = ev.markets.h2h || [], sp = ev.markets.spreads;
      const soon = startsIn(ev.commence);
      return el("article", { class: `sb-event${ev.open ? "" : " closed"}` },
        el("div", { class: "sb-ev-head" },
          el("span", { class: "sb-ev-time" }, time(ev.commence)),
          soon ? el("span", { class: "sb-ev-soon" }, soon) : null,
          ev.open ? null : el("span", { class: "sb-ev-closed" }, "Betting closed")),
        el("div", { class: "sb-teams" }, el("b", {}, ev.home), el("span", { class: "sb-v" }, "v"), el("b", {}, ev.away)),
        el("div", { class: "sb-market" }, el("span", { class: "sb-mk-name" }, "Match result"),
          el("div", { class: `sb-odds n${h2h.length}` }, h2h.map((o) => oddsBtn(ev, "h2h", o, o.name === "Draw" ? "Draw" : o.name === ev.home ? "Home" : "Away")))),
        sp ? el("div", { class: "sb-market" }, el("span", { class: "sb-mk-name" }, "Handicap"),
          el("div", { class: "sb-odds n2" }, sp.map((o) => oddsBtn(ev, "spreads", o, `${o.name === ev.home ? "Home" : "Away"} ${fmtPoint(o.point)}`, hcapHint(o.point))))) : null);
    }
    function paintEvents() {
      if (!data) return;
      if (!data.events.length) { list.replaceChildren(el("div", { class: "sb-empty" }, el("b", {}, "No upcoming matches in this league right now."), el("span", {}, "Try another league or check back later."))); return; }
      const groups = new Map();
      for (const ev of data.events) { const k = dayLabel(ev.commence); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(ev); }
      list.replaceChildren(...[...groups].map(([day, evs]) => el("section", { class: "sb-day" }, el("h3", {}, day), el("div", { class: "sb-grid" }, evs.map(eventCard)))));
    }
    function paintInfo() {
      info.replaceChildren(...[
        el("span", { class: "sb-live-dot" }), el("span", {}, "Pre-match only"),
        el("span", { class: "sb-sep" }, "·"),
        el("span", {}, data && data.updatedAt ? `Odds updated ${ago(data.updatedAt)}` : "Odds loading"),
        data && data.paused ? el("span", { class: "sb-paused" }, "Betting paused while odds refresh") : null].filter(Boolean));
    }
    async function load(silent) {
      if (!league) return;
      if (!silent) list.replaceChildren(el("div", { class: "sb-empty" }, el("span", { class: "spinner" }), `Loading ${league.title}…`));
      try {
        const r = await api(`/api/sports/league/${encodeURIComponent(league.key)}`, null, null, { noBalance: true });
        if (!alive || r.key !== league.key) return;
        data = r;
        if (slip && slip.league === league.key) {
          const ev = r.events.find((e) => e.id === slip.eventId); const o = ev && ev.open && (ev.markets[slip.market] || []).find((x) => x.name === slip.selection && (slip.market !== "spreads" || x.point === slip.point));
          if (!o) { slip = null; toast("Your selection is no longer available.", "warn"); paintSlip(); } else if (o.price !== slip.odds) { slip.odds = o.price; slip.pct = o.pct; paintSlip(); }
        }
        paintInfo(); paintEvents();
      } catch (e) { if (!silent) list.replaceChildren(el("div", { class: "sb-empty" }, el("b", {}, "Couldn't load matches."), el("span", {}, e.message))); }
    }
    function paintChips(ls) {
      chips.replaceChildren(...ls.map((l) => el("button", { type: "button", class: `chip${league && l.key === league.key ? " on" : ""}`, onclick: () => { if (league && l.key === league.key) return; league = l; try { sessionStorage.setItem(`cq-league-${sport.id}`, l.key); } catch { /* ignore */ } data = null; paintChips(ls); load(); } }, l.title)));
    }

    (async () => {
      try {
        const m = await loadMeta();
        if (!alive) return;
        const ls = (m.groups.find((g) => g.id === sport.id) || { leagues: [] }).leagues;
        if (!m.enabled || !ls.length) {
          list.replaceChildren(el("div", { class: "sb-empty big" }, el("span", { class: "sb-empty-ico" }, sport.emoji), el("b", {}, `No ${sport.name.toLowerCase()} matches are open for betting right now.`), el("span", {}, sport.id === "tennis" ? "Tennis returns when the next tournament starts. Check back soon." : "Check back soon — new fixtures are added as the markets open.")));
          info.replaceChildren(); return;
        }
        let saved = null; try { saved = sessionStorage.getItem(`cq-league-${sport.id}`); } catch { /* ignore */ }
        league = ls.find((l) => l.key === saved) || ls[0];
        paintChips(ls); paintInfo(); load();
      } catch (e) { fail(e); }
    })();
    paintSlip(); loadBets();
    timer = setInterval(() => { if (document.hidden) return; load(true); loadBets(); }, 60e3);
    const clock = setInterval(() => { if (!document.hidden && data) { paintInfo(); paintEvents(); } }, 30e3);
    return () => { alive = false; io.disconnect(); clearInterval(timer); clearInterval(clock); };
  }

  for (const s of SPORTS) {
    registerGame({
      id: `sports-${s.id}`, name: s.name, cat: "sports", tag: "Pre-match",
      art: { emoji: s.emoji, bg: s.bg, accent: s.accent },
      navIcon: s.emoji,
      blurb: `Pre-match ${s.name.toLowerCase()} betting: ${s.draw ? "win, draw or lose" : "match winner"}${s.id === "soccer" || s.id === "basketball" ? " and handicap margins" : ""}.`,
      rules: RULES.common + RULES[s.id],
      mount: (stage) => mount(s, stage),
    });
  }
})();
