/* CareQuay Casino — Blackjack & European Roulette */
(() => {
  "use strict";
  const { el, rng, wallet, record, betInput, registerGame, fmt, sleep, round } = CQ;

  /* =========================================================
     BLACKJACK — 6 decks, dealer stands on soft 17, BJ pays 3:2,
     double on any first two cards, split once (split aces get one card).
     ========================================================= */
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const val = (r) => (r === "A" ? 11 : ["K", "Q", "J"].includes(r) ? 10 : +r);
  function total(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { if (c.down) continue; t += val(c.r); if (c.r === "A") aces++; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t, soft: aces > 0 };
  }
  const isBJ = (cards) => cards.length === 2 && total(cards).t === 21;

  registerGame({
    id: "blackjack", name: "Blackjack", cat: "tables", tag: "Table",
    art: { emoji: "🃏", bg: "linear-gradient(150deg,#2ee6a0,#0b6b48 55%,#04241a)", accent: "#2ee6a0" },
    blurb: "Beat the dealer to 21. Blackjack pays 3 to 2.",
    rules: "<p>Six decks. Get closer to 21 than the dealer without going over. Picture cards count 10 and aces 1 or 11. Blackjack pays 3:2, other wins pay 1:1. You can double down on your first two cards or split a pair once (split aces get one card each). The dealer draws to 16 and stands on all 17s.</p>",
    mount(stage) {
      const bet = betInput();
      const dealBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Deal");
      const hitBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Hit");
      const standBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Stand");
      const dblBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Double");
      const splitBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Split");
      const actions = el("div", { class: "bj-actions" }, hitBtn, standBtn, dblBtn, splitBtn);
      const controls = el("div", { class: "gcontrols" }, bet.el, dealBtn, actions, el("p", { class: "bj-keys" }, "Keys: H hit · S stand · D double · P split"));
      const dealerEl = el("div", { class: "bj-hand dealer" });
      const dealerTot = el("span", { class: "bj-total" });
      const handsEl = el("div", { class: "bj-hands" });
      const status = el("div", { class: "bj-status" }, "Place your bet and deal");
      const table = el("div", { class: "gboard bj-table" },
        el("div", { class: "bj-row" }, el("div", { class: "bj-label" }, "Dealer ", dealerTot), dealerEl),
        el("div", { class: "bj-felt-text" }, "BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17"),
        status,
        handsEl);
      stage.append(el("div", { class: "gframe" }, controls, table));

      let shoe = [], dealer = [], hands = [], active = 0, phase = "idle", alive = true;
      const shuffle = () => { shoe = []; for (let d = 0; d < 6; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s }); rng.shuffle(shoe); };
      const draw = (down = false) => { if (shoe.length < 60) shuffle(); const c = { ...shoe.pop(), down }; return c; };
      shuffle();

      const cardEl = (c, i) => el("div", { class: `pcard${c.down ? " down" : ""}${c.s === "♥" || c.s === "♦" ? " red" : ""}`, style: { "--i": i } },
        c.down ? el("span", { class: "back" }) : [el("span", { class: "tl" }, c.r, el("br"), c.s), el("span", { class: "mid" }, c.s), el("span", { class: "br" }, c.r, el("br"), c.s)]);
      function paint() {
        dealerEl.replaceChildren(...dealer.map(cardEl));
        const dt = total(dealer);
        dealerTot.textContent = dealer.length ? (dealer.some((c) => c.down) ? `${dt.t}` : dt.t > 21 ? `${dt.t} · bust` : `${dt.t}`) : "";
        handsEl.replaceChildren(...hands.map((h, i) => {
          const t = total(h.cards);
          return el("div", { class: `bj-handwrap${i === active && phase === "player" ? " active" : ""}${h.result ? ` res-${h.result}` : ""}` },
            el("div", { class: "bj-hand" }, h.cards.map(cardEl)),
            el("div", { class: "bj-label" }, `${hands.length > 1 ? `Hand ${i + 1} · ` : "You "}`, el("span", { class: "bj-total" }, isBJ(h.cards) && !h.split ? "Blackjack" : t.t > 21 ? `${t.t} · bust` : `${t.soft && t.t < 21 ? "soft " : ""}${t.t}`), el("span", { class: "bj-bet" }, `${fmt(h.bet)} ${wallet.coin}${h.doubled ? " ×2" : ""}`), h.result ? el("span", { class: "bj-res" }, { win: "Win", lose: "Lose", push: "Push", bj: "Blackjack!" }[h.result]) : null));
        }));
        const h = hands[active];
        const can = phase === "player" && h;
        hitBtn.disabled = !can;
        standBtn.disabled = !can;
        dblBtn.disabled = !(can && h.cards.length === 2 && wallet.balance >= h.bet);
        splitBtn.disabled = !(can && hands.length === 1 && h.cards.length === 2 && val(h.cards[0].r) === val(h.cards[1].r) && wallet.balance >= h.bet);
        dealBtn.disabled = phase !== "idle";
        bet.disable(phase !== "idle");
      }
      const pause = (ms) => sleep(ms).then(() => alive);

      async function deal() {
        if (phase !== "idle") return;
        const stake = bet.value;
        if (!wallet.debit(stake)) return;
        phase = "dealing"; dealer = []; hands = [{ cards: [], bet: stake }]; active = 0;
        status.textContent = "";
        const seq = [() => hands[0].cards.push(draw()), () => dealer.push(draw()), () => hands[0].cards.push(draw()), () => dealer.push(draw(true))];
        for (const s of seq) { s(); paint(); if (!(await pause(260))) return; }
        const up = dealer[0];
        const dealerBJ = (() => { const d = [dealer[0], { ...dealer[1], down: false }]; return isBJ(d); })();
        if (isBJ(hands[0].cards) || ((up.r === "A" || val(up.r) === 10) && dealerBJ)) {
          if (up.r === "A" || val(up.r) === 10) { status.textContent = "Dealer checks for blackjack…"; paint(); if (!(await pause(600))) return; }
          return finish();
        }
        phase = "player"; status.textContent = "Hit, stand, double or split?"; paint();
      }
      async function nextHand() {
        const h = hands[active];
        if (h && total(h.cards).t < 21 && !(h.splitAces) && !h.doubled) { paint(); return; }
        if (active < hands.length - 1) {
          active++;
          const nh = hands[active];
          if (nh.cards.length < 2) { nh.cards.push(draw()); paint(); await pause(220); }
          if (nh.splitAces || total(nh.cards).t >= 21) return nextHand();
          paint(); return;
        }
        return finish();
      }
      async function hit() { if (phase !== "player") return; const h = hands[active]; h.cards.push(draw()); paint(); if (total(h.cards).t >= 21) { await pause(250); nextHand(); } }
      async function stand() { if (phase !== "player") return; const h = hands[active]; h.stood = true; if (active < hands.length - 1) { active++; const nh = hands[active]; if (nh.cards.length < 2) { nh.cards.push(draw()); paint(); await pause(220); } if (nh.splitAces || total(nh.cards).t >= 21) return finish(); paint(); return; } finish(); }
      async function double() {
        if (phase !== "player") return; const h = hands[active];
        if (h.cards.length !== 2 || !wallet.debit(h.bet)) return;
        h.bet *= 2; h.doubled = true; h.cards.push(draw()); paint(); await pause(300);
        if (active < hands.length - 1) { active++; const nh = hands[active]; if (nh.cards.length < 2) { nh.cards.push(draw()); paint(); await pause(220); } if (nh.splitAces || total(nh.cards).t >= 21) return finish(); paint(); return; }
        finish();
      }
      async function split() {
        if (phase !== "player" || hands.length !== 1) return; const h = hands[0];
        if (h.cards.length !== 2 || val(h.cards[0].r) !== val(h.cards[1].r) || !wallet.debit(h.bet)) return;
        const aces = h.cards[0].r === "A";
        hands = [{ cards: [h.cards[0]], bet: h.bet, split: true, splitAces: aces }, { cards: [h.cards[1]], bet: h.bet, split: true, splitAces: aces }];
        hands[0].cards.push(draw()); paint(); await pause(250);
        if (aces) { hands[1].cards.push(draw()); paint(); await pause(250); return finish(); }
        if (total(hands[0].cards).t >= 21) { active = 0; return stand(); }
        paint();
      }
      async function finish() {
        phase = "dealer";
        dealer[1].down = false; paint(); if (!(await pause(450))) return;
        const live = hands.some((h) => total(h.cards).t <= 21 && !(isBJ(h.cards) && !h.split));
        if (live) while (total(dealer).t < 17) { dealer.push(draw()); paint(); if (!(await pause(420))) return; }
        const d = total(dealer).t, dBJ = isBJ(dealer);
        let staked = 0, paid = 0;
        for (const h of hands) {
          const p = total(h.cards).t, pBJ = isBJ(h.cards) && !h.split;
          staked += h.bet;
          if (pBJ && dBJ) h.result = "push";
          else if (pBJ) h.result = "bj";
          else if (dBJ) h.result = "lose";
          else if (p > 21) h.result = "lose";
          else if (d > 21 || p > d) h.result = "win";
          else if (p === d) h.result = "push";
          else h.result = "lose";
          const mult = { bj: 2.5, win: 2, push: 1, lose: 0 }[h.result];
          paid += round(h.bet * mult, wallet.coin);
        }
        if (paid > 0) wallet.credit(paid);
        record("Blackjack", staked, paid);
        status.textContent = paid > staked ? `You win ${fmt(paid - staked)} ${wallet.coin}` : paid === staked ? "Push — bet returned" : dBJ ? "Dealer blackjack" : d > 21 ? "Dealer busts" : `Dealer has ${d}`;
        if (paid > staked && d > 21) status.textContent = `Dealer busts — you win ${fmt(paid - staked)} ${wallet.coin}`;
        status.className = `bj-status ${paid > staked ? "win" : paid === staked ? "push" : "lose"}`;
        phase = "idle"; active = -1; paint();
      }
      dealBtn.addEventListener("click", deal);
      hitBtn.addEventListener("click", hit); standBtn.addEventListener("click", stand); dblBtn.addEventListener("click", double); splitBtn.addEventListener("click", split);
      const onKey = (e) => {
        if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
        const k = e.key.toLowerCase();
        if (k === "h" && !hitBtn.disabled) hit(); else if (k === "s" && !standBtn.disabled) stand(); else if (k === "d" && !dblBtn.disabled) double(); else if (k === "p" && !splitBtn.disabled) split();
        else if ((k === "enter" || k === " ") && phase === "idle" && document.activeElement === document.body) { e.preventDefault(); deal(); }
      };
      document.addEventListener("keydown", onKey);
      paint();
      return () => {
        alive = false; document.removeEventListener("keydown", onKey); bet.destroy();
        if (phase !== "idle" && hands.length) wallet.credit(hands.reduce((s, h) => s + h.bet, 0)); // unfinished hand: stake returned
      };
    },
  });

  /* =========================================================
     ROULETTE — European single zero
     ========================================================= */
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");
  const nice = (v) => { if (v <= 0) return v; const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };

  function wheelSvg() {
    const R = 150, cx = 160, cy = 160, n = WHEEL.length, seg = (Math.PI * 2) / n;
    let paths = "", labels = "";
    WHEEL.forEach((num, i) => {
      const a0 = -Math.PI / 2 + i * seg - seg / 2, a1 = a0 + seg;
      const p = (a, r) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      const fill = num === 0 ? "#1f9d55" : REDS.has(num) ? "#d1283d" : "#151b22";
      paths += `<path d="M${p(a0, R)} A${R},${R} 0 0 1 ${p(a1, R)} L${p(a1, 100)} A100,100 0 0 0 ${p(a0, 100)} Z" fill="${fill}" stroke="#c9a54a" stroke-width="1"/>`;
      const am = a0 + seg / 2, deg = (am * 180) / Math.PI + 90;
      labels += `<text x="${(cx + 128 * Math.cos(am)).toFixed(2)}" y="${(cy + 128 * Math.sin(am)).toFixed(2)}" transform="rotate(${deg.toFixed(2)} ${(cx + 128 * Math.cos(am)).toFixed(2)} ${(cy + 128 * Math.sin(am)).toFixed(2)})" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="800" fill="#fff">${num}</text>`;
    });
    return `<svg viewBox="0 0 320 320" class="rw-svg"><defs><radialGradient id="rwc" cx="50%" cy="45%"><stop offset="0" stop-color="#f3d27a"/><stop offset=".55" stop-color="#9b6d1d"/><stop offset="1" stop-color="#4a3208"/></radialGradient><radialGradient id="rwr" cx="50%" cy="50%"><stop offset=".85" stop-color="#3a2410"/><stop offset="1" stop-color="#1a0e05"/></radialGradient></defs>
      <circle cx="160" cy="160" r="158" fill="url(#rwr)" stroke="#c9a54a" stroke-width="3"/>${paths}${labels}
      <circle cx="160" cy="160" r="100" fill="#12333a" stroke="#c9a54a" stroke-width="2"/><circle cx="160" cy="160" r="62" fill="url(#rwc)"/>
      <g stroke="#f7e3a3" stroke-width="5" stroke-linecap="round"><line x1="160" y1="112" x2="160" y2="208"/><line x1="112" y1="160" x2="208" y2="160"/></g><circle cx="160" cy="160" r="12" fill="#f7e3a3"/></svg>`;
  }

  registerGame({
    id: "roulette", name: "Roulette", cat: "tables", tag: "Table",
    art: { emoji: "🎡", bg: "linear-gradient(150deg,#ff5d6c,#8a1424 55%,#25060b)", accent: "#ff5d6c" },
    blurb: "European single-zero roulette. Place chips, spin the wheel.",
    rules: "<p>European wheel with a single zero. Pick a chip, click the table to place bets, then spin. Straight numbers pay 35:1, dozens and columns 2:1, red/black, odd/even and 1–18/19–36 pay 1:1. Zero loses all outside bets. Return to player is 97.3%.</p>",
    mount(stage) {
      let chips = [], chip = 0;
      const bets = new Map(); // key -> amount
      const historyStack = [];
      const chipRow = el("div", { class: "rl-chips" });
      const totalV = el("b", {}, "0");
      const spinBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Spin");
      const undoBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Undo");
      const clearBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Clear");
      const dblBtn = el("button", { class: "btn btn-ghost", type: "button" }, "2×");
      const rebetBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Rebet");
      const controls = el("div", { class: "gcontrols" },
        el("div", { class: "field" }, el("span", { class: "field-label" }, "Chip value"), chipRow),
        el("div", { class: "stat-row" }, el("span", {}, "Total bet"), totalV),
        el("div", { class: "bj-actions" }, undoBtn, clearBtn, dblBtn, rebetBtn),
        spinBtn);
      const wheelWrap = el("div", { class: "rw" }, el("div", { class: "rw-rot", html: wheelSvg() }), el("div", { class: "rw-ball-track" }, el("div", { class: "rw-ball" })), el("div", { class: "rw-pointer" }));
      const resultEl = el("div", { class: "rl-result" }, "–");
      const hist = el("div", { class: "rl-hist" });
      const board = el("div", { class: "rl-board" });
      const tableEl = el("div", { class: "gboard rl-table" }, el("div", { class: "rl-top" }, wheelWrap, el("div", { class: "rl-side" }, resultEl, hist)), board);
      stage.append(el("div", { class: "gframe" }, controls, tableEl));

      function setChips() {
        const d = wallet.defaultBet();
        chips = [d / 10, d / 2, d, d * 5, d * 25].map((v) => round(nice(v), wallet.coin) || wallet.minBet());
        chipRow.replaceChildren(...chips.map((v, i) => el("button", { type: "button", class: `rl-chip c${i}${i === chip ? " on" : ""}`, onclick: () => { chip = i; setChips(); } }, el("span", {}, short(v)))));
      }
      const short = (v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v >= 1 ? `${+v.toFixed(2)}` : `${+v.toPrecision(2)}`);

      // bet definitions
      const spot = (key, label, cls, covers, pays) => ({ key, label, cls, covers: new Set(covers), pays });
      const SPOTS = new Map();
      const add = (s) => SPOTS.set(s.key, s);
      add(spot("n0", "0", "rl-zero green", [0], 36));
      for (let n = 1; n <= 36; n++) add(spot(`n${n}`, String(n), `rl-num ${colorOf(n)}`, [n], 36));
      const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
      [0, 1, 2].forEach((c) => add(spot(`col${c}`, "2:1", "rl-col", range(1, 36).filter((n) => n % 3 === (c === 0 ? 0 : c === 1 ? 2 : 1)), 3)));
      [0, 1, 2].forEach((d) => add(spot(`doz${d}`, ["1st 12", "2nd 12", "3rd 12"][d], "rl-out", range(d * 12 + 1, d * 12 + 12), 3)));
      add(spot("low", "1–18", "rl-out", range(1, 18), 2));
      add(spot("even", "Even", "rl-out", range(1, 36).filter((n) => n % 2 === 0), 2));
      add(spot("red", "", "rl-out red-spot", [...REDS], 2));
      add(spot("black", "", "rl-out black-spot", range(1, 36).filter((n) => !REDS.has(n)), 2));
      add(spot("odd", "Odd", "rl-out", range(1, 36).filter((n) => n % 2), 2));
      add(spot("high", "19–36", "rl-out", range(19, 36), 2));

      const spotEls = new Map();
      const mk = (key, style) => {
        const s = SPOTS.get(key);
        const b = el("button", { type: "button", class: `rl-spot ${s.cls}`, style, "data-key": key, onclick: () => place(key), oncontextmenu: (e) => { e.preventDefault(); remove(key); } }, el("span", { class: "rl-lbl" }, s.label));
        spotEls.set(key, b);
        return b;
      };
      // layout: grid 14 cols × 5 rows (zero | 12 numbers | 2:1), then dozens, then outside
      const cells = [mk("n0", { gridColumn: "1", gridRow: "1 / span 3" })];
      for (let col = 0; col < 12; col++) for (let row = 0; row < 3; row++) {
        const n = col * 3 + (3 - row);
        cells.push(mk(`n${n}`, { gridColumn: String(col + 2), gridRow: String(row + 1) }));
      }
      ["col0", "col1", "col2"].forEach((k, row) => cells.push(mk(k, { gridColumn: "14", gridRow: String(row + 1) })));
      ["doz0", "doz1", "doz2"].forEach((k, i) => cells.push(mk(k, { gridColumn: `${2 + i * 4} / span 4`, gridRow: "4" })));
      ["low", "even", "red", "black", "odd", "high"].forEach((k, i) => cells.push(mk(k, { gridColumn: `${2 + i * 2} / span 2`, gridRow: "5" })));
      board.append(...cells);

      function paintBets() {
        let t = 0;
        spotEls.forEach((b, key) => {
          const amt = bets.get(key) || 0; t += amt;
          let c = b.querySelector(".rl-stack");
          if (amt > 0) { if (!c) { c = el("span", { class: "rl-stack" }); b.append(c); } c.textContent = short(amt); }
          else if (c) c.remove();
        });
        totalV.textContent = `${fmt(round(t, wallet.coin))} ${wallet.coin}`;
        spinBtn.disabled = spinning || t <= 0;
        [undoBtn, clearBtn, dblBtn].forEach((b) => (b.disabled = spinning || t <= 0));
        rebetBtn.disabled = spinning || !lastBets || t > 0;
      }
      const sum = () => [...bets.values()].reduce((a, b) => a + b, 0);
      function place(key) {
        if (spinning) return;
        const v = chips[chip];
        bets.set(key, round((bets.get(key) || 0) + v, wallet.coin));
        historyStack.push({ key, v });
        clearWin(); paintBets();
      }
      function remove(key) { if (spinning || !bets.has(key)) return; bets.delete(key); clearWin(); paintBets(); }
      function clearWin() { board.querySelectorAll(".hit").forEach((n) => n.classList.remove("hit")); }
      undoBtn.addEventListener("click", () => { const last = historyStack.pop(); if (!last) return; const v = round((bets.get(last.key) || 0) - last.v, wallet.coin); if (v > 0) bets.set(last.key, v); else bets.delete(last.key); paintBets(); });
      clearBtn.addEventListener("click", () => { bets.clear(); historyStack.length = 0; paintBets(); });
      dblBtn.addEventListener("click", () => { for (const [k, v] of bets) bets.set(k, round(v * 2, wallet.coin)); paintBets(); });
      rebetBtn.addEventListener("click", () => { if (!lastBets) return; lastBets.forEach(([k, v]) => bets.set(k, v)); paintBets(); });

      let spinning = false, rot = 0, ballRot = 0, lastBets = null, alive = true;
      const past = [];
      const rotEl = wheelWrap.querySelector(".rw-rot"), ballTrack = wheelWrap.querySelector(".rw-ball-track");
      spinBtn.addEventListener("click", async () => {
        if (spinning) return;
        const stake = round(sum(), wallet.coin);
        if (!wallet.debit(stake)) return;
        spinning = true; paintBets(); clearWin();
        lastBets = [...bets.entries()];
        const result = WHEEL[rng.int(37)];
        const i = WHEEL.indexOf(result), seg = 360 / 37;
        // wheel spins clockwise; ball counter-clockwise and lands at the top over pocket i
        rot += 360 * 5 + (360 - ((rot % 360) + i * seg) % 360);
        const target = rot;
        ballRot -= 360 * 7 + ((ballRot % 360) + 360) % 360;
        rotEl.style.transition = "transform 4.6s cubic-bezier(.12,.6,.18,1)";
        rotEl.style.transform = `rotate(${target}deg)`;
        ballTrack.style.transition = "transform 4.6s cubic-bezier(.2,.65,.25,1)";
        ballTrack.style.transform = `rotate(${ballRot}deg)`;
        wheelWrap.classList.add("spinning");
        resultEl.className = "rl-result"; resultEl.textContent = "…";
        await sleep(4700);
        wheelWrap.classList.remove("spinning");
        let paid = 0;
        for (const [k, v] of bets) { const s = SPOTS.get(k); if (s.covers.has(result)) paid += round(v * s.pays, wallet.coin); }
        if (paid > 0) wallet.credit(paid);
        record("Roulette", stake, paid);
        resultEl.textContent = String(result); resultEl.className = `rl-result ${colorOf(result)}`;
        past.unshift(result); past.length = Math.min(past.length, 12);
        hist.replaceChildren(...past.map((n) => el("span", { class: colorOf(n) }, String(n))));
        spotEls.get(`n${result}`)?.classList.add("hit");
        for (const [k] of bets) if (SPOTS.get(k).covers.has(result)) spotEls.get(k)?.classList.add("hit");
        CQ.toast(paid > 0 ? `${result} ${colorOf(result)} — you won ${fmt(paid)} ${wallet.coin}` : `${result} ${colorOf(result)} — no win this time`, paid > 0 ? "win" : "info");
        bets.clear(); historyStack.length = 0;
        spinning = false; if (alive) paintBets();
      });
      let coinNow = wallet.coin;
      const off = wallet.onChange(() => { if (wallet.coin !== coinNow) { coinNow = wallet.coin; if (!spinning) { bets.clear(); historyStack.length = 0; lastBets = null; } setChips(); paintBets(); } });
      setChips(); paintBets();
      return () => { alive = false; off(); };
    },
  });
})();
