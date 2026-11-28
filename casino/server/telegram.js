"use strict";
/* Telegram: a channel auto-poster (fixtures, big wins, cashback reminders) and a helper bot for players.
   Turned on by TELEGRAM_BOT_TOKEN. Posts only to the operator's own channel (TELEGRAM_CHANNEL). */
const crypto = require("crypto");
const S = require("./support");

const env = (k, d) => (process.env[k] == null || process.env[k] === "" ? d : process.env[k]);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const money = (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FOOTER = "\n\n<i>18+ · Not available in Australia or other restricted countries · Play responsibly</i>";
const LEAGUE_PAGES = { soccer_epl: "/sports/soccer/epl", soccer_spain_la_liga: "/sports/soccer/la-liga", soccer_italy_serie_a: "/sports/soccer/serie-a", soccer_germany_bundesliga: "/sports/soccer/bundesliga", soccer_france_ligue_one: "/sports/soccer/ligue-1", soccer_uefa_champs_league: "/sports/soccer/champions-league", soccer_australia_aleague: "/sports/soccer/a-league", basketball_nba: "/sports/basketball/nba", basketball_nbl: "/sports/basketball/nbl", basketball_euroleague: "/sports/basketball/euroleague", cricket_big_bash: "/sports/cricket/big-bash", cricket_test_match: "/sports/cricket/test-matches", cricket_odi: "/sports/cricket/odi", cricket_international_t20: "/sports/cricket/t20-internationals" };
const EMOJI = { soccer: "⚽", basketball: "🏀", tennis: "🎾", cricket: "🏏" };

module.exports = function createTelegram({ store, SP }) {
  const TOKEN = env("TELEGRAM_BOT_TOKEN", "");
  const CHANNEL = env("TELEGRAM_CHANNEL", "");
  const SITE = () => env("SITE_URL", "").replace(/\/$/, "");
  const SECRET = TOKEN ? crypto.createHash("sha256").update("cq-tg:" + TOKEN).digest("hex").slice(0, 48) : "";
  const POST_HOURS = env("TG_POST_HOURS", "1,11").split(",").map(Number).filter((h) => h >= 0 && h < 24); // UTC; 1 & 11 = 9am & 7pm Perth
  const BIG_X = Number(env("TG_BIG_WIN_X", 20)), BIG_MIN = Number(env("TG_BIG_WIN_MIN", 25));
  let botName = null;
  const on = () => !!TOKEN;

  async function call(method, params) {
    if (!TOKEN) return null;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}), signal: ctl.signal });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
      return j.result;
    } finally { clearTimeout(t); }
  }
  const send = (chat, text, extra = {}) => call("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }).catch((e) => console.error("telegram:", e.message));
  const btn = (text, url) => ({ text, url });
  const kb = (...rows) => ({ reply_markup: { inline_keyboard: rows } });

  async function init() {
    if (!on()) return;
    try {
      const me = await call("getMe"); botName = me.username;
      if (SITE().startsWith("https://")) {
        await call("setWebhook", { url: `${SITE()}/api/telegram/webhook`, secret_token: SECRET, allowed_updates: ["message"], drop_pending_updates: false });
        await call("setMyCommands", { commands: [
          { command: "odds", description: "Today's top matches and odds" },
          { command: "cashback", description: "Your 20% weekly cashback" },
          { command: "invite", description: "Your invite link and earnings" },
          { command: "balance", description: "Your balances (linked account)" },
          { command: "deposit", description: "How to deposit crypto" },
          { command: "help", description: "What I can do" },
        ] });
      }
      console.log(`Telegram bot @${botName} ready${CHANNEL ? `, channel ${CHANNEL}` : ""}`);
    } catch (e) { console.error("telegram init:", e.message); }
  }

  /* ---------------- Content from the site's own data ---------------- */
  async function upcoming(hours = 30, max = 8) {
    const ls = await SP.leagues().catch(() => []);
    const now = Date.now(), until = now + hours * 3600e3, evs = [];
    for (const l of ls) {
      const c = await store.kvGet(`odds:${l.key}`);
      if (!c) continue;
      for (const e of c.events) { const t = new Date(e.commence).getTime(); if (t > now + 5 * 60e3 && t < until && e.markets.h2h) evs.push({ ...e, group: l.group, league: l.title }); }
    }
    // Prefer matches where the market is closest (most interesting), then soonest.
    const tight = (e) => { const p = e.markets.h2h.map((o) => o.prob).sort((a, b) => b - a); return p[0] - (p[1] || 0); };
    return evs.sort((a, b) => tight(a) - tight(b)).slice(0, max).sort((a, b) => new Date(a.commence) - new Date(b.commence));
  }
  async function refreshTopLeagues() {
    // Refresh a couple of headline leagues before a post (stays inside the odds credit budget).
    const ls = (await SP.leagues().catch(() => [])).map((l) => l.key);
    for (const k of ["soccer_epl", "basketball_nba", "soccer_uefa_champs_league", "cricket_big_bash"].filter((k) => ls.includes(k)).slice(0, 3)) await SP.league(k).catch(() => {});
  }
  function fixturesText(evs, title) {
    if (!evs.length) return null;
    const lines = evs.map((e) => {
      const t = new Date(e.commence).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
      const odds = e.markets.h2h.map((o) => `${o.name === "Draw" ? "Draw" : esc(o.name)} <b>${o.price.toFixed(2)}</b>`).join(" · ");
      const page = LEAGUE_PAGES[e.sport_key] ? `${SITE()}${LEAGUE_PAGES[e.sport_key]}` : `${SITE()}/sports/${e.group}`;
      return `${EMOJI[e.group] || "🏟"} <b>${esc(e.home)} v ${esc(e.away)}</b>\n<i>${esc(e.league)} · ${t} UTC</i>\n${odds} — <a href="${page}">bet</a>`;
    });
    return `🗓 <b>${title}</b>\n\n${lines.join("\n\n")}\n\nPre-match odds · 20% weekly cashback on losses${FOOTER}`;
  }

  /* ---------------- Channel scheduler ---------------- */
  async function tick() {
    if (!on() || !CHANNEL) return;
    const now = new Date(), day = now.toISOString().slice(0, 10), h = now.getUTCHours();
    for (const ph of POST_HOURS) {
      if (h < ph || h > ph + 2) continue; // post within 2 hours of the slot (the free server may be asleep at the exact time)
      const key = `tg:post:${day}:${ph}`;
      if (await store.kvGet(key)) continue;
      await store.kvSet(key, { at: now.toISOString() });
      await refreshTopLeagues();
      const text = fixturesText(await upcoming(30, 8), ph === POST_HOURS[0] ? "Today's top matches" : "Tonight's top matches");
      if (text) await send(CHANNEL, text, kb([btn("⚽ Open the sportsbook", `${SITE()}/sports`)], [btn("🎁 Sign up free", `${SITE()}/signup`)]));
    }
    // Sunday cashback reminder, 2 hours before the 22:00 UTC payout
    if (now.getUTCDay() === 0 && h === 20) {
      const key = `tg:cashback:${day}`;
      if (!(await store.kvGet(key))) {
        await store.kvSet(key, { at: now.toISOString() });
        await send(CHANNEL, `💸 <b>Cashback lands in 2 hours</b>\n\nEvery Sunday at 22:00 UTC we pay back <b>20%</b> of your net real-money losses for the week — straight to your real balance, no wagering.\n\nStill time to get your bets on.${FOOTER}`, kb([btn("See how cashback works", `${SITE()}/bonus/cashback`)]));
      }
    }
  }

  let lastBig = 0;
  async function bigWin({ game, stake, payout, mode }) {
    if (!on() || !CHANNEL || mode !== "real") return;
    const x = stake > 0 ? payout / stake : 0;
    if (payout < BIG_MIN || x < BIG_X || Date.now() - lastBig < 30 * 60e3) return;
    lastBig = Date.now();
    await send(CHANNEL, `🔥 <b>Big win on ${esc(game)}</b>\n\nA player just turned <b>${money(stake)}</b> into <b>${money(payout)}</b> (${x.toFixed(1)}×).${FOOTER}`, kb([btn("Play now", `${SITE()}/casino`)]));
  }

  /* ---------------- Notifications to linked players ---------------- */
  async function notify(userId, text) {
    if (!on()) return;
    const u = await store.users.byId(userId).catch(() => null);
    if (u && u.telegram_chat_id) await send(u.telegram_chat_id, text);
  }

  /* ---------------- Helper bot (direct messages) ---------------- */
  const startText = () => `👋 <b>Welcome to CareQuay</b> — no-KYC crypto casino & pre-match sportsbook.\n\n• 20% cashback on weekly losses\n• Withdrawals usually in under 10 minutes\n• BTC, ETH, LTC, BNB and TRON\n\nCommands:\n/odds — today's top matches\n/cashback — weekly cashback\n/invite — your invite link (earn 10%)\n/balance — your balances\n/deposit — how to deposit\n\nTo get bet and withdrawal alerts here, open <b>Invite friends</b> on the site and tap <b>Connect Telegram</b>.${FOOTER}`;
  const linkHint = () => `🔗 First connect your account: log in at ${SITE()}, open <b>Invite friends</b> and tap <b>Connect Telegram</b>.`;

  async function onMessage(m) {
    const chat = m.chat && m.chat.id;
    if (!chat || m.chat.type !== "private" || typeof m.text !== "string") return;
    const [cmdRaw, ...args] = m.text.trim().split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, "");
    const user = await store.users.byTelegram(chat).catch(() => null);
    switch (cmd) {
      case "/start": {
        const p = args[0] || "";
        if (p.startsWith("link_")) {
          const uid = await store.tokens.take(S.sha(p.slice(5)), "tglink");
          if (!uid) return send(chat, "That connect link has expired. Open <b>Invite friends</b> on the site and tap <b>Connect Telegram</b> again.");
          await store.users.setTelegram(uid, chat);
          const u = await store.users.byId(uid);
          return send(chat, `✅ Connected to <b>${esc(u.email)}</b>.\n\nYou'll get a message here when a sports bet settles, a deposit is credited, a withdrawal is paid or you earn from referrals. Send /balance any time.`);
        }
        return send(chat, startText(), kb([btn("🎰 Open CareQuay", `${SITE()}/`)], [btn("⚽ Sportsbook", `${SITE()}/sports`), btn("💸 Cashback", `${SITE()}/bonus/cashback`)]));
      }
      case "/odds": {
        const text = fixturesText(await upcoming(36, 6), "Top matches");
        return send(chat, text || "No matches with odds right now — check the sportsbook for the latest.", kb([btn("Open the sportsbook", `${SITE()}/sports`)]));
      }
      case "/cashback": {
        const next = S.nextBoundary(new Date()); const ms = next - Date.now();
        return send(chat, `💸 <b>20% weekly cashback</b>\n\nNext payout in <b>${Math.floor(ms / 86400e3)}d ${Math.floor((ms % 86400e3) / 3600e3)}h ${Math.floor((ms % 3600e3) / 60e3)}m</b> (Sunday 22:00 UTC).\n\nWe add up your real-money bets minus winnings for the week; if it's a loss, 20% goes back to your real balance with no wagering.`, kb([btn("Details", `${SITE()}/bonus/cashback`)]));
      }
      case "/invite": {
        if (!user) return send(chat, linkHint());
        const st = await store.referrals.stats(user.id);
        return send(chat, `🤝 <b>Your invite link</b>\n${SITE()}/r/${user.ref_code || "—"}\n\nFriends invited: <b>${st.invited}</b>\nEarned so far: <b>${money(st.earned / 1e6)}</b>\n\nYou earn 10% of each friend's weekly net losses, paid every Sunday.`);
      }
      case "/balance": {
        if (!user) return send(chat, linkHint());
        return send(chat, `👛 <b>Your balances</b>\nReal: <b>${money(user.real_balance / 1e6)}</b>\nFun: ${money(user.fun_balance / 1e6)}${user.wager_remaining > 0 ? `\nStill to wager before withdrawing: ${money(user.wager_remaining / 1e6)}` : ""}`, kb([btn("Open wallet", `${SITE()}/#/wallet`)]));
      }
      case "/deposit":
        return send(chat, `🪙 <b>Deposit crypto</b>\n\nLog in, open <b>Wallet</b>, pick a coin and copy your deposit address. Guides:\n${[["Bitcoin", "bitcoin"], ["Ethereum", "ethereum"], ["Litecoin", "litecoin"], ["BNB", "bnb"], ["TRON", "tron"]].map(([n, s]) => `• <a href="${SITE()}/deposit/${s}">${n}</a>`).join("\n")}\n\nOnly send each coin on the network shown in the wallet.`);
      case "/stop":
        if (user) await store.users.setTelegram(user.id, null);
        return send(chat, "🔕 Alerts turned off and your account disconnected. Send /start any time to come back.");
      default:
        return send(chat, startText());
    }
  }

  async function webhook(req, body) {
    if (!on() || req.headers["x-telegram-bot-api-secret-token"] !== SECRET) return false;
    if (body && body.message) onMessage(body.message).catch((e) => console.error("telegram msg:", e.message));
    return true;
  }

  async function linkUrl(userId) {
    if (!on() || !botName) return null;
    const raw = S.newToken().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    await store.tokens.create(S.sha(raw), userId, "tglink", new Date(Date.now() + 30 * 60e3));
    return `https://t.me/${botName}?start=link_${raw}`;
  }

  return { init, tick, bigWin, notify, webhook, linkUrl, enabled: on, botName: () => botName, channel: CHANNEL, money };
};
