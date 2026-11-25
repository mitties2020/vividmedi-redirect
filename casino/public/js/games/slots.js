/* CareQuay Casino — slot machine UI (results come from the server). */
(() => {
  "use strict";
  const { el, betInput, registerGame, fmtUSD, sleep, play, fail } = CQ;
  const { DEFS } = window.SlotEngine;
  const idx = (def, reel, row) => reel * def.rows + row;
  const allIds = (def) => [...def.syms.map((s) => s.s), def.wild && def.wild.s, def.scatter && def.scatter.s].filter(Boolean);

  function payTable(def) {
    const unit = def.mode === "lines" ? "× line bet" : def.mode === "ways" ? `× (bet ÷ ${def.waysDiv}) per way` : "× total bet";
    const heads = def.mode === "anywhere" ? ["8–9", "10–11", "12+"] : def.reels === 3 ? ["3 in a row"] : ["3", "4", "5"];
    const row = (sym, label) => `<tr><td class="pt-sym">${CQSym.html(sym.s, "pt-icon")}${label ? `<small>${label}</small>` : ""}</td>${(sym.pay || []).map((p) => `<td>${+(p * def.scale).toFixed(2)}</td>`).join("")}</tr>`;
    let rows = def.syms.map((s) => row(s)).join("");
    if (def.wild && def.wild.pay) rows = row(def.wild, "wild") + rows;
    const notes = [];
    if (def.wild) notes.push(`${CQSym.name(def.wild.s)} is wild and substitutes for every symbol${def.scatter ? ` except ${CQSym.name(def.scatter.s)}` : ""}.`);
    if (def.scatter) notes.push(`${def.scatterNeed || 3} or more ${CQSym.name(def.scatter.s)} scatters anywhere award ${def.freeSpins} free spins with all wins ×${def.freeMult}. Free spins can retrigger (+5).`);
    if (def.mode === "anywhere") notes.push("Winning symbols vanish and new ones tumble in until no new wins land.");
    if (def.mode === "ways") notes.push("243 ways: wins pay left to right when a symbol appears on adjacent reels, in any position.");
    if (def.mode === "lines") notes.push(`${def.lines.length} fixed paylines, paying left to right.`);
    return `<p>${notes.join(" ")}</p><table class="paytable"><thead><tr><th>Symbol</th>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><p class="pt-unit">Payouts ${unit}. Return to player about 96%.</p>`;
  }

  function mount(def, stage) {
    const bet = betInput({ label: "Total bet", value: 1 });
    const spinBtn = el("button", { class: "slot-spin", type: "button", "aria-label": "Spin" }, el("span", {}, "↻"));
    const autoBtn = el("button", { class: "btn btn-ghost slot-mini", type: "button" }, "Auto");
    const turboBtn = el("button", { class: "btn btn-ghost slot-mini", type: "button", "aria-pressed": "false" }, "Turbo");
    const winV = el("b", { class: "slot-win-val" }, "$0.00");
    const msg = el("div", { class: "slot-msg" }, def.mode === "anywhere" ? "8+ matching symbols anywhere pays" : def.mode === "ways" ? "243 ways to win" : `${def.lines.length} paylines`);
    const fsBanner = el("div", { class: "fs-banner", hidden: true });
    const gridEl = el("div", { class: `slot-grid mode-${def.mode}`, style: { "--reels": def.reels, "--rows": def.rows } });
    const machine = el("div", { class: "slot-machine", style: { "--accent": def.theme.accent, "--slot-bg": def.theme.bg } },
      el("div", { class: "slot-lights", "aria-hidden": "true" }),
      el("div", { class: "slot-title" }, el("span", { class: "slot-title-sym", html: CQSym.html(def.theme.tile, "sym") }), def.name),
      fsBanner,
      el("div", { class: "slot-window" }, gridEl),
      el("div", { class: "slot-bar" }, el("div", { class: "slot-winbox" }, el("small", {}, "Win"), winV), msg));
    stage.append(el("div", { class: "slot-wrap" }, machine, el("div", { class: "slot-controls" }, bet.el, el("div", { class: "slot-btns" }, autoBtn, spinBtn, turboBtn), el("p", { class: "muted small" }, "Press Space to spin"))));

    const ids = allIds(def);
    const randId = () => ids[Math.floor(Math.random() * ids.length)];
    let reels = [], busy = false, alive = true, autoLeft = 0, autoRunning = false, turbo = false, pendingSettle = null;
    const cell = (id) => el("div", { class: `scell${def.wild && id === def.wild.s ? " wild" : ""}${def.scatter && id === def.scatter.s ? " scat" : ""}`, html: CQSym.html(id, "sym") });
    function renderStatic(g, fresh) {
      const freshSet = new Set(fresh || []);
      gridEl.replaceChildren(...g.map((col, reel) => el("div", { class: "reel" }, el("div", { class: "strip" }, col.map((id, row) => { const c = cell(id); if (freshSet.has(idx(def, reel, row))) { c.classList.add("drop"); c.style.animationDelay = `${(def.rows - row) * 30}ms`; } return c; })))));
      reels = [...gridEl.children];
    }
    const cellAt = (p) => reels[Math.floor(p / def.rows)]?.querySelector(".strip").children[p % def.rows];

    async function spinTo(g) {
      const h = gridEl.querySelector(".scell")?.getBoundingClientRect().height || 80, fill = turbo ? 6 : 14;
      await Promise.all(g.map((col, reel) => {
        const strip = el("div", { class: "strip blur" }, [...col.map(cell), ...Array.from({ length: fill }, () => cell(randId()))]);
        reels[reel].replaceChildren(strip);
        const a = strip.animate([{ transform: `translateY(${-fill * h}px)` }, { transform: "translateY(6px)", offset: 0.92 }, { transform: "translateY(0)" }], { duration: (turbo ? 260 : 520) + reel * (turbo ? 70 : 160), easing: "cubic-bezier(.25,.6,.3,1)", fill: "forwards" });
        return a.finished.then(() => strip.classList.remove("blur"));
      }));
    }
    async function showSpin(sp, running) {
      gridEl.classList.remove("has-win");
      await spinTo(sp.steps[0].grid); renderStatic(sp.steps[0].grid);
      let shown = 0;
      for (let i = 0; i < sp.steps.length && alive; i++) {
        const st = sp.steps[i];
        if (i > 0) { renderStatic(st.grid, st.fresh); await sleep(turbo ? 220 : 380); }
        if (st.wins.length) {
          st.wins.flatMap((w) => w.positions).forEach((p) => cellAt(p)?.classList.add("win"));
          gridEl.classList.add("has-win");
          const best = st.wins.reduce((a, b) => (b.amount > a.amount ? b : a));
          msg.innerHTML = "";
          msg.append(el("span", { class: "msg-sym", html: CQSym.html(best.sym, "sym") }), def.mode === "anywhere" ? `${best.count} × ${CQSym.name(best.sym)} pays ${fmtUSD(best.amount)}` : def.mode === "ways" ? `${CQSym.name(best.sym)} on ${best.count} reels · ${best.ways} way${best.ways > 1 ? "s" : ""} · ${fmtUSD(best.amount)}` : `${best.count} × ${CQSym.name(best.sym)} on line ${best.line + 1} · ${fmtUSD(best.amount)}${st.wins.length > 1 ? ` (+${st.wins.length - 1} more)` : ""}`);
          shown += st.stepWin; setWin(running + shown);
          await sleep(turbo ? 380 : 750);
          if (i < sp.steps.length - 1) { st.wins.flatMap((w) => w.positions).forEach((p) => cellAt(p)?.classList.add("pop")); await sleep(turbo ? 160 : 260); gridEl.classList.remove("has-win"); }
        }
      }
      if (sp.trigger) { const last = sp.steps[sp.steps.length - 1]; last.grid.forEach((col, reel) => col.forEach((id, row) => { if (def.scatter && id === def.scatter.s) cellAt(idx(def, reel, row))?.classList.add("win", "scat-hit"); })); }
    }
    function setWin(v) { winV.textContent = fmtUSD(v); winV.classList.remove("bump"); void winV.offsetWidth; winV.classList.add("bump"); }

    async function round() {
      if (busy) return;
      busy = true; spinBtn.classList.add("spinning"); bet.disable(true); winV.textContent = "$0.00"; msg.textContent = "Good luck!";
      let r;
      try { r = await play("slot", { slotId: def.id, bet: bet.value }); }
      catch (e) { fail(e); busy = false; spinBtn.classList.remove("spinning"); bet.disable(false); autoRunning = false; paintAuto(); return; }
      pendingSettle = r.settle;
      const stake = r.stake, rd = r.result;
      await showSpin(rd.base, 0);
      let total = rd.base.total;
      if (!total && !rd.free.length) msg.textContent = "No win — spin again";
      if (rd.free.length && alive) {
        msg.textContent = `Scatters! ${rd.base.trigger} free spins`; await sleep(1100);
        for (let n = 0; n < rd.free.length && alive; n++) {
          fsBanner.hidden = false; fsBanner.textContent = `FREE SPIN ${n + 1} of ${rd.free.length} · wins ×${def.freeMult}`;
          await showSpin(rd.free[n], total);
          total += rd.free[n].total; winV.textContent = fmtUSD(total);
          if (rd.free[n].trigger) { msg.textContent = "+5 free spins!"; await sleep(700); }
          await sleep(turbo ? 120 : 260);
        }
        fsBanner.hidden = true; msg.textContent = `Free spins paid ${fmtUSD(total)}`;
      }
      r.settle(); pendingSettle = null;
      winV.textContent = fmtUSD(r.payout);
      if (r.payout / stake >= 5) celebrate(r.payout / stake, r.payout);
      busy = false; spinBtn.classList.remove("spinning"); bet.disable(false);
      if (autoRunning && autoLeft > 0 && alive) { autoLeft--; paintAuto(); await sleep(turbo ? 150 : 400); if (alive && autoRunning) round(); }
      else { autoRunning = false; autoLeft = 0; paintAuto(); }
    }
    function celebrate(x, amt) {
      const label = x >= 50 ? "MEGA WIN" : x >= 15 ? "BIG WIN" : "NICE WIN";
      const b = el("div", { class: "big-win" }, el("small", {}, label), el("b", {}, fmtUSD(amt)), el("span", {}, `${x.toFixed(1)}× your bet`));
      machine.append(b); setTimeout(() => b.remove(), 2300);
    }
    const STEPS = [10, 25, 50];
    function paintAuto() { autoBtn.textContent = autoRunning ? `Stop (${autoLeft + (busy ? 1 : 0)})` : "Auto"; autoBtn.classList.toggle("on", autoRunning); }
    autoBtn.addEventListener("click", () => { if (autoRunning) { autoRunning = false; autoLeft = 0; paintAuto(); return; } const n = STEPS[(+(autoBtn.dataset.n || 0)) % STEPS.length]; autoBtn.dataset.n = +(autoBtn.dataset.n || 0) + 1; autoRunning = true; autoLeft = n - 1; paintAuto(); round(); });
    turboBtn.addEventListener("click", () => { turbo = !turbo; turboBtn.classList.toggle("on", turbo); turboBtn.setAttribute("aria-pressed", String(turbo)); });
    spinBtn.addEventListener("click", () => { if (autoRunning) { autoRunning = false; autoLeft = 0; paintAuto(); } round(); });
    const onKey = (e) => { if (e.code === "Space" && !/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(document.activeElement.tagName)) { e.preventDefault(); round(); } };
    document.addEventListener("keydown", onKey);
    renderStatic(Array.from({ length: def.reels }, () => Array.from({ length: def.rows }, randId)));
    return () => { alive = false; autoRunning = false; document.removeEventListener("keydown", onKey); if (pendingSettle) pendingSettle(); };
  }

  for (const def of DEFS) {
    registerGame({
      id: def.id, name: def.name, cat: "slots", tag: def.tag,
      art: { sym: def.theme.tile, bg: def.theme.bg, accent: def.theme.accent },
      blurb: def.mode === "anywhere" ? "Pays anywhere with tumbling wins and free spins." : def.mode === "ways" ? "243 ways to win with free spins." : def.reels === 3 ? "Three reels, five lines, old-school wins." : `${def.lines.length} lines with wilds and free spins.`,
      get rules() { return payTable(def); },
      mount: (stage) => mount(def, stage),
    });
  }
})();
