/* CareQuay Casino — originals: Crash, Plinko, Limbo, Mines, Dice, Keno */
(() => {
  "use strict";
  const { el, rng, wallet, record, betInput, field, segmented, registerGame, fmt, sleep, $$ } = CQ;
  const EDGE = 0.99;

  const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  const sig = (v) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
  const mfmt = (m) => (m >= 1000 ? m.toLocaleString("en-US", { maximumFractionDigits: 0 }) : m.toFixed(2)) + "×";
  const crashPoint = () => { const r = rng.float(); return Math.max(1, Math.floor((EDGE / (1 - r)) * 100) / 100); };

  function frame() {
    const controls = el("div", { class: "gcontrols" });
    const board = el("div", { class: "gboard" });
    const pop = el("div", { class: "result-pop" }, el("b"), el("small"));
    board.append(pop);
    const root = el("div", { class: "gframe" }, controls, board);
    let popTimer;
    return {
      root, controls, board,
      pop(mult, payout, won) {
        pop.classList.toggle("lose", !won);
        pop.querySelector("b").textContent = mfmt(mult);
        pop.querySelector("small").textContent = won ? `+${fmt(payout)} ${wallet.coin}` : "No win";
        pop.classList.add("show");
        clearTimeout(popTimer);
        popTimer = setTimeout(() => pop.classList.remove("show"), 1500);
      },
      hidePop() { pop.classList.remove("show"); },
    };
  }
  const statRow = (label, valueEl) => el("div", { class: "stat-row" }, el("span", {}, label), valueEl);

  /* =========================================================
     CRASH
     ========================================================= */
  registerGame({
    id: "crash", name: "Crash", cat: "originals", tag: "Original",
    art: { emoji: "🚀", bg: "linear-gradient(150deg,#ff6a3d,#b3135e 55%,#3a0b4a)", accent: "#ff6a3d" },
    blurb: "Watch the multiplier climb. Cash out before it crashes.",
    rules: "<p>Place a bet and the rocket launches. The multiplier rises until a random crash point. Cash out any time before the crash to win your bet × the current multiplier. Set an auto cash out to have it done for you. Return to player is 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      const auto = el("input", { class: "text-in boxed", type: "number", min: "1.01", step: "0.01", value: "2.00" });
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Bet");
      const profitV = el("b", {}, "–");
      f.controls.append(bet.el, field("Auto cash out (×, blank = off)", auto), btn, statRow("Profit on cash out", profitV));

      const hist = el("div", { class: "crash-hist" });
      const canvas = el("canvas", { class: "crash-canvas" });
      const big = el("div", { class: "crash-mult" }, "1.00×");
      const status = el("div", { class: "crash-status" }, "Place a bet to launch");
      f.board.classList.add("crash-board");
      f.board.append(hist, el("div", { class: "crash-wrap" }, canvas, big, status));
      stage.append(f.root);

      const ctx = canvas.getContext("2d");
      const K = 0.00009; // growth per ms
      let raf = 0, running = false, cashed = false, start = 0, crashAt = 1, stake = 0, current = 1, autoAt = 0;
      const past = [];

      function size() {
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.max(10, r.width * dpr); canvas.height = Math.max(10, r.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(running ? (performance.now() - start) : 0, current, false);
      }
      const ro = new ResizeObserver(size); ro.observe(canvas);

      function draw(ms, m, crashed) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const pad = 34;
        const maxT = Math.max(8000, ms * 1.15);
        const maxM = Math.max(2, m * 1.2);
        const X = (t) => pad + (t / maxT) * (w - pad * 1.5);
        const Y = (v) => h - pad - ((v - 1) / (maxM - 1)) * (h - pad * 2);
        // grid
        ctx.strokeStyle = "rgba(160,240,228,.08)"; ctx.lineWidth = 1; ctx.fillStyle = "rgba(143,176,173,.7)"; ctx.font = "11px ui-monospace,Consolas,monospace";
        const step = maxM <= 3 ? 0.5 : maxM <= 6 ? 1 : maxM <= 20 ? 5 : Math.pow(10, Math.floor(Math.log10(maxM)));
        for (let v = 1; v <= maxM; v += step) { const y = Y(v); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 8, y); ctx.stroke(); ctx.fillText(v.toFixed(v < 10 ? 1 : 0) + "×", 2, y + 4); }
        if (ms <= 0) return;
        // curve
        const grad = ctx.createLinearGradient(0, h, w, 0);
        grad.addColorStop(0, crashed ? "#ff5d6c" : "#5ee6d2"); grad.addColorStop(1, crashed ? "#ff9a5d" : "#f5c451");
        ctx.beginPath(); ctx.moveTo(X(0), Y(1));
        const N = 80;
        for (let i = 1; i <= N; i++) { const t = (ms * i) / N; ctx.lineTo(X(t), Y(Math.min(m, Math.exp(K * t)))); }
        ctx.lineWidth = 4; ctx.strokeStyle = grad; ctx.lineCap = "round"; ctx.shadowColor = crashed ? "#ff5d6c" : "#5ee6d2"; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.lineTo(X(ms), h - pad); ctx.lineTo(X(0), h - pad); ctx.closePath();
        const fill = ctx.createLinearGradient(0, 0, 0, h); fill.addColorStop(0, crashed ? "rgba(255,93,108,.25)" : "rgba(94,230,210,.22)"); fill.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fill; ctx.fill();
        ctx.font = "26px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(crashed ? "💥" : "🚀", X(ms), Y(m) - 4); ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      }

      function setIdle() {
        btn.textContent = "Bet"; btn.className = "btn btn-primary btn-lg btn-block"; btn.disabled = false;
        bet.disable(false); auto.disabled = false;
      }
      function pushHist(v) {
        past.unshift(v); past.length = Math.min(past.length, 14);
        hist.replaceChildren(...past.map((p) => el("span", { class: p >= 2 ? "hi" : "lo" }, mfmt(p))));
      }
      function cashOut(at) {
        if (!running || cashed) return;
        cashed = true;
        const payout = CQ.round(stake * at, wallet.coin);
        wallet.credit(payout); record("Crash", stake, payout);
        f.pop(at, payout, true);
        status.textContent = `Cashed out at ${mfmt(at)}`;
        btn.disabled = true; btn.textContent = "Cashed out";
      }
      function tick(now) {
        const ms = now - start;
        current = Math.floor(Math.exp(K * ms) * 100) / 100;
        if (current >= crashAt) {
          current = crashAt; running = false;
          draw(ms, crashAt, true);
          big.textContent = mfmt(crashAt); big.classList.add("crashed");
          status.textContent = cashed ? status.textContent : `Crashed at ${mfmt(crashAt)}`;
          if (!cashed) { record("Crash", stake, 0); f.pop(crashAt, 0, false); }
          pushHist(crashAt);
          setTimeout(setIdle, 700);
          return;
        }
        if (autoAt && !cashed && current >= autoAt) cashOut(autoAt);
        big.textContent = mfmt(current);
        if (!cashed) { btn.textContent = `Cash out ${fmt(CQ.round(stake * current, wallet.coin))}`; profitV.textContent = `${fmt(CQ.round(stake * current - stake, wallet.coin))} ${wallet.coin}`; }
        draw(ms, current, false);
        raf = requestAnimationFrame(tick);
      }
      async function launch() {
        const a = parseFloat(auto.value);
        autoAt = a >= 1.01 ? Math.floor(a * 100) / 100 : 0;
        if (!wallet.debit(bet.value)) return;
        stake = bet.value; cashed = false; crashAt = crashPoint(); current = 1;
        bet.disable(true); auto.disabled = true; f.hidePop();
        big.classList.remove("crashed");
        btn.disabled = true; btn.className = "btn btn-gold btn-lg btn-block";
        counting = true;
        for (const n of ["3", "2", "1"]) { status.textContent = `Launching in ${n}…`; big.textContent = "1.00×"; await sleep(320); if (!alive) return; }
        counting = false;
        status.textContent = autoAt ? `Auto cash out at ${mfmt(autoAt)}` : "Cash out before it crashes";
        btn.disabled = false; running = true; start = performance.now();
        raf = requestAnimationFrame(tick);
      }
      let alive = true, counting = false;
      btn.addEventListener("click", () => { if (running) cashOut(current); else launch(); });
      size();
      return () => {
        alive = false;
        if (counting) wallet.credit(stake);
        if (running && !cashed) cashOut(current);
        cancelAnimationFrame(raf); ro.disconnect(); bet.destroy();
      };
    },
  });

  /* =========================================================
     PLINKO
     ========================================================= */
  const PLINKO_R = { 8: { low: 12, medium: 45, high: 160 }, 12: { low: 22, medium: 140, high: 900 }, 16: { low: 40, medium: 600, high: 6000 } };
  function plinkoTable(n, risk) {
    const R = PLINKO_R[n][risk], h = n / 2;
    const raw = []; for (let i = 0; i <= n; i++) { const d = Math.abs(i - h) / h; raw.push(Math.pow(R, d * d * 0.6 + d * 0.4)); }
    const p = raw.map((_, i) => C(n, i) / 2 ** n);
    const e = raw.reduce((s, v, i) => s + v * p[i], 0);
    return raw.map((v) => sig((v * EDGE) / e));
  }

  registerGame({
    id: "plinko", name: "Plinko", cat: "originals", tag: "Original",
    art: { emoji: "🔻", bg: "linear-gradient(150deg,#ff4fa3,#7b2cff 55%,#1b0f4a)", accent: "#ff4fa3" },
    blurb: "Drop the ball, bounce through the pegs, land a multiplier.",
    rules: "<p>Each ball bounces left or right at every row and lands in a payout slot. Edge slots pay the most but are the hardest to hit. More rows and higher risk mean a wider spread of payouts. Return to player is about 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      let rows = 12, risk = "medium";
      const rowsSeg = segmented([{ label: "8", value: 8 }, { label: "12", value: 12 }, { label: "16", value: 16 }], rows, (v) => { rows = v; layout(); });
      const riskSeg = segmented([{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }], risk, (v) => { risk = v; layout(); });
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Drop ball");
      f.controls.append(bet.el, field("Risk", riskSeg.el), field("Rows", rowsSeg.el), btn);
      const canvas = el("canvas", { class: "plinko-canvas" });
      const slots = el("div", { class: "plinko-slots" });
      f.board.classList.add("plinko-board");
      f.board.append(el("div", { class: "plinko-wrap" }, canvas, slots));
      stage.append(f.root);

      const ctx = canvas.getContext("2d");
      let table = [], balls = [], raf = 0, W = 0, H = 0, gap = 0, top = 0;
      const lock = () => { const busy = balls.length > 0; rowsSeg.lock(busy); riskSeg.lock(busy); };

      function layout() {
        table = plinkoTable(rows, risk);
        slots.style.setProperty("--n", rows + 1);
        slots.replaceChildren(...table.map((m) => {
          const t = Math.min(1, Math.log10(m + 1) / Math.log10(Math.max(...table) + 1));
          return el("span", { class: "pslot", style: { "--heat": t.toFixed(2) } }, String(m));
        }));
        size();
      }
      const wrapEl = () => canvas.parentElement;
      function size() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        W = wrapEl().clientWidth || 600;
        gap = Math.min(W / (rows + 2), 470 / (rows + 0.6), 56);
        top = gap * 0.7;
        H = Math.round(top + (rows - 0.25) * gap);
        canvas.style.height = `${H}px`;
        canvas.width = Math.max(10, W * dpr); canvas.height = Math.max(10, H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        slots.style.width = `${gap * (rows + 1)}px`;
        slots.style.setProperty("--fs", `${Math.max(9, Math.min(13, gap * 0.3))}px`);
        draw();
      }
      const pegX = (row, i) => W / 2 + (i - (row + 2) / 2) * gap;
      const pegY = (row) => top + row * gap;
      function draw() {
        ctx.clearRect(0, 0, W, H);
        for (let r = 0; r < rows; r++) for (let i = 0; i < r + 3; i++) {
          ctx.beginPath(); ctx.arc(pegX(r, i), pegY(r), Math.max(2.2, gap * 0.09), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(234,251,248,.85)"; ctx.shadowColor = "rgba(94,230,210,.6)"; ctx.shadowBlur = 6; ctx.fill();
        }
        ctx.shadowBlur = 0;
        for (const b of balls) {
          ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(4, gap * 0.22), 0, Math.PI * 2);
          const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, gap * 0.25);
          g.addColorStop(0, "#fff6d2"); g.addColorStop(1, "#f5a623");
          ctx.fillStyle = g; ctx.shadowColor = "#f5c451"; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        }
      }
      let lastW = 0; const ro = new ResizeObserver(() => { const w = wrapEl().clientWidth; if (w !== lastW) { lastW = w; size(); } }); ro.observe(canvas.parentElement);

      function frameLoop(now) {
        for (const b of balls) {
          const seg = Math.min(b.path.length, (now - b.t0) / b.speed);
          const k = Math.floor(seg), frac = seg - k;
          // position along rows: after k decisions, rights so far
          const rightsBefore = b.path.slice(0, k).reduce((s, v) => s + v, 0);
          const x0 = W / 2 + (rightsBefore - k / 2) * gap;
          const dir = k < b.path.length ? (b.path[k] ? 0.5 : -0.5) : 0;
          const y0 = top - gap * 0.55 + k * gap;
          b.x = x0 + dir * gap * frac;
          b.y = y0 + gap * frac - Math.sin(frac * Math.PI) * gap * 0.35;
          if (seg >= b.path.length && !b.done) {
            b.done = true;
            const idx = b.path.reduce((s, v) => s + v, 0);
            const mult = table[idx];
            const payout = CQ.round(b.stake * mult, b.coin);
            if (payout > 0) wallet.credit(payout);
            record("Plinko", b.stake, payout);
            const s = slots.children[idx];
            if (s) { s.classList.remove("hit"); void s.offsetWidth; s.classList.add("hit"); }
          }
        }
        balls = balls.filter((b) => !b.done);
        draw(); lock();
        raf = balls.length ? requestAnimationFrame(frameLoop) : 0;
      }
      btn.addEventListener("click", () => {
        if (!wallet.debit(bet.value)) return;
        const path = Array.from({ length: rows }, () => (rng.float() < 0.5 ? 1 : 0));
        balls.push({ path, t0: performance.now(), speed: 150 + rng.float() * 20, stake: bet.value, coin: wallet.coin, x: W / 2, y: 0, done: false });
        lock();
        if (!raf) raf = requestAnimationFrame(frameLoop);
      });
      layout();
      return () => {
        // settle any balls still in flight
        for (const b of balls) { const idx = b.path.reduce((s, v) => s + v, 0); const payout = CQ.round(b.stake * table[idx], b.coin); if (payout > 0) wallet.credit(payout); record("Plinko", b.stake, payout); }
        cancelAnimationFrame(raf); ro.disconnect(); bet.destroy();
      };
    },
  });

  /* =========================================================
     LIMBO
     ========================================================= */
  registerGame({
    id: "limbo", name: "Limbo", cat: "originals", tag: "Original",
    art: { emoji: "🎯", bg: "linear-gradient(150deg,#2bd4ff,#2563eb 55%,#0b1a4a)", accent: "#2bd4ff" },
    blurb: "Pick a target multiplier. Beat it and win.",
    rules: "<p>Set a target multiplier, then bet. A random result is drawn; if it's at or above your target, you win bet × target. Higher targets win less often. Return to player is 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      const target = el("input", { class: "text-in boxed", type: "number", min: "1.01", max: "1000000", step: "0.01", value: "2.00" });
      const chance = el("b", {}, "49.50%");
      const profit = el("b", {}, "");
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Bet");
      f.controls.append(bet.el, field("Target multiplier", target), statRow("Win chance", chance), statRow("Profit on win", profit), btn);
      const big = el("div", { class: "limbo-num" }, "1.00×");
      const tgt = el("div", { class: "limbo-target" }, "Target 2.00×");
      const recent = el("div", { class: "crash-hist" });
      f.board.classList.add("limbo-board");
      f.board.append(recent, big, tgt);
      stage.append(f.root);
      const tv = () => Math.min(1e6, Math.max(1.01, Math.floor((parseFloat(target.value) || 2) * 100) / 100));
      const paint = () => {
        chance.textContent = `${((EDGE / tv()) * 100).toFixed(tv() > 1000 ? 4 : 2)}%`;
        profit.textContent = `${fmt(CQ.round(bet.value * tv() - bet.value, wallet.coin))} ${wallet.coin}`;
        tgt.textContent = `Target ${mfmt(tv())}`;
      };
      target.addEventListener("input", paint); bet.input.addEventListener("input", paint);
      const off = wallet.onChange(paint);
      paint();
      let busy = false; const past = [];
      btn.addEventListener("click", async () => {
        if (busy) return;
        const t = tv(); target.value = t.toFixed(2);
        if (!wallet.debit(bet.value)) return;
        busy = true; btn.disabled = true; f.hidePop();
        const stake = bet.value; const res = crashPoint();
        big.className = "limbo-num rolling";
        const t0 = performance.now(), dur = 650;
        await new Promise((done) => {
          const step = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.pow(1 - k, 3);
            big.textContent = mfmt(1 + (res - 1) * e);
            if (k < 1) requestAnimationFrame(step); else done();
          };
          requestAnimationFrame(step);
        });
        const won = res >= t;
        big.className = `limbo-num ${won ? "win" : "lose"}`;
        const payout = won ? CQ.round(stake * t, wallet.coin) : 0;
        if (won) wallet.credit(payout);
        record("Limbo", stake, payout);
        f.pop(won ? t : res, payout, won);
        past.unshift(res); past.length = Math.min(past.length, 14);
        recent.replaceChildren(...past.map((p) => el("span", { class: p >= t ? "hi" : "lo" }, mfmt(p))));
        busy = false; btn.disabled = false;
      });
      return () => { off(); bet.destroy(); };
    },
  });

  /* =========================================================
     MINES
     ========================================================= */
  registerGame({
    id: "mines", name: "Mines", cat: "originals", tag: "Original",
    art: { emoji: "💣", bg: "linear-gradient(150deg,#33e1a0,#0f8a6b 55%,#06302a)", accent: "#33e1a0" },
    blurb: "Find the gems, dodge the mines, cash out whenever you like.",
    rules: "<p>Choose how many mines hide in the 5×5 grid, then bet. Every gem you reveal raises your multiplier. Hit a mine and the round is lost. Cash out at any point to keep your winnings. Return to player is 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      const mineSel = el("select", { class: "boxed" }, Array.from({ length: 24 }, (_, i) => el("option", { value: i + 1, selected: i + 1 === 3 }, `${i + 1} mine${i ? "s" : ""}`)));
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Bet");
      const pickBtn = el("button", { class: "btn btn-ghost btn-block", type: "button", disabled: true }, "Pick random tile");
      const multV = el("b", {}, "1.00×"), nextV = el("b", {}, "–"), payV = el("b", {}, "–");
      f.controls.append(bet.el, field("Mines", mineSel), btn, pickBtn, statRow("Current multiplier", multV), statRow("Next gem", nextV), statRow("Cash out value", payV));
      const grid = el("div", { class: "mines-grid" });
      f.board.classList.add("mines-board");
      f.board.append(grid);
      stage.append(f.root);
      let mines = new Set(), revealed = 0, playing = false, stake = 0, m = 3;
      const multAt = (k) => (k === 0 ? 1 : (EDGE * C(25, k)) / C(25 - m, k));
      const tiles = Array.from({ length: 25 }, (_, i) => el("button", { class: "mtile", type: "button", "aria-label": `Tile ${i + 1}`, disabled: true, onclick: () => reveal(i) }));
      grid.append(...tiles);
      function paint() {
        multV.textContent = mfmt(Math.floor(multAt(revealed) * 100) / 100);
        nextV.textContent = playing && revealed < 25 - m ? mfmt(Math.floor(multAt(revealed + 1) * 100) / 100) : "–";
        payV.textContent = playing ? `${fmt(CQ.round(stake * multAt(revealed), wallet.coin))} ${wallet.coin}` : "–";
      }
      function end(lost) {
        playing = false;
        tiles.forEach((t, i) => {
          t.disabled = true;
          if (!t.classList.contains("open")) { t.classList.add("dim", mines.has(i) ? "mine" : "gem"); t.textContent = mines.has(i) ? "💣" : "💎"; }
        });
        btn.textContent = "Bet"; btn.className = "btn btn-primary btn-lg btn-block";
        pickBtn.disabled = true; bet.disable(false); mineSel.disabled = false;
        if (lost) { record("Mines", stake, 0); f.pop(0, 0, false); }
        paint();
      }
      function reveal(i) {
        if (!playing || tiles[i].classList.contains("open")) return;
        const t = tiles[i];
        t.classList.add("open"); t.disabled = true;
        if (mines.has(i)) { t.classList.add("mine", "boom"); t.textContent = "💣"; end(true); return; }
        t.classList.add("gem"); t.textContent = "💎"; revealed += 1;
        if (revealed === 25 - m) { cash(); return; }
        btn.textContent = `Cash out ${fmt(CQ.round(stake * multAt(revealed), wallet.coin))}`;
        paint();
      }
      function cash() {
        if (!playing || revealed === 0) return;
        const mult = multAt(revealed);
        const payout = CQ.round(stake * mult, wallet.coin);
        wallet.credit(payout); record("Mines", stake, payout); f.pop(mult, payout, true);
        end(false);
      }
      btn.addEventListener("click", () => {
        if (playing) { cash(); return; }
        m = +mineSel.value;
        if (!wallet.debit(bet.value)) return;
        stake = bet.value; revealed = 0; playing = true; f.hidePop();
        mines = new Set(rng.shuffle([...Array(25).keys()]).slice(0, m));
        tiles.forEach((t) => { t.className = "mtile"; t.textContent = ""; t.disabled = false; });
        btn.textContent = "Cash out"; btn.className = "btn btn-gold btn-lg btn-block";
        pickBtn.disabled = false; bet.disable(true); mineSel.disabled = true;
        paint();
      });
      pickBtn.addEventListener("click", () => { const open = tiles.map((t, i) => i).filter((i) => !tiles[i].classList.contains("open")); if (open.length) reveal(rng.pick(open)); });
      paint();
      return () => { if (playing && revealed > 0) cash(); else if (playing) { wallet.credit(stake); } bet.destroy(); };
    },
  });

  /* =========================================================
     DICE
     ========================================================= */
  registerGame({
    id: "dice", name: "Dice", cat: "originals", tag: "Original",
    art: { emoji: "🎲", bg: "linear-gradient(150deg,#ffd54a,#f08a24 55%,#5a2006)", accent: "#ffd54a" },
    blurb: "Slide your odds, roll over or under, set your own payout.",
    rules: "<p>A number from 0.00 to 100.00 is rolled. Drag the slider to set a target and choose roll over or roll under. The smaller your chance, the bigger the payout. Return to player is 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      let over = true, target = 50.5;
      const dir = segmented([{ label: "Roll over", value: true }, { label: "Roll under", value: false }], over, (v) => { over = v; target = 100 - target; slider.value = target; paint(); });
      const multV = el("b"), chanceV = el("b"), profitV = el("b");
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Roll dice");
      f.controls.append(bet.el, field("Direction", dir.el), statRow("Multiplier", multV), statRow("Win chance", chanceV), statRow("Profit on win", profitV), btn);
      const slider = el("input", { type: "range", min: "2", max: "98", step: "0.5", value: target, class: "dice-range", "aria-label": "Target" });
      const marker = el("div", { class: "dice-marker" }, el("span", {}, "50.00"));
      const track = el("div", { class: "dice-track" }, el("div", { class: "dice-fill" }), marker, slider);
      const scale = el("div", { class: "dice-scale" }, ["0", "25", "50", "75", "100"].map((s) => el("span", {}, s)));
      const result = el("div", { class: "dice-result" }, "–");
      const tgtLabel = el("div", { class: "dice-target" });
      f.board.classList.add("dice-board");
      f.board.append(result, tgtLabel, el("div", { class: "dice-slider" }, track, scale));
      stage.append(f.root);
      const chance = () => (over ? 100 - target : target);
      const mult = () => Math.floor((EDGE * 100 * 10000) / chance()) / 10000;
      function paint() {
        track.style.setProperty("--t", `${target}%`);
        track.classList.toggle("under", !over);
        multV.textContent = `${mult().toFixed(4)}×`;
        chanceV.textContent = `${chance().toFixed(2)}%`;
        profitV.textContent = `${fmt(CQ.round(bet.value * mult() - bet.value, wallet.coin))} ${wallet.coin}`;
        tgtLabel.textContent = `${over ? "Roll over" : "Roll under"} ${target.toFixed(2)}`;
      }
      slider.addEventListener("input", () => { target = +slider.value; paint(); });
      bet.input.addEventListener("input", paint);
      const off = wallet.onChange(paint);
      paint();
      let busy = false;
      btn.addEventListener("click", async () => {
        if (busy) return;
        if (!wallet.debit(bet.value)) return;
        busy = true; btn.disabled = true; slider.disabled = true; dir.lock(true); f.hidePop();
        const stake = bet.value, m = mult();
        const roll = rng.int(10001) / 100;
        const won = over ? roll > target : roll < target;
        marker.style.left = `${roll}%`; marker.classList.add("show");
        marker.firstChild.textContent = roll.toFixed(2);
        marker.classList.toggle("win", won); marker.classList.toggle("lose", !won);
        const t0 = performance.now();
        await new Promise((done) => {
          const step = (now) => { const k = Math.min(1, (now - t0) / 450); result.textContent = (k < 1 ? rng.int(10001) / 100 : roll).toFixed(2); if (k < 1) requestAnimationFrame(step); else done(); };
          requestAnimationFrame(step);
        });
        result.className = `dice-result ${won ? "win" : "lose"}`;
        const payout = won ? CQ.round(stake * m, wallet.coin) : 0;
        if (won) wallet.credit(payout);
        record("Dice", stake, payout);
        f.pop(won ? m : 0, payout, won);
        busy = false; btn.disabled = false; slider.disabled = false; dir.lock(false);
      });
      return () => { off(); bet.destroy(); };
    },
  });

  /* =========================================================
     KENO
     ========================================================= */
  const KENO = {};
  for (let p = 1; p <= 10; p++) {
    const P = (h) => (C(p, h) * C(40 - p, 10 - h)) / C(40, 10);
    const th = p <= 2 ? 1 : p <= 4 ? 2 : p <= 7 ? 3 : 4;
    const raw = []; for (let h = 0; h <= p; h++) raw.push(h < th ? 0 : Math.pow(h - th + 1, 2.2) * Math.pow(2.1, h - th));
    const e = raw.reduce((s, v, h) => s + v * P(h), 0);
    KENO[p] = raw.map((v) => sig((v * 0.97) / e));
  }
  registerGame({
    id: "keno", name: "Keno", cat: "originals", tag: "Original",
    art: { emoji: "🔢", bg: "linear-gradient(150deg,#b46bff,#5b21b6 55%,#1e0b3f)", accent: "#b46bff" },
    blurb: "Pick up to 10 numbers. Ten are drawn. Match to win.",
    rules: "<p>Choose 1 to 10 numbers from 40, then bet. Ten numbers are drawn; your payout depends on how many of your picks match, shown in the table under the board. Return to player is about 97%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button", disabled: true }, "Pick numbers");
      const autoBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Auto pick");
      const clearBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Clear");
      f.controls.append(bet.el, el("div", { class: "btn-pair" }, autoBtn, clearBtn), btn);
      const grid = el("div", { class: "keno-grid" });
      const pays = el("div", { class: "keno-pays" });
      f.board.classList.add("keno-board");
      f.board.append(grid, pays);
      stage.append(f.root);
      const picks = new Set();
      let busy = false;
      const cells = Array.from({ length: 40 }, (_, i) => el("button", { class: "kcell", type: "button", onclick: () => toggle(i + 1) }, String(i + 1)));
      grid.append(...cells);
      function clearDraw() { cells.forEach((c) => c.classList.remove("drawn", "hit")); $$(".kp", pays).forEach((p) => p.classList.remove("on")); }
      function paint() {
        cells.forEach((c, i) => c.classList.toggle("picked", picks.has(i + 1)));
        const n = picks.size;
        btn.disabled = busy || n === 0;
        btn.textContent = n ? "Bet" : "Pick numbers";
        pays.replaceChildren(...(n ? KENO[n].map((m, h) => el("div", { class: `kp${m ? "" : " zero"}`, "data-h": h }, el("b", {}, m ? `${m}×` : "0×"), el("small", {}, `${h} hit${h === 1 ? "" : "s"}`))) : [el("p", { class: "keno-hint" }, "Select up to 10 numbers on the board")]));
      }
      function toggle(n) {
        if (busy) return;
        clearDraw();
        if (picks.has(n)) picks.delete(n); else if (picks.size < 10) picks.add(n); else CQ.toast("You can pick up to 10 numbers.", "warn");
        paint();
      }
      autoBtn.addEventListener("click", () => { if (busy) return; clearDraw(); const want = picks.size || 10; picks.clear(); rng.shuffle([...Array(40).keys()]).slice(0, want).forEach((i) => picks.add(i + 1)); paint(); });
      clearBtn.addEventListener("click", () => { if (busy) return; picks.clear(); clearDraw(); paint(); });
      btn.addEventListener("click", async () => {
        if (busy || !picks.size) return;
        if (!wallet.debit(bet.value)) return;
        busy = true; paint(); bet.disable(true); f.hidePop(); clearDraw();
        const stake = bet.value, n = picks.size;
        const draw = rng.shuffle([...Array(40).keys()].map((i) => i + 1)).slice(0, 10);
        const hits = draw.filter((d) => picks.has(d)).length;
        const mult = KENO[n][hits];
        pending = { stake, payout: CQ.round(stake * mult, wallet.coin) };
        for (const d of draw) {
          const c = cells[d - 1];
          c.classList.add("drawn");
          if (picks.has(d)) c.classList.add("hit");
          await sleep(110);
          if (!alive) return;
        }
        pending = null;
        const kp = pays.querySelector(`[data-h="${hits}"]`); if (kp) kp.classList.add("on");
        const payout = CQ.round(stake * mult, wallet.coin);
        if (payout > 0) wallet.credit(payout);
        record("Keno", stake, payout);
        f.pop(mult, payout, payout > 0);
        busy = false; bet.disable(false); paint();
      });
      let alive = true, pending = null;
      paint();
      return () => { alive = false; if (pending) { if (pending.payout > 0) wallet.credit(pending.payout); record("Keno", pending.stake, pending.payout); } bet.destroy(); };
    },
  });
})();
