/* CareQuay Casino — slot definitions + engine (shared by server and browser). */
(function (root) {
  "use strict";
  const L33 = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const L53_10 = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]];
  const L53_20 = [...L53_10, [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0]];
  const L54_20 = [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0], [1, 2, 3, 2, 1], [3, 2, 1, 2, 3], [2, 1, 0, 1, 2], [0, 1, 0, 1, 0], [1, 2, 1, 2, 1], [2, 3, 2, 3, 2], [3, 2, 3, 2, 3], [1, 0, 1, 0, 1], [2, 1, 2, 1, 2], [0, 0, 1, 0, 0], [3, 3, 2, 3, 3], [1, 1, 0, 1, 1], [2, 2, 3, 2, 2], [0, 1, 1, 1, 0], [3, 2, 2, 2, 3]];
  const S = (s, w, pay) => ({ s, w, pay });

  /* pay arrays: lines/ways → [3,4,5 of a kind] (3-reel → [3]); anywhere → [8–9, 10–11, 12+].
     lines × line bet · ways × bet/waysDiv · anywhere × total bet. `scale` is set by RTP simulation (~94%). */
  const DEFS = [
    { id: "triple-sevens", name: "Triple Sevens", tag: "Classic", mode: "lines", reels: 3, rows: 3, lines: L33, scale: 2.6364,
      theme: { bg: "linear-gradient(160deg,#ff2d55,#8b0a2a 55%,#2a0410)", accent: "#ffd34d", tile: "seven" },
      wild: S("wild", 3, [60]), syms: [S("seven", 3, [40]), S("bar3", 4, [25]), S("bar2", 6, [15]), S("bar1", 8, [10]), S("bell", 10, [6]), S("plum", 12, [4]), S("cherry", 14, [2])] },
    { id: "burning-sevens", name: "Burning Sevens", tag: "Lines", mode: "lines", reels: 5, rows: 3, lines: L53_10, scale: 4.6981, freeSpins: 10, freeMult: 2,
      theme: { bg: "linear-gradient(160deg,#ffb000,#e2321b 50%,#3a0600)", accent: "#ffd66b", tile: "seven" },
      wild: S("wild", 2, [10, 50, 250]), scatter: S("star", 0.95), syms: [S("seven", 2, [10, 50, 250]), S("seven_blue", 3, [5, 25, 100]), S("bar3", 4, [4, 15, 60]), S("bar2", 5, [3, 10, 40]), S("bar1", 7, [2, 6, 20]), S("bell", 8, [1, 4, 12]), S("cherry", 9, [1, 3, 10])] },
    { id: "crown-royale", name: "Crown Royale", tag: "Lines", mode: "lines", reels: 5, rows: 4, lines: L54_20, scale: 4.3973, freeSpins: 10, freeMult: 3,
      theme: { bg: "linear-gradient(160deg,#d9a8ff,#6a1fb8 55%,#16062e)", accent: "#ffd86b", tile: "crown" },
      wild: S("crown", 2, [10, 50, 250]), scatter: S("coin", 0.7), syms: [S("amethyst", 2, [10, 50, 250]), S("seven", 3, [5, 25, 100]), S("bell", 4, [4, 15, 60]), S("card_A", 5, [3, 10, 40]), S("card_K", 7, [2, 6, 20]), S("card_Q", 8, [1, 4, 12]), S("card_J", 9, [1, 3, 10])] },
    { id: "hot-gems", name: "Hot Gems", tag: "Ways", mode: "ways", reels: 5, rows: 3, waysDiv: 25, scale: 2.7341, freeSpins: 10, freeMult: 2,
      theme: { bg: "linear-gradient(160deg,#ff7ad9,#b0128a 55%,#2e0428)", accent: "#ffd1f3", tile: "ruby" },
      wild: S("wild", 1.6), scatter: S("star", 1.2), syms: [S("ruby", 2, [5, 20, 100]), S("sapphire", 3, [4, 15, 60]), S("emerald", 4, [3, 10, 40]), S("amethyst", 6, [2, 6, 20]), S("topaz", 8, [1, 3, 10]), S("card_A", 9, [1, 2, 8]), S("card_K", 10, [0.5, 2, 6])] },
    { id: "gem-cascade", name: "Gem Cascade", tag: "Tumble", mode: "anywhere", reels: 6, rows: 5, scale: 2.2342, freeSpins: 10, freeMult: 3, scatterNeed: 4,
      theme: { bg: "linear-gradient(160deg,#7af0ff,#3b4bff 55%,#0b0b38)", accent: "#bff8ff", tile: "emerald" },
      scatter: S("star", 1.7), syms: [S("crown", 3, [10, 25, 50]), S("seven", 4, [2.5, 10, 25]), S("ruby", 5, [2, 5, 15]), S("sapphire", 6, [1.5, 2, 12]), S("emerald", 9, [1, 1.5, 10]), S("amethyst", 10, [0.8, 1.2, 8]), S("topaz", 11, [0.5, 1, 5]), S("clover", 12, [0.4, 0.9, 4]), S("bell", 13, [0.25, 0.75, 2])] },
  ];

  function pool(def) {
    if (def._pool) return def._pool;
    const items = def.syms.map((x) => ({ ...x }));
    if (def.wild) items.push({ ...def.wild, isWild: true });
    if (def.scatter) items.push({ ...def.scatter, isScatter: true });
    Object.defineProperty(def, "_pool", { value: items, enumerable: false });
    return items;
  }
  function draw(def, rand) {
    const items = pool(def);
    let total = 0; for (const it of items) total += it.w;
    let r = rand() * total;
    for (const it of items) { r -= it.w; if (r < 0) return it; }
    return items[items.length - 1];
  }
  const idx = (def, reel, row) => reel * def.rows + row;

  function evalLines(def, grid, bet) {
    const lineBet = bet / def.lines.length, wins = [];
    def.lines.forEach((line, li) => {
      const cells = line.map((row, reel) => grid[reel][row]);
      let base = cells.find((c) => !c.isWild), count = 0;
      if (!base) { base = cells[0]; count = cells.length; } else for (const c of cells) { if (c.isWild || c.s === base.s) count++; else break; }
      if (base.isScatter) return;
      let wildRun = 0; for (const c of cells) { if (c.isWild) wildRun++; else break; }
      let best = null;
      if (count >= 3 && base.pay) best = { sym: base.s, count, amount: base.pay[count - 3] * lineBet * def.scale };
      if (wildRun >= 3 && def.wild && def.wild.pay) { const wa = def.wild.pay[wildRun - 3] * lineBet * def.scale; if (!best || wa > best.amount) best = { sym: def.wild.s, count: wildRun, amount: wa }; }
      if (best && best.amount > 0) wins.push({ ...best, line: li, positions: line.slice(0, best.count).map((row, reel) => idx(def, reel, row)) });
    });
    return wins;
  }
  function evalWays(def, grid, bet) {
    const unit = bet / def.waysDiv, wins = [];
    for (const sym of def.syms) {
      let ways = 1, n = 0; const positions = [];
      for (let reel = 0; reel < def.reels; reel++) {
        const hits = []; grid[reel].forEach((c, row) => { if (c.s === sym.s || c.isWild) hits.push(idx(def, reel, row)); });
        if (!hits.length) break; ways *= hits.length; n++; positions.push(...hits);
      }
      if (n >= 3) wins.push({ sym: sym.s, count: n, ways, positions, amount: sym.pay[n - 3] * ways * unit * def.scale });
    }
    return wins;
  }
  function evalAnywhere(def, grid, bet) {
    const counts = new Map();
    grid.forEach((col, reel) => col.forEach((c, row) => { if (c.isScatter) return; const e = counts.get(c.s) || { sym: c, positions: [] }; e.positions.push(idx(def, reel, row)); counts.set(c.s, e); }));
    const wins = [];
    for (const { sym, positions } of counts.values()) { const n = positions.length; if (n < 8) continue; wins.push({ sym: sym.s, count: n, positions, amount: sym.pay[n >= 12 ? 2 : n >= 10 ? 1 : 0] * bet * def.scale }); }
    return wins;
  }
  function countScatter(grid) { let n = 0; const positions = []; grid.forEach((col, reel) => col.forEach((c, row) => { if (c.isScatter) { n++; positions.push([reel, row]); } })); return { n, positions }; }

  function spin(def, bet, rand, mult = 1) {
    let grid = Array.from({ length: def.reels }, () => Array.from({ length: def.rows }, () => draw(def, rand)));
    const ev = def.mode === "lines" ? evalLines : def.mode === "ways" ? evalWays : evalAnywhere;
    const steps = []; let total = 0;
    let fresh = null;
    for (let guard = 0; guard < 40; guard++) {
      const wins = ev(def, grid, bet); wins.forEach((w) => (w.amount *= mult));
      const stepWin = wins.reduce((s, w) => s + w.amount, 0);
      steps.push({ grid: grid.map((col) => col.map((c) => c.s)), wins, fresh: fresh ? [...fresh] : null, stepWin });
      total += stepWin;
      if (def.mode !== "anywhere" || !wins.length) break;
      const gone = new Set(wins.flatMap((w) => w.positions)); fresh = new Set();
      grid = grid.map((col, reel) => {
        const keep = col.filter((_, row) => !gone.has(idx(def, reel, row)));
        const add = def.rows - keep.length;
        for (let row = 0; row < add; row++) fresh.add(idx(def, reel, row));
        return [...Array.from({ length: add }, () => draw(def, rand)), ...keep];
      });
    }
    const firstGrid = steps[0].grid.map((col) => col.map((s) => pool(def).find((p) => p.s === s)));
    const lastGrid = grid;
    const a = countScatter(firstGrid), b = countScatter(lastGrid);
    const scat = b.n > a.n ? b : a;
    const need = def.scatterNeed || 3;
    const trigger = def.freeSpins && scat.n >= need ? def.freeSpins + (scat.n - need) * (def.mode === "anywhere" ? 2 : 0) : 0;
    return { steps, total, scatters: scat.n, trigger };
  }

  /** Full paid round: base spin + any free spins. Amounts are in the same unit as `bet`. */
  function playRound(def, bet, rand) {
    const base = spin(def, bet, rand);
    const free = []; let total = base.total, left = base.trigger;
    while (left > 0 && free.length < 100) {
      const fs = spin(def, bet, rand, def.freeMult || 1);
      free.push(fs); total += fs.total; left--;
      if (fs.trigger) left += 5;
    }
    return { base, free, total };
  }

  const api = { DEFS, spin, playRound, byId: (id) => DEFS.find((d) => d.id === id) };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SlotEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
