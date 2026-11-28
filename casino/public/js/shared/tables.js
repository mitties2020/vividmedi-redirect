/* CareQuay Casino — shared payout tables (server + browser). */
(function (root) {
  "use strict";
  const EDGE = 0.97;
  const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  const sig = (v) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

  const PLINKO_R = { 8: { low: 12, medium: 45, high: 160 }, 12: { low: 22, medium: 140, high: 900 }, 16: { low: 40, medium: 600, high: 6000 } };
  function plinkoTable(n, risk) {
    const R = PLINKO_R[n][risk], h = n / 2, raw = [];
    for (let i = 0; i <= n; i++) { const d = Math.abs(i - h) / h; raw.push(Math.pow(R, d * d * 0.6 + d * 0.4)); }
    const e = raw.reduce((s, v, i) => s + v * (C(n, i) / 2 ** n), 0);
    return raw.map((v) => sig((v * EDGE) / e));
  }

  const KENO = {};
  for (let p = 1; p <= 10; p++) {
    const P = (h) => (C(p, h) * C(40 - p, 10 - h)) / C(40, 10);
    const th = p <= 2 ? 1 : p <= 4 ? 2 : p <= 7 ? 3 : 4, raw = [];
    for (let h = 0; h <= p; h++) raw.push(h < th ? 0 : Math.pow(h - th + 1, 2.2) * Math.pow(2.1, h - th));
    const e = raw.reduce((s, v, h) => s + v * P(h), 0);
    KENO[p] = raw.map((v) => sig((v * 0.95) / e));
  }

  // Jacks or Better 8/5 (≈97.3% with optimal play). Multipliers are total return per unit bet.
  const VIDEO_POKER = [
    { key: "royal", name: "Royal Flush", pay: 800 },
    { key: "sflush", name: "Straight Flush", pay: 50 },
    { key: "quads", name: "Four of a Kind", pay: 25 },
    { key: "full", name: "Full House", pay: 8 },
    { key: "flush", name: "Flush", pay: 5 },
    { key: "straight", name: "Straight", pay: 4 },
    { key: "trips", name: "Three of a Kind", pay: 3 },
    { key: "twopair", name: "Two Pair", pay: 2 },
    { key: "jacks", name: "Jacks or Better", pay: 1 },
  ];

  // Three Card Poker: Ante bonus and Pair Plus (standard paytables)
  const TCP_ANTE_BONUS = { sflush: 5, trips: 4, straight: 1 };
  const TCP_PAIRPLUS = { sflush: 40, trips: 30, straight: 6, flush: 3, pair: 1 };

  // Roulette (European)
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const ROULETTE = (() => {
    const m = {};
    for (let n = 0; n <= 36; n++) m[`n${n}`] = { covers: [n], pays: 36 };
    m.col0 = { covers: range(1, 36).filter((n) => n % 3 === 0), pays: 3 };
    m.col1 = { covers: range(1, 36).filter((n) => n % 3 === 2), pays: 3 };
    m.col2 = { covers: range(1, 36).filter((n) => n % 3 === 1), pays: 3 };
    for (let d = 0; d < 3; d++) m[`doz${d}`] = { covers: range(d * 12 + 1, d * 12 + 12), pays: 3 };
    m.low = { covers: range(1, 18), pays: 2 };
    m.high = { covers: range(19, 36), pays: 2 };
    m.even = { covers: range(1, 36).filter((n) => n % 2 === 0), pays: 2 };
    m.odd = { covers: range(1, 36).filter((n) => n % 2 === 1), pays: 2 };
    m.red = { covers: REDS.slice(), pays: 2 };
    m.black = { covers: range(1, 36).filter((n) => !REDS.includes(n)), pays: 2 };
    return m;
  })();

  // Baccarat payouts (total return per unit): player 1:1, banker 0.95:1, tie 8:1 (push on main bets)
  const BACCARAT = { player: 2, banker: 1.95, tie: 9 };

  const api = { EDGE, C, plinkoTable, KENO, VIDEO_POKER, TCP_ANTE_BONUS, TCP_PAIRPLUS, WHEEL, REDS, ROULETTE, BACCARAT, MIN_BET: 0.1, MAX_BET: 50 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CQTables = api;
})(typeof window !== "undefined" ? window : globalThis);
