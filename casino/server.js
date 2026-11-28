"use strict";
/* CareQuay Casino — server. No framework; Node 20+. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const createStore = require("./server/db");
const S = require("./server/support");
const G = require("./server/games");
const T = require("./public/js/shared/tables.js");
const createSports = require("./server/sports");
const createSite = require("./server/site");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, "public");
const MICRO = 1e6;
const FUN_START = 1000 * MICRO;
const CASHBACK_RATE = 0.2;
const MIN_WITHDRAW = Number(process.env.MIN_WITHDRAW_USD || 20);
const SESSION_DAYS = 30;
const PROD = process.env.NODE_ENV === "production";
const REQUIRE_CONFIRM = process.env.REQUIRE_EMAIL_CONFIRM === "1"; // off: accounts work straight after sign-up
const store = createStore();
const SP = createSports(store);
let SITE = null; // created once currentUser is defined

const usd = (micro) => Math.floor(micro / 10000) / 100; // micro → dollars (cents precision, floored)
const usdx = (micro) => micro / MICRO;                    // exact

/* ---------- HTTP helpers ---------- */
class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
function send(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": typeof body === "object" && !Buffer.isBuffer(body) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(data);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 64 * 1024) { reject(new HttpError(413, "Request too large.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new HttpError(400, "Invalid JSON.")); } });
    req.on("error", reject);
  });
}
const cookies = (req) => Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const ipOf = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
const baseUrl = (req) => process.env.APP_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
function sessionCookie(token, maxAge) {
  return `cq_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${PROD ? "; Secure" : ""}`;
}

/* ---------- Account helpers (inside a locked transaction) ---------- */
const balField = (mode) => (mode === "real" ? "real_balance" : "fun_balance");
function debitAcct(acct, mode, micro) {
  const f = balField(mode);
  if (acct[f] < micro) throw new HttpError(402, mode === "real" ? "Not enough real balance. Deposit in the Wallet to keep playing." : "Not enough fun balance. Choose Play for fun again to reload $1,000.");
  acct[f] -= micro;
  if (mode === "real") acct.wager_remaining = Math.max(0, acct.wager_remaining - micro);
}
function creditAcct(acct, mode, micro) { acct[balField(mode)] += micro; }

async function settleCashback(acct, ops) {
  const now = new Date();
  if (!acct.cashback_until) { acct.cashback_until = S.lastBoundary(acct.created_at); }
  let guard = 0;
  while (acct.cashback_until.getTime() + S.WEEK <= now.getTime() && guard++ < 60) {
    const from = acct.cashback_until, to = new Date(from.getTime() + S.WEEK);
    const { bets, wins } = await ops.sumWindow("real", from, to);
    const net = bets - wins;
    if (net > 0) {
      const cb = Math.floor(net * CASHBACK_RATE / 10000) * 10000; // whole cents
      if (cb > 0) { acct.real_balance += cb; await ops.ledger({ mode: "real", type: "cashback", amount: cb, meta: { from: from.toISOString(), to: to.toISOString(), net } }); }
    }
    acct.cashback_until = to;
  }
}
const balances = (acct) => ({ fun: usdx(acct.fun_balance), real: usdx(acct.real_balance), wagerRemaining: usd(acct.wager_remaining) });

/* ---------- Auth ---------- */
async function currentUser(req) {
  const tok = cookies(req).cq_sid;
  if (!tok) return null;
  const uid = await store.sessions.get(S.sha(tok));
  return uid ? store.users.byId(uid) : null;
}
SITE = createSite({ store, SP, currentUser: (req) => currentUser(req) });
async function requireUser(req) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, "Please log in.");
  return u;
}
function requireAdmin(req) {
  const t = process.env.ADMIN_TOKEN;
  if (!t || t.length < 16 || req.headers["x-admin-token"] !== t) throw new HttpError(403, "Forbidden.");
}
async function issueToken(user, type, hours) {
  const tok = S.newToken();
  await store.tokens.create(S.sha(tok), user.id, type, new Date(Date.now() + hours * 3600e3));
  return tok;
}
async function sendConfirm(req, user) {
  const tok = await issueToken(user, "confirm", 48);
  const link = `${baseUrl(req)}/api/auth/confirm?token=${tok}`;
  return S.sendMail({ to: user.email, subject: "Confirm your CareQuay Casino account", text: `Confirm your account: ${link}`, html: S.emailLayout("Confirm your email", "Thanks for signing up to CareQuay Casino. Confirm your email address to activate your account.", "Confirm my account", link) });
}

/* ---------- Routes ---------- */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), handler });

async function startSession(res, userId) {
  const tok = S.newToken();
  await store.sessions.create(S.sha(tok), userId, new Date(Date.now() + SESSION_DAYS * 86400e3));
  res.setHeader("Set-Cookie", sessionCookie(tok, SESSION_DAYS * 86400));
}

route("POST", "/api/auth/register", async ({ req, res, body }) => {
  if (S.limited(`reg:${ipOf(req)}`, 10, 3600e3)) throw new HttpError(429, "Too many sign-ups from this connection. Try again later.");
  const email = String(body.email || "").trim().toLowerCase();
  if (!S.EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const pp = S.passwordProblem(body.password); if (pp) throw new HttpError(400, pp);
  if (body.password !== body.password2) throw new HttpError(400, "Passwords don't match.");
  if (!body.terms) throw new HttpError(400, "Please confirm you're 18 or over and accept the Terms & Conditions.");
  let referredBy = null;
  const refCode = cookies(req).cq_ref;
  if (refCode && /^[a-z0-9]{4,16}$/i.test(refCode)) { const ref = await store.users.byRefCode(refCode); if (ref && ref.email !== email) referredBy = ref.id; }
  const user = await store.users.create({ email, passHash: await S.hashPassword(body.password), referredBy });
  if (user && referredBy) res.setHeader("Set-Cookie", `cq_ref=; Path=/; Max-Age=0; SameSite=Lax${PROD ? "; Secure" : ""}`);
  if (!REQUIRE_CONFIRM) {
    if (!user) throw new HttpError(409, "An account with that email already exists. Log in instead.");
    await store.users.setConfirmed(user.id);
    await startSession(res, user.id);
    return { ok: true, loggedIn: true };
  }
  let target = user;
  if (!target) {
    const existing = await store.users.byEmail(email);
    if (existing && !existing.confirmed) { await store.users.setPasswordUnconfirmed(existing.id, await S.hashPassword(body.password)); target = existing; }
    else return { ok: true, emailSent: S.emailConfigured() };
  }
  const r = await sendConfirm(req, target).catch((e) => { console.error(e); return { sent: false }; });
  return { ok: true, emailSent: r.sent };
});

route("GET", "/api/auth/confirm", async ({ url }) => {
  const uid = await store.tokens.take(S.sha(url.searchParams.get("token") || ""), "confirm");
  if (uid) await store.users.setConfirmed(uid);
  return { redirect: `/?confirmed=${uid ? 1 : 0}` };
});

route("POST", "/api/auth/resend", async ({ req, body }) => {
  const email = String(body.email || "").trim().toLowerCase();
  if (S.limited(`resend:${ipOf(req)}`, 5, 3600e3)) throw new HttpError(429, "Too many requests. Try again later.");
  const u = await store.users.byEmail(email);
  if (u && !u.confirmed) await sendConfirm(req, u).catch((e) => console.error(e));
  return { ok: true, emailSent: S.emailConfigured() };
});

route("POST", "/api/auth/login", async ({ req, body, res }) => {
  const email = String(body.email || "").trim().toLowerCase();
  if (S.limited(`login:${ipOf(req)}`, 30, 600e3) || S.limited(`login:${email}`, 10, 600e3)) throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  const u = await store.users.byEmail(email);
  if (!u || !(await S.verifyPassword(String(body.password || ""), u.pass_hash))) throw new HttpError(401, "Email or password is incorrect.");
  if (REQUIRE_CONFIRM && !u.confirmed) throw new HttpError(403, "Please confirm your email first. Check your inbox for the confirmation link.", { unconfirmed: true });
  await startSession(res, u.id);
  return { ok: true };
});

route("POST", "/api/auth/logout", async ({ req, res }) => {
  const tok = cookies(req).cq_sid;
  if (tok) await store.sessions.del(S.sha(tok));
  res.setHeader("Set-Cookie", sessionCookie("", 0));
  return { ok: true };
});

route("POST", "/api/auth/forgot", async ({ req, body }) => {
  const email = String(body.email || "").trim().toLowerCase();
  if (S.limited(`forgot:${ipOf(req)}`, 5, 3600e3)) throw new HttpError(429, "Too many requests. Try again later.");
  const u = await store.users.byEmail(email);
  if (u) {
    const tok = await issueToken(u, "reset", 1);
    const link = `${baseUrl(req)}/?reset=${tok}`;
    await S.sendMail({ to: u.email, subject: "Reset your CareQuay Casino password", text: `Reset your password (link valid for 1 hour): ${link}`, html: S.emailLayout("Reset your password", "We received a request to reset your password. This link is valid for 1 hour.", "Choose a new password", link) }).catch((e) => console.error(e));
  }
  return { ok: true, emailSent: S.emailConfigured() };
});

route("POST", "/api/auth/reset", async ({ body }) => {
  const pp = S.passwordProblem(body.password); if (pp) throw new HttpError(400, pp);
  if (body.password !== body.password2) throw new HttpError(400, "Passwords don't match.");
  const uid = await store.tokens.take(S.sha(body.token || ""), "reset");
  if (!uid) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
  await store.users.setPassword(uid, await S.hashPassword(body.password));
  await store.users.setConfirmed(uid);
  await store.sessions.delForUser(uid);
  return { ok: true };
});

route("GET", "/api/me", async ({ req }) => {
  const u = await requireUser(req);
  return store.tx(u.id, async (acct, ops) => { await settleCashback(acct, ops); return { email: u.email, ...balances(acct), emailConfigured: S.emailConfigured() }; });
});

route("POST", "/api/fun", async ({ req }) => {
  const u = await requireUser(req);
  return store.tx(u.id, async (acct, ops) => {
    if (acct.fun_balance < FUN_START) { await ops.ledger({ mode: "fun", type: "fun_topup", amount: FUN_START - acct.fun_balance }); acct.fun_balance = FUN_START; }
    return balances(acct);
  });
});

route("GET", "/api/prices", async () => ({ coins: await S.prices(), at: new Date().toISOString() }));

route("GET", "/api/wallet", async ({ req }) => {
  const u = await requireUser(req);
  const out = await store.tx(u.id, async (acct, ops) => { await settleCashback(acct, ops); return balances(acct); });
  const [deps, wds] = await Promise.all([store.deposits(u.id), store.withdrawals(u.id)]);
  return { ...out, minWithdraw: MIN_WITHDRAW, deposits: deps.map((d) => ({ ...d, usd: usd(d.usd) })), withdrawals: wds.map((w) => ({ ...w, usd: usd(w.usd) })) };
});

route("POST", "/api/withdraw", async ({ req, body }) => {
  const u = await requireUser(req);
  const coin = S.COINS.find((c) => c.sym === body.coin);
  if (!coin) throw new HttpError(400, "Choose a coin.");
  const network = coin.nets.includes(body.network) ? body.network : coin.nets[0];
  const address = String(body.address || "").trim();
  const ap = S.addressProblem(coin.sym, address); if (ap) throw new HttpError(400, ap);
  const amt = Math.round(Number(body.usd) * 100) * 10000;
  if (!(amt >= MIN_WITHDRAW * MICRO)) throw new HttpError(400, `Minimum withdrawal is $${MIN_WITHDRAW}.`);
  const price = (await S.prices()).find((p) => p.sym === coin.sym).usd;
  return store.tx(u.id, async (acct, ops) => {
    await settleCashback(acct, ops);
    if (acct.wager_remaining > 0) throw new HttpError(400, `Your deposits must be wagered 1× before withdrawing. $${usd(acct.wager_remaining).toFixed(2)} left to wager.`);
    if (acct.real_balance < amt) throw new HttpError(400, "That's more than your real balance.");
    acct.real_balance -= amt;
    const crypto_amount = +(usdx(amt) / price).toPrecision(10);
    const id = await ops.withdrawal({ coin: coin.sym, network, address, usd: amt, crypto_amount, price });
    await ops.ledger({ mode: "real", type: "withdraw", amount: amt, meta: { id, coin: coin.sym } });
    return { ok: true, id, crypto_amount, price, ...balances(acct) };
  });
});

route("GET", "/api/bonus", async ({ req }) => {
  const u = await requireUser(req);
  const now = new Date();
  const from = S.lastBoundary(now), to = S.nextBoundary(now);
  const bal = await store.tx(u.id, async (acct, ops) => { await settleCashback(acct, ops); return balances(acct); });
  const w = await store.sumWindow(u.id, "real", from, to);
  const net = Math.max(0, w.bets - w.wins);
  const hist = await store.cashbacks(u.id);
  return { rate: CASHBACK_RATE, weekStart: from.toISOString(), nextPayout: to.toISOString(), wagered: usd(w.bets), won: usd(w.wins), netLoss: usd(net), projected: usd(Math.floor(net * CASHBACK_RATE)), history: hist.map((h) => ({ amount: usd(h.amount), at: h.created_at, meta: h.meta })), ...bal };
});

route("GET", "/api/history", async ({ req, url }) => {
  const u = await requireUser(req);
  const rows = await store.history(u.id, 40);
  const mode = url.searchParams.get("mode");
  return { rows: rows.filter((r) => !mode || r.mode === mode).map((r) => ({ mode: r.mode, type: r.type, amount: usdx(r.amount), game: r.game, at: r.created_at })) };
});

/* ----- Games ----- */
const GAME_NAMES = { dice: "Dice", limbo: "Limbo", plinko: "Plinko", keno: "Keno", roulette: "Roulette", baccarat: "Baccarat", crash: "Crash", mines: "Mines", blackjack: "Blackjack", videopoker: "Video Poker", threecard: "Three Card Poker" };
const modeOf = (b) => { if (b.mode !== "fun" && b.mode !== "real") throw new HttpError(400, "Choose Play for fun or Play for real."); return b.mode; };

route("POST", "/api/play/:game", async ({ req, body, params }) => {
  const u = await requireUser(req);
  const fn = G.SINGLE[params.game];
  if (!fn) throw new HttpError(404, "Unknown game.");
  const mode = modeOf(body);
  return store.tx(u.id, async (acct, ops) => {
    await settleCashback(acct, ops);
    const out = fn(body);
    const name = out.game || GAME_NAMES[params.game];
    debitAcct(acct, mode, out.stake);
    await ops.ledger({ mode, type: "bet", amount: out.stake, game: name });
    if (out.payout > 0) { creditAcct(acct, mode, out.payout); await ops.ledger({ mode, type: "win", amount: out.payout, game: name }); }
    return { result: out.result, stake: usdx(out.stake), payout: usdx(out.payout), mode, ...balances(acct) };
  });
});

route("POST", "/api/g/:game/:action", async ({ req, body, params }) => {
  const u = await requireUser(req);
  const game = G.STATEFUL[params.game];
  const act = game && params.action !== "view" && game[params.action];
  if (!act) throw new HttpError(404, "Unknown action.");
  const now = Date.now();
  return store.tx(u.id, async (acct, ops) => {
    await settleCashback(acct, ops);
    let saved = await ops.getState(params.game);
    const name = GAME_NAMES[params.game];
    let bets = 0, mode;
    const finish = async (res, m) => {
      if (res.state == null) {
        if (res.payout > 0) { creditAcct(acct, m, res.payout); await ops.ledger({ mode: m, type: "win", amount: res.payout, game: name }); }
        await ops.setState(params.game, null);
        if (res.keep) await ops.setState(`${params.game}:keep`, res.keep);
      } else await ops.setState(params.game, { mode: m, s: res.state });
    };
    if (params.action === "start") {
      if (saved && params.game === "crash") { await finish(G.STATEFUL.crash.poll({ state: saved.s, now }), saved.mode); saved = null; }
      if (saved) throw new HttpError(409, "Finish your current round first.", { view: game.view(saved.s, now), mode: saved.mode });
      mode = modeOf(body);
      const extra = (await ops.getState(`${params.game}:keep`)) || {};
      const debit = (m) => { debitAcct(acct, mode, m); bets += m; };
      const res = act({ body, state: null, mode, debit, now, extra });
      await ops.ledger({ mode, type: "bet", amount: bets, game: name });
      await finish(res, mode);
      return { view: res.view, done: res.state == null, payout: usdx(res.payout || 0), mode, ...balances(acct) };
    }
    if (!saved) throw new HttpError(409, "No round in progress.");
    mode = saved.mode;
    const debit = (m) => { debitAcct(acct, mode, m); bets += m; };
    const res = act({ body, state: saved.s, mode, debit, now, extra: {} });
    if (bets) await ops.ledger({ mode, type: "bet", amount: bets, game: name });
    await finish(res, mode);
    return { view: res.view, done: res.state == null, payout: usdx(res.payout || 0), mode, ...balances(acct) };
  });
});

route("GET", "/api/g/:game/state", async ({ req, params }) => {
  const u = await requireUser(req);
  const game = G.STATEFUL[params.game];
  if (!game) throw new HttpError(404, "Unknown game.");
  return store.tx(u.id, async (acct, ops) => {
    const saved = await ops.getState(params.game);
    if (!saved) return { active: false, ...balances(acct) };
    if (params.game === "crash") {
      const res = G.STATEFUL.crash.poll({ state: saved.s, now: Date.now() });
      if (res.state == null) {
        if (res.payout > 0) { creditAcct(acct, saved.mode, res.payout); await ops.ledger({ mode: saved.mode, type: "win", amount: res.payout, game: "Crash" }); }
        await ops.setState("crash", null);
        return { active: false, ...balances(acct) };
      }
    }
    return { active: true, mode: saved.mode, view: game.view(saved.s, Date.now()), ...balances(acct) };
  });
});

/* ----- Admin (header x-admin-token) ----- */
route("POST", "/api/admin/deposit", async ({ req, body }) => {
  requireAdmin(req);
  const u = await store.users.byEmail(String(body.email || "").trim().toLowerCase());
  if (!u) throw new HttpError(404, "No such user.");
  const coin = S.COINS.find((c) => c.sym === body.coin);
  if (!coin) throw new HttpError(400, "Unknown coin.");
  const amount = Number(body.amount);
  if (!(amount > 0)) throw new HttpError(400, "Amount must be positive.");
  const price = Number(body.price) > 0 ? Number(body.price) : (await S.prices()).find((p) => p.sym === coin.sym).usd;
  const micro = Math.floor(amount * price * 100) * 10000;
  return store.tx(u.id, async (acct, ops) => {
    acct.real_balance += micro; acct.wager_remaining += micro;
    const id = await ops.deposit({ coin: coin.sym, amount, usd: micro, price, txid: body.txid || null });
    await ops.ledger({ mode: "real", type: "deposit", amount: micro, meta: { id, coin: coin.sym, amount } });
    return { ok: true, id, credited: usd(micro), ...balances(acct) };
  });
});
route("GET", "/api/admin/deposits", async ({ req, url }) => {
  requireAdmin(req);
  return { deposits: (await store.allDeposits(url.searchParams.get("status"))).map((d) => ({ ...d, usd: usd(d.usd) })), addresses: S.DEPOSIT_ADDRESSES };
});
route("POST", "/api/admin/deposits/:id", async ({ req, body, params }) => {
  requireAdmin(req);
  const d = await store.lockDeposit(Number(params.id));
  if (!d) throw new HttpError(409, "That deposit isn't pending.");
  try {
    if (body.status === "rejected") { await store.setDeposit(d.id, { status: "rejected" }); return { ok: true }; }
    if (body.status !== "credited") throw new HttpError(400, "Status must be credited or rejected.");
    const amount = Number(body.amount) > 0 ? Number(body.amount) : d.amount;
    const price = Number(body.price) > 0 ? Number(body.price) : (await S.prices()).find((p) => p.sym === d.coin).usd;
    const micro = Math.floor(amount * price * 100) * 10000;
    await store.tx(d.user_id, async (acct, ops) => {
      acct.real_balance += micro; acct.wager_remaining += micro;
      await ops.ledger({ mode: "real", type: "deposit", amount: micro, meta: { id: d.id, coin: d.coin, amount } });
    });
    await store.setDeposit(d.id, { status: "credited", usd: micro, price, amount });
    return { ok: true, credited: usd(micro) };
  } catch (e) { if (body.status === "credited") await store.setDeposit(d.id, { status: "pending" }).catch(() => {}); throw e; }
});
route("POST", "/api/admin/confirm", async ({ req, body }) => {
  requireAdmin(req);
  const u = await store.users.byEmail(String(body.email || "").trim().toLowerCase());
  if (!u) throw new HttpError(404, "No such user.");
  await store.users.setConfirmed(u.id);
  return { ok: true };
});
route("GET", "/api/admin/withdrawals", async ({ req, url }) => {
  requireAdmin(req);
  return { withdrawals: (await store.allWithdrawals(url.searchParams.get("status"))).map((w) => ({ ...w, usd: usd(w.usd) })) };
});
route("POST", "/api/admin/withdrawals/:id", async ({ req, body, params }) => {
  requireAdmin(req);
  const w = await store.withdrawalById(Number(params.id));
  if (!w) throw new HttpError(404, "No such withdrawal.");
  if (w.status !== "pending") throw new HttpError(409, `Withdrawal is already ${w.status}.`);
  if (body.status === "paid") { await store.setWithdrawal(w.id, "paid", body.txid); return { ok: true }; }
  if (body.status === "rejected") {
    await store.tx(w.user_id, async (acct, ops) => { acct.real_balance += Number(w.usd); await ops.ledger({ mode: "real", type: "withdraw_refund", amount: Number(w.usd), meta: { id: w.id } }); });
    await store.setWithdrawal(w.id, "rejected", null);
    return { ok: true };
  }
  throw new HttpError(400, "Status must be paid or rejected.");
});

/* ---------- Sportsbook (pre-match only) ---------- */
const sportsName = (b) => `${b.home} v ${b.away}`;
const sportsHelpers = { creditAcct, gameName: sportsName };
const betView = (b) => ({ id: b.id, mode: b.mode, sport: b.sport_key, league: b.sport_title, home: b.home, away: b.away, commence: b.commence_time, market: b.market, selection: b.selection, point: b.point, odds: b.odds, stake: usdx(b.stake), status: b.status, payout: usdx(b.payout), potential: usdx(Math.floor(b.stake * b.odds)), result: b.result && { homeScore: b.result.homeScore, awayScore: b.result.awayScore, winner: b.result.winner }, placed: b.created_at, settled: b.settled_at });
let lastAuto = 0;
const maybeAutoSettle = () => { if (Date.now() - lastAuto < 5 * 60e3) return; lastAuto = Date.now(); SP.autoSettle(sportsHelpers).catch((e) => console.error("auto-settle:", e.message)); };
const wrapSports = async (fn) => { try { return await fn(); } catch (e) { if (e instanceof SP.SportsError) throw new HttpError(e.status, e.message, e.extra); throw e; } };

route("GET", "/api/sports", async ({ req }) => {
  await requireUser(req);
  maybeAutoSettle();
  const ls = await SP.leagues();
  return { enabled: SP.CFG.key !== "" || SP.CFG.mock, groups: SP.GROUPS.map((g) => ({ ...g, leagues: ls.filter((l) => l.group === g.id) })), limits: { maxStake: SP.CFG.maxStake, maxPayout: SP.CFG.maxPayout } };
});
route("GET", "/api/sports/league/:key", async ({ req, params }) => {
  await requireUser(req);
  const L = await wrapSports(() => SP.league(params.key));
  return { ...L, events: L.events.map((e) => ({ ...e, markets: Object.fromEntries(Object.entries(e.markets).map(([k, v]) => [k, v.map(({ prob, ...o }) => ({ ...o, pct: Math.round(prob * 1000) / 10 }))])) })) };
});
route("POST", "/api/sports/bet", async ({ req, body }) => {
  const u = await requireUser(req);
  const mode = modeOf(body);
  const market = String(body.market || "");
  if (!["h2h", "spreads"].includes(market)) throw new HttpError(400, "Unknown market.");
  const stakeUsd = Math.floor(Number(body.stake) * 100) / 100;
  if (!(stakeUsd >= T.MIN_BET)) throw new HttpError(400, `Minimum stake is $${T.MIN_BET.toFixed(2)}.`);
  if (stakeUsd > SP.CFG.maxStake) throw new HttpError(400, `Maximum stake is $${SP.CFG.maxStake.toLocaleString("en-US")} per bet.`);
  const { ev, o } = await wrapSports(() => SP.quote({ league: body.league, eventId: String(body.eventId || ""), market, selection: String(body.selection || ""), point: body.point }));
  if (Number(body.odds) !== o.price) throw new HttpError(409, `Odds changed to ${o.price.toFixed(2)}. Check your bet slip and place it again.`, { odds: o.price, pct: Math.round(o.prob * 1000) / 10 });
  if (stakeUsd * o.price > SP.CFG.maxPayout) throw new HttpError(400, `Maximum return is $${SP.CFG.maxPayout.toLocaleString("en-US")} per bet. Lower your stake to $${Math.floor((SP.CFG.maxPayout / o.price) * 100) / 100} or less.`);
  const stake = Math.round(stakeUsd * 100) * 10000;
  return store.tx(u.id, async (acct, ops) => {
    await settleCashback(acct, ops);
    debitAcct(acct, mode, stake);
    const row = { mode, event_id: ev.id, sport_key: ev.sport_key, sport_title: ev.sport_title, home: ev.home, away: ev.away, commence_time: ev.commence, market, selection: o.name, point: market === "spreads" ? o.point : null, odds: o.price, stake };
    const id = await ops.sportsBet(row);
    await ops.ledger({ mode, type: "bet", amount: stake, game: sportsName(row), meta: { sportsBet: id } });
    return { ok: true, id, mode, ...balances(acct) };
  });
});
route("GET", "/api/sports/bets", async ({ req }) => {
  const u = await requireUser(req);
  maybeAutoSettle();
  return { bets: (await store.sports.forUser(u.id)).map(betView) };
});
route("GET", "/api/admin/sports", async ({ req }) => {
  requireAdmin(req);
  const open = await store.sports.open();
  const events = new Map();
  for (const b of open) {
    const e = events.get(b.event_id) || { eventId: b.event_id, sport: b.sport_key, league: b.sport_title, home: b.home, away: b.away, commence: b.commence_time, draw: SP.hasDraw(b.sport_key), needsScores: false, bets: 0, staked: 0, liability: {} };
    e.bets++; e.staked += usdx(b.stake);
    if (b.market === "spreads") e.needsScores = true;
    const label = b.market === "spreads" ? `${b.selection} ${b.point > 0 ? "+" : ""}${b.point}` : b.selection;
    e.liability[label] = Math.round(((e.liability[label] || 0) + usdx(Math.floor(b.stake * b.odds))) * 100) / 100;
    events.set(b.event_id, e);
  }
  return { status: await SP.status(), events: [...events.values()], recent: (await store.sports.recent(30)).map((b) => ({ ...betView(b), email: b.email })) };
});
route("POST", "/api/admin/sports/settle", async ({ req, body }) => {
  requireAdmin(req);
  const eventId = String(body.eventId || "");
  const bets = await store.sports.openForEvent(eventId);
  if (!bets.length) throw new HttpError(404, "No open bets on that event.");
  const b0 = bets[0];
  const r = { source: "admin" };
  if (body.result === "void") r.void = true;
  else {
    const hs = body.homeScore === "" || body.homeScore == null ? null : Number(body.homeScore);
    const as = body.awayScore === "" || body.awayScore == null ? null : Number(body.awayScore);
    if ((hs == null) !== (as == null) || (hs != null && !(Number.isFinite(hs) && Number.isFinite(as) && hs >= 0 && as >= 0))) throw new HttpError(400, "Enter both scores, or leave both empty.");
    if (hs != null) { r.homeScore = hs; r.awayScore = as; }
    const win = { home: b0.home, away: b0.away, draw: "Draw" }[body.result];
    if (win) r.winner = win;
    else if (hs == null) throw new HttpError(400, "Choose the result or enter the final score.");
    if (r.winner && hs != null) { const byScore = hs > as ? b0.home : as > hs ? b0.away : "Draw"; if (byScore !== r.winner) throw new HttpError(400, "The result doesn't match the score."); }
  }
  const out = await SP.settleEvent(eventId, r, sportsHelpers);
  return { ok: true, ...out };
});
setInterval(maybeAutoSettle, 20 * 60e3).unref();

/* ---------- Referrals: 10% of referred players' weekly net real-money losses ---------- */
const REFERRAL_RATE = Number(process.env.REFERRAL_RATE || 0.1);
const REF_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
async function ensureRefCode(u) {
  if (u.ref_code) return u.ref_code;
  for (let i = 0; i < 8; i++) {
    const code = Array.from(require("crypto").randomBytes(7), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
    if (await store.users.setRefCode(u.id, code)) return code;
    const fresh = await store.users.byId(u.id); if (fresh.ref_code) return fresh.ref_code;
  }
  throw new HttpError(500, "Couldn't create an invite code.");
}
async function settleReferrals() {
  const last = S.lastBoundary(new Date());
  for (let w = 4; w >= 1; w--) {
    const to = new Date(last.getTime() - (w - 1) * S.WEEK), from = new Date(to.getTime() - S.WEEK);
    for (const r of await store.referrals.weekNet(from, to)) {
      const amount = Math.floor(r.net * REFERRAL_RATE / 10000) * 10000;
      if (amount <= 0) continue;
      await store.tx(r.referrer_id, async (acct, ops) => {
        if (!(await ops.referralReward({ user_id: r.user_id, week_start: from, net: r.net, amount }))) return;
        acct.real_balance += amount;
        await ops.ledger({ mode: "real", type: "referral", amount, meta: { from: from.toISOString(), to: to.toISOString() } });
      });
    }
  }
}
let lastRef = 0;
const maybeSettleReferrals = () => { if (Date.now() - lastRef < 10 * 60e3) return; lastRef = Date.now(); settleReferrals().catch((e) => console.error("referrals:", e.message)); };
setInterval(maybeSettleReferrals, 60 * 60e3).unref();
route("GET", "/api/referral", async ({ req }) => {
  const u = await requireUser(req);
  maybeSettleReferrals();
  const code = await ensureRefCode(u);
  const st = await store.referrals.stats(u.id);
  const base = (process.env.SITE_URL || `${(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`).replace(/\/$/, "");
  return { code, link: `${base}/r/${code}`, rate: REFERRAL_RATE, invited: st.invited, earned: usdx(st.earned), weeks: st.recent.map((x) => ({ week: x.week_start, amount: usdx(x.amount), players: x.players })), nextPayout: S.nextBoundary(new Date()).toISOString() };
});

route("GET", "/api/health", async () => ({ ok: true, store: store.kind, email: S.emailConfigured() }));

/* ---------- Static files ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json" };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || !path.extname(rel)) rel = "/index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": rel === "/index.html" ? "no-cache" : "public, max-age=300" });
    res.end(data);
  });
}

const CANON = (() => { try { if (!process.env.SITE_URL || process.env.CANONICAL_REDIRECT === "0") return null; const u = new URL(process.env.SITE_URL); return { host: u.host.toLowerCase(), origin: u.origin }; } catch { return null; } })();
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  if (PROD) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  const url = new URL(req.url, "http://x");
  // One public address: send visitors on other hostnames (e.g. the onrender.com one) to SITE_URL.
  if (CANON && req.headers.host && req.headers.host.toLowerCase() !== CANON.host && (req.method === "GET" || req.method === "HEAD") && !url.pathname.startsWith("/api/") && !/^\/google[0-9a-f]+\.html$/.test(url.pathname)) {
    res.writeHead(301, { Location: CANON.origin + url.pathname + url.search, "Cache-Control": "public, max-age=3600" });
    return res.end();
  }
  if (!url.pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    try {
      const p = url.pathname.replace(/\/+$/, "") || "/";
      const ref = p.match(/^\/r\/([a-z0-9]{4,16})$/i);
      if (ref) { res.writeHead(302, { Location: "/signup", "Set-Cookie": `cq_ref=${ref[1].toLowerCase()}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax${PROD ? "; Secure" : ""}`, "Cache-Control": "no-store" }); return res.end(); }
      if (p === "/login" || p === "/signup" || p === "/app") return serveStatic(req, res, "/index.html");
      if (p === "/") {
        const q = url.searchParams;
        if (q.has("reset") || q.has("confirmed") || (await currentUser(req).catch(() => null))) return serveStatic(req, res, "/index.html");
      }
      if (await SITE.handle(req, res, url)) return;
    } catch (e) { console.error(e); return send(res, 500, "Something went wrong."); }
    return serveStatic(req, res, url.pathname);
  }
  try {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) throw new HttpError(404, "Not found.");
    if (req.method === "POST" && !/application\/json/.test(req.headers["content-type"] || "")) throw new HttpError(415, "Send JSON.");
    const body = req.method === "POST" ? await readJson(req) : {};
    const out = await r.handler({ req, res, body, url, params: url.pathname.match(r.re).groups || {} });
    if (out && out.redirect) { res.writeHead(302, { Location: out.redirect }); return res.end(); }
    send(res, 200, out);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    send(res, status, { error: status >= 500 ? "Something went wrong. Please try again." : e.message, ...(e.extra || {}) });
  }
});

store.init().then(() => server.listen(PORT, () => console.log(`CareQuay Casino on :${PORT} (store: ${store.kind}, email: ${S.emailConfigured() ? "on" : "log only"})`)))
  .catch((e) => { console.error("Startup failed:", e); process.exit(1); });

module.exports = { server, store, settleReferrals };
