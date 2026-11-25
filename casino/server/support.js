"use strict";
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

/* ---------- Passwords & tokens ---------- */
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `s1$${salt.toString("base64")}$${key.toString("base64")}`;
}
async function verifyPassword(pw, stored) {
  const [v, salt, key] = String(stored).split("$");
  if (v !== "s1") return false;
  const k = await scrypt(pw, Buffer.from(salt, "base64"), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(key, "base64");
  return want.length === k.length && crypto.timingSafeEqual(want, k);
}
const newToken = () => crypto.randomBytes(32).toString("base64url");
const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

/* ---------- Email ---------- */
async function sendMail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || "CareQuay Casino <no-reply@carequay.casino>";
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!r.ok) throw new Error(`Email provider error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { sent: true };
  }
  if (process.env.SMTP_HOST) {
    const nodemailer = require("nodemailer");
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: String(process.env.SMTP_PORT || 465) === "465", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await t.sendMail({ from, to, subject, html, text });
    return { sent: true };
  }
  console.log(`[email not configured] To: ${to} | ${subject}\n${text}`);
  return { sent: false };
}
const emailConfigured = () => !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

function emailLayout(title, body, cta, link) {
  return `<!doctype html><html><body style="margin:0;background:#0a1418;font-family:Segoe UI,Arial,sans-serif;color:#eafbf8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#12242a;border:1px solid #1f3d44;border-radius:16px">
<tr><td style="padding:28px 32px 8px"><div style="font-size:22px;font-weight:800;color:#5ee6d2">CareQuay <span style="color:#f5c451">Casino</span></div></td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0 0 12px;font-size:20px;color:#fff">${title}</h1><p style="margin:0 0 22px;color:#9fbcb8;line-height:1.6">${body}</p>
<a href="${link}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#5ee6d2;color:#032321;font-weight:800;text-decoration:none">${cta}</a>
<p style="margin:22px 0 0;color:#6f8f8b;font-size:12px;line-height:1.6">Or paste this link into your browser:<br><span style="color:#9fbcb8;word-break:break-all">${link}</span></p></td></tr>
<tr><td style="padding:24px 32px 28px;color:#5f7f7c;font-size:12px">If you didn't request this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}

/* ---------- Live prices (CoinGecko, cached) ---------- */
const COINS = [
  { sym: "BTC", name: "Bitcoin", id: "bitcoin", nets: ["Bitcoin"] },
  { sym: "ETH", name: "Ethereum", id: "ethereum", nets: ["Ethereum (ERC-20)"] },
  { sym: "LTC", name: "Litecoin", id: "litecoin", nets: ["Litecoin"] },
  { sym: "BNB", name: "BNB", id: "binancecoin", nets: ["BNB Smart Chain (BEP-20)"] },
  { sym: "TRX", name: "TRON", id: "tron", nets: ["Tron (TRC-20)"] },
];
/* Deposit addresses (public). Override with DEPOSIT_ADDRESSES='{"BTC":"bc1..."}' if they change. */
const DEPOSIT_ADDRESSES = Object.assign({
  BTC: "bc1q52dgnkxa2vrh8sv7ngve5cvh3wudu94xa7cj8z",
  ETH: "0xE96b67a44570865E0d58A6382e1e9953Bd42E597",
  BNB: "0xE96b67a44570865E0d58A6382e1e9953Bd42E597",
  LTC: "LbixU6aHxGchnSDqNh7gji3EDMU83Ciijj",
  TRX: "TKBwyP4kHsi2jEQyoMn3gPPXEfqxThmczg",
}, (() => { try { return JSON.parse(process.env.DEPOSIT_ADDRESSES || "{}"); } catch { return {}; } })());
let priceCache = { at: 0, data: null, pending: null };
async function prices() {
  if (priceCache.data && Date.now() - priceCache.at < 60_000) return priceCache.data;
  if (priceCache.pending) return priceCache.pending;
  priceCache.pending = (async () => {
    try {
      const ids = COINS.map((c) => c.id).join(",");
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`prices ${r.status}`);
      const j = await r.json();
      const data = COINS.map((c) => ({ sym: c.sym, name: c.name, nets: c.nets, address: DEPOSIT_ADDRESSES[c.sym] || null, usd: j[c.id]?.usd ?? null, change24h: j[c.id]?.usd_24h_change ?? null }));
      if (data.some((d) => d.usd == null)) throw new Error("incomplete prices");
      priceCache = { at: Date.now(), data, pending: null };
      return data;
    } catch (e) {
      console.error("price fetch failed:", e.message);
      priceCache.pending = null;
      if (priceCache.data) return priceCache.data;
      if (process.env.PRICE_FALLBACK === "1") return COINS.map((c) => ({ sym: c.sym, name: c.name, nets: c.nets, address: DEPOSIT_ADDRESSES[c.sym] || null, usd: 100, change24h: 0, fallback: true }));
      throw new Error("Live prices are unavailable right now. Try again in a minute.");
    }
  })();
  return priceCache.pending;
}

/* ---------- Cashback weeks (Sunday 22:00 UTC) ---------- */
const WEEK = 7 * 24 * 3600 * 1000;
function lastBoundary(d) {
  const t = new Date(d);
  const b = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - t.getUTCDay(), 22, 0, 0));
  return b > t ? new Date(b.getTime() - WEEK) : b;
}
const nextBoundary = (d) => new Date(lastBoundary(d).getTime() + WEEK);

/* ---------- Validation ---------- */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password needs at least one letter and one number.";
  return null;
}
function addressProblem(coin, addr) {
  const a = String(addr || "").trim();
  const B58 = "[1-9A-HJ-NP-Za-km-z]";
  const rules = {
    BTC: [new RegExp(`^(bc1[02-9ac-hj-np-z]{25,87}|[13]${B58}{25,34})$`), "That isn't a valid Bitcoin address."],
    ETH: [/^0x[0-9a-fA-F]{40}$/, "That isn't a valid Ethereum address (0x…)."],
    BNB: [/^0x[0-9a-fA-F]{40}$/, "That isn't a valid BNB Smart Chain address (0x…)."],
    LTC: [new RegExp(`^(ltc1[02-9ac-hj-np-z]{25,87}|[LM3]${B58}{25,34})$`), "That isn't a valid Litecoin address."],
    TRX: [new RegExp(`^T${B58}{33}$`), "That isn't a valid TRON address."],
  };
  const r = rules[coin];
  if (!r) return "Unsupported coin.";
  return r[0].test(a) ? null : r[1];
}

/* ---------- Tiny rate limiter ---------- */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

module.exports = { hashPassword, verifyPassword, newToken, sha, sendMail, emailConfigured, emailLayout, COINS, DEPOSIT_ADDRESSES, prices, lastBoundary, nextBoundary, WEEK, EMAIL_RE, passwordProblem, addressProblem, limited };
