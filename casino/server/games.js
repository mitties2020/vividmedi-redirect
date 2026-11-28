"use strict";
/* All game outcomes are decided here, on the server. The browser only animates results. */
const crypto = require("crypto");
const T = require("../public/js/shared/tables.js");
const SlotEngine = require("../public/js/shared/slots.js");

const rand = () => crypto.randomBytes(6).readUIntBE(0, 6) / 2 ** 48;
const randInt = (n) => crypto.randomInt(n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const MICRO = 1e6;
const toMicro = (usd) => Math.round(Number(usd) * MICRO);
const pay = (stakeMicro, mult) => Math.floor(stakeMicro * mult);

class GameError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
function betMicro(v, label = "Bet") {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new GameError(`${label} must be a positive amount.`);
  if (n < T.MIN_BET - 1e-9) throw new GameError(`Minimum ${label.toLowerCase()} is $${T.MIN_BET.toFixed(2)}.`);
  if (n > T.MAX_BET + 1e-9) throw new GameError(`Maximum ${label.toLowerCase()} is $${T.MAX_BET.toLocaleString("en-US")}.`);
  return Math.round(n * 100) * 10000; // whole cents
}

/* ---------- Cards ---------- */
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RV = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
const decks = (n) => { const d = []; for (let k = 0; k < n; k++) for (const s of SUITS) for (const r of RANKS) d.push({ r, s }); return shuffle(d); };

/* ---------- Single-shot games ---------- */
const crashPoint = () => Math.max(1, Math.floor((T.EDGE / (1 - rand())) * 100) / 100);

const SINGLE = {
  dice(b) {
    const stake = betMicro(b.bet);
    const target = Math.round(Number(b.target) * 100) / 100;
    const over = !!b.over;
    if (!(target >= 2 && target <= 98)) throw new GameError("Target must be between 2 and 98.");
    const chance = over ? 100 - target : target;
    const mult = Math.floor((T.EDGE * 100 * 10000) / chance) / 10000;
    const roll = randInt(10001) / 100;
    const won = over ? roll > target : roll < target;
    return { stake, payout: won ? pay(stake, mult) : 0, result: { roll, won, mult, target, over } };
  },
  limbo(b) {
    const stake = betMicro(b.bet);
    const target = Math.floor(Number(b.target) * 100) / 100;
    if (!(target >= 1.01 && target <= 1e6)) throw new GameError("Target must be between 1.01× and 1,000,000×.");
    const res = crashPoint();
    const won = res >= target;
    return { stake, payout: won ? pay(stake, target) : 0, result: { value: res, won, target } };
  },
  plinko(b) {
    const stake = betMicro(b.bet);
    const rows = Number(b.rows), risk = String(b.risk);
    if (![8, 12, 16].includes(rows) || !["low", "medium", "high"].includes(risk)) throw new GameError("Invalid rows or risk.");
    const path = Array.from({ length: rows }, () => randInt(2));
    const slot = path.reduce((s, v) => s + v, 0);
    const mult = T.plinkoTable(rows, risk)[slot];
    return { stake, payout: pay(stake, mult), result: { path, slot, mult } };
  },
  keno(b) {
    const stake = betMicro(b.bet);
    const picks = [...new Set((b.picks || []).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 40);
    if (picks.length < 1 || picks.length > 10 || picks.length !== (b.picks || []).length) throw new GameError("Pick between 1 and 10 different numbers.");
    const drawn = shuffle(Array.from({ length: 40 }, (_, i) => i + 1)).slice(0, 10);
    const hits = drawn.filter((d) => picks.includes(d)).length;
    const mult = T.KENO[picks.length][hits];
    return { stake, payout: pay(stake, mult), result: { drawn, hits, mult } };
  },
  roulette(b) {
    const entries = Object.entries(b.bets || {}).filter(([, v]) => Number(v) > 0);
    if (!entries.length) throw new GameError("Place at least one bet.");
    let stake = 0; const bets = [];
    for (const [key, v] of entries) {
      if (!T.ROULETTE[key]) throw new GameError("Invalid bet.");
      const m = Math.round(Number(v) * 100) * 10000;
      if (m < 10000) throw new GameError("Minimum chip is $0.01.");
      stake += m; bets.push([key, m]);
    }
    if (stake < T.MIN_BET * MICRO - 1) throw new GameError(`Minimum total bet is $${T.MIN_BET.toFixed(2)}.`);
    if (stake > T.MAX_BET * MICRO) throw new GameError(`Maximum total bet is $${T.MAX_BET.toLocaleString("en-US")}.`);
    const number = T.WHEEL[randInt(37)];
    let payout = 0; const winning = [];
    for (const [key, m] of bets) if (T.ROULETTE[key].covers.includes(number)) { payout += m * T.ROULETTE[key].pays; winning.push(key); }
    return { stake, payout, result: { number, winning } };
  },
  baccarat(b) {
    const sides = ["player", "banker", "tie"];
    let stake = 0; const bets = {};
    for (const s of sides) { const v = Number((b.bets || {})[s] || 0); if (v > 0) { bets[s] = Math.round(v * 100) * 10000; stake += bets[s]; } }
    if (!stake) throw new GameError("Place a bet on Player, Banker or Tie.");
    if (stake < T.MIN_BET * MICRO - 1 || stake > T.MAX_BET * MICRO) throw new GameError(`Total bet must be between $${T.MIN_BET.toFixed(2)} and $${T.MAX_BET.toLocaleString("en-US")}.`);
    const shoe = decks(8);
    const v = (c) => (["10", "J", "Q", "K"].includes(c.r) ? 0 : c.r === "A" ? 1 : Number(c.r));
    const tot = (h) => h.reduce((s, c) => s + v(c), 0) % 10;
    const P = [shoe.pop(), shoe.pop()], B = [shoe.pop(), shoe.pop()];
    let p3 = null;
    if (tot(P) < 8 && tot(B) < 8) {
      if (tot(P) <= 5) { p3 = shoe.pop(); P.push(p3); }
      const bt = tot(B);
      const draw = p3 == null ? bt <= 5 : bt <= 2 || (bt === 3 && v(p3) !== 8) || (bt === 4 && v(p3) >= 2 && v(p3) <= 7) || (bt === 5 && v(p3) >= 4 && v(p3) <= 7) || (bt === 6 && v(p3) >= 6 && v(p3) <= 7);
      if (draw) B.push(shoe.pop());
    }
    const pt = tot(P), bt = tot(B);
    const winner = pt > bt ? "player" : bt > pt ? "banker" : "tie";
    let payout = 0;
    if (winner === "tie") { payout += (bets.tie || 0) * T.BACCARAT.tie + (bets.player || 0) + (bets.banker || 0); }
    else payout += Math.floor((bets[winner] || 0) * T.BACCARAT[winner]);
    return { stake, payout, result: { player: P, banker: B, pt, bt, winner } };
  },
  slot(b) {
    const def = SlotEngine.byId(String(b.slotId));
    if (!def) throw new GameError("Unknown slot.");
    const stake = betMicro(b.bet);
    const round = SlotEngine.playRound(def, stake / MICRO, rand);
    return { stake, payout: Math.floor(round.total * MICRO), result: round, game: def.name };
  },
};

/* ---------- Stateful games ---------- */
const K_CRASH = 0.00009; // multiplier = e^(K·ms)
const crashMultAt = (ms) => (ms <= 0 ? 1 : Math.floor(Math.exp(K_CRASH * ms) * 100) / 100);
const minesMult = (m, k) => (k === 0 ? 1 : Math.floor(((T.EDGE * T.C(25, k)) / T.C(25 - m, k)) * 100) / 100);

/* Blackjack helpers */
const bjVal = (r) => (r === "A" ? 11 : ["K", "Q", "J", "10"].includes(r) ? 10 : Number(r));
function bjTotal(cards) { let t = 0, a = 0; for (const c of cards) { t += bjVal(c.r); if (c.r === "A") a++; } while (t > 21 && a) { t -= 10; a--; } return { t, soft: a > 0 }; }
const isBJ = (cards) => cards.length === 2 && bjTotal(cards).t === 21;

/* Poker evaluators */
function evalFive(cards) {
  const v = cards.map((c) => RV[c.r]).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(v)];
  let straight = false, high = v[0];
  if (uniq.length === 5) { if (v[0] - v[4] === 4) straight = true; else if (v.join() === "14,5,4,3,2") { straight = true; high = 5; } }
  const counts = Object.values(v.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((a, b) => b - a);
  if (straight && flush) return high === 14 ? "royal" : "sflush";
  if (counts[0] === 4) return "quads";
  if (counts[0] === 3 && counts[1] === 2) return "full";
  if (flush) return "flush";
  if (straight) return "straight";
  if (counts[0] === 3) return "trips";
  if (counts[0] === 2 && counts[1] === 2) return "twopair";
  if (counts[0] === 2) { const pr = Number(Object.entries(v.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).find(([, c]) => c === 2)[0]); if (pr >= 11) return "jacks"; }
  return null;
}
function evalThree(cards) {
  const v = cards.map((c) => RV[c.r]).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  let straight = v[0] - v[2] === 2 && new Set(v).size === 3, sv = v.slice();
  if (!straight && v.join() === "14,3,2") { straight = true; sv = [3, 2, 1]; }
  if (straight && flush) return { cat: 5, key: "sflush", tie: sv };
  if (v[0] === v[2]) return { cat: 4, key: "trips", tie: v };
  if (straight) return { cat: 3, key: "straight", tie: sv };
  if (flush) return { cat: 2, key: "flush", tie: v };
  if (v[0] === v[1] || v[1] === v[2]) { const p = v[1], k = v[0] === v[1] ? v[2] : v[0]; return { cat: 1, key: "pair", tie: [p, k] }; }
  return { cat: 0, key: "high", tie: v };
}
const cmp3 = (a, b) => { if (a.cat !== b.cat) return a.cat - b.cat; for (let i = 0; i < a.tie.length; i++) if (a.tie[i] !== b.tie[i]) return a.tie[i] - b.tie[i]; return 0; };

/**
 * Stateful game actions. Each receives ({ body, state, mode, debit, now }) and returns
 * { state (null = round over), payout?, view }. `debit(micro)` takes more stake from the balance.
 */
const STATEFUL = {
  crash: {
    start({ body, debit, now }) {
      const stake = betMicro(body.bet);
      const auto = Number(body.auto) >= 1.01 ? Math.floor(Number(body.auto) * 100) / 100 : 0;
      debit(stake);
      const st = { stake, auto, crash: crashPoint(), t0: now + 1000 };
      return { state: st, view: { t0In: 1000, auto, k: K_CRASH } };
    },
    poll({ state, now }) { return crashResolve(state, now, false); },
    cashout({ state, now }) { return crashResolve(state, now, true); },
    view(state, now) { return { active: true, elapsed: now - state.t0, auto: state.auto, k: K_CRASH, stake: state.stake / MICRO }; },
  },
  mines: {
    start({ body, debit }) {
      const stake = betMicro(body.bet), m = Number(body.mines);
      if (!Number.isInteger(m) || m < 1 || m > 24) throw new GameError("Choose 1 to 24 mines.");
      debit(stake);
      const mines = shuffle([...Array(25).keys()]).slice(0, m);
      return { state: { stake, m, mines, revealed: [] }, view: minesView({ m, revealed: [] }) };
    },
    reveal({ body, state }) {
      const tile = Number(body.tile);
      if (!Number.isInteger(tile) || tile < 0 || tile > 24) throw new GameError("Invalid tile.");
      if (state.revealed.includes(tile)) return { state, view: minesView(state) };
      if (state.mines.includes(tile)) return { state: null, payout: 0, view: { ...minesView(state), boom: tile, mines: state.mines, done: true } };
      state.revealed.push(tile);
      if (state.revealed.length === 25 - state.m) { const mult = minesMult(state.m, state.revealed.length); return { state: null, payout: pay(state.stake, mult), view: { ...minesView(state), mines: state.mines, done: true, mult } }; }
      return { state, view: minesView(state) };
    },
    cashout({ state }) {
      if (!state.revealed.length) throw new GameError("Reveal at least one tile first.");
      const mult = minesMult(state.m, state.revealed.length);
      return { state: null, payout: pay(state.stake, mult), view: { ...minesView(state), mines: state.mines, done: true, mult } };
    },
    view: (state) => minesView(state),
  },
  blackjack: {
    start({ body, debit, extra }) {
      const stake = betMicro(body.bet);
      debit(stake);
      let shoe = extra.shoe && extra.shoe.length > 60 ? extra.shoe : decks(6);
      const st = { shoe, dealer: [], hands: [{ cards: [], bet: stake }], active: 0, phase: "player" };
      st.hands[0].cards.push(shoe.pop()); st.dealer.push(shoe.pop()); st.hands[0].cards.push(shoe.pop()); st.dealer.push(shoe.pop());
      const up = st.dealer[0];
      if (isBJ(st.hands[0].cards) || ((up.r === "A" || bjVal(up.r) === 10) && isBJ(st.dealer))) return bjFinish(st);
      return { state: st, view: bjView(st) };
    },
    hit({ state }) {
      bjNeed(state); const h = state.hands[state.active];
      h.cards.push(state.shoe.pop());
      if (bjTotal(h.cards).t >= 21) return bjNext(state);
      return { state, view: bjView(state) };
    },
    stand({ state }) { bjNeed(state); return bjNext(state); },
    double({ state, debit }) {
      bjNeed(state); const h = state.hands[state.active];
      if (h.cards.length !== 2) throw new GameError("You can only double on your first two cards.");
      debit(h.bet); h.bet *= 2; h.doubled = true; h.cards.push(state.shoe.pop());
      return bjNext(state);
    },
    split({ state, debit }) {
      bjNeed(state); const h = state.hands[0];
      if (state.hands.length !== 1 || h.cards.length !== 2 || bjVal(h.cards[0].r) !== bjVal(h.cards[1].r)) throw new GameError("You can only split a pair once.");
      debit(h.bet);
      const aces = h.cards[0].r === "A";
      state.hands = [{ cards: [h.cards[0], state.shoe.pop()], bet: h.bet, split: true, aces }, { cards: [h.cards[1]], bet: h.bet, split: true, aces }];
      if (aces) { state.hands[1].cards.push(state.shoe.pop()); return bjFinish(state); }
      state.active = 0;
      if (bjTotal(state.hands[0].cards).t >= 21) return bjNext(state);
      return { state, view: bjView(state) };
    },
    view: (state) => bjView(state),
  },
  videopoker: {
    start({ body, debit }) {
      const stake = betMicro(body.bet);
      debit(stake);
      const deck = decks(1);
      const hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
      return { state: { stake, deck, hand }, view: { hand, phase: "hold", made: evalFive(hand) } };
    },
    draw({ body, state }) {
      const holds = Array.isArray(body.holds) ? body.holds.map(Boolean).slice(0, 5) : [];
      const hand = state.hand.map((c, i) => (holds[i] ? c : state.deck.pop()));
      const made = evalFive(hand);
      const row = T.VIDEO_POKER.find((p) => p.key === made);
      const mult = row ? row.pay : 0;
      return { state: null, payout: pay(state.stake, mult), view: { hand, phase: "done", made, mult } };
    },
    view: (state) => ({ hand: state.hand, phase: "hold", made: evalFive(state.hand) }),
  },
  threecard: {
    start({ body, debit }) {
      const ante = betMicro(body.ante, "Ante");
      const pp = Number(body.pairplus) > 0 ? betMicro(body.pairplus, "Pair Plus") : 0;
      debit(ante + pp);
      const deck = decks(1);
      const player = [deck.pop(), deck.pop(), deck.pop()], dealer = [deck.pop(), deck.pop(), deck.pop()];
      return { state: { ante, pp, player, dealer }, view: { player, phase: "decide", ph: evalThree(player).key, ante: ante / MICRO, pp: pp / MICRO } };
    },
    play({ state, debit }) { debit(state.ante); return tcpResolve(state, true); },
    fold({ state }) { return tcpResolve(state, false); },
    view: (state) => ({ player: state.player, phase: "decide", ph: evalThree(state.player).key, ante: state.ante / MICRO, pp: state.pp / MICRO }),
  },
};

function crashResolve(st, now, wantCash) {
  const crashT = Math.log(st.crash) / K_CRASH;
  const elapsed = now - st.t0;
  const autoHit = st.auto && st.auto < st.crash;
  if (autoHit && crashMultAt(elapsed) >= st.auto) return { state: null, payout: pay(st.stake, st.auto), view: { done: true, crash: st.crash, cashedAt: st.auto, auto: true } };
  if (elapsed >= crashT || st.crash <= 1) return { state: null, payout: 0, view: { done: true, crash: st.crash, cashedAt: null } };
  if (!wantCash) return { state: st, view: { done: false, elapsed } };
  const m = crashMultAt(elapsed);
  if (m < 1.01) throw new GameError("Wait for take-off before cashing out.");
  return { state: null, payout: pay(st.stake, m), view: { done: true, crash: st.crash, cashedAt: m } };
}
function minesView(s) { const k = s.revealed.length; return { m: s.m, stake: s.stake / MICRO, revealed: s.revealed, mult: Math.floor(minesMult(s.m, k) * 100) / 100, next: k < 25 - s.m ? Math.floor(minesMult(s.m, k + 1) * 100) / 100 : null }; }

function bjNeed(st) { if (st.phase !== "player") throw new GameError("No hand in play."); }
function bjNext(st) {
  if (st.active < st.hands.length - 1) {
    st.active++;
    const h = st.hands[st.active];
    if (h.cards.length < 2) h.cards.push(st.shoe.pop());
    if (bjTotal(h.cards).t >= 21) return bjFinish(st);
    return { state: st, view: bjView(st) };
  }
  return bjFinish(st);
}
function bjFinish(st) {
  st.phase = "done";
  const live = st.hands.some((h) => bjTotal(h.cards).t <= 21 && !(isBJ(h.cards) && !h.split));
  const dealerBJ = isBJ(st.dealer);
  if (live && !dealerBJ) for (let h = bjTotal(st.dealer); h.t < 17 || (h.t === 17 && h.soft); h = bjTotal(st.dealer)) st.dealer.push(st.shoe.pop());
  const d = bjTotal(st.dealer).t;
  let payout = 0;
  for (const h of st.hands) {
    const p = bjTotal(h.cards).t, pBJ = isBJ(h.cards) && !h.split;
    h.result = pBJ && dealerBJ ? "push" : pBJ ? "bj" : dealerBJ ? "lose" : p > 21 ? "lose" : d > 21 || p > d ? "win" : p === d ? "push" : "lose";
    payout += Math.floor(h.bet * { bj: 2.5, win: 2, push: 1, lose: 0 }[h.result]);
  }
  return { state: null, payout, view: bjView(st), keep: { shoe: st.shoe } };
}
function bjView(st) {
  const hide = st.phase === "player";
  return {
    phase: st.phase, active: st.active,
    dealer: st.dealer.map((c, i) => (hide && i === 1 ? { down: true } : c)),
    dealerTotal: hide ? bjTotal([st.dealer[0]]).t : bjTotal(st.dealer).t,
    hands: st.hands.map((h) => ({ cards: h.cards, bet: h.bet / MICRO, total: bjTotal(h.cards).t, soft: bjTotal(h.cards).soft, bj: isBJ(h.cards) && !h.split, doubled: !!h.doubled, result: h.result || null })),
    canDouble: st.phase === "player" && st.hands[st.active].cards.length === 2,
    canSplit: st.phase === "player" && st.hands.length === 1 && st.hands[0].cards.length === 2 && bjVal(st.hands[0].cards[0].r) === bjVal(st.hands[0].cards[1].r),
  };
}
function tcpResolve(st, played) {
  const p = evalThree(st.player), d = evalThree(st.dealer);
  let payout = 0;
  const pp = st.pp ? T.TCP_PAIRPLUS[p.key] || 0 : 0;
  if (st.pp && pp) payout += st.pp * (pp + 1);
  let outcome = "fold";
  if (played) {
    const qualifies = d.cat > 0 || d.tie[0] >= 12;
    const bonus = T.TCP_ANTE_BONUS[p.key] || 0;
    payout += st.ante * bonus;
    if (!qualifies) { outcome = "noqualify"; payout += st.ante * 2 + st.ante; }
    else { const c = cmp3(p, d); if (c > 0) { outcome = "win"; payout += st.ante * 4; } else if (c === 0) { outcome = "push"; payout += st.ante * 2; } else outcome = "lose"; }
  }
  return { state: null, payout, view: { player: st.player, dealer: st.dealer, ph: p.key, dh: d.key, outcome, phase: "done", ppWin: pp } };
}

module.exports = { SINGLE, STATEFUL, GameError, toMicro, MICRO, crashMultAt, K_CRASH, evalFive, evalThree };
