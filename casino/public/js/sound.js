/* CareQuay Casino — sound effects, synthesised with Web Audio (no audio files to download). */
(() => {
  "use strict";
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem("cq-sound") === "off"; } catch { /* storage blocked */ }

  function ac() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const unlock = () => { if (!muted) ac(); };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  /* ---------- Building blocks ---------- */
  function tone({ f = 440, f2 = null, type = "sine", t = 0, dur = 0.15, vol = 0.3, attack = 0.005, out = null }) {
    const c = ac(); if (!c) return;
    const at = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out || master); o.start(at); o.stop(at + dur + 0.02);
  }
  function noise({ t = 0, dur = 0.1, vol = 0.25, freq = 2000, q = 1, type = "bandpass", f2 = null }) {
    const c = ac(); if (!c) return;
    const at = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, at); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl).connect(g).connect(master); s.start(at, Math.random() * 0.5); s.stop(at + dur + 0.02);
  }
  const notes = (freqs, step, opts = {}) => freqs.forEach((f, i) => tone({ f, t: i * step, ...opts }));

  /* ---------- Sound library ---------- */
  const SFX = {
    click: () => tone({ f: 1800, f2: 1200, type: "triangle", dur: 0.04, vol: 0.08 }),
    chip: () => { tone({ f: 2600, type: "triangle", dur: 0.05, vol: 0.12 }); tone({ f: 3400, type: "triangle", t: 0.035, dur: 0.05, vol: 0.1 }); noise({ dur: 0.04, vol: 0.12, freq: 5000 }); },
    bet: () => { noise({ dur: 0.05, vol: 0.15, freq: 4200, q: 2 }); tone({ f: 900, f2: 1300, type: "triangle", dur: 0.08, vol: 0.12 }); },
    card: () => noise({ dur: 0.12, vol: 0.22, freq: 3000, f2: 900, q: 0.8 }),
    flip: () => { noise({ dur: 0.07, vol: 0.18, freq: 2400, q: 1.2 }); tone({ f: 500, f2: 260, type: "sine", dur: 0.06, vol: 0.08 }); },
    reelStart: () => { noise({ dur: 0.35, vol: 0.12, freq: 600, f2: 2200, q: 0.7 }); tone({ f: 180, f2: 420, type: "sawtooth", dur: 0.3, vol: 0.05 }); },
    reelStop: (i = 0) => { tone({ f: 140 - i * 6, f2: 60, type: "sine", dur: 0.14, vol: 0.32 }); noise({ dur: 0.06, vol: 0.2, freq: 1400, q: 1.5 }); },
    tease: () => notes([523, 587, 659, 740, 831, 932], 0.09, { type: "triangle", dur: 0.12, vol: 0.12 }),
    tumble: () => { tone({ f: 700, f2: 1400, type: "sine", dur: 0.09, vol: 0.12 }); noise({ dur: 0.05, vol: 0.08, freq: 6000 }); },
    scatter: () => notes([784, 988, 1175, 1568], 0.07, { type: "triangle", dur: 0.25, vol: 0.16 }),
    win: () => { notes([523, 659, 784, 1047], 0.075, { type: "triangle", dur: 0.22, vol: 0.18 }); tone({ f: 2093, t: 0.3, dur: 0.35, vol: 0.06 }); },
    smallWin: () => notes([784, 1047], 0.07, { type: "triangle", dur: 0.18, vol: 0.14 }),
    bigWin: () => {
      notes([392, 523, 659, 784, 1047, 1319, 1568], 0.09, { type: "square", dur: 0.2, vol: 0.07 });
      notes([523, 659, 784, 1047, 1319, 1568, 2093], 0.09, { type: "triangle", dur: 0.3, vol: 0.14 });
      for (let i = 0; i < 18; i++) tone({ f: 2400 + Math.random() * 2400, t: 0.65 + i * 0.06, type: "sine", dur: 0.12, vol: 0.06 });
    },
    coin: () => { tone({ f: 1975, type: "square", dur: 0.06, vol: 0.06 }); tone({ f: 2637, t: 0.06, type: "square", dur: 0.18, vol: 0.06 }); },
    lose: () => tone({ f: 220, f2: 150, type: "triangle", dur: 0.22, vol: 0.1 }),
    push: () => notes([660, 660], 0.1, { type: "triangle", dur: 0.12, vol: 0.1 }),
    tick: () => tone({ f: 2200 + Math.random() * 600, type: "sine", dur: 0.03, vol: 0.07 }),
    peg: () => tone({ f: 1400 + Math.random() * 900, type: "triangle", dur: 0.05, vol: 0.08 }),
    land: () => { tone({ f: 330, f2: 160, type: "sine", dur: 0.15, vol: 0.22 }); noise({ dur: 0.05, vol: 0.1, freq: 900 }); },
    dice: () => { for (let i = 0; i < 7; i++) noise({ t: i * 0.045 + Math.random() * 0.02, dur: 0.035, vol: 0.18, freq: 1800 + Math.random() * 1500, q: 3 }); },
    gem: () => notes([1319, 1976], 0.05, { type: "sine", dur: 0.25, vol: 0.16 }),
    boom: () => { noise({ dur: 0.7, vol: 0.5, freq: 900, f2: 60, type: "lowpass", q: 0.5 }); tone({ f: 120, f2: 35, type: "sine", dur: 0.6, vol: 0.45 }); },
    cashout: () => { notes([880, 1175, 1568], 0.06, { type: "triangle", dur: 0.2, vol: 0.16 }); SFX.coin(); },
    wheel: (dur = 3.5) => { let t = 0, gap = 0.04; while (t < dur) { tone({ f: 2600, type: "square", t, dur: 0.015, vol: 0.035 }); t += gap; gap *= 1.045; } },
    ball: () => { tone({ f: 1800, type: "sine", dur: 0.05, vol: 0.1 }); tone({ f: 1500, t: 0.09, type: "sine", dur: 0.05, vol: 0.08 }); tone({ f: 1300, t: 0.16, type: "sine", dur: 0.06, vol: 0.06 }); },
    error: () => notes([300, 220], 0.1, { type: "square", dur: 0.1, vol: 0.05 }),
  };

  /* Rising engine note for Crash: start() → {set(mult), stop()} */
  function riser() {
    const c = ac(); if (!c) return { set() {}, stop() {} };
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth"; o2.type = "sine"; o.frequency.value = 110; o2.frequency.value = 220;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.2);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(master); o.start(); o2.start();
    return {
      set(m) { const f = 110 * Math.min(8, 1 + Math.log2(Math.max(1, m)) * 0.9); o.frequency.setTargetAtTime(f, c.currentTime, 0.05); o2.frequency.setTargetAtTime(f * 2.01, c.currentTime, 0.05); },
      stop() { try { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.04); o.stop(c.currentTime + 0.2); o2.stop(c.currentTime + 0.2); } catch { /* already stopped */ } },
    };
  }

  const play = (name, ...args) => { if (muted) return; try { SFX[name] && SFX[name](...args); } catch { /* audio unavailable */ } };
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("cq-sound", m ? "off" : "on"); } catch { /* ignore */ }
    if (m && ctx) ctx.suspend(); else if (!m) ac();
    document.querySelectorAll(".sound-btn").forEach((b) => { b.textContent = m ? "🔇" : "🔊"; b.setAttribute("aria-pressed", String(!m)); b.title = m ? "Sound off" : "Sound on"; });
  }
  const toggle = () => { setMuted(!muted); if (!muted) play("chip"); };

  /* ---------- Automatic sounds ---------- */
  // UI clicks
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button, .btn, .chip, .odds-btn, .nav-link, .tile");
    if (!b || b.disabled || b.classList.contains("sound-btn") || b.matches(".slot-spin, .rl-spot, .mtile") || b.dataset.silent != null) return;
    play(b.classList.contains("odds-btn") || b.classList.contains("chip-btn") ? "chip" : "click");
  }, true);

  // Balance changes while a game is open: stake taken → bet sound; money back → win sound sized to the win.
  let prev = null, lastStake = 0;
  function onBal(bal) {
    const st = window.CQ && CQ.state;
    const mode = st && st.mode;
    if (!mode || !document.body.dataset.mode) { prev = null; return; }
    const now = bal[mode];
    if (prev && prev.mode === mode) {
      const d = Math.round((now - prev.v) * 100) / 100;
      if (d < 0) { lastStake = -d; play("bet"); }
      else if (d > 0) {
        const x = lastStake ? d / lastStake : 2;
        if (x >= 10) play("bigWin"); else if (x > 1.01) play("win"); else if (x >= 0.99) play("push"); else play("smallWin");
      }
    }
    prev = { mode, v: now };
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (window.CQ) CQ.onBalance(onBal);
    const host = document.querySelector(".topbar .wallet");
    if (host) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "icon-btn sound-btn"; b.addEventListener("click", toggle);
      host.prepend(b);
    }
    setMuted(muted);
  });

  window.CQSound = { play, riser, toggle, get muted() { return muted; }, setMuted };
})();
