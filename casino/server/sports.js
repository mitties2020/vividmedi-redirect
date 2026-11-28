"use strict";
/* Pre-match sportsbook: fixtures and market odds from The Odds API (https://the-odds-api.com).
   Our price = market consensus probability (bookmaker margin removed) plus our own margin.
   Betting is only open before an event starts. */

const BASE = "https://api.the-odds-api.com/v4";
const MIN = 60e3;
const env = (k, d) => (process.env[k] == null || process.env[k] === "" ? d : process.env[k]);

const CFG = {
  key: env("ODDS_API_KEY", ""),
  region: env("ODDS_REGION", "au"),
  ttl: Number(env("ODDS_TTL_MIN", 360)) * MIN,          // refresh a league's odds at most this often
  maxAge: Number(env("ODDS_MAX_AGE_MIN", 1440)) * MIN,  // older odds than this: betting paused for that league
  minCredits: Number(env("ODDS_MIN_CREDITS", 10)),       // keep this many credits in reserve
  margin: Number(env("SPORTS_MARGIN", 0.06)),            // our margin over the fair market price
  cutoff: Number(env("SPORTS_CUTOFF_SEC", 60)) * 1000,   // betting closes this long before the start
  maxStake: Number(env("SPORTS_MAX_STAKE", 500)),
  maxPayout: Number(env("SPORTS_MAX_PAYOUT", 5000)),
  spreads: env("ODDS_SPREADS", "1") !== "0",
  mock: env("ODDS_MOCK", "") === "1" && process.env.NODE_ENV !== "production",
};

const GROUPS = [
  { id: "soccer", title: "Soccer", icon: "⚽" },
  { id: "basketball", title: "Basketball", icon: "🏀" },
  { id: "tennis", title: "Tennis", icon: "🎾" },
  { id: "cricket", title: "Cricket", icon: "🏏" },
];
const SOCCER = ["soccer_epl", "soccer_spain_la_liga", "soccer_italy_serie_a", "soccer_germany_bundesliga", "soccer_france_ligue_one", "soccer_uefa_champs_league", "soccer_australia_aleague"];
const BASKETBALL = ["basketball_nba", "basketball_nbl", "basketball_euroleague"];
const allowList = env("SPORTS_LEAGUES", "") ? env("SPORTS_LEAGUES", "").split(",").map((s) => s.trim()) : null;
function groupOf(key) {
  if (allowList) return allowList.includes(key) ? key.split("_")[0] : null;
  if (SOCCER.includes(key)) return "soccer";
  if (BASKETBALL.includes(key)) return "basketball";
  if (key.startsWith("tennis_")) return "tennis";
  if (key.startsWith("cricket_")) return "cricket";
  return null;
}
const hasSpreads = (key) => CFG.spreads && (key.startsWith("soccer_") || key.startsWith("basketball_"));
const hasScores = (key) => key.startsWith("soccer_") || key.startsWith("basketball_");
const hasDraw = (key) => key.startsWith("soccer_") || key === "cricket_test_match";
const ACTIVE = () => CFG.key || CFG.mock;

class SportsError extends Error { constructor(msg, status = 400, extra) { super(msg); this.status = status; this.extra = extra; } }

module.exports = function createSports(store) {
  const inflight = new Map();
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- Credit budget (free plan: 500 a month) ---------- */
  async function budgetOk(cost) {
    if (CFG.mock) return true;
    const credits = await store.kvGet("odds:credits");
    if (!credits || credits.remaining == null) return true;
    if (credits.remaining - cost < CFG.minCredits) return false;
    const now = new Date();
    const daysLeft = Math.max(1, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - now.getTime()) / 86400e3));
    const allowance = Math.max(cost, Math.floor((credits.remaining - CFG.minCredits) / daysLeft));
    const spend = (await store.kvGet("odds:spend")) || {};
    const spent = spend.day === today() ? spend.used : 0;
    return spent + cost <= allowance;
  }
  async function noteCredits(res) {
    const remaining = Number(res.headers.get("x-requests-remaining"));
    const last = Number(res.headers.get("x-requests-last")) || 0;
    if (Number.isFinite(remaining)) await store.kvSet("odds:credits", { remaining, used: Number(res.headers.get("x-requests-used")) || null, at: new Date().toISOString() });
    const spend = (await store.kvGet("odds:spend")) || {};
    await store.kvSet("odds:spend", { day: today(), used: (spend.day === today() ? spend.used : 0) + last });
  }
  async function call(path, params = {}) {
    const u = new URL(BASE + path);
    u.searchParams.set("apiKey", CFG.key);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(u, { signal: ctl.signal });
      await noteCredits(res).catch(() => {});
      if (!res.ok) throw new Error(`Odds API ${res.status}`);
      return res.json();
    } finally { clearTimeout(t); }
  }
  const once = (key, fn) => { if (inflight.has(key)) return inflight.get(key); const p = fn().finally(() => inflight.delete(key)); inflight.set(key, p); return p; };

  /* ---------- Leagues (the /sports call is free) ---------- */
  async function leagues() {
    if (!ACTIVE()) return [];
    let c = await store.kvGet("odds:sports");
    if (!c || Date.now() - c.at > 3 * 60 * MIN) {
      try {
        const list = CFG.mock ? mock.sports() : await once("sports", () => call("/sports"));
        c = { at: Date.now(), list: list.filter((s) => s.active && !s.has_outrights).map((s) => ({ key: s.key, title: s.title })) };
        await store.kvSet("odds:sports", c);
      } catch (e) { console.error("sports list:", e.message); if (!c) return []; }
    }
    return c.list.map((l) => ({ ...l, group: groupOf(l.key) })).filter((l) => l.group);
  }

  /* ---------- Pricing ---------- */
  const round2 = (x) => Math.floor(x * 100) / 100;
  const ourPrice = (p) => Math.max(1.01, round2(1 / Math.min(0.99, p * (1 + CFG.margin))));
  function fair(books, pick) {
    // pick(book) → { outcomeName: decimalPrice } or null. Remove each book's margin, then average.
    const acc = {}; let n = 0;
    for (const b of books) {
      const o = pick(b); if (!o) continue;
      const inv = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, 1 / v]));
      const tot = Object.values(inv).reduce((s, v) => s + v, 0);
      if (!(tot > 0)) continue;
      for (const [k, v] of Object.entries(inv)) acc[k] = (acc[k] || 0) + v / tot;
      n++;
    }
    if (!n) return null;
    for (const k of Object.keys(acc)) acc[k] /= n;
    return { probs: acc, books: n };
  }
  function priceEvent(e) {
    const books = e.bookmakers || [];
    const mk = (b, key) => (b.markets || []).find((m) => m.key === key);
    const out = { id: e.id, sport_key: e.sport_key, sport_title: e.sport_title, home: e.home_team, away: e.away_team, commence: e.commence_time, markets: {} };
    const h = fair(books, (b) => { const m = mk(b, "h2h"); if (!m || m.outcomes.length < 2) return null; return Object.fromEntries(m.outcomes.map((o) => [o.name, o.price])); });
    if (h) {
      const order = [out.home, "Draw", out.away].filter((n) => h.probs[n] != null);
      out.markets.h2h = order.map((name) => ({ name, price: ourPrice(h.probs[name]), prob: h.probs[name] }));
    }
    // Handicap: use the line most bookmakers offer.
    const lines = {};
    for (const b of books) { const m = mk(b, "spreads"); const ho = m && m.outcomes.find((o) => o.name === out.home); if (ho && m.outcomes.length === 2) (lines[ho.point] = lines[ho.point] || []).push(b); }
    const best = Object.entries(lines).sort((a, b) => b[1].length - a[1].length)[0];
    if (best) {
      const hp = Number(best[0]);
      const s = fair(best[1], (b) => Object.fromEntries(mk(b, "spreads").outcomes.map((o) => [o.name, o.price])));
      if (s && s.probs[out.home] != null && s.probs[out.away] != null)
        out.markets.spreads = [{ name: out.home, point: hp, price: ourPrice(s.probs[out.home]), prob: s.probs[out.home] }, { name: out.away, point: -hp, price: ourPrice(s.probs[out.away]), prob: s.probs[out.away] }];
    }
    return out;
  }

  /* ---------- League odds (cached; refreshed within the credit budget) ---------- */
  async function league(key) {
    const group = groupOf(key);
    if (!group) throw new SportsError("Unknown league.", 404);
    const ck = `odds:${key}`;
    let c = await store.kvGet(ck);
    const age = c ? Date.now() - c.at : Infinity;
    if (age > CFG.ttl) {
      const markets = hasSpreads(key) ? "h2h,spreads" : "h2h";
      const cost = markets.split(",").length;
      if (await budgetOk(cost)) {
        try {
          const raw = CFG.mock ? mock.odds(key) : await once(ck, () => call(`/sports/${key}/odds`, { regions: CFG.region, markets, oddsFormat: "decimal", dateFormat: "iso" }));
          c = { at: Date.now(), events: raw.map(priceEvent).filter((e) => e.markets.h2h) };
          await store.kvSet(ck, c);
        } catch (e) { console.error(`odds ${key}:`, e.message); }
      }
    }
    const now = Date.now();
    const fresh = !!c && now - c.at <= CFG.maxAge;
    const events = (c ? c.events : []).filter((e) => new Date(e.commence).getTime() > now - 6 * 60 * MIN)
      .map((e) => ({ ...e, open: fresh && new Date(e.commence).getTime() - CFG.cutoff > now }))
      .filter((e) => e.open || new Date(e.commence).getTime() > now)
      .sort((a, b) => new Date(a.commence) - new Date(b.commence));
    return { key, group, updatedAt: c ? new Date(c.at).toISOString() : null, paused: !!c && !fresh, events };
  }

  /* ---------- Placing a bet ---------- */
  async function quote({ league: key, eventId, market, selection, point }) {
    const L = await league(String(key || ""));
    const ev = L.events.find((e) => e.id === eventId);
    if (!ev) throw new SportsError("That match is no longer available.", 409);
    if (!ev.open) throw new SportsError(L.paused ? "Betting on this league is paused while odds update. Try again shortly." : "Betting has closed for this match — it's about to start.", 409);
    const m = ev.markets[market];
    if (!m) throw new SportsError("That market isn't available.", 409);
    const o = m.find((x) => x.name === selection && (market !== "spreads" || Number(x.point) === Number(point)));
    if (!o) throw new SportsError("That selection isn't available any more.", 409);
    return { ev, o };
  }

  /* ---------- Settlement ---------- */
  function outcome(bet, r) {
    if (r.void) return { status: "void", mult: 1 };
    if (bet.market === "h2h") {
      let winner = r.winner;
      if (!winner && r.homeScore != null) winner = r.homeScore > r.awayScore ? bet.home : r.awayScore > r.homeScore ? bet.away : "Draw";
      if (!winner) return null;
      if (winner === "Draw" && !hasDraw(bet.sport_key) && bet.selection !== "Draw") return { status: "void", mult: 1 }; // tie in a two-way market
      return bet.selection === winner ? { status: "won", mult: bet.odds } : { status: "lost", mult: 0 };
    }
    if (bet.market === "spreads") {
      if (r.homeScore == null || r.awayScore == null) return null;
      const diff = (bet.selection === bet.home ? r.homeScore - r.awayScore : r.awayScore - r.homeScore) + Number(bet.point);
      return diff > 0 ? { status: "won", mult: bet.odds } : diff === 0 ? { status: "push", mult: 1 } : { status: "lost", mult: 0 };
    }
    return null;
  }
  /** r: { winner?: name|"Draw", homeScore?, awayScore?, void?: true, source } — settles every open bet on the event it can. */
  async function settleEvent(eventId, r, { creditAcct, gameName }) {
    const bets = await store.sports.openForEvent(eventId);
    let settled = 0, skipped = 0;
    for (const b of bets) {
      const oc = outcome(b, r);
      if (!oc) { skipped++; continue; }
      const payout = Math.floor(b.stake * oc.mult);
      await store.tx(b.user_id, async (acct, ops) => {
        const ok = await ops.settleSportsBet(b.id, oc.status, payout, { ...r, at: new Date().toISOString() });
        if (!ok) return;
        if (payout > 0) { creditAcct(acct, b.mode, payout); await ops.ledger({ mode: b.mode, type: "win", amount: payout, game: gameName(b), meta: { sportsBet: b.id, status: oc.status } }); }
        settled++;
      });
    }
    return { settled, skipped };
  }

  async function autoSettle(helpers) {
    if (!ACTIVE()) return;
    const open = await store.sports.open();
    const due = new Map();
    const now = Date.now();
    for (const b of open) {
      if (!hasScores(b.sport_key)) continue;
      const len = b.sport_key.startsWith("soccer_") ? 125 : 160; // minutes until it is usually over
      if (now - b.commence_time.getTime() > len * MIN) due.set(b.sport_key, true);
    }
    for (const key of due.keys()) {
      const sk = `scores:${key}`;
      const last = await store.kvGet(sk);
      if (last && now - last.at < 45 * MIN) continue;
      if (!(await budgetOk(2))) continue;
      await store.kvSet(sk, { at: now });
      let rows;
      try { rows = CFG.mock ? mock.scores(key, open) : await call(`/sports/${key}/scores`, { daysFrom: 3, dateFormat: "iso" }); }
      catch (e) { console.error(`scores ${key}:`, e.message); continue; }
      for (const g of rows) {
        if (!g.completed || !Array.isArray(g.scores)) continue;
        const hs = g.scores.find((s) => s.name === g.home_team), as = g.scores.find((s) => s.name === g.away_team);
        if (!hs || !as) continue;
        await settleEvent(g.id, { homeScore: Number(hs.score), awayScore: Number(as.score), source: "auto" }, helpers);
      }
    }
  }

  async function status() {
    return { enabled: !!ACTIVE(), credits: await store.kvGet("odds:credits"), spend: await store.kvGet("odds:spend"), config: { region: CFG.region, ttlMin: CFG.ttl / MIN, margin: CFG.margin, maxStake: CFG.maxStake, maxPayout: CFG.maxPayout, spreads: CFG.spreads } };
  }

  /* ---------- Local testing only (ODDS_MOCK=1, never in production) ---------- */
  const mock = {
    sports: () => [
      { key: "soccer_epl", title: "EPL", active: true, has_outrights: false },
      { key: "soccer_spain_la_liga", title: "La Liga - Spain", active: true, has_outrights: false },
      { key: "basketball_nba", title: "NBA", active: true, has_outrights: false },
      { key: "tennis_atp_aus_open_singles", title: "ATP Australian Open", active: true, has_outrights: false },
      { key: "cricket_big_bash", title: "Big Bash", active: true, has_outrights: false },
    ],
    odds(key) {
      const teams = { soccer_epl: [["Arsenal", "Chelsea"], ["Liverpool", "Everton"], ["Brentford", "Fulham"]], soccer_spain_la_liga: [["Real Madrid", "Sevilla"]], basketball_nba: [["Boston Celtics", "Miami Heat"], ["LA Lakers", "Denver Nuggets"]], tennis_atp_aus_open_singles: [["Jannik Sinner", "Carlos Alcaraz"]], cricket_big_bash: [["Perth Scorchers", "Sydney Sixers"]] }[key] || [];
      return teams.map(([h, a], i) => {
        const draw = key.startsWith("soccer_");
        const t = new Date(Date.now() + (i === 0 && key === "soccer_epl" ? 30e3 : (i + 1) * 3 * 3600e3)).toISOString();
        const bk = (k, ph, pa, pd) => ({ key: k, markets: [{ key: "h2h", outcomes: [{ name: h, price: ph }, { name: a, price: pa }, ...(draw ? [{ name: "Draw", price: pd }] : [])] }, ...(hasSpreads(key) ? [{ key: "spreads", outcomes: [{ name: h, price: 1.9, point: key.startsWith("basketball") ? -4.5 : -0.5 }, { name: a, price: 1.92, point: key.startsWith("basketball") ? 4.5 : 0.5 }] }] : [])] });
        return { id: `mock-${key}-${i}`, sport_key: key, sport_title: key, commence_time: t, home_team: h, away_team: a, bookmakers: [bk("a", 2.1, 3.4, 3.5), bk("b", 2.05, 3.5, 3.4)] };
      });
    },
    scores: () => [],
  };

  return { CFG, GROUPS, groupOf, leagues, league, quote, settleEvent, autoSettle, status, hasDraw, SportsError };
};
