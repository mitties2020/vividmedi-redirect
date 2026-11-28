"use strict";
/* Automatic deposit detection for the shared deposit addresses.
   A player starts a deposit and gets an exact amount with a unique tail (e.g. 0.04213187 LTC).
   We watch each address on public block explorers; when a transaction for exactly that amount
   appears (even unconfirmed) the player is credited. Withdrawals stay locked until it confirms. */
const crypto = require("crypto");
const S = require("./support");

const CFG = {
  BTC: { dec: 8, show: 8, kind: "esplora", base: "https://mempool.space/api", alt: ["https://blockstream.info/api", "https://mempool.emzy.de/api"] },
  LTC: { dec: 8, show: 8, kind: "esplora", base: "https://litecoinspace.org/api" },
  ETH: { dec: 18, show: 8, kind: "blockscout", base: "https://eth.blockscout.com/api/v2" },
  BNB: { dec: 18, show: 8, kind: "evmBalance", rpc: ["https://bsc-dataseed.binance.org/", "https://bsc-dataseed1.defibit.io/", "https://bsc-dataseed1.ninicoin.io/"] },
  TRX: { dec: 6, show: 6, kind: "trongrid", base: "https://api.trongrid.io" },
};
const TAIL = 1000n;               // unique tail = last 3 shown digits
const CLAIM_TTL = 24 * 3600e3;     // keep watching a request for 24h
const RATE_LOCK = 60 * 60e3;       // price locked for 60 minutes
const pow10 = (n) => 10n ** BigInt(n);

/* ---------- amounts ---------- */
function toUnits(coin, decimalStr) {
  const { dec } = CFG[coin];
  const [i, f = ""] = String(decimalStr).split(".");
  return BigInt(i || "0") * pow10(dec) + BigInt((f + "0".repeat(dec)).slice(0, dec) || "0");
}
function fromUnits(coin, units, digits) {
  const { dec, show } = CFG[coin];
  const d = digits == null ? show : digits;
  const u = BigInt(units);
  const whole = u / pow10(dec), frac = (u % pow10(dec)).toString().padStart(dec, "0").slice(0, d);
  return d ? `${whole}.${frac}` : `${whole}`;
}
/** Exact amount for a new request: value rounded down to the shown precision with a random, unused 3-digit tail. */
function makeAmount(coin, usd, price, taken) {
  const { dec, show } = CFG[coin];
  const shownUnits = BigInt(Math.floor((usd / price) * 10 ** show));
  const base = (shownUnits / TAIL) * TAIL;
  for (let i = 0; i < 200; i++) {
    const tail = BigInt(crypto.randomInt(1, 1000));
    const units = (base + tail) * pow10(dec - show);
    if (!taken.has(units.toString())) return { units: units.toString(), amount: fromUnits(coin, units) };
  }
  throw new Error("Too many open deposits for this amount — try a slightly different amount.");
}

/* ---------- TRON base58 → hex ---------- */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function tronHex(addr) {
  let n = 0n;
  for (const ch of addr) { const v = B58.indexOf(ch); if (v < 0) throw new Error("bad address"); n = n * 58n + BigInt(v); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  return hex.slice(0, 42).toLowerCase(); // 21 bytes (0x41 + 20), drop 4-byte checksum
}

/* ---------- explorers ---------- */
async function getJson(url, opts) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { accept: "application/json", ...(opts && opts.headers) } }); if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}`); return await r.json(); }
  finally { clearTimeout(t); }
}
/** Incoming transfers to `addr`: [{ txid, units (string), confirmed }] */
async function incoming(coin, addr) {
  const c = CFG[coin];
  if (c.kind === "esplora") {
    let txs, last;
    for (const base of [c.base, ...(c.alt || [])]) {
      try { txs = await getJson(`${base}/address/${addr}/txs`); break; } catch (e) { last = e; }
    }
    if (!txs) throw last;
    return txs.map((tx) => {
      const sum = tx.vout.filter((o) => o.scriptpubkey_address === addr).reduce((s, o) => s + BigInt(o.value), 0n);
      const fromSelf = (tx.vin || []).some((i) => i.prevout && i.prevout.scriptpubkey_address === addr);
      return { txid: tx.txid, units: sum.toString(), confirmed: !!(tx.status && tx.status.confirmed), skip: sum === 0n || fromSelf };
    }).filter((x) => !x.skip);
  }
  if (c.kind === "blockscout") {
    const j = await getJson(`${c.base}/addresses/${addr}/transactions?filter=to`);
    return (j.items || []).filter((t) => t.to && String(t.to.hash).toLowerCase() === addr.toLowerCase() && t.value && t.value !== "0" && t.result !== "error" && t.status !== "error")
      .map((t) => ({ txid: t.hash, units: String(t.value), confirmed: !!t.block_number && (t.confirmations || 0) >= 1 }));
  }
  if (c.kind === "trongrid") {
    const hex = tronHex(addr);
    const j = await getJson(`${c.base}/v1/accounts/${addr}/transactions?only_to=true&limit=50`);
    return (j.data || []).filter((t) => t.ret && t.ret[0] && t.ret[0].contractRet === "SUCCESS" && t.raw_data && t.raw_data.contract && t.raw_data.contract[0].type === "TransferContract")
      .map((t) => ({ v: t.raw_data.contract[0].parameter.value, t }))
      .filter(({ v }) => String(v.to_address).toLowerCase() === hex)
      .map(({ v, t }) => ({ txid: t.txID, units: String(v.amount), confirmed: true }));
  }
  return [];
}
async function evmRpc(coin, method, params) {
  let last;
  for (const url of CFG[coin].rpc) {
    try { const j = await getJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); if (j.error) throw new Error(j.error.message); return j.result; }
    catch (e) { last = e; }
  }
  throw last;
}

module.exports = function createChain({ store, onCredit, onUnmatched, onStale }) {
  const addresses = () => S.DEPOSIT_ADDRESSES;
  let running = false, lastRun = 0;

  async function seenSet(coin) { return new Set((await store.kvGet(`chain:seen:${coin}`)) || []); }
  async function saveSeen(coin, set) { await store.kvSet(`chain:seen:${coin}`, [...set].slice(-800)); }

  /** Create a deposit request for a player. */
  async function start(userId, coinSym, usd, opts = {}) {
    const coin = String(coinSym || "").toUpperCase();
    if (!CFG[coin] || !addresses()[coin]) throw Object.assign(new Error("Choose a coin."), { status: 400 });
    if (!(usd >= 5)) throw Object.assign(new Error("The minimum deposit is $5."), { status: 400 });
    if (usd > 100000) throw Object.assign(new Error("For deposits over $100,000 please contact support."), { status: 400 });
    const mine = (await store.depositRequests.open()).filter((d) => d.user_id === userId);
    if (mine.length >= 3) throw Object.assign(new Error("You already have 3 deposits waiting. Send one of those, or wait for them to expire."), { status: 409 });
    const p = (await S.prices()).find((x) => x.sym === coin);
    if (!p || !p.usd) throw Object.assign(new Error("Live prices are unavailable right now. Try again in a minute."), { status: 503 });
    const taken = new Set((await store.depositRequests.open()).filter((d) => d.coin === coin).map((d) => d.units));
    const { units, amount } = makeAmount(coin, usd, p.usd, taken);
    const usdMicro = Math.round(Number(amount) * p.usd * 1e6);
    const id = await store.depositRequests.create(userId, { coin, amount, units, usd: usdMicro, price: p.usd, bonus: !!opts.bonus });
    setTimeout(() => tick(true).catch(() => {}), 15000);
    return { id, coin, amount, units, address: addresses()[coin], network: S.COINS.find((c) => c.sym === coin).nets[0], usd: usdMicro / 1e6, price: p.usd, lockedUntil: new Date(Date.now() + RATE_LOCK).toISOString(), watchUntil: new Date(Date.now() + CLAIM_TTL).toISOString(), bonus: !!opts.bonus };
  }

  async function scanCoin(coin, open, unconfirmed) {
    const addr = addresses()[coin];
    if (!addr) return;
    const seen = await seenSet(coin);
    const initKey = `chain:init:${coin}`;
    const first = !(await store.kvGet(initKey));
    if (CFG[coin].kind === "evmBalance") return scanBalance(coin, addr, open, first);
    const txs = await incoming(coin, addr);
    if (first) { txs.forEach((t) => seen.add(t.txid)); await saveSeen(coin, seen); await store.kvSet(initKey, { at: new Date().toISOString() }); return; }
    // newly confirmed
    for (const d of unconfirmed.filter((x) => x.coin === coin)) {
      const t = txs.find((x) => x.txid === d.txid);
      if (t && t.confirmed) await store.setDeposit(d.id, { status: "credited" });
      else if (Date.now() - new Date(d.created_at).getTime() > 6 * 3600e3 && !(await store.kvGet(`chain:stale:${d.id}`))) { await store.kvSet(`chain:stale:${d.id}`, 1); onStale && onStale(d, !!t); }
    }
    let dirty = false;
    for (const t of txs) {
      if (seen.has(t.txid)) continue;
      const claim = open.find((d) => d.coin === coin && d.units === t.units);
      if (claim) {
        const ok = await onCredit(claim, { txid: t.txid, confirmed: t.confirmed });
        if (ok) { seen.add(t.txid); dirty = true; const i = open.indexOf(claim); if (i >= 0) open.splice(i, 1); }
      } else { seen.add(t.txid); dirty = true; onUnmatched && onUnmatched({ coin, txid: t.txid, amount: fromUnits(coin, t.units), confirmed: t.confirmed }); }
    }
    if (dirty) await saveSeen(coin, seen);
  }

  // BNB Smart Chain: no free explorer API, so watch the balance and match increases to requests.
  async function scanBalance(coin, addr, open, first) {
    const [balHex, blockHex] = await Promise.all([evmRpc(coin, "eth_getBalance", [addr, "latest"]), evmRpc(coin, "eth_blockNumber", [])]);
    const bal = BigInt(balHex), key = `chain:balance:${coin}`;
    const prev = await store.kvGet(key);
    await store.kvSet(key, { units: bal.toString(), block: blockHex });
    if (first) { await store.kvSet(`chain:init:${coin}`, { at: new Date().toISOString() }); return; }
    if (!prev) return;
    const delta = bal - BigInt(prev.units);
    if (delta <= 0n) return; // nothing new (or the owner moved funds out)
    const mine = open.filter((d) => d.coin === coin);
    const one = mine.find((d) => BigInt(d.units) === delta);
    if (one) { await onCredit(one, { txid: `bsc:${blockHex}:${one.id}`, confirmed: true }); return; }
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
      if (BigInt(mine[i].units) + BigInt(mine[j].units) === delta) { await onCredit(mine[i], { txid: `bsc:${blockHex}:${mine[i].id}`, confirmed: true }); await onCredit(mine[j], { txid: `bsc:${blockHex}:${mine[j].id}`, confirmed: true }); return; }
    }
    onUnmatched && onUnmatched({ coin, txid: `balance +${fromUnits(coin, delta)} at block ${parseInt(blockHex, 16)}`, amount: fromUnits(coin, delta), confirmed: true });
  }

  /** Scan the chains. Fast when someone is waiting for a deposit, slow otherwise. */
  async function tick(force) {
    if (running) return;
    const open = await store.depositRequests.open();
    const unconfirmed = await store.depositRequests.unconfirmed();
    const busy = open.length || unconfirmed.length;
    if (!force && Date.now() - lastRun < (busy ? 15e3 : 120e3)) return;
    running = true; lastRun = Date.now();
    try {
      await store.depositRequests.expire(new Date(Date.now() - CLAIM_TTL));
      for (const coin of Object.keys(CFG)) {
        try { await scanCoin(coin, open, unconfirmed); } catch (e) { console.error(`chain ${coin}:`, e.message, e.cause ? String(e.cause.code || e.cause.message || e.cause) : ""); }
      }
    } finally { running = false; }
  }

  return { start, tick, CFG, fromUnits, toUnits, makeAmount, tronHex, RATE_LOCK };
};
