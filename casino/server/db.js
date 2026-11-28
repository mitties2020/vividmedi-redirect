"use strict";
/* Storage layer: Postgres when DATABASE_URL is set, otherwise an in-memory store (local testing only).
   Money is stored as integer micro-USD (1 USD = 1,000,000). */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fun_balance BIGINT NOT NULL DEFAULT 0,
  real_balance BIGINT NOT NULL DEFAULT 0,
  wager_remaining BIGINT NOT NULL DEFAULT 0,
  cashback_until TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tokens (
  hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  game TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_user_time ON ledger (user_id, created_at);
CREATE TABLE IF NOT EXISTS game_state (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game)
);
CREATE TABLE IF NOT EXISTS deposits (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  usd BIGINT NOT NULL,
  price NUMERIC NOT NULL,
  txid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'credited';
CREATE UNIQUE INDEX IF NOT EXISTS deposits_coin_txid ON deposits (coin, lower(txid)) WHERE txid IS NOT NULL;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS units TEXT;
CREATE INDEX IF NOT EXISTS deposits_status ON deposits (status);
CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  network TEXT,
  address TEXT NOT NULL,
  usd BIGINT NOT NULL,
  crypto_amount NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  txid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sports_bets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  sport_title TEXT,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  point NUMERIC,
  odds NUMERIC NOT NULL,
  stake BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  payout BIGINT NOT NULL DEFAULT 0,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sports_bets_user ON sports_bets (user_id, id);
CREATE INDEX IF NOT EXISTS sports_bets_open ON sports_bets (status, commence_time);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_ref_code ON users (lower(ref_code)) WHERE ref_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS referral_rewards (
  referrer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TIMESTAMPTZ NOT NULL,
  net BIGINT NOT NULL,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (referrer_id, user_id, week_start)
);
CREATE TABLE IF NOT EXISTS visits (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visitor TEXT NOT NULL,
  path TEXT NOT NULL,
  ref TEXT
);
CREATE INDEX IF NOT EXISTS visits_at ON visits (at);
CREATE INDEX IF NOT EXISTS visits_visitor ON visits (visitor, at);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const num = (v) => (v == null ? v : Number(v));
const userRow = (r) => r && {
  id: num(r.id), email: r.email, pass_hash: r.pass_hash, confirmed: !!r.confirmed,
  created_at: new Date(r.created_at),
  fun_balance: num(r.fun_balance), real_balance: num(r.real_balance), wager_remaining: num(r.wager_remaining),
  cashback_until: r.cashback_until ? new Date(r.cashback_until) : null,
  ref_code: r.ref_code || null, telegram_chat_id: r.telegram_chat_id == null ? null : num(r.telegram_chat_id), referred_by: r.referred_by == null ? null : num(r.referred_by),
};
const betRow = (x) => x && { ...x, id: num(x.id), user_id: num(x.user_id), point: x.point == null ? null : num(x.point), odds: num(x.odds), stake: num(x.stake), payout: num(x.payout), commence_time: new Date(x.commence_time) };
const ACCT_FIELDS = ["fun_balance", "real_balance", "wager_remaining", "cashback_until"];

/* ---------------- Postgres ---------------- */
function pgStore(url) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 });
  const q = (text, params) => pool.query(text, params);

  return {
    kind: "postgres",
    async init() { await q(SCHEMA); },
    users: {
      async create({ email, passHash, referredBy }) {
        const r = await q("INSERT INTO users (email, pass_hash, referred_by) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING *", [email, passHash, referredBy || null]);
        return userRow(r.rows[0]) || null;
      },
      async byTelegram(chatId) { return userRow((await q("SELECT * FROM users WHERE telegram_chat_id = $1", [chatId])).rows[0]); },
      async setTelegram(id, chatId) { if (chatId != null) await q("UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = $1", [chatId]); await q("UPDATE users SET telegram_chat_id = $2 WHERE id = $1", [id, chatId]); },
      async byRefCode(code) { return userRow((await q("SELECT * FROM users WHERE lower(ref_code) = lower($1)", [code])).rows[0]); },
      async setRefCode(id, code) { try { const r = await q("UPDATE users SET ref_code = $2 WHERE id = $1 AND ref_code IS NULL", [id, code]); return r.rowCount === 1; } catch (e) { if (e.code === "23505") return false; throw e; } },
      async byEmail(email) { return userRow((await q("SELECT * FROM users WHERE email = $1", [email])).rows[0]); },
      async byId(id) { return userRow((await q("SELECT * FROM users WHERE id = $1", [id])).rows[0]); },
      async setConfirmed(id) { await q("UPDATE users SET confirmed = TRUE WHERE id = $1", [id]); },
      async setPassword(id, hash) { await q("UPDATE users SET pass_hash = $2 WHERE id = $1", [id, hash]); },
      async setPasswordUnconfirmed(id, hash) { await q("UPDATE users SET pass_hash = $2 WHERE id = $1 AND confirmed = FALSE", [id, hash]); },
    },
    tokens: {
      async create(hash, userId, type, expiresAt) { await q("INSERT INTO tokens (hash, user_id, type, expires_at) VALUES ($1, $2, $3, $4)", [hash, userId, type, expiresAt]); },
      async take(hash, type) {
        const r = await q("UPDATE tokens SET used = TRUE WHERE hash = $1 AND type = $2 AND used = FALSE AND expires_at > now() RETURNING user_id", [hash, type]);
        return r.rows[0] ? num(r.rows[0].user_id) : null;
      },
    },
    sessions: {
      async create(hash, userId, expiresAt) { await q("INSERT INTO sessions (hash, user_id, expires_at) VALUES ($1, $2, $3)", [hash, userId, expiresAt]); },
      async get(hash) { const r = await q("SELECT user_id FROM sessions WHERE hash = $1 AND expires_at > now()", [hash]); return r.rows[0] ? num(r.rows[0].user_id) : null; },
      async del(hash) { await q("DELETE FROM sessions WHERE hash = $1", [hash]); },
      async delForUser(userId) { await q("DELETE FROM sessions WHERE user_id = $1", [userId]); },
    },
    /** Runs fn with the user's account row locked. fn(acct, ops) may mutate acct balance fields. */
    async tx(userId, fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const r = await client.query("SELECT * FROM users WHERE id = $1 FOR UPDATE", [userId]);
        if (!r.rows[0]) throw new Error("no such user");
        const acct = userRow(r.rows[0]);
        const ops = {
          async ledger(row) { await client.query("INSERT INTO ledger (user_id, mode, type, amount, game, meta) VALUES ($1,$2,$3,$4,$5,$6)", [userId, row.mode, row.type, row.amount, row.game || null, row.meta ? JSON.stringify(row.meta) : null]); },
          async getState(game) { const s = await client.query("SELECT state FROM game_state WHERE user_id = $1 AND game = $2", [userId, game]); return s.rows[0] ? s.rows[0].state : null; },
          async setState(game, state) {
            if (state == null) await client.query("DELETE FROM game_state WHERE user_id = $1 AND game = $2", [userId, game]);
            else await client.query("INSERT INTO game_state (user_id, game, state, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (user_id, game) DO UPDATE SET state = EXCLUDED.state, updated_at = now()", [userId, game, JSON.stringify(state)]);
          },
          async withdrawal(row) { const w = await client.query("INSERT INTO withdrawals (user_id, coin, network, address, usd, crypto_amount, price) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [userId, row.coin, row.network || null, row.address, row.usd, row.crypto_amount, row.price]); return num(w.rows[0].id); },
          async deposit(row) { const d = await client.query("INSERT INTO deposits (user_id, coin, amount, usd, price, txid) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [userId, row.coin, row.amount, row.usd, row.price, row.txid || null]); return num(d.rows[0].id); },
          async sportsBet(b) {
            const r = await client.query("INSERT INTO sports_bets (user_id, mode, event_id, sport_key, sport_title, home, away, commence_time, market, selection, point, odds, stake) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id", [userId, b.mode, b.event_id, b.sport_key, b.sport_title, b.home, b.away, b.commence_time, b.market, b.selection, b.point, b.odds, b.stake]);
            return num(r.rows[0].id);
          },
          async settleSportsBet(id, status, payout, result) {
            const r = await client.query("UPDATE sports_bets SET status = $2, payout = $3, result = $4, settled_at = now() WHERE id = $1 AND user_id = $5 AND status = 'open' RETURNING id", [id, status, payout, JSON.stringify(result || {}), userId]);
            return r.rowCount === 1;
          },
          async matchDeposit(id, txid, status, usdMicro, price) {
            const r = await client.query("UPDATE deposits SET status = $3, txid = $2, usd = $4, price = $5 WHERE id = $1 AND user_id = $6 AND status IN ('awaiting','expired') RETURNING id", [id, txid, status, usdMicro, price, userId]);
            return r.rowCount === 1;
          },
          async referralReward(r) {
            const x = await client.query("INSERT INTO referral_rewards (referrer_id, user_id, week_start, net, amount) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [userId, r.user_id, r.week_start, r.net, r.amount]);
            return x.rowCount === 1;
          },
          async sumWindow(mode, from, to) {
            const s = await client.query("SELECT COALESCE(SUM(CASE WHEN type='bet' THEN amount ELSE 0 END),0) AS bets, COALESCE(SUM(CASE WHEN type='win' THEN amount ELSE 0 END),0) AS wins FROM ledger WHERE user_id = $1 AND mode = $2 AND created_at >= $3 AND created_at < $4", [userId, mode, from, to]);
            return { bets: num(s.rows[0].bets), wins: num(s.rows[0].wins) };
          },
        };
        const out = await fn(acct, ops);
        await client.query("UPDATE users SET fun_balance = $2, real_balance = $3, wager_remaining = $4, cashback_until = $5 WHERE id = $1", [userId, acct.fun_balance, acct.real_balance, acct.wager_remaining, acct.cashback_until]);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally { client.release(); }
    },
    async sumWindow(userId, mode, from, to) {
      const s = await q("SELECT COALESCE(SUM(CASE WHEN type='bet' THEN amount ELSE 0 END),0) AS bets, COALESCE(SUM(CASE WHEN type='win' THEN amount ELSE 0 END),0) AS wins FROM ledger WHERE user_id = $1 AND mode = $2 AND created_at >= $3 AND created_at < $4", [userId, mode, from, to]);
      return { bets: num(s.rows[0].bets), wins: num(s.rows[0].wins) };
    },
    async history(userId, limit = 30) {
      const r = await q("SELECT mode, type, amount, game, meta, created_at FROM ledger WHERE user_id = $1 ORDER BY id DESC LIMIT $2", [userId, limit]);
      return r.rows.map((x) => ({ ...x, amount: num(x.amount) }));
    },
    async cashbacks(userId) {
      const r = await q("SELECT amount, meta, created_at FROM ledger WHERE user_id = $1 AND type = 'cashback' ORDER BY id DESC LIMIT 20", [userId]);
      return r.rows.map((x) => ({ ...x, amount: num(x.amount) }));
    },
    depositRequests: {
      async create(userId, d) { return num((await q("INSERT INTO deposits (user_id, coin, amount, usd, price, units, status) VALUES ($1,$2,$3,$4,$5,$6,'awaiting') RETURNING id", [userId, d.coin, d.amount, d.usd, d.price, d.units])).rows[0].id); },
      async open() { return (await q("SELECT id, user_id, coin, amount, units, usd, price, created_at FROM deposits WHERE status = 'awaiting' ORDER BY id")).rows.map((x) => ({ ...x, id: num(x.id), user_id: num(x.user_id), usd: num(x.usd), price: num(x.price), amount: String(x.amount) })); },
      async unconfirmed() { return (await q("SELECT id, user_id, coin, amount, txid, created_at FROM deposits WHERE status = 'unconfirmed'")).rows.map((x) => ({ ...x, id: num(x.id), user_id: num(x.user_id) })); },
      async expire(before) { await q("UPDATE deposits SET status = 'expired' WHERE status = 'awaiting' AND created_at < $1", [before]); },
      async get(userId, id) { const x = (await q("SELECT id, coin, amount, units, usd, price, status, txid, created_at FROM deposits WHERE id = $1 AND user_id = $2", [id, userId])).rows[0]; return x && { ...x, id: num(x.id), usd: num(x.usd), price: num(x.price), amount: String(x.amount) }; },
      async hasUnconfirmed(userId) { return (await q("SELECT 1 FROM deposits WHERE user_id = $1 AND status = 'unconfirmed' LIMIT 1", [userId])).rowCount > 0; },
    },
    async claimDeposit(userId, { coin, amount, txid }) {
      const r = await q("INSERT INTO deposits (user_id, coin, amount, usd, price, txid, status) VALUES ($1,$2,$3,0,0,$4,'pending') ON CONFLICT DO NOTHING RETURNING id", [userId, coin, amount, txid]);
      return r.rows[0] ? num(r.rows[0].id) : null;
    },
    async allDeposits(status) { return (await q("SELECT d.*, u.email FROM deposits d JOIN users u ON u.id = d.user_id WHERE ($1::text IS NULL OR d.status = $1) ORDER BY d.id DESC LIMIT 200", [status || null])).rows.map((x) => ({ ...x, id: num(x.id), user_id: num(x.user_id), usd: num(x.usd), amount: num(x.amount), price: num(x.price) })); },
    async lockDeposit(id) { const r = await q("UPDATE deposits SET status = 'processing' WHERE id = $1 AND status = 'pending' RETURNING *", [id]); const x = r.rows[0]; return x && { ...x, id: num(x.id), user_id: num(x.user_id), amount: num(x.amount) }; },
    async setDeposit(id, f) { await q("UPDATE deposits SET status = $2, usd = COALESCE($3, usd), price = COALESCE($4, price), amount = COALESCE($5, amount) WHERE id = $1", [id, f.status, f.usd ?? null, f.price ?? null, f.amount ?? null]); },
    async deposits(userId) { return (await q("SELECT id, coin, amount, usd, price, txid, status, created_at FROM deposits WHERE user_id = $1 ORDER BY id DESC LIMIT 50", [userId])).rows.map((x) => ({ ...x, id: num(x.id), usd: num(x.usd), amount: num(x.amount), price: num(x.price) })); },
    async withdrawals(userId) { return (await q("SELECT id, coin, network, address, usd, crypto_amount, price, status, txid, created_at FROM withdrawals WHERE user_id = $1 ORDER BY id DESC LIMIT 50", [userId])).rows.map((x) => ({ ...x, id: num(x.id), usd: num(x.usd), crypto_amount: num(x.crypto_amount), price: num(x.price) })); },
    async allWithdrawals(status) { return (await q("SELECT w.*, u.email FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE ($1::text IS NULL OR w.status = $1) ORDER BY w.id DESC LIMIT 200", [status || null])).rows.map((x) => ({ ...x, id: num(x.id), user_id: num(x.user_id), usd: num(x.usd), crypto_amount: num(x.crypto_amount), price: num(x.price) })); },
    async withdrawalById(id) { const r = await q("SELECT * FROM withdrawals WHERE id = $1", [id]); const x = r.rows[0]; return x && { ...x, id: num(x.id), user_id: num(x.user_id), usd: num(x.usd) }; },
    sports: {
      async forUser(userId) { return (await q("SELECT * FROM sports_bets WHERE user_id = $1 ORDER BY (status = 'open') DESC, id DESC LIMIT 60", [userId])).rows.map(betRow); },
      async open() { return (await q("SELECT b.*, u.email FROM sports_bets b JOIN users u ON u.id = b.user_id WHERE b.status = 'open' ORDER BY b.commence_time, b.id")).rows.map(betRow); },
      async openForEvent(eventId) { return (await q("SELECT * FROM sports_bets WHERE status = 'open' AND event_id = $1", [eventId])).rows.map(betRow); },
      async recent(limit = 100) { return (await q("SELECT b.*, u.email FROM sports_bets b JOIN users u ON u.id = b.user_id WHERE b.status <> 'open' ORDER BY b.settled_at DESC LIMIT $1", [limit])).rows.map(betRow); },
    },
    referrals: {
      async weekNet(from, to) {
        const r = await q("SELECT l.user_id, u.referred_by AS referrer_id, SUM(CASE WHEN l.type='bet' THEN l.amount ELSE 0 END) - SUM(CASE WHEN l.type='win' THEN l.amount ELSE 0 END) AS net FROM ledger l JOIN users u ON u.id = l.user_id WHERE u.referred_by IS NOT NULL AND l.mode = 'real' AND l.created_at >= $1 AND l.created_at < $2 GROUP BY l.user_id, u.referred_by", [from, to]);
        return r.rows.map((x) => ({ user_id: num(x.user_id), referrer_id: num(x.referrer_id), net: num(x.net) })).filter((x) => x.net > 0);
      },
      async stats(referrerId) {
        const invited = num((await q("SELECT COUNT(*) AS n FROM users WHERE referred_by = $1", [referrerId])).rows[0].n);
        const earned = num((await q("SELECT COALESCE(SUM(amount),0) AS s FROM referral_rewards WHERE referrer_id = $1", [referrerId])).rows[0].s);
        const recent = (await q("SELECT week_start, SUM(amount) AS amount, COUNT(*) AS players FROM referral_rewards WHERE referrer_id = $1 GROUP BY week_start ORDER BY week_start DESC LIMIT 12", [referrerId])).rows.map((x) => ({ week_start: x.week_start, amount: num(x.amount), players: num(x.players) }));
        return { invited, earned, recent };
      },
    },
    visits: {
      async add(v) { await q("INSERT INTO visits (visitor, path, ref) VALUES ($1, $2, $3)", [v.visitor, v.path, v.ref || null]); },
      async seen(visitor, since) { return (await q("SELECT 1 FROM visits WHERE visitor = $1 AND at >= $2 LIMIT 1", [visitor, since])).rowCount > 0; },
    },
    async stats(from, to) {
      const one = async (sql, args) => (await q(sql, args)).rows[0];
      const u = await one("SELECT COUNT(*) AS n FROM users WHERE created_at >= $1 AND created_at < $2", [from, to]);
      const l = await one("SELECT COALESCE(SUM(CASE WHEN type='bet' THEN amount END),0) AS bets, COALESCE(SUM(CASE WHEN type='win' THEN amount END),0) AS wins, COALESCE(SUM(CASE WHEN type='deposit' THEN amount END),0) AS deposits, COALESCE(SUM(CASE WHEN type='withdraw' THEN amount END),0) AS withdrawals, COUNT(DISTINCT CASE WHEN type='bet' THEN user_id END) AS players FROM ledger WHERE mode='real' AND created_at >= $1 AND created_at < $2", [from, to]);
      const fp = await one("SELECT COUNT(DISTINCT user_id) AS n FROM ledger WHERE mode='fun' AND type='bet' AND created_at >= $1 AND created_at < $2", [from, to]);
      const v = await one("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM visits WHERE at >= $1 AND at < $2", [from, to]);
      const pages = (await q("SELECT path, COUNT(*) AS n FROM visits WHERE at >= $1 AND at < $2 GROUP BY path ORDER BY n DESC LIMIT 5", [from, to])).rows.map((r) => [r.path, num(r.n)]);
      const refs = (await q("SELECT ref, COUNT(DISTINCT visitor) AS n FROM visits WHERE at >= $1 AND at < $2 AND ref IS NOT NULL GROUP BY ref ORDER BY n DESC LIMIT 5", [from, to])).rows.map((r) => [r.ref, num(r.n)]);
      return { signups: num(u.n), bets: num(l.bets), wins: num(l.wins), deposits: num(l.deposits), withdrawals: num(l.withdrawals), realPlayers: num(l.players), funPlayers: num(fp.n), views: num(v.views), visitors: num(v.visitors), pages, refs };
    },
    async kvGet(key) { const r = await q("SELECT value FROM kv WHERE key = $1", [key]); return r.rows[0] ? r.rows[0].value : null; },
    async kvSet(key, value) { await q("INSERT INTO kv (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [key, JSON.stringify(value)]); },
    async setWithdrawal(id, status, txid) { await q("UPDATE withdrawals SET status = $2, txid = COALESCE($3, txid), updated_at = now() WHERE id = $1", [id, status, txid || null]); },
  };
}

/* ---------------- In-memory (local testing) ---------------- */
function memStore() {
  const users = new Map(), byEmail = new Map(), tokens = new Map(), sessions = new Map();
  const ledger = [], gstate = new Map(), deposits = [], withdrawals = [], sbets = [], kv = new Map(), rrewards = new Map(), visits = [];
  let uid = 0, lid = 0, did = 0, wid = 0, sid = 0;
  const locks = new Map();
  const lock = (id) => { const prev = locks.get(id) || Promise.resolve(); let release; const next = new Promise((r) => (release = r)); locks.set(id, prev.then(() => next)); return prev.then(() => release); };
  const sum = (userId, mode, from, to) => {
    let bets = 0, wins = 0;
    for (const l of ledger) if (l.user_id === userId && l.mode === mode && l.created_at >= from && l.created_at < to) { if (l.type === "bet") bets += l.amount; if (l.type === "win") wins += l.amount; }
    return { bets, wins };
  };
  return {
    kind: "memory",
    async init() {},
    users: {
      async create({ email, passHash, referredBy }) {
        if (byEmail.has(email)) return null;
        const u = { id: ++uid, email, pass_hash: passHash, confirmed: false, created_at: new Date(), fun_balance: 0, real_balance: 0, wager_remaining: 0, cashback_until: null, ref_code: null, referred_by: referredBy || null };
        users.set(u.id, u); byEmail.set(email, u.id); return { ...u };
      },
      async byEmail(email) { const id = byEmail.get(email); return id ? { ...users.get(id) } : null; },
      async byId(id) { const u = users.get(id); return u ? { ...u } : null; },
      async byTelegram(chatId) { for (const u of users.values()) if (u.telegram_chat_id === chatId) return { ...u }; return null; },
      async setTelegram(id, chatId) { for (const u of users.values()) if (chatId != null && u.telegram_chat_id === chatId) u.telegram_chat_id = null; const u = users.get(id); if (u) u.telegram_chat_id = chatId; },
      async byRefCode(code) { for (const u of users.values()) if (u.ref_code && u.ref_code.toLowerCase() === String(code).toLowerCase()) return { ...u }; return null; },
      async setRefCode(id, code) { for (const u of users.values()) if (u.ref_code && u.ref_code.toLowerCase() === code.toLowerCase()) return false; const u = users.get(id); if (!u || u.ref_code) return false; u.ref_code = code; return true; },
      async setConfirmed(id) { users.get(id).confirmed = true; },
      async setPassword(id, hash) { users.get(id).pass_hash = hash; },
      async setPasswordUnconfirmed(id, hash) { const u = users.get(id); if (!u.confirmed) u.pass_hash = hash; },
    },
    tokens: {
      async create(hash, userId, type, expiresAt) { tokens.set(hash, { userId, type, expiresAt, used: false }); },
      async take(hash, type) { const t = tokens.get(hash); if (!t || t.used || t.type !== type || t.expiresAt <= new Date()) return null; t.used = true; return t.userId; },
    },
    sessions: {
      async create(hash, userId, expiresAt) { sessions.set(hash, { userId, expiresAt }); },
      async get(hash) { const s = sessions.get(hash); return s && s.expiresAt > new Date() ? s.userId : null; },
      async del(hash) { sessions.delete(hash); },
      async delForUser(userId) { for (const [k, s] of sessions) if (s.userId === userId) sessions.delete(k); },
    },
    async tx(userId, fn) {
      const release = await lock(userId);
      try {
        const u = users.get(userId);
        if (!u) throw new Error("no such user");
        const acct = { ...u };
        const pending = { ledger: [], state: new Map(), withdrawals: [], deposits: [], sbets: [], settle: [], rr: new Map() };
        const ops = {
          async ledger(row) { pending.ledger.push({ id: ++lid, user_id: userId, created_at: new Date(), ...row }); },
          async getState(game) { const k = `${userId}:${game}`; if (pending.state.has(k)) return pending.state.get(k); const s = gstate.get(k); return s ? JSON.parse(JSON.stringify(s)) : null; },
          async setState(game, state) { pending.state.set(`${userId}:${game}`, state == null ? null : JSON.parse(JSON.stringify(state))); },
          async withdrawal(row) { const w = { id: ++wid, user_id: userId, status: "pending", created_at: new Date(), ...row }; pending.withdrawals.push(w); return w.id; },
          async deposit(row) { const d = { id: ++did, user_id: userId, status: "credited", created_at: new Date(), ...row }; pending.deposits.push(d); return d.id; },
          async sumWindow(mode, from, to) { return sum(userId, mode, from, to); },
          async matchDeposit(id, txid, status, usdMicro, price) { const d = deposits.find((x) => x.id === id && x.user_id === userId && (x.status === "awaiting" || x.status === "expired")); if (!d) return false; if (deposits.some((x) => x.coin === d.coin && x.txid && x.txid.toLowerCase() === String(txid).toLowerCase())) return false; pending.settle.push(() => Object.assign(d, { status, txid, usd: usdMicro, price })); return true; },
          async referralReward(r) { const k = `${userId}:${r.user_id}:${new Date(r.week_start).toISOString()}`; if (rrewards.has(k) || pending.rr.has(k)) return false; pending.rr.set(k, { referrer_id: userId, ...r, week_start: new Date(r.week_start), created_at: new Date() }); return true; },
          async sportsBet(b) { const row = { id: ++sid, user_id: userId, status: "open", payout: 0, result: null, created_at: new Date(), settled_at: null, ...b, commence_time: new Date(b.commence_time) }; pending.sbets.push(row); return row.id; },
          async settleSportsBet(id, status, payout, result) { const b = sbets.find((x) => x.id === id && x.user_id === userId && x.status === "open"); if (!b) return false; pending.settle.push(() => Object.assign(b, { status, payout, result, settled_at: new Date() })); return true; },
        };
        const out = await fn(acct, ops);
        for (const f of ACCT_FIELDS) u[f] = acct[f];
        ledger.push(...pending.ledger);
        for (const [k, s] of pending.state) { if (s == null) gstate.delete(k); else gstate.set(k, s); }
        withdrawals.push(...pending.withdrawals); deposits.push(...pending.deposits); sbets.push(...pending.sbets); pending.settle.forEach((f) => f()); for (const [k, v] of pending.rr) rrewards.set(k, v);
        return out;
      } finally { release(); }
    },
    async sumWindow(userId, mode, from, to) { return sum(userId, mode, from, to); },
    async history(userId, limit = 30) { return ledger.filter((l) => l.user_id === userId).slice(-limit).reverse(); },
    async cashbacks(userId) { return ledger.filter((l) => l.user_id === userId && l.type === "cashback").slice(-20).reverse(); },
    depositRequests: {
      async create(userId, d) { const row = { id: ++did, user_id: userId, status: "awaiting", txid: null, created_at: new Date(), ...d }; deposits.push(row); return row.id; },
      async open() { return deposits.filter((d) => d.status === "awaiting").map((d) => ({ ...d })); },
      async unconfirmed() { return deposits.filter((d) => d.status === "unconfirmed").map((d) => ({ ...d })); },
      async expire(before) { deposits.forEach((d) => { if (d.status === "awaiting" && d.created_at < before) d.status = "expired"; }); },
      async get(userId, id) { const d = deposits.find((x) => x.id === id && x.user_id === userId); return d && { ...d }; },
      async hasUnconfirmed(userId) { return deposits.some((d) => d.user_id === userId && d.status === "unconfirmed"); },
    },
    async claimDeposit(userId, { coin, amount, txid }) {
      const d = { id: ++did, user_id: userId, coin, amount, usd: 0, price: 0, txid, status: "pending", created_at: new Date() }; deposits.push(d); return d.id;
    },
    async allDeposits(status) { return deposits.filter((d) => !status || d.status === status).map((d) => ({ ...d, email: users.get(d.user_id).email })).reverse(); },
    async lockDeposit(id) { const d = deposits.find((x) => x.id === id && x.status === "pending"); if (!d) return null; d.status = "processing"; return { ...d }; },
    async setDeposit(id, f) { const d = deposits.find((x) => x.id === id); if (!d) return; d.status = f.status; if (f.usd != null) d.usd = f.usd; if (f.price != null) d.price = f.price; if (f.amount != null) d.amount = f.amount; },
    async deposits(userId) { return deposits.filter((d) => d.user_id === userId).slice().reverse(); },
    async withdrawals(userId) { return withdrawals.filter((w) => w.user_id === userId).slice().reverse(); },
    async allWithdrawals(status) { return withdrawals.filter((w) => !status || w.status === status).map((w) => ({ ...w, email: users.get(w.user_id).email })).reverse(); },
    async withdrawalById(id) { return withdrawals.find((w) => w.id === id) || null; },
    async setWithdrawal(id, status, txid) { const w = withdrawals.find((x) => x.id === id); if (w) { w.status = status; if (txid) w.txid = txid; w.updated_at = new Date(); } },
    sports: {
      async forUser(userId) { return sbets.filter((b) => b.user_id === userId).sort((a, b) => (a.status === "open") - (b.status === "open") || a.id - b.id).reverse().slice(0, 60).map((b) => ({ ...b })); },
      async open() { return sbets.filter((b) => b.status === "open").map((b) => ({ ...b, email: users.get(b.user_id).email })); },
      async openForEvent(eventId) { return sbets.filter((b) => b.status === "open" && b.event_id === eventId).map((b) => ({ ...b })); },
      async recent(limit = 100) { return sbets.filter((b) => b.status !== "open").slice(-limit).reverse().map((b) => ({ ...b, email: users.get(b.user_id).email })); },
    },
    referrals: {
      async weekNet(from, to) {
        const m = new Map();
        for (const l of ledger) { const u = users.get(l.user_id); if (!u || !u.referred_by || l.mode !== "real" || l.created_at < from || l.created_at >= to) continue; const e = m.get(u.id) || { user_id: u.id, referrer_id: u.referred_by, net: 0 }; if (l.type === "bet") e.net += l.amount; if (l.type === "win") e.net -= l.amount; m.set(u.id, e); }
        return [...m.values()].filter((x) => x.net > 0);
      },
      async stats(referrerId) {
        const rs = [...rrewards.values()].filter((r) => r.referrer_id === referrerId);
        const byWeek = new Map(); for (const r of rs) { const k = r.week_start.toISOString(); const e = byWeek.get(k) || { week_start: r.week_start, amount: 0, players: 0 }; e.amount += r.amount; e.players++; byWeek.set(k, e); }
        return { invited: [...users.values()].filter((u) => u.referred_by === referrerId).length, earned: rs.reduce((s, r) => s + r.amount, 0), recent: [...byWeek.values()].sort((a, b) => b.week_start - a.week_start).slice(0, 12) };
      },
    },
    visits: {
      async add(v) { visits.push({ ...v, at: new Date() }); },
      async seen(visitor, since) { return visits.some((x) => x.visitor === visitor && x.at >= since); },
    },
    async stats(from, to) {
      const inR = (d) => d >= from && d < to;
      const L = ledger.filter((l) => inR(l.created_at));
      const sum = (t, m = "real") => L.filter((l) => l.type === t && l.mode === m).reduce((s, l) => s + l.amount, 0);
      const V = visits.filter((x) => inR(x.at));
      const top = (arr, key, uniq) => { const m = new Map(); for (const x of arr) { if (!x[key]) continue; const e = m.get(x[key]) || new Set(); e.add(uniq ? x.visitor : Math.random()); m.set(x[key], e); } return [...m].map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 5); };
      return { signups: [...users.values()].filter((u) => inR(u.created_at)).length, bets: sum("bet"), wins: sum("win"), deposits: sum("deposit"), withdrawals: sum("withdraw"), realPlayers: new Set(L.filter((l) => l.mode === "real" && l.type === "bet").map((l) => l.user_id)).size, funPlayers: new Set(L.filter((l) => l.mode === "fun" && l.type === "bet").map((l) => l.user_id)).size, views: V.length, visitors: new Set(V.map((x) => x.visitor)).size, pages: top(V, "path", false), refs: top(V, "ref", true) };
    },
    async kvGet(key) { return kv.has(key) ? JSON.parse(JSON.stringify(kv.get(key))) : null; },
    async kvSet(key, value) { kv.set(key, JSON.parse(JSON.stringify(value))); },
    // test helper
    _shiftLedger(userId, ms) { for (const l of ledger) if (l.user_id === userId) l.created_at = new Date(l.created_at.getTime() + ms); },
  };
}

module.exports = function createStore() {
  return process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : memStore();
};
