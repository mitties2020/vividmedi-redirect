/* CareQuay Casino — Crash, Plinko, Limbo, Mines, Dice, Keno (results from the server). */
(() => {
  "use strict";
  const { el, $$, betInput, field, segmented, statRow, registerGame, fmtUSD, sleep, play, act, gameState, fail, mfmt, frame, T } = CQ;

  /* ================= CRASH ================= */
  registerGame({
    id: "crash", name: "Crash", cat: "originals", tag: "Original",
    art: { emoji: "🚀", bg: "linear-gradient(150deg,#ff6a3d,#b3135e 55%,#3a0b4a)", accent: "#ff6a3d" },
    blurb: "Watch the multiplier climb. Cash out before it crashes.",
    rules: "<p>Place a bet and the rocket launches. The multiplier rises until a random crash point. Cash out before the crash to win your bet × the multiplier. Set an auto cash out and it happens for you even if you leave the page. Return to player 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      const auto = el("input", { class: "text-in boxed", type: "number", min: "1.01", step: "0.01", value: "2.00" });
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Bet");
      const profitV = el("b", {}, "–");
      f.controls.append(bet.el, field("Auto cash out (× — blank for off)", auto), btn, statRow("Cash out value", profitV));
      const hist = el("div", { class: "crash-hist" });
      const canvas = el("canvas", { class: "crash-canvas" });
      const big = el("div", { class: "crash-mult" }, "1.00×");
      const status = el("div", { class: "crash-status" }, "Place a bet to launch");
      f.board.classList.add("crash-board");
      f.board.append(hist, el("div", { class: "crash-wrap" }, canvas, big, status));
      stage.append(f.root);
      const ctx = canvas.getContext("2d");
      let K = 0.00009, raf = 0, running = false, t0 = 0, stake = 0, current = 1, alive = true, polling = false, pollT = 0, autoAt = 0, cashing = false;
      const past = [];

      function size() { const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.max(10, r.width * dpr); canvas.height = Math.max(10, r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(running ? performance.now() - t0 : 0, current, false); }
      const ro = new ResizeObserver(size); ro.observe(canvas);
      function draw(ms, m, crashed) {
        const w = canvas.clientWidth, h = canvas.clientHeight, pad = 34;
        ctx.clearRect(0, 0, w, h);
        const maxT = Math.max(8000, ms * 1.15), maxM = Math.max(2, m * 1.2);
        const X = (t) => pad + (t / maxT) * (w - pad * 1.5), Y = (v) => h - pad - ((v - 1) / (maxM - 1)) * (h - pad * 2);
        ctx.strokeStyle = "rgba(160,240,228,.08)"; ctx.lineWidth = 1; ctx.fillStyle = "rgba(143,176,173,.7)"; ctx.font = "11px ui-monospace,Consolas,monospace";
        const step = maxM <= 3 ? 0.5 : maxM <= 6 ? 1 : maxM <= 20 ? 5 : Math.pow(10, Math.floor(Math.log10(maxM)));
        for (let v = 1; v <= maxM; v += step) { const y = Y(v); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 8, y); ctx.stroke(); ctx.fillText(v.toFixed(v < 10 ? 1 : 0) + "×", 2, y + 4); }
        if (ms <= 0) return;
        const g = ctx.createLinearGradient(0, h, w, 0); g.addColorStop(0, crashed ? "#ff5d6c" : "#5ee6d2"); g.addColorStop(1, crashed ? "#ff9a5d" : "#f5c451");
        ctx.beginPath(); ctx.moveTo(X(0), Y(1));
        for (let i = 1; i <= 80; i++) { const t = (ms * i) / 80; ctx.lineTo(X(t), Y(Math.min(m, Math.exp(K * t)))); }
        ctx.lineWidth = 4; ctx.strokeStyle = g; ctx.lineCap = "round"; ctx.shadowColor = crashed ? "#ff5d6c" : "#5ee6d2"; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.lineTo(X(ms), h - pad); ctx.lineTo(X(0), h - pad); ctx.closePath();
        const fill = ctx.createLinearGradient(0, 0, 0, h); fill.addColorStop(0, crashed ? "rgba(255,93,108,.25)" : "rgba(94,230,210,.22)"); fill.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = fill; ctx.fill();
        ctx.font = "26px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(crashed ? "💥" : "🚀", X(ms), Y(m) - 4); ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      }
      function idle() { running = false; cancelAnimationFrame(raf); clearTimeout(pollT); btn.textContent = "Bet"; btn.className = "btn btn-primary btn-lg btn-block"; btn.disabled = false; bet.disable(false); auto.disabled = false; profitV.textContent = "–"; }
      function pushHist(v) { past.unshift(v); past.length = Math.min(past.length, 14); hist.replaceChildren(...past.map((p) => el("span", { class: p >= 2 ? "hi" : "lo" }, mfmt(p)))); }
      function finish(v, payout) {
        const ms = performance.now() - t0;
        running = false; cancelAnimationFrame(raf); clearTimeout(pollT);
        if (v.cashedAt) { status.textContent = `Cashed out at ${mfmt(v.cashedAt)}${v.auto ? " (auto)" : ""} · crashed at ${mfmt(v.crash)}`; f.pop(v.cashedAt, payout, true); }
        else { status.textContent = `Crashed at ${mfmt(v.crash)}`; f.pop(v.crash, 0, false); }
        big.textContent = mfmt(v.crash); big.classList.add("crashed");
        draw(Math.max(ms, 1), v.crash, true);
        pushHist(v.crash);
        setTimeout(idle, 600);
      }
      async function poll() {
        if (!running || !alive || polling) return;
        polling = true;
        try { const r = await act("crash", "poll"); if (r.done) { finish(r.view, r.payout); polling = false; return; } } catch (e) { fail(e); }
        polling = false;
        if (running && alive) pollT = setTimeout(poll, 350);
      }
      function tick() {
        const ms = performance.now() - t0;
        if (ms < 0) { status.textContent = `Launching in ${Math.ceil(-ms / 1000)}…`; raf = requestAnimationFrame(tick); return; }
        current = Math.floor(Math.exp(K * ms) * 100) / 100;
        big.textContent = mfmt(current);
        if (!cashing) { btn.disabled = false; btn.textContent = `Cash out ${fmtUSD(stake * current)}`; }
        profitV.textContent = fmtUSD(stake * current);
        status.textContent = autoAt ? `Auto cash out at ${mfmt(autoAt)}` : "Cash out before it crashes";
        draw(ms, current, false);
        raf = requestAnimationFrame(tick);
      }
      function startAnim(startInMs, k, a, st) {
        K = k; autoAt = a; stake = st; running = true; cashing = false; current = 1; t0 = performance.now() + startInMs;
        big.classList.remove("crashed"); f.hidePop();
        bet.disable(true); auto.disabled = true; btn.className = "btn btn-gold btn-lg btn-block"; btn.disabled = true;
        raf = requestAnimationFrame(tick); pollT = setTimeout(poll, Math.max(200, startInMs));
      }
      btn.addEventListener("click", async () => {
        if (running) {
          if (current < 1.01 || cashing) return;
          cashing = true; btn.disabled = true; btn.textContent = "Cashing out…";
          try { const r = await act("crash", "cashout"); if (r.done) finish(r.view, r.payout); } catch (e) { fail(e); cashing = false; }
          return;
        }
        btn.disabled = true;
        try {
          const a = parseFloat(auto.value);
          const r = await act("crash", "start", { bet: bet.value, auto: a >= 1.01 ? a : 0 });
          startAnim(r.view.t0In, r.view.k, r.view.auto, bet.value);
        } catch (e) { fail(e); btn.disabled = false; }
      });
      gameState("crash").then((s) => { if (alive && s.active && s.view) { startAnim(-s.view.elapsed, s.view.k, s.view.auto, s.view.stake); status.textContent = "Round in progress"; } }).catch(() => {});
      size();
      return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(pollT); ro.disconnect(); };
    },
  });

  /* ================= PLINKO ================= */
  registerGame({
    id: "plinko", name: "Plinko", cat: "originals", tag: "Original",
    art: { emoji: "🔻", bg: "linear-gradient(150deg,#ff4fa3,#7b2cff 55%,#1b0f4a)", accent: "#ff4fa3" },
    blurb: "Drop the ball, bounce through the pegs, land a multiplier.",
    rules: "<p>Each ball bounces left or right at every row and lands in a payout slot. Edge slots pay the most but are the hardest to hit. More rows and higher risk widen the spread. Return to player about 99%.</p>",
    mount(stage) {
      const f = frame();
      const bet = betInput();
      let rows = 12, risk = "medium";
      const rowsSeg = segmented([{ label: "8", value: 8 }, { label: "12", value: 12 }, { label: "16", value: 16 }], rows, (v) => { rows = v; layout(); });
      const riskSeg = segmented([{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }], risk, (v) => { risk = v; layout(); });
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Drop ball");
      f.controls.append(bet.el, field("Risk", riskSeg.el), field("Rows", rowsSeg.el), btn);
      const canvas = el("canvas", { class: "plinko-canvas" }), slots = el("div", { class: "plinko-slots" });
      f.board.classList.add("plinko-board");
      const wrap = el("div", { class: "plinko-wrap" }, canvas, slots);
      f.board.append(wrap); stage.append(f.root);
      const ctx = canvas.getContext("2d");
      let table = [], balls = [], raf = 0, W = 0, H = 0, gap = 0, top = 0, inflight = 0;
      const lock = () => { const b = balls.length > 0 || inflight > 0; rowsSeg.lock(b); riskSeg.lock(b); };
      function layout() {
        table = T.plinkoTable(rows, risk);
        const mx = Math.max(...table);
        slots.style.setProperty("--n", rows + 1);
        slots.replaceChildren(...table.map((m) => el("span", { class: "pslot", style: { "--heat": Math.min(1, Math.log10(m + 1) / Math.log10(mx + 1)).toFixed(2) } }, String(m))));
        size();
      }
      function size() {
        const dpr = Math.min(2, devicePixelRatio || 1);
        W = wrap.clientWidth || 600; gap = Math.min(W / (rows + 2), 470 / (rows + 0.6), 56); top = gap * 0.7; H = Math.round(top + (rows - 0.25) * gap);
        canvas.style.height = `${H}px`; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        slots.style.width = `${gap * (rows + 1)}px`; slots.style.setProperty("--fs", `${Math.max(9, Math.min(13, gap * 0.3))}px`);
        draw();
      }
      function draw() {
        ctx.clearRect(0, 0, W, H);
        for (let r = 0; r < rows; r++) for (let i = 0; i < r + 3; i++) { ctx.beginPath(); ctx.arc(W / 2 + (i - (r + 2) / 2) * gap, top + r * gap, Math.max(2.2, gap * 0.09), 0, Math.PI * 2); ctx.fillStyle = "rgba(234,251,248,.85)"; ctx.shadowColor = "rgba(94,230,210,.6)"; ctx.shadowBlur = 6; ctx.fill(); }
        ctx.shadowBlur = 0;
        for (const b of balls) { ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(4, gap * 0.22), 0, Math.PI * 2); const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, gap * 0.25); g.addColorStop(0, "#fff6d2"); g.addColorStop(1, "#f5a623"); ctx.fillStyle = g; ctx.shadowColor = "#f5c451"; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0; }
      }
      let lastW = 0; const ro = new ResizeObserver(() => { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; size(); } }); ro.observe(wrap);
      function loop(now) {
        for (const b of balls) {
          const seg = Math.min(b.path.length, (now - b.t0) / b.speed), k = Math.floor(seg), frac = seg - k;
          const rb = b.path.slice(0, k).reduce((s, v) => s + v, 0);
          const dir = k < b.path.length ? (b.path[k] ? 0.5 : -0.5) : 0;
          b.x = W / 2 + (rb - k / 2) * gap + dir * gap * frac;
          b.y = top - gap * 0.55 + k * gap + gap * frac - Math.sin(frac * Math.PI) * gap * 0.35;
          if (seg >= b.path.length && !b.done) {
            b.done = true; b.settle();
            const s = slots.children[b.slot]; if (s) { s.classList.remove("hit"); void s.offsetWidth; s.classList.add("hit"); }
          }
        }
        balls = balls.filter((b) => !b.done); draw(); lock();
        raf = balls.length ? requestAnimationFrame(loop) : 0;
      }
      btn.addEventListener("click", async () => {
        inflight++; lock();
        try {
          const r = await play("plinko", { bet: bet.value, rows, risk });
          balls.push({ path: r.result.path, slot: r.result.slot, settle: r.settle, t0: performance.now(), speed: 150 + Math.random() * 20, x: W / 2, y: 0, done: false });
          if (!raf) raf = requestAnimationFrame(loop);
        } catch (e) { fail(e); }
        inflight--; lock();
      });
      layout();
      return () => { balls.forEach((b) => b.settle()); cancelAnimationFrame(raf); ro.disconnect(); };
    },
  });

  /* ================= LIMBO ================= */
  registerGame({
    id: "limbo", name: "Limbo", cat: "originals", tag: "Original",
    art: { emoji: "🎯", bg: "linear-gradient(150deg,#2bd4ff,#2563eb 55%,#0b1a4a)", accent: "#2bd4ff" },
    blurb: "Pick a target multiplier. Beat it and win.",
    rules: "<p>Set a target multiplier, then bet. If the result is at or above your target you win bet × target. Higher targets win less often. Return to player 99%.</p>",
    mount(stage) {
      const f = frame(); const bet = betInput();
      const target = el("input", { class: "text-in boxed", type: "number", min: "1.01", max: "1000000", step: "0.01", value: "2.00" });
      const chance = el("b"), profit = el("b");
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Bet");
      f.controls.append(bet.el, field("Target multiplier", target), statRow("Win chance", chance), statRow("Profit on win", profit), btn);
      const big = el("div", { class: "limbo-num" }, "1.00×"), tgt = el("div", { class: "limbo-target" }), recent = el("div", { class: "crash-hist" });
      f.board.classList.add("limbo-board"); f.board.append(recent, big, tgt); stage.append(f.root);
      const tv = () => Math.min(1e6, Math.max(1.01, Math.floor((parseFloat(target.value) || 2) * 100) / 100));
      const paint = () => { chance.textContent = `${((T.EDGE / tv()) * 100).toFixed(tv() > 1000 ? 4 : 2)}%`; profit.textContent = fmtUSD(bet.value * tv() - bet.value); tgt.textContent = `Target ${mfmt(tv())}`; };
      target.addEventListener("input", paint); bet.input.addEventListener("input", paint); paint();
      let busy = false; const past = [];
      btn.addEventListener("click", async () => {
        if (busy) return; busy = true; btn.disabled = true; f.hidePop();
        const t = tv(); target.value = t.toFixed(2);
        try {
          const r = await play("limbo", { bet: bet.value, target: t });
          const res = r.result.value; big.className = "limbo-num rolling";
          const t0 = performance.now();
          await new Promise((done) => { const step = (now) => { const k = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - k, 3); big.textContent = mfmt(1 + (res - 1) * e); if (k < 1) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
          big.className = `limbo-num ${r.result.won ? "win" : "lose"}`; r.settle();
          f.pop(r.result.won ? t : res, r.payout, r.result.won);
          past.unshift(res); past.length = Math.min(past.length, 14); recent.replaceChildren(...past.map((p) => el("span", { class: p >= t ? "hi" : "lo" }, mfmt(p))));
        } catch (e) { fail(e); }
        busy = false; btn.disabled = false;
      });
    },
  });

  /* ================= MINES ================= */
  registerGame({
    id: "mines", name: "Mines", cat: "originals", tag: "Original",
    art: { emoji: "💣", bg: "linear-gradient(150deg,#33e1a0,#0f8a6b 55%,#06302a)", accent: "#33e1a0" },
    blurb: "Find the gems, dodge the mines, cash out whenever you like.",
    rules: "<p>Choose how many mines hide in the 5×5 grid, then bet. Every gem you reveal raises your multiplier; hit a mine and the round is lost. Cash out any time. Your round is saved if you leave. Return to player 99%.</p>",
    mount(stage) {
      const f = frame(); const bet = betInput();
      const mineSel = el("select", { class: "boxed" }, Array.from({ length: 24 }, (_, i) => el("option", { value: i + 1, selected: i + 1 === 3 }, `${i + 1} mine${i ? "s" : ""}`)));
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Bet");
      const pickBtn = el("button", { class: "btn btn-ghost btn-block", type: "button", disabled: true }, "Pick random tile");
      const multV = el("b", {}, "1.00×"), nextV = el("b", {}, "–"), payV = el("b", {}, "–");
      f.controls.append(bet.el, field("Mines", mineSel), btn, pickBtn, statRow("Current multiplier", multV), statRow("Next gem", nextV), statRow("Cash out value", payV));
      const grid = el("div", { class: "mines-grid" }); f.board.classList.add("mines-board"); f.board.append(grid); stage.append(f.root);
      let playing = false, busy = false, stake = 0;
      const tiles = Array.from({ length: 25 }, (_, i) => el("button", { class: "mtile", type: "button", "aria-label": `Tile ${i + 1}`, disabled: true, onclick: () => reveal(i) }));
      grid.append(...tiles);
      function paint(v) {
        multV.textContent = mfmt(v ? v.mult : 1); nextV.textContent = v && v.next ? mfmt(v.next) : "–";
        payV.textContent = playing && v && v.revealed.length ? fmtUSD(stake * v.mult) : "–";
        if (playing) btn.textContent = v && v.revealed.length ? `Cash out ${fmtUSD(stake * v.mult)}` : "Cash out";
      }
      function setPlaying(on, v) {
        playing = on;
        btn.className = on ? "btn btn-gold btn-lg btn-block" : "btn btn-primary btn-lg btn-block";
        if (!on) btn.textContent = "Bet";
        pickBtn.disabled = !on; bet.disable(on); mineSel.disabled = on;
        tiles.forEach((t) => (t.disabled = !on || t.classList.contains("open")));
        paint(v);
      }
      function showEnd(v) {
        tiles.forEach((t, i) => { t.disabled = true; if (!t.classList.contains("open")) { const mine = v.mines.includes(i); t.classList.add("dim", mine ? "mine" : "gem"); t.textContent = mine ? "💣" : "💎"; } });
        if (v.boom != null) { tiles[v.boom].classList.add("open", "mine", "boom"); tiles[v.boom].classList.remove("dim"); tiles[v.boom].textContent = "💣"; }
      }
      function applyView(v) { v.revealed.forEach((i) => { tiles[i].classList.add("open", "gem"); tiles[i].textContent = "💎"; tiles[i].disabled = true; }); }
      async function reveal(i) {
        if (!playing || busy || tiles[i].classList.contains("open")) return;
        busy = true;
        try {
          const r = await act("mines", "reveal", { tile: i });
          applyView(r.view);
          if (r.done) { showEnd(r.view); setPlaying(false, r.view); if (r.view.boom != null) f.pop(0, 0, false); else f.pop(r.view.mult, r.payout, true); }
          else paint(r.view);
        } catch (e) { fail(e); }
        busy = false;
      }
      btn.addEventListener("click", async () => {
        if (busy) return; busy = true;
        try {
          if (playing) { const r = await act("mines", "cashout"); showEnd(r.view); setPlaying(false, r.view); f.pop(r.view.mult, r.payout, true); }
          else {
            const r = await act("mines", "start", { bet: bet.value, mines: +mineSel.value });
            stake = bet.value; f.hidePop();
            tiles.forEach((t) => { t.className = "mtile"; t.textContent = ""; });
            setPlaying(true, r.view);
          }
        } catch (e) {
          if (e.status === 409 && e.data && e.data.view) { resume(e.data.view, e.data.mode); } else fail(e);
        }
        busy = false;
      });
      pickBtn.addEventListener("click", () => { const open = tiles.map((t, i) => i).filter((i) => !tiles[i].classList.contains("open")); if (open.length) reveal(open[Math.floor(Math.random() * open.length)]); });
      function resume(v, mode) {
        if (mode && mode !== CQ.state.mode) { CQ.toast(`You have a ${mode} Mines round in progress — switch to ${mode} to finish it.`, "warn"); return; }
        stake = v.stake; tiles.forEach((t) => { t.className = "mtile"; t.textContent = ""; });
        applyView(v); setPlaying(true, v); CQ.toast("Resumed your Mines round.");
      }
      gameState("mines").then((s) => { if (s.active) resume(s.view, s.mode); }).catch(() => {});
    },
  });

  /* ================= DICE ================= */
  registerGame({
    id: "dice", name: "Dice", cat: "originals", tag: "Original",
    art: { emoji: "🎲", bg: "linear-gradient(150deg,#ffd54a,#f08a24 55%,#5a2006)", accent: "#ffd54a" },
    blurb: "Slide your odds, roll over or under, set your own payout.",
    rules: "<p>A number from 0.00 to 100.00 is rolled. Drag the slider to set a target and choose roll over or under. The smaller your chance, the bigger the payout. Return to player 99%.</p>",
    mount(stage) {
      const f = frame(); const bet = betInput();
      let over = true, target = 50.5;
      const dir = segmented([{ label: "Roll over", value: true }, { label: "Roll under", value: false }], over, (v) => { over = v; target = 100 - target; slider.value = target; paint(); });
      const multV = el("b"), chanceV = el("b"), profitV = el("b");
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button" }, "Roll dice");
      f.controls.append(bet.el, field("Direction", dir.el), statRow("Multiplier", multV), statRow("Win chance", chanceV), statRow("Profit on win", profitV), btn);
      const slider = el("input", { type: "range", min: "2", max: "98", step: "0.5", value: target, class: "dice-range", "aria-label": "Target" });
      const marker = el("div", { class: "dice-marker" }, el("span", {}, "50.00"));
      const track = el("div", { class: "dice-track" }, el("div", { class: "dice-fill" }), marker, slider);
      const result = el("div", { class: "dice-result" }, "–"), tgtLabel = el("div", { class: "dice-target" });
      f.board.classList.add("dice-board");
      f.board.append(result, tgtLabel, el("div", { class: "dice-slider" }, track, el("div", { class: "dice-scale" }, ["0", "25", "50", "75", "100"].map((s) => el("span", {}, s)))));
      stage.append(f.root);
      const chance = () => (over ? 100 - target : target), mult = () => Math.floor((T.EDGE * 100 * 10000) / chance()) / 10000;
      function paint() { track.style.setProperty("--t", `${target}%`); track.classList.toggle("under", !over); multV.textContent = `${mult().toFixed(4)}×`; chanceV.textContent = `${chance().toFixed(2)}%`; profitV.textContent = fmtUSD(bet.value * mult() - bet.value); tgtLabel.textContent = `${over ? "Roll over" : "Roll under"} ${target.toFixed(2)}`; }
      slider.addEventListener("input", () => { target = +slider.value; paint(); }); bet.input.addEventListener("input", paint); paint();
      let busy = false;
      btn.addEventListener("click", async () => {
        if (busy) return; busy = true; btn.disabled = true; slider.disabled = true; dir.lock(true); f.hidePop();
        try {
          const r = await play("dice", { bet: bet.value, target, over });
          const { roll, won } = r.result;
          marker.style.left = `${roll}%`; marker.classList.add("show"); marker.firstChild.textContent = roll.toFixed(2); marker.classList.toggle("win", won); marker.classList.toggle("lose", !won);
          const t0 = performance.now();
          await new Promise((done) => { const step = (now) => { const k = Math.min(1, (now - t0) / 450); result.textContent = (k < 1 ? Math.random() * 100 : roll).toFixed(2); if (k < 1) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
          result.className = `dice-result ${won ? "win" : "lose"}`; r.settle();
          f.pop(won ? r.result.mult : 0, r.payout, won);
        } catch (e) { fail(e); }
        busy = false; btn.disabled = false; slider.disabled = false; dir.lock(false);
      });
    },
  });

  /* ================= KENO ================= */
  registerGame({
    id: "keno", name: "Keno", cat: "originals", tag: "Original",
    art: { emoji: "🔢", bg: "linear-gradient(150deg,#b46bff,#5b21b6 55%,#1e0b3f)", accent: "#b46bff" },
    blurb: "Pick up to 10 numbers. Ten are drawn. Match to win.",
    rules: "<p>Choose 1 to 10 numbers from 40, then bet. Ten numbers are drawn and your payout depends on how many you match — see the table under the board. Return to player about 97%.</p>",
    mount(stage) {
      const f = frame(); const bet = betInput();
      const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "button", disabled: true }, "Pick numbers");
      const autoBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Auto pick"), clearBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Clear");
      f.controls.append(bet.el, el("div", { class: "btn-pair" }, autoBtn, clearBtn), btn);
      const grid = el("div", { class: "keno-grid" }), pays = el("div", { class: "keno-pays" });
      f.board.classList.add("keno-board"); f.board.append(grid, pays); stage.append(f.root);
      const picks = new Set(); let busy = false, alive = true, pending = null;
      const cells = Array.from({ length: 40 }, (_, i) => el("button", { class: "kcell", type: "button", onclick: () => toggle(i + 1) }, String(i + 1)));
      grid.append(...cells);
      const clearDraw = () => { cells.forEach((c) => c.classList.remove("drawn", "hit")); $$(".kp", pays).forEach((p) => p.classList.remove("on")); };
      function paint() {
        cells.forEach((c, i) => c.classList.toggle("picked", picks.has(i + 1)));
        const n = picks.size; btn.disabled = busy || !n; btn.textContent = n ? "Bet" : "Pick numbers";
        pays.replaceChildren(...(n ? T.KENO[n].map((m, h) => el("div", { class: `kp${m ? "" : " zero"}`, "data-h": h }, el("b", {}, `${m}×`), el("small", {}, `${h} hit${h === 1 ? "" : "s"}`))) : [el("p", { class: "keno-hint" }, "Select up to 10 numbers on the board")]));
      }
      function toggle(n) { if (busy) return; clearDraw(); if (picks.has(n)) picks.delete(n); else if (picks.size < 10) picks.add(n); else CQ.toast("You can pick up to 10 numbers.", "warn"); paint(); }
      autoBtn.addEventListener("click", () => { if (busy) return; clearDraw(); const want = picks.size || 10; picks.clear(); const all = [...Array(40).keys()]; for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } all.slice(0, want).forEach((i) => picks.add(i + 1)); paint(); });
      clearBtn.addEventListener("click", () => { if (busy) return; picks.clear(); clearDraw(); paint(); });
      btn.addEventListener("click", async () => {
        if (busy || !picks.size) return; busy = true; paint(); bet.disable(true); f.hidePop(); clearDraw();
        try {
          const r = await play("keno", { bet: bet.value, picks: [...picks] }); pending = r;
          for (const d of r.result.drawn) { const c = cells[d - 1]; c.classList.add("drawn"); if (picks.has(d)) c.classList.add("hit"); await sleep(110); if (!alive) return; }
          pays.querySelector(`[data-h="${r.result.hits}"]`)?.classList.add("on");
          r.settle(); pending = null; f.pop(r.result.mult, r.payout, r.payout > 0);
        } catch (e) { fail(e); }
        busy = false; bet.disable(false); paint();
      });
      paint();
      return () => { alive = false; if (pending) pending.settle(); };
    },
  });
})();
