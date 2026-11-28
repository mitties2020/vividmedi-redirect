/* CareQuay Casino — Blackjack, Baccarat, Three Card Poker, Video Poker, Roulette (server-dealt). */
(() => {
  "use strict";
  const { el, betInput, field, statRow, registerGame, fmtUSD, sleep, play, act, gameState, fail, cardEl, T, toast } = CQ;
  const HAND_NAMES = { royal: "Royal Flush", sflush: "Straight Flush", quads: "Four of a Kind", full: "Full House", flush: "Flush", straight: "Straight", trips: "Three of a Kind", twopair: "Two Pair", jacks: "Jacks or Better", pair: "Pair", high: "High card" };

  function chipPicker(values, onPick) {
    let cur = 1;
    const row = el("div", { class: "rl-chips" });
    const short = (v) => (v >= 1000 ? `${v / 1000}k` : v < 1 ? `${Math.round(v * 100)}¢` : `${v}`);
    const paint = () => row.replaceChildren(...values.map((v, i) => el("button", { type: "button", class: `rl-chip c${i}${i === cur ? " on" : ""}`, "aria-label": `${fmtUSD(v)} chip`, onclick: () => { cur = i; paint(); onPick && onPick(v); } }, el("span", {}, short(v)))));
    paint();
    return { el: row, get value() { return values[cur]; }, short };
  }
  const CHIPS = [0.1, 0.5, 1, 5, 10, 25];

  /* ================= BLACKJACK ================= */
  registerGame({
    id: "blackjack", name: "Blackjack", cat: "tables", tag: "Cards", navIcon: "🂡",
    art: { emoji: "🂡", bg: "linear-gradient(150deg,#2ee6a0,#0b6b48 55%,#04241a)", accent: "#2ee6a0" },
    blurb: "Beat the dealer to 21. Blackjack pays 3 to 2.",
    rules: "<p>Six decks. Get closer to 21 than the dealer without going over. Picture cards count 10, aces 1 or 11. Blackjack pays 3:2, other wins 1:1. Double on your first two cards; split a pair once (split aces get one card each). Dealer hits soft 17 and peeks for blackjack with an ace or ten showing. Return to player about 99.4% with basic strategy.</p>",
    mount(stage) {
      const bet = betInput();
      const dealBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Deal");
      const B = (t) => el("button", { class: "btn btn-ghost", type: "button", disabled: true }, t);
      const hitBtn = B("Hit"), standBtn = B("Stand"), dblBtn = B("Double"), splitBtn = B("Split");
      const controls = el("div", { class: "gcontrols" }, bet.el, dealBtn, el("div", { class: "bj-actions" }, hitBtn, standBtn, dblBtn, splitBtn), el("p", { class: "bj-keys" }, "Keys: H hit · S stand · D double · P split"));
      const dealerEl = el("div", { class: "bj-hand dealer" }), dealerTot = el("span", { class: "bj-total" }), handsEl = el("div", { class: "bj-hands" });
      const status = el("div", { class: "bj-status" }, "Place your bet and deal");
      stage.append(el("div", { class: "gframe" }, controls, el("div", { class: "gboard bj-table" },
        el("div", { class: "bj-row" }, el("div", { class: "bj-label" }, "Dealer ", dealerTot), dealerEl),
        el("div", { class: "bj-felt-text" }, "BLACKJACK PAYS 3 TO 2 · DEALER HITS SOFT 17"), status, handsEl)));
      let v = null, busy = false, shownDealer = 0, shownHands = [], alive = true;
      function render(view, { dealerUpTo } = {}) {
        v = view;
        const dl = dealerUpTo == null ? view.dealer.length : dealerUpTo;
        dealerEl.replaceChildren(...view.dealer.slice(0, dl).map((c, i) => cardEl(c, i, i >= shownDealer ? "deal" : "")));
        shownDealer = dl;
        const showTotal = dealerUpTo == null || dealerUpTo >= view.dealer.length;
        dealerTot.textContent = view.phase === "dealing" ? "" : view.dealer.length ? (showTotal ? `${view.dealerTotal}${view.dealerTotal > 21 ? " · bust" : ""}` : "…") : "";
        handsEl.replaceChildren(...view.hands.map((h, i) => {
          const prev = shownHands[i] || 0;
          return el("div", { class: `bj-handwrap${i === view.active && view.phase === "player" ? " active" : ""}${h.result ? ` res-${h.result}` : ""}` },
            el("div", { class: "bj-hand" }, h.cards.map((c, j) => cardEl(c, j, j >= prev ? "deal" : ""))),
            el("div", { class: "bj-label" }, view.hands.length > 1 ? `Hand ${i + 1}` : "You", el("span", { class: "bj-total" }, h.bj ? "Blackjack" : h.total > 21 ? `${h.total} · bust` : `${h.soft && h.total < 21 ? "soft " : ""}${h.total}`), el("span", { class: "bj-bet" }, `${fmtUSD(h.bet)}${h.doubled ? " (doubled)" : ""}`), h.result && showTotal ? el("span", { class: "bj-res" }, { win: "Win", lose: "Lose", push: "Push", bj: "Blackjack!" }[h.result]) : null));
        }));
        shownHands = view.hands.map((h) => h.cards.length);
        const playing = view.phase === "player" && !busy;
        hitBtn.disabled = standBtn.disabled = !playing; dblBtn.disabled = !(playing && view.canDouble); splitBtn.disabled = !(playing && view.canSplit);
        dealBtn.disabled = view.phase === "player" || busy; bet.disable(view.phase === "player" || busy);
      }
      async function reveal(r) {
        // reveal the hole card and dealer draws one at a time
        const total = r.view.dealer.length;
        for (let k = Math.max(2, shownDealer); k <= total && alive; k++) { render(r.view, { dealerUpTo: k }); await sleep(420); }
        render(r.view);
        const staked = r.view.hands.reduce((s, h) => s + h.bet, 0), paid = r.payout;
        status.className = `bj-status ${paid > staked ? "win" : paid === staked ? "push" : "lose"}`;
        status.textContent = paid > staked ? `You win ${fmtUSD(paid - staked)}` : paid === staked && paid > 0 ? "Push — bet returned" : r.view.dealerTotal > 21 ? "Dealer busts" : `Dealer has ${r.view.dealerTotal}`;
        if (paid > staked && r.view.dealerTotal > 21) status.textContent = `Dealer busts — you win ${fmtUSD(paid - staked)}`;
      }
      async function send(action, body) {
        if (busy) return; busy = true;
        try {
          if (action === "start") { shownDealer = 0; shownHands = []; status.className = "bj-status"; status.textContent = ""; }
          const r = await act("blackjack", action, body);
          if (action === "start") { // deal one card at a time
            const view = r.view;
            for (const [h, d] of [[1, 0], [1, 1], [2, 1], [2, 2]]) {
              const p = JSON.parse(JSON.stringify(view));
              p.hands[0].cards = view.hands[0].cards.slice(0, h); p.hands[0].result = null; p.hands[0].bj = false;
              p.dealer = view.dealer.slice(0, d).map((c, i) => (i === 1 && view.phase === "done" ? { down: true } : c));
              p.phase = "dealing"; p.dealerTotal = 0; render(p, { dealerUpTo: d }); await sleep(260); if (!alive) return;
            }
          }
          busy = false;
          if (r.done) { busy = true; await reveal(r); busy = false; render(r.view); }
          else { render(r.view); status.textContent = "Hit, stand, double or split?"; }
        } catch (e) {
          busy = false;
          if (e.status === 409 && e.data && e.data.view) { if (e.data.mode !== CQ.state.mode) toast(`You have a ${e.data.mode} hand in progress — switch to ${e.data.mode} to finish it.`, "warn"); else render(e.data.view); }
          else fail(e);
        }
      }
      dealBtn.addEventListener("click", () => send("start", { bet: bet.value }));
      hitBtn.addEventListener("click", () => send("hit")); standBtn.addEventListener("click", () => send("stand"));
      dblBtn.addEventListener("click", () => send("double")); splitBtn.addEventListener("click", () => send("split"));
      const onKey = (e) => { if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || !v || v.phase !== "player") return; const k = e.key.toLowerCase(); if (k === "h" && !hitBtn.disabled) send("hit"); else if (k === "s" && !standBtn.disabled) send("stand"); else if (k === "d" && !dblBtn.disabled) send("double"); else if (k === "p" && !splitBtn.disabled) send("split"); };
      document.addEventListener("keydown", onKey);
      gameState("blackjack").then((s) => { if (s.active && alive) { if (s.mode !== CQ.state.mode) toast(`You have a ${s.mode} hand in progress — switch to ${s.mode} to finish it.`, "warn"); else { render(s.view); status.textContent = "Your hand is still in play."; } } }).catch(() => {});
      return () => { alive = false; document.removeEventListener("keydown", onKey); };
    },
  });

  /* ================= BACCARAT ================= */
  registerGame({
    id: "baccarat", name: "Baccarat", cat: "tables", tag: "Cards", navIcon: "🀄",
    art: { emoji: "🎴", bg: "linear-gradient(150deg,#ffb36b,#a8331f 55%,#2b0a05)", accent: "#ffcf7a" },
    blurb: "Back the Player, the Banker or a Tie. Closest to 9 wins.",
    rules: "<p>Punto banco, 8 decks. Cards 2–9 count face value, tens and pictures 0, aces 1; only the last digit of the total counts. Third cards are drawn automatically by standard rules. Player pays 1:1, Banker pays 0.95:1 (5% commission), Tie pays 8:1 and returns Player/Banker bets. Return to player: Banker 98.94%, Player 98.76%, Tie 85.6%.</p>",
    mount(stage) {
      const bets = { player: 0, banker: 0, tie: 0 }; let last = null;
      const chips = chipPicker(CHIPS);
      const totalV = el("b", {}, "$0.00");
      const dealBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Deal");
      const clearBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Clear"), rebetBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Rebet");
      const controls = el("div", { class: "gcontrols" }, el("div", { class: "field" }, el("span", { class: "field-label" }, "Chip"), chips.el), statRow("Total bet", totalV), el("div", { class: "btn-pair" }, clearBtn, rebetBtn), dealBtn);
      const pHand = el("div", { class: "bj-hand" }), bHand = el("div", { class: "bj-hand" }), pTot = el("span", { class: "bac-total" }), bTot = el("span", { class: "bac-total" });
      const banner = el("div", { class: "bac-banner" });
      const spot = (key, label, odds) => el("button", { type: "button", class: `bac-spot ${key}`, onclick: () => add(key) }, el("b", {}, label), el("small", {}, odds), el("span", { class: "bac-stack" }));
      const spots = { player: spot("player", "PLAYER", "pays 1:1"), tie: spot("tie", "TIE", "pays 8:1"), banker: spot("banker", "BANKER", "pays 0.95:1") };
      stage.append(el("div", { class: "gframe" }, controls, el("div", { class: "gboard bac-table" },
        el("div", { class: "bac-hands" }, el("div", { class: "bac-side" }, el("h3", {}, "Player ", pTot), pHand), el("div", { class: "bac-side" }, el("h3", {}, "Banker ", bTot), bHand)),
        banner, el("div", { class: "bac-spots" }, spots.player, spots.tie, spots.banker))));
      let busy = false;
      function paint() {
        const t = bets.player + bets.banker + bets.tie;
        totalV.textContent = fmtUSD(t);
        for (const k of Object.keys(spots)) { const s = spots[k].querySelector(".bac-stack"); s.textContent = bets[k] ? fmtUSD(bets[k]) : ""; spots[k].classList.toggle("has", bets[k] > 0); }
        dealBtn.disabled = busy || t <= 0; clearBtn.disabled = busy || t <= 0; rebetBtn.disabled = busy || !last || t > 0;
      }
      function add(k) { if (busy) return; bets[k] = Math.round((bets[k] + chips.value) * 100) / 100; Object.values(spots).forEach((s) => s.classList.remove("winner")); paint(); }
      clearBtn.addEventListener("click", () => { bets.player = bets.banker = bets.tie = 0; paint(); });
      rebetBtn.addEventListener("click", () => { Object.assign(bets, last); paint(); });
      dealBtn.addEventListener("click", async () => {
        if (busy) return; busy = true; paint(); banner.textContent = ""; banner.className = "bac-banner";
        pHand.replaceChildren(); bHand.replaceChildren(); pTot.textContent = bTot.textContent = "";
        try {
          const r = await play("baccarat", { bets: { ...bets } });
          const { player: P, banker: Bk, pt, bt, winner } = r.result;
          const v = (c) => (["10", "J", "Q", "K"].includes(c.r) ? 0 : c.r === "A" ? 1 : +c.r);
          const tot = (h) => h.reduce((s, c) => s + v(c), 0) % 10;
          const seq = [[pHand, P[0]], [bHand, Bk[0]], [pHand, P[1]], [bHand, Bk[1]]];
          for (const [h, c] of seq) { h.append(cardEl(c, h.children.length, "deal")); pTot.textContent = tot([...pHand.children].map((_, i) => P[i])); bTot.textContent = tot([...bHand.children].map((_, i) => Bk[i])); await sleep(380); }
          if (P[2]) { await sleep(250); pHand.append(cardEl(P[2], 2, "deal third")); pTot.textContent = pt; await sleep(420); }
          if (Bk[2]) { await sleep(250); bHand.append(cardEl(Bk[2], 2, "deal third")); bTot.textContent = bt; await sleep(420); }
          pTot.textContent = pt; bTot.textContent = bt;
          r.settle();
          spots[winner].classList.add("winner");
          banner.className = `bac-banner show ${winner}`;
          banner.textContent = `${winner === "tie" ? "Tie" : winner === "player" ? "Player wins" : "Banker wins"} ${pt}–${bt}${r.payout > 0 ? ` · you get ${fmtUSD(r.payout)}` : ""}`;
          last = { ...bets }; bets.player = bets.banker = bets.tie = 0;
        } catch (e) { fail(e); }
        busy = false; paint();
      });
      paint();
    },
  });

  /* ================= THREE CARD POKER ================= */
  registerGame({
    id: "three-card-poker", name: "Three Card Poker", cat: "tables", tag: "Cards", navIcon: "🃏",
    art: { emoji: "🃏", bg: "linear-gradient(150deg,#6bb6ff,#1d3fa8 55%,#081436)", accent: "#a8d4ff" },
    blurb: "Beat the dealer's three cards. Pair Plus pays up to 40 to 1.",
    rules: "<p>Place an Ante (and optionally Pair Plus), then see your three cards. Fold to give up the Ante, or Play by matching your Ante. The dealer needs Queen-high or better to qualify: if not, the Ante pays 1:1 and Play pushes. If the dealer qualifies and you win, Ante and Play both pay 1:1. Ante bonus (paid when you play): straight 1:1, three of a kind 4:1, straight flush 5:1. Pair Plus pays on your hand alone: pair 1:1, flush 3:1, straight 6:1, three of a kind 30:1, straight flush 40:1. Hand ranks: straight flush, three of a kind, straight, flush, pair, high card.</p>",
    mount(stage) {
      const ante = betInput({ label: "Ante" });
      const pp = el("input", { type: "number", min: "0", step: "0.01", value: "0", class: "bet-input" });
      const ppWrap = el("label", { class: "field" }, el("span", { class: "field-label" }, "Pair Plus (optional)"), el("div", { class: "bet-row" }, el("span", { class: "coin-glyph" }, "$"), pp));
      const dealBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Deal");
      const playBtn = el("button", { class: "btn btn-gold", type: "button", disabled: true }, "Play");
      const foldBtn = el("button", { class: "btn btn-ghost", type: "button", disabled: true }, "Fold");
      const controls = el("div", { class: "gcontrols" }, ante.el, ppWrap, dealBtn, el("div", { class: "btn-pair" }, playBtn, foldBtn), el("p", { class: "muted small" }, "Play costs the same as your Ante."));
      const dHand = el("div", { class: "bj-hand" }), pHand = el("div", { class: "bj-hand" }), dLbl = el("span", { class: "bj-total" }), pLbl = el("span", { class: "bj-total" });
      const status = el("div", { class: "bj-status" }, "Place your Ante and deal");
      const pt = el("div", { class: "tcp-pay" }, el("div", {}, el("h4", {}, "Pair Plus"), ...Object.entries(T.TCP_PAIRPLUS).map(([k, x]) => el("p", { "data-k": k }, el("span", {}, HAND_NAMES[k]), el("b", {}, `${x}:1`)))), el("div", {}, el("h4", {}, "Ante bonus"), ...Object.entries(T.TCP_ANTE_BONUS).map(([k, x]) => el("p", { "data-k": k }, el("span", {}, HAND_NAMES[k]), el("b", {}, `${x}:1`)))));
      stage.append(el("div", { class: "gframe" }, controls, el("div", { class: "gboard bj-table tcp-table" },
        el("div", { class: "bj-row" }, el("div", { class: "bj-label" }, "Dealer ", dLbl), dHand),
        el("div", { class: "bj-felt-text" }, "DEALER QUALIFIES WITH QUEEN HIGH"), status,
        el("div", { class: "bj-row" }, pHand, el("div", { class: "bj-label" }, "You ", pLbl)), pt)));
      let busy = false, phase = "idle";
      const setPhase = (p) => { phase = p; dealBtn.disabled = p !== "idle" || busy; playBtn.disabled = foldBtn.disabled = p !== "decide" || busy; ante.disable(p !== "idle"); pp.disabled = p !== "idle"; };
      function showDecide(v) { pHand.replaceChildren(...v.player.map((c, i) => cardEl(c, i, "deal"))); dHand.replaceChildren(...[0, 1, 2].map((i) => cardEl(null, i, "deal"))); pLbl.textContent = HAND_NAMES[v.ph]; dLbl.textContent = ""; status.className = "bj-status"; status.textContent = "Play or fold?"; setPhase("decide"); }
      dealBtn.addEventListener("click", async () => {
        if (busy) return; busy = true; setPhase("idle");
        CQ.$$(".tcp-pay p").forEach((p) => p.classList.remove("on"));
        try { const r = await act("threecard", "start", { ante: ante.value, pairplus: Number(pp.value) || 0 }); busy = false; showDecide(r.view); }
        catch (e) { busy = false; if (e.status === 409 && e.data && e.data.view && e.data.mode === CQ.state.mode) showDecide(e.data.view); else fail(e); setPhase(phase); }
      });
      async function decide(action) {
        if (busy) return; busy = true; setPhase("decide");
        try {
          const r = await act("threecard", action);
          const v = r.view;
          for (let i = 0; i < 3; i++) { dHand.children[i].replaceWith(cardEl(v.dealer[i], i, "deal")); await sleep(300); }
          dLbl.textContent = HAND_NAMES[v.dh];
          const text = { fold: "You folded", noqualify: "Dealer doesn't qualify — Ante pays", win: "You beat the dealer!", push: "Push", lose: "Dealer wins" }[v.outcome];
          status.className = `bj-status ${r.payout > 0 ? "win" : "lose"}`;
          status.textContent = `${text}${r.payout > 0 ? ` · you get ${fmtUSD(r.payout)}` : ""}`;
          if (v.ppWin) pt.querySelector(`div:first-child p[data-k="${v.ph}"]`)?.classList.add("on");
          if (action === "play" && T.TCP_ANTE_BONUS[v.ph]) pt.querySelector(`div:last-child p[data-k="${v.ph}"]`)?.classList.add("on");
        } catch (e) { fail(e); }
        busy = false; setPhase("idle");
      }
      playBtn.addEventListener("click", () => decide("play")); foldBtn.addEventListener("click", () => decide("fold"));
      gameState("threecard").then((s) => { if (s.active && s.mode === CQ.state.mode) showDecide(s.view); }).catch(() => {});
      setPhase("idle");
    },
  });

  /* ================= VIDEO POKER ================= */
  registerGame({
    id: "video-poker", name: "Jacks or Better", cat: "tables", tag: "Cards", navIcon: "🎴",
    art: { emoji: "🎰", bg: "linear-gradient(150deg,#ffe36b,#2b6cff 55%,#0a1440)", accent: "#ffe36b" },
    blurb: "Video poker. Hold your best cards, draw, and hit the pay table.",
    rules: "<p>Jacks or Better, 8/5 pay table, one 52-card deck. You're dealt five cards; tap the ones to hold, then draw replacements. Pays on a pair of Jacks or better. Return to player 97.3% with perfect strategy.</p>",
    mount(stage) {
      const bet = betInput();
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Deal");
      const controls = el("div", { class: "gcontrols" }, bet.el, btn, el("p", { class: "muted small" }, "Tap cards to hold them, then Draw."));
      const ptRows = T.VIDEO_POKER.map((p) => el("tr", { "data-k": p.key }, el("td", {}, p.name), el("td", { class: "num" }, `${p.pay}×`), el("td", { class: "num vp-amt" })));
      const handEl = el("div", { class: "vp-hand" });
      const status = el("div", { class: "bj-status" }, "Press Deal to start");
      stage.append(el("div", { class: "gframe" }, controls, el("div", { class: "gboard vp-table" }, el("table", { class: "vp-pay" }, el("tbody", {}, ptRows)), status, handEl)));
      let phase = "idle", busy = false, holds = [false, false, false, false, false];
      const paintPay = () => ptRows.forEach((r, i) => (r.querySelector(".vp-amt").textContent = fmtUSD(bet.value * T.VIDEO_POKER[i].pay)));
      bet.input.addEventListener("input", paintPay); paintPay();
      function showHand(hand, anim = true) {
        handEl.replaceChildren(...hand.map((c, i) => {
          const wrap = el("button", { type: "button", class: `vp-card${holds[i] ? " held" : ""}`, disabled: phase !== "hold", onclick: () => { holds[i] = !holds[i]; wrap.classList.toggle("held", holds[i]); } }, cardEl(c, i, anim ? "deal" : ""), el("span", { class: "vp-hold" }, "HELD"));
          return wrap;
        }));
      }
      const mark = (k) => ptRows.forEach((r) => r.classList.toggle("on", r.dataset.k === k));
      btn.addEventListener("click", async () => {
        if (busy) return; busy = true;
        try {
          if (phase === "idle") {
            const r = await act("videopoker", "start", { bet: bet.value });
            holds = [false, false, false, false, false]; phase = "hold"; showHand(r.view.hand);
            mark(r.view.made); status.className = "bj-status"; status.textContent = r.view.made ? `You have ${HAND_NAMES[r.view.made]} — hold and draw` : "Choose cards to hold, then draw";
            btn.textContent = "Draw"; bet.disable(true);
          } else {
            const r = await act("videopoker", "draw", { holds });
            phase = "idle";
            const old = [...handEl.children];
            r.view.hand.forEach((c, i) => { if (!holds[i]) old[i].replaceWith(el("button", { type: "button", class: "vp-card", disabled: true }, cardEl(c, i, "deal"), el("span", { class: "vp-hold" }, "HELD"))); else old[i].disabled = true; });
            mark(r.view.made);
            status.className = `bj-status ${r.payout > 0 ? "win" : "lose"}`;
            status.textContent = r.view.made ? `${HAND_NAMES[r.view.made]} — you win ${fmtUSD(r.payout)}` : "No win — deal again";
            btn.textContent = "Deal"; bet.disable(false);
          }
        } catch (e) {
          if (e.status === 409 && e.data && e.data.view && e.data.mode === CQ.state.mode) { phase = "hold"; holds = [false, false, false, false, false]; showHand(e.data.view.hand); btn.textContent = "Draw"; bet.disable(true); }
          else fail(e);
        }
        busy = false;
      });
      gameState("videopoker").then((s) => { if (s.active && s.mode === CQ.state.mode) { phase = "hold"; showHand(s.view.hand); btn.textContent = "Draw"; bet.disable(true); status.textContent = "Your hand is still in play — hold and draw"; } }).catch(() => {});
      showHand([null, null, null, null, null], false);
    },
  });

  /* ================= ROULETTE ================= */
  const colorOf = (n) => (n === 0 ? "green" : T.REDS.includes(n) ? "red" : "black");
  function wheelSvg() {
    const R = 150, cx = 160, cy = 160, n = T.WHEEL.length, seg = (Math.PI * 2) / n; let paths = "", labels = "";
    T.WHEEL.forEach((num, i) => {
      const a0 = -Math.PI / 2 + i * seg - seg / 2, a1 = a0 + seg, p = (a, r) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      paths += `<path d="M${p(a0, R)} A${R},${R} 0 0 1 ${p(a1, R)} L${p(a1, 100)} A100,100 0 0 0 ${p(a0, 100)} Z" fill="${num === 0 ? "#1f9d55" : T.REDS.includes(num) ? "#d1283d" : "#151b22"}" stroke="#c9a54a" stroke-width="1"/>`;
      const am = a0 + seg / 2, x = (cx + 128 * Math.cos(am)).toFixed(2), y = (cy + 128 * Math.sin(am)).toFixed(2);
      labels += `<text x="${x}" y="${y}" transform="rotate(${((am * 180) / Math.PI + 90).toFixed(2)} ${x} ${y})" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="800" fill="#fff">${num}</text>`;
    });
    return `<svg viewBox="0 0 320 320" class="rw-svg"><defs><radialGradient id="rwc" cx="50%" cy="45%"><stop offset="0" stop-color="#f3d27a"/><stop offset=".55" stop-color="#9b6d1d"/><stop offset="1" stop-color="#4a3208"/></radialGradient></defs><circle cx="160" cy="160" r="158" fill="#2a180a" stroke="#c9a54a" stroke-width="3"/>${paths}${labels}<circle cx="160" cy="160" r="100" fill="#12333a" stroke="#c9a54a" stroke-width="2"/><circle cx="160" cy="160" r="62" fill="url(#rwc)"/><g stroke="#f7e3a3" stroke-width="5" stroke-linecap="round"><line x1="160" y1="112" x2="160" y2="208"/><line x1="112" y1="160" x2="208" y2="160"/></g><circle cx="160" cy="160" r="12" fill="#f7e3a3"/></svg>`;
  }
  registerGame({
    id: "roulette", name: "Roulette", cat: "tables", tag: "Wheel", navIcon: "🎡",
    art: { emoji: "🎡", bg: "linear-gradient(150deg,#ff5d6c,#8a1424 55%,#25060b)", accent: "#ff5d6c" },
    blurb: "European single-zero roulette. Place chips, spin the wheel.",
    rules: "<p>European wheel with a single zero. Pick a chip, click the table to bet (right-click to remove), then spin. Straight numbers pay 35:1, dozens and columns 2:1, red/black, odd/even and 1–18/19–36 pay 1:1. Zero loses all outside bets. Return to player 97.3%.</p>",
    mount(stage) {
      const bets = new Map(), stack = [];
      const chips = chipPicker(CHIPS);
      const totalV = el("b", {}, "$0.00");
      const spinBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Spin");
      const mkB = (t) => el("button", { class: "btn btn-ghost", type: "button" }, t);
      const undoBtn = mkB("Undo"), clearBtn = mkB("Clear"), dblBtn = mkB("2×"), rebetBtn = mkB("Rebet");
      const controls = el("div", { class: "gcontrols" }, el("div", { class: "field" }, el("span", { class: "field-label" }, "Chip"), chips.el), statRow("Total bet", totalV), el("div", { class: "bj-actions" }, undoBtn, clearBtn, dblBtn, rebetBtn), spinBtn);
      const wheel = el("div", { class: "rw" }, el("div", { class: "rw-rot", html: wheelSvg() }), el("div", { class: "rw-ball-track" }, el("div", { class: "rw-ball" })), el("div", { class: "rw-pointer" }));
      const resultEl = el("div", { class: "rl-result" }, "–"), hist = el("div", { class: "rl-hist" }), board = el("div", { class: "rl-board" });
      stage.append(el("div", { class: "gframe" }, controls, el("div", { class: "gboard rl-table" }, el("div", { class: "rl-top" }, wheel, el("div", { class: "rl-side" }, resultEl, hist)), board)));
      const spotEls = new Map();
      const LABEL = { col0: "2:1", col1: "2:1", col2: "2:1", doz0: "1st 12", doz1: "2nd 12", doz2: "3rd 12", low: "1–18", even: "Even", odd: "Odd", high: "19–36", red: "", black: "" };
      const mk = (key, cls, style) => { const b = el("button", { type: "button", class: `rl-spot ${cls}`, style, "data-key": key, onclick: () => place(key), oncontextmenu: (e) => { e.preventDefault(); remove(key); } }, el("span", { class: "rl-lbl" }, LABEL[key] ?? key.slice(1))); spotEls.set(key, b); return b; };
      const cells = [mk("n0", "rl-zero", { gridColumn: "1", gridRow: "1 / span 3" })];
      for (let col = 0; col < 12; col++) for (let row = 0; row < 3; row++) { const n = col * 3 + (3 - row); cells.push(mk(`n${n}`, `rl-num ${colorOf(n)}`, { gridColumn: String(col + 2), gridRow: String(row + 1) })); }
      ["col0", "col1", "col2"].forEach((k, row) => cells.push(mk(k, "rl-col", { gridColumn: "14", gridRow: String(row + 1) })));
      ["doz0", "doz1", "doz2"].forEach((k, i) => cells.push(mk(k, "rl-out", { gridColumn: `${2 + i * 4} / span 4`, gridRow: "4" })));
      ["low", "even", "red", "black", "odd", "high"].forEach((k, i) => cells.push(mk(k, `rl-out${k === "red" ? " red-spot" : k === "black" ? " black-spot" : ""}`, { gridColumn: `${2 + i * 2} / span 2`, gridRow: "5" })));
      board.append(...cells);
      let spinning = false, rot = 0, ballRot = 0, lastBets = null, alive = true;
      const sum = () => [...bets.values()].reduce((a, b) => a + b, 0);
      function paint() {
        spotEls.forEach((b, k) => { const amt = bets.get(k) || 0; let c = b.querySelector(".rl-stack"); if (amt > 0) { if (!c) { c = el("span", { class: "rl-stack" }); b.append(c); } c.textContent = chips.short(Math.round(amt * 100) / 100); } else if (c) c.remove(); });
        const t = sum(); totalV.textContent = fmtUSD(t);
        spinBtn.disabled = spinning || t <= 0; [undoBtn, clearBtn, dblBtn].forEach((b) => (b.disabled = spinning || t <= 0)); rebetBtn.disabled = spinning || !lastBets || t > 0;
      }
      const clearHit = () => board.querySelectorAll(".hit").forEach((n) => n.classList.remove("hit"));
      function place(k) { if (spinning) return; window.CQSound && CQSound.play("chip"); bets.set(k, Math.round(((bets.get(k) || 0) + chips.value) * 100) / 100); stack.push([k, chips.value]); clearHit(); paint(); }
      function remove(k) { if (spinning || !bets.has(k)) return; bets.delete(k); clearHit(); paint(); }
      undoBtn.addEventListener("click", () => { const l = stack.pop(); if (!l) return; const v = Math.round(((bets.get(l[0]) || 0) - l[1]) * 100) / 100; if (v > 0) bets.set(l[0], v); else bets.delete(l[0]); paint(); });
      clearBtn.addEventListener("click", () => { bets.clear(); stack.length = 0; paint(); });
      dblBtn.addEventListener("click", () => { for (const [k, v] of bets) bets.set(k, Math.round(v * 200) / 100); paint(); });
      rebetBtn.addEventListener("click", () => { lastBets.forEach(([k, v]) => bets.set(k, v)); paint(); });
      const rotEl = wheel.querySelector(".rw-rot"), ballTrack = wheel.querySelector(".rw-ball-track"), past = [];
      spinBtn.addEventListener("click", async () => {
        if (spinning) return; spinning = true; paint(); clearHit();
        try {
          const r = await play("roulette", { bets: Object.fromEntries(bets) });
          lastBets = [...bets.entries()];
          const n = r.result.number, i = T.WHEEL.indexOf(n), seg = 360 / 37;
          rot += 360 * 5 + (360 - (((rot % 360) + i * seg) % 360));
          ballRot -= 360 * 7 + (((ballRot % 360) + 360) % 360);
          rotEl.style.transition = "transform 4.6s cubic-bezier(.12,.6,.18,1)"; rotEl.style.transform = `rotate(${rot}deg)`;
          ballTrack.style.transition = "transform 4.6s cubic-bezier(.2,.65,.25,1)"; ballTrack.style.transform = `rotate(${ballRot}deg)`;
          wheel.classList.add("spinning"); resultEl.className = "rl-result"; resultEl.textContent = "…";
          window.CQSound && CQSound.play("wheel", 4.4);
          await sleep(4700);
          window.CQSound && CQSound.play("ball");
          wheel.classList.remove("spinning"); r.settle();
          resultEl.textContent = String(n); resultEl.className = `rl-result ${colorOf(n)}`;
          past.unshift(n); past.length = Math.min(past.length, 12); hist.replaceChildren(...past.map((x) => el("span", { class: colorOf(x) }, String(x))));
          spotEls.get(`n${n}`)?.classList.add("hit"); r.result.winning.forEach((k) => spotEls.get(k)?.classList.add("hit"));
          toast(r.payout > 0 ? `${n} ${colorOf(n)} — you won ${fmtUSD(r.payout)}` : `${n} ${colorOf(n)} — no win this time`, r.payout > 0 ? "win" : "info");
          bets.clear(); stack.length = 0;
        } catch (e) { fail(e); }
        spinning = false; if (alive) paint();
      });
      paint();
      return () => { alive = false; };
    },
  });
})();
