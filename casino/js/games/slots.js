/* CareQuay Casino — slot engine + 20 original slots */
(() => {
  "use strict";

  /* ---------- Paylines ---------- */
  const L33 = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const L53_10 = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]];
  const L53_20 = [...L53_10, [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0]];
  const L54_20 = [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0], [1, 2, 3, 2, 1], [3, 2, 1, 2, 3], [2, 1, 0, 1, 2], [0, 1, 0, 1, 0], [1, 2, 1, 2, 1], [2, 3, 2, 3, 2], [3, 2, 3, 2, 3], [1, 0, 1, 0, 1], [2, 1, 2, 1, 2], [0, 0, 1, 0, 0], [3, 3, 2, 3, 3], [1, 1, 0, 1, 1], [2, 2, 3, 2, 2], [0, 1, 1, 1, 0], [3, 2, 2, 2, 3]];

  /* ---------- Definitions ----------
     pay arrays: lines/ways → [3,4,5 of a kind] (classic 3-reel → [3]); anywhere → [8-9, 10-11, 12+]
     lines pay × line bet, ways pay × bet/waysDiv, anywhere pay × total bet. `scale` tunes RTP (set by simulation). */
  const S = (s, w, pay) => ({ s, w, pay });
  const DEFS = [
    // ---- Classic 3×3 ----
    { id: "neon-fruits", name: "Neon Fruits", tag: "Classic", mode: "lines", reels: 3, rows: 3, lines: L33, scale: 2.6976,
      art: { emoji: "🍒", bg: "linear-gradient(150deg,#ff3d77,#8a1fff 60%,#1a0938)", accent: "#ff3d77" },
      wild: S("🌟", 3, [60]), syms: [S("7️⃣", 3, [40]), S("💎", 4, [25]), S("🔔", 6, [15]), S("🍉", 8, [10]), S("🍇", 10, [6]), S("🍋", 12, [4]), S("🍒", 14, [2])] },
    { id: "lucky-clover", name: "Lucky Clover", tag: "Classic", mode: "lines", reels: 3, rows: 3, lines: L33, scale: 2.7036,
      art: { emoji: "🍀", bg: "linear-gradient(150deg,#3ee68a,#0f7a45 60%,#062a19)", accent: "#3ee68a" },
      wild: S("🍀", 3, [60]), syms: [S("🌈", 3, [40]), S("🪙", 4, [25]), S("🎩", 6, [15]), S("🐞", 8, [10]), S("🌼", 10, [6]), S("💚", 12, [4]), S("🔔", 14, [2])] },
    { id: "hot-chilli-7s", name: "Hot Chilli 7s", tag: "Classic", mode: "lines", reels: 3, rows: 3, lines: L33, scale: 2.6973,
      art: { emoji: "🌶️", bg: "linear-gradient(150deg,#ffb02e,#e8380d 55%,#3d0a04)", accent: "#ff6a2e" },
      wild: S("🔥", 3, [60]), syms: [S("7️⃣", 3, [40]), S("🌶️", 4, [25]), S("⭐", 6, [15]), S("🍉", 8, [10]), S("🍊", 10, [6]), S("🍋", 12, [4]), S("🍒", 14, [2])] },
    { id: "diamond-vault", name: "Diamond Vault", tag: "Classic", mode: "lines", reels: 3, rows: 3, lines: L33, scale: 2.7068,
      art: { emoji: "💎", bg: "linear-gradient(150deg,#8fe3ff,#2f7bff 55%,#0a1745)", accent: "#8fe3ff" },
      wild: S("💎", 3, [60]), syms: [S("👑", 3, [40]), S("💍", 4, [25]), S("💰", 6, [15]), S("🔑", 8, [10]), S("🪙", 10, [6]), S("🔔", 12, [4]), S("🍒", 14, [2])] },

    // ---- Book (scatter is also wild) ----
    { id: "pharaohs-ledger", name: "Pharaoh's Ledger", tag: "Book", mode: "lines", reels: 5, rows: 3, lines: L53_10, scale: 7.4756, book: true, freeSpins: 10, freeMult: 2,
      art: { emoji: "📜", bg: "linear-gradient(150deg,#ffd36b,#c27a12 55%,#3a2004)", accent: "#ffd36b" },
      wild: S("📜", 1.25, [2, 20, 200]), syms: [S("🗿", 2, [10, 100, 500]), S("🏺", 3, [5, 40, 200]), S("🐫", 4, [5, 30, 150]), S("🦂", 5, [3, 15, 75]), S("🪲", 7, [2, 8, 40]), S("🌙", 8, [1, 5, 20]), S("☀️", 9, [1, 5, 20]), S("🔺", 10, [1, 4, 15])] },
    { id: "mystic-grimoire", name: "Mystic Grimoire", tag: "Book", mode: "lines", reels: 5, rows: 3, lines: L53_10, scale: 7.5998, book: true, freeSpins: 10, freeMult: 3,
      art: { emoji: "📖", bg: "linear-gradient(150deg,#c18bff,#5a23c8 55%,#170936)", accent: "#c18bff" },
      wild: S("📖", 1.15, [2, 20, 200]), syms: [S("🧙", 2, [10, 100, 500]), S("🦉", 3, [5, 40, 200]), S("🔮", 4, [5, 30, 150]), S("🕯️", 5, [3, 15, 75]), S("🍄", 7, [2, 8, 40]), S("🌙", 8, [1, 5, 20]), S("⭐", 9, [1, 5, 20]), S("🗝️", 10, [1, 4, 15])] },

    // ---- Tumble / pays anywhere 6×5 ----
    { id: "thunder-peak", name: "Thunder Peak", tag: "Tumble", mode: "anywhere", reels: 6, rows: 5, scale: 2.2526, freeSpins: 10, freeMult: 3, scatterNeed: 4,
      art: { emoji: "⚡", bg: "linear-gradient(150deg,#7fd1ff,#4b3bff 55%,#140b40)", accent: "#7fd1ff" },
      scatter: S("⚡", 1.7), syms: [S("👑", 3, [10, 25, 50]), S("⏳", 4, [2.5, 10, 25]), S("💍", 5, [2, 5, 15]), S("🏺", 6, [1.5, 2, 12]), S("🔷", 9, [1, 1.5, 10]), S("🔶", 10, [0.8, 1.2, 8]), S("💠", 11, [0.5, 1, 5]), S("🟣", 12, [0.4, 0.9, 4]), S("🟢", 13, [0.25, 0.75, 2])] },
    { id: "candy-cascade", name: "Candy Cascade", tag: "Tumble", mode: "anywhere", reels: 6, rows: 5, scale: 2.2712, freeSpins: 10, freeMult: 3, scatterNeed: 4,
      art: { emoji: "🍭", bg: "linear-gradient(150deg,#ff9ad5,#ff4f9a 50%,#5a1442)", accent: "#ff9ad5" },
      scatter: S("🍭", 1.7), syms: [S("🍬", 3, [10, 25, 50]), S("🍫", 4, [2.5, 10, 25]), S("🍩", 5, [2, 5, 15]), S("🧁", 6, [1.5, 2, 12]), S("🍓", 9, [1, 1.5, 10]), S("🍇", 10, [0.8, 1.2, 8]), S("🍉", 11, [0.5, 1, 5]), S("🍏", 12, [0.4, 0.9, 4]), S("🫐", 13, [0.25, 0.75, 2])] },
    { id: "galaxy-gems", name: "Galaxy Gems", tag: "Tumble", mode: "anywhere", reels: 6, rows: 5, scale: 2.2702, freeSpins: 10, freeMult: 3, scatterNeed: 4,
      art: { emoji: "🪐", bg: "linear-gradient(150deg,#5ef0ff,#7a3cff 55%,#0b0830)", accent: "#5ef0ff" },
      scatter: S("🪐", 1.7), syms: [S("👽", 3, [10, 25, 50]), S("🛸", 4, [2.5, 10, 25]), S("☄️", 5, [2, 5, 15]), S("🌟", 6, [1.5, 2, 12]), S("🔷", 9, [1, 1.5, 10]), S("🔶", 10, [0.8, 1.2, 8]), S("💠", 11, [0.5, 1, 5]), S("🟣", 12, [0.4, 0.9, 4]), S("🔴", 13, [0.25, 0.75, 2])] },

    // ---- Ways ----
    { id: "wild-west-bounty", name: "Wild West Bounty", tag: "Ways", mode: "ways", reels: 5, rows: 3, waysDiv: 25, scale: 2.7894, freeSpins: 10, freeMult: 2,
      art: { emoji: "🤠", bg: "linear-gradient(150deg,#f2b36b,#a2531c 55%,#2e1406)", accent: "#f2b36b" },
      wild: S("⭐", 1.6), scatter: S("💰", 1.2), syms: [S("🤠", 2, [5, 20, 100]), S("🐎", 3, [4, 15, 60]), S("🐂", 4, [3, 10, 40]), S("🌵", 6, [2, 6, 20]), S("🪕", 8, [1, 3, 10]), S("👢", 9, [1, 2, 8]), S("🥾", 10, [0.5, 2, 6])] },
    { id: "dragon-hoard", name: "Dragon Hoard", tag: "Ways", mode: "ways", reels: 5, rows: 4, waysDiv: 50, scale: 1.511, freeSpins: 10, freeMult: 2,
      art: { emoji: "🐉", bg: "linear-gradient(150deg,#ff6b5b,#b0122d 55%,#330612)", accent: "#ffcf5b" },
      wild: S("🐉", 1.6), scatter: S("🏮", 0.75), syms: [S("🧧", 2, [5, 20, 100]), S("🐅", 3, [4, 15, 60]), S("🐢", 4, [3, 10, 40]), S("🀄", 6, [2, 6, 20]), S("🎋", 8, [1, 3, 10]), S("🪙", 9, [1, 2, 8]), S("🍵", 10, [0.5, 2, 6])] },
    { id: "viking-raid", name: "Viking Raid", tag: "Ways", mode: "ways", reels: 5, rows: 3, waysDiv: 25, scale: 2.7982, freeSpins: 10, freeMult: 2,
      art: { emoji: "⚔️", bg: "linear-gradient(150deg,#9fd8ff,#3a6b96 55%,#0d1c2c)", accent: "#9fd8ff" },
      wild: S("🛡️", 1.6), scatter: S("⚔️", 1.2), syms: [S("🪓", 2, [5, 20, 100]), S("🐺", 3, [4, 15, 60]), S("🦅", 4, [3, 10, 40]), S("🐗", 6, [2, 6, 20]), S("⛵", 8, [1, 3, 10]), S("🌊", 9, [1, 2, 8]), S("❄️", 10, [0.5, 2, 6])] },
    { id: "jungle-spirits", name: "Jungle Spirits", tag: "Ways", mode: "ways", reels: 5, rows: 3, waysDiv: 25, scale: 2.6319, freeSpins: 10, freeMult: 3,
      art: { emoji: "🐯", bg: "linear-gradient(150deg,#b6f05a,#2f8a2c 55%,#0b2a10)", accent: "#b6f05a" },
      wild: S("🌺", 1.6), scatter: S("🗿", 1.2), syms: [S("🐯", 2, [5, 20, 100]), S("🦍", 3, [4, 15, 60]), S("🦜", 4, [3, 10, 40]), S("🐍", 6, [2, 6, 20]), S("🍌", 8, [1, 3, 10]), S("🌴", 9, [1, 2, 8]), S("🥥", 10, [0.5, 2, 6])] },
    { id: "aztec-sun", name: "Aztec Sun", tag: "Ways", mode: "ways", reels: 5, rows: 4, waysDiv: 50, scale: 1.4513, freeSpins: 10, freeMult: 3,
      art: { emoji: "🌞", bg: "linear-gradient(150deg,#ffe36b,#e0781a 50%,#3a1a05)", accent: "#ffe36b" },
      wild: S("🌞", 1.6), scatter: S("🏵️", 0.75), syms: [S("🦅", 2, [5, 20, 100]), S("🐆", 3, [4, 15, 60]), S("🐍", 4, [3, 10, 40]), S("🏺", 6, [2, 6, 20]), S("🌽", 8, [1, 3, 10]), S("💚", 9, [1, 2, 8]), S("🔺", 10, [0.5, 2, 6])] },

    // ---- Lines ----
    { id: "deep-sea-gold", name: "Deep Sea Gold", tag: "Lines", mode: "lines", reels: 5, rows: 3, lines: L53_20, scale: 4.7872, freeSpins: 10, freeMult: 2,
      art: { emoji: "🐙", bg: "linear-gradient(150deg,#4ff0d8,#0f6fa8 55%,#041a33)", accent: "#4ff0d8" },
      wild: S("🐚", 2, [10, 50, 250]), scatter: S("🔱", 0.95), syms: [S("🦈", 2, [10, 50, 250]), S("🐙", 3, [5, 25, 100]), S("🐠", 4, [4, 15, 60]), S("🦀", 5, [3, 10, 40]), S("🐡", 7, [2, 6, 20]), S("⚓", 8, [1, 4, 12]), S("🪸", 9, [1, 3, 10])] },
    { id: "moon-mining", name: "Moon Mining", tag: "Lines", mode: "lines", reels: 5, rows: 3, lines: L53_20, scale: 4.5866, freeSpins: 10, freeMult: 3,
      art: { emoji: "🚀", bg: "linear-gradient(150deg,#f7c35a,#6b4bff 55%,#0b0b2e)", accent: "#f7c35a" },
      wild: S("🚀", 2, [10, 50, 250]), scatter: S("🌕", 0.95), syms: [S("💎", 2, [10, 50, 250]), S("🪙", 3, [5, 25, 100]), S("⛏️", 4, [4, 15, 60]), S("🛰️", 5, [3, 10, 40]), S("🌍", 7, [2, 6, 20]), S("🔋", 8, [1, 4, 12]), S("⭐", 9, [1, 3, 10])] },
    { id: "samurai-steel", name: "Samurai Steel", tag: "Lines", mode: "lines", reels: 5, rows: 3, lines: L53_20, scale: 4.7855, freeSpins: 10, freeMult: 2,
      art: { emoji: "⛩️", bg: "linear-gradient(150deg,#ff8a8a,#c21f3a 55%,#2a0710)", accent: "#ff8a8a" },
      wild: S("🏯", 2, [10, 50, 250]), scatter: S("⛩️", 0.95), syms: [S("🗡️", 2, [10, 50, 250]), S("🥷", 3, [5, 25, 100]), S("🐉", 4, [4, 15, 60]), S("🌸", 5, [3, 10, 40]), S("🎐", 7, [2, 6, 20]), S("🍶", 8, [1, 4, 12]), S("🏮", 9, [1, 3, 10])] },
    { id: "pirate-plunder", name: "Pirate Plunder", tag: "Lines", mode: "lines", reels: 5, rows: 3, lines: L53_10, scale: 4.8234, freeSpins: 10, freeMult: 2,
      art: { emoji: "🦜", bg: "linear-gradient(150deg,#5be0c2,#1b6d7a 55%,#06202a)", accent: "#ffd36b" },
      wild: S("🦜", 2, [10, 50, 250]), scatter: S("🗺️", 0.95), syms: [S("💰", 2, [10, 50, 250]), S("💀", 3, [5, 25, 100]), S("🧭", 4, [4, 15, 60]), S("⚓", 5, [3, 10, 40]), S("🗝️", 7, [2, 6, 20]), S("🦑", 8, [1, 4, 12]), S("🍾", 9, [1, 3, 10])] },
    { id: "haunted-manor", name: "Haunted Manor", tag: "Lines", mode: "lines", reels: 5, rows: 4, lines: L54_20, scale: 4.6788, freeSpins: 10, freeMult: 2,
      art: { emoji: "👻", bg: "linear-gradient(150deg,#b8a6ff,#4b2a8a 55%,#120a26)", accent: "#ffa94d" },
      wild: S("👻", 2, [10, 50, 250]), scatter: S("🕯️", 0.7), syms: [S("🧛", 2, [10, 50, 250]), S("🎃", 3, [5, 25, 100]), S("🦇", 4, [4, 15, 60]), S("🕸️", 5, [3, 10, 40]), S("🔮", 7, [2, 6, 20]), S("🦉", 8, [1, 4, 12]), S("🍬", 9, [1, 3, 10])] },
    { id: "crown-jewels", name: "Crown Jewels", tag: "Lines", mode: "lines", reels: 5, rows: 4, lines: L54_20, scale: 4.4795, freeSpins: 10, freeMult: 3,
      art: { emoji: "👑", bg: "linear-gradient(150deg,#ffe28a,#9a5bff 55%,#1a0b36)", accent: "#ffe28a" },
      wild: S("👑", 2, [10, 50, 250]), scatter: S("🏰", 0.7), syms: [S("💍", 2, [10, 50, 250]), S("💎", 3, [5, 25, 100]), S("🔱", 4, [4, 15, 60]), S("⚜️", 5, [3, 10, 40]), S("🪙", 7, [2, 6, 20]), S("🎖️", 8, [1, 4, 12]), S("🔔", 9, [1, 3, 10])] },
  ];

  /* ---------- Engine (pure; also used by the RTP simulator) ---------- */
  function pool(def) {
    if (def._pool) return def._pool;
    const items = [...def.syms];
    if (def.wild) items.push({ ...def.wild, isWild: true, isScatter: !!def.book });
    if (def.scatter && !def.book) items.push({ ...def.scatter, isScatter: true });
    def._pool = items;
    return items;
  }
  function draw(def, rand) {
    const items = pool(def);
    const total = items.reduce((s, it) => s + it.w, 0);
    let r = rand() * total;
    for (const it of items) { r -= it.w; if (r < 0) return it; }
    return items[items.length - 1];
  }
  function newGrid(def, rand) {
    // grid[reel][row]
    return Array.from({ length: def.reels }, () => Array.from({ length: def.rows }, () => draw(def, rand)));
  }
  const idx = (def, reel, row) => reel * def.rows + row;

  function evalLines(def, grid, bet) {
    const lineBet = bet / def.lines.length;
    const wins = [];
    def.lines.forEach((line, li) => {
      const cells = line.map((row, reel) => grid[reel][row]);
      let base = cells.find((c) => !c.isWild);
      let count = 0;
      if (!base) { base = cells[0]; count = cells.length; }
      else for (const c of cells) { if (c.isWild || c.s === base.s) count++; else break; }
      if (base.isScatter && !base.isWild) return;
      // a pure-wild run can out-pay the symbol it substitutes for
      let wildRun = 0; for (const c of cells) { if (c.isWild) wildRun++; else break; }
      const need = def.reels === 3 ? 3 : 3;
      let best = null;
      if (count >= need && base.pay) best = { sym: base, count, amount: base.pay[count - 3] * lineBet * def.scale };
      if (wildRun >= need && def.wild.pay) {
        const wa = def.wild.pay[wildRun - 3] * lineBet * def.scale;
        if (!best || wa > best.amount) best = { sym: def.wild, count: wildRun, amount: wa };
      }
      if (best && best.amount > 0) wins.push({ ...best, line: li, positions: line.slice(0, best.count).map((row, reel) => idx(def, reel, row)) });
    });
    return wins;
  }

  function evalWays(def, grid, bet) {
    const unit = bet / def.waysDiv;
    const wins = [];
    for (const sym of def.syms) {
      let ways = 1, n = 0; const positions = [];
      for (let reel = 0; reel < def.reels; reel++) {
        const hits = []; grid[reel].forEach((c, row) => { if (c.s === sym.s || c.isWild) hits.push(idx(def, reel, row)); });
        if (!hits.length) break;
        ways *= hits.length; n++; positions.push(...hits);
      }
      if (n >= 3) wins.push({ sym, count: n, ways, positions, amount: sym.pay[n - 3] * ways * unit * def.scale });
    }
    return wins;
  }

  function evalAnywhere(def, grid, bet) {
    const counts = new Map();
    grid.forEach((col, reel) => col.forEach((c, row) => { if (c.isScatter) return; const e = counts.get(c.s) || { sym: c, positions: [] }; e.positions.push(idx(def, reel, row)); counts.set(c.s, e); }));
    const wins = [];
    for (const { sym, positions } of counts.values()) {
      const n = positions.length;
      if (n < 8) continue;
      const tier = n >= 12 ? 2 : n >= 10 ? 1 : 0;
      wins.push({ sym, count: n, positions, amount: sym.pay[tier] * bet * def.scale });
    }
    return wins;
  }

  function countScatter(def, grid) {
    let n = 0; const positions = [];
    grid.forEach((col, reel) => col.forEach((c, row) => { if (c.isScatter) { n++; positions.push(idx(def, reel, row)); } }));
    return { n, positions };
  }

  /** One paid or free spin. Returns steps (for tumbles) and totals. */
  function spin(def, bet, rand, mult = 1) {
    let grid = newGrid(def, rand);
    const steps = [];
    let total = 0;
    const evaluate = def.mode === "lines" ? evalLines : def.mode === "ways" ? evalWays : evalAnywhere;
    let fresh = new Set(grid.flatMap((col, r) => col.map((_, row) => idx(def, r, row))));
    for (let guard = 0; guard < 40; guard++) {
      const wins = evaluate(def, grid, bet);
      wins.forEach((w) => (w.amount *= mult));
      const stepWin = wins.reduce((s, w) => s + w.amount, 0);
      steps.push({ grid: grid.map((c) => [...c]), wins, fresh, stepWin });
      total += stepWin;
      if (def.mode !== "anywhere" || !wins.length) break;
      // tumble: remove winners, drop survivors down, fill from the top
      const gone = new Set(wins.flatMap((w) => w.positions));
      fresh = new Set();
      grid = grid.map((col, reel) => {
        const keep = col.filter((_, row) => !gone.has(idx(def, reel, row)));
        const add = def.rows - keep.length;
        const fill = Array.from({ length: add }, () => draw(def, rand));
        for (let row = 0; row < add; row++) fresh.add(idx(def, reel, row));
        return [...fill, ...keep];
      });
    }
    const sc = countScatter(def, steps[steps.length - 1].grid);
    const first = countScatter(def, steps[0].grid);
    const scat = def.mode === "anywhere" ? (sc.n >= first.n ? sc : first) : first;
    const need = def.scatterNeed || 3;
    const trigger = def.freeSpins && scat.n >= need ? def.freeSpins + (scat.n - need) * (def.mode === "anywhere" ? 2 : 0) : 0;
    return { steps, total, scatters: scat, trigger };
  }

  /** Full round incl. free spins — used by the simulator. */
  function playRound(def, bet, rand) {
    const base = spin(def, bet, rand);
    let total = base.total, left = base.trigger, played = 0;
    while (left > 0 && played < 100) {
      const fs = spin(def, bet, rand, def.freeMult || 1);
      total += fs.total; left -= 1; played++;
      if (fs.trigger) left += 5;
    }
    return total;
  }

  const ENGINE = { DEFS, spin, playRound, newGrid };
  if (typeof module !== "undefined") { module.exports = ENGINE; return; }
  if (typeof window === "undefined" || !window.CQ) return;

  /* ---------- Browser UI ---------- */
  const { el, rng, wallet, record, betInput, registerGame, fmt, sleep } = CQ;
  const rand = () => rng.float();
  CQ.slotEngine = ENGINE;

  function payTable(def) {
    const unit = def.mode === "lines" ? `× line bet` : def.mode === "ways" ? `× bet/${def.waysDiv} per way` : "× total bet";
    const heads = def.mode === "anywhere" ? ["8–9", "10–11", "12+"] : def.reels === 3 ? ["3"] : ["3", "4", "5"];
    const row = (sym, label) => `<tr><td class="pt-sym">${sym.s}${label ? ` <small>${label}</small>` : ""}</td>${(sym.pay || []).map((p) => `<td>${+(p * def.scale).toFixed(2)}</td>`).join("")}</tr>`;
    let rows = def.syms.map((s) => row(s)).join("");
    if (def.wild && def.wild.pay) rows = row(def.wild, def.book ? "wild + scatter" : "wild") + rows;
    const extra = [];
    if (def.wild && !def.wild.pay) extra.push(`${def.wild.s} is wild and substitutes for every symbol except ${def.scatter ? def.scatter.s : "scatters"}.`);
    else if (def.wild && !def.book) extra.push(`${def.wild.s} is wild and substitutes for all symbols.`);
    if (def.book) extra.push(`${def.wild.s} is wild and scatter: 3 or more anywhere award ${def.freeSpins} free spins with wins ×${def.freeMult}.`);
    else if (def.scatter) extra.push(`${def.scatter.s} is the scatter: ${def.scatterNeed || 3} or more anywhere award ${def.freeSpins} free spins with wins ×${def.freeMult}${def.mode === "anywhere" ? " (+2 per extra scatter)" : ""}.`);
    if (def.mode === "anywhere") extra.push("Winning symbols vanish and new ones tumble in — keep winning until no new wins land.");
    if (def.mode === "ways") extra.push(`Wins pay left to right on any ${def.rows === 4 ? "1,024" : "243"} ways — the symbol just has to appear on adjacent reels.`);
    if (def.mode === "lines") extra.push(`${def.lines.length} fixed paylines, wins pay left to right.`);
    return `<p>${extra.join(" ")}</p><table class="paytable"><thead><tr><th>Symbol</th>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><p class="pt-unit">Payouts shown ${unit}. Target return to player about 96%.</p>`;
  }

  function mountSlot(def, stage) {
    const bet = betInput({ label: "Total bet" });
    const spinBtn = el("button", { class: "slot-spin", type: "button", "aria-label": "Spin" }, el("span", {}, "↻"));
    const autoBtn = el("button", { class: "btn btn-ghost slot-mini", type: "button" }, "Auto");
    const turboBtn = el("button", { class: "btn btn-ghost slot-mini", type: "button", "aria-pressed": "false" }, "Turbo");
    const winV = el("b", { class: "slot-win-val" }, "0.00");
    const msg = el("div", { class: "slot-msg" }, def.mode === "anywhere" ? "8+ matching symbols anywhere pays" : def.mode === "ways" ? `${def.rows === 4 ? "1,024" : "243"} ways to win` : `${def.lines.length} paylines`);
    const fsBanner = el("div", { class: "fs-banner", hidden: true });
    const gridEl = el("div", { class: `slot-grid mode-${def.mode}`, style: { "--reels": def.reels, "--rows": def.rows } });
    const frameEl = el("div", { class: "slot-machine", style: { "--accent": def.art.accent, "--slot-bg": def.art.bg } },
      el("div", { class: "slot-title" }, el("span", {}, def.art.emoji), def.name),
      fsBanner,
      el("div", { class: "slot-window" }, gridEl),
      el("div", { class: "slot-bar" },
        el("div", { class: "slot-winbox" }, el("small", {}, "Win"), winV),
        msg));
    const controls = el("div", { class: "slot-controls" }, bet.el, el("div", { class: "slot-btns" }, autoBtn, spinBtn, turboBtn));
    stage.append(el("div", { class: "slot-wrap" }, frameEl, controls));

    let reelsEls = [], busy = false, alive = true, autoLeft = 0, turbo = false;
    let grid = newGrid(def, rand);

    function cellEl(sym) { return el("div", { class: `scell${sym.isWild ? " wild" : ""}${sym.isScatter ? " scat" : ""}` }, el("span", {}, sym.s)); }
    function renderStatic(g, freshSet) {
      gridEl.replaceChildren(...g.map((col, reel) => el("div", { class: "reel" }, el("div", { class: "strip" }, col.map((sym, row) => {
        const c = cellEl(sym);
        if (freshSet && freshSet.has(idx(def, reel, row))) { c.classList.add("drop"); c.style.animationDelay = `${(def.rows - row) * 30}ms`; }
        return c;
      })))));
      reelsEls = [...gridEl.children];
    }
    const cellAt = (p) => { const reel = Math.floor(p / def.rows), row = p % def.rows; return reelsEls[reel]?.querySelector(".strip").children[row]; };

    async function animateSpin(g) {
      const cellH = gridEl.querySelector(".scell")?.getBoundingClientRect().height || 80;
      const fillers = turbo ? 6 : 14;
      const anims = g.map((col, reel) => {
        const strip = el("div", { class: "strip" }, [...col.map(cellEl), ...Array.from({ length: fillers }, () => cellEl(draw(def, rand)))]);
        strip.classList.add("blur");
        reelsEls[reel].replaceChildren(strip);
        const dur = (turbo ? 260 : 520) + reel * (turbo ? 70 : 160);
        const a = strip.animate([{ transform: `translateY(${-fillers * cellH}px)` }, { transform: "translateY(6px)", offset: 0.92 }, { transform: "translateY(0)" }], { duration: dur, easing: "cubic-bezier(.25,.6,.3,1)", fill: "forwards" });
        a.finished.then(() => strip.classList.remove("blur"));
        return a.finished;
      });
      await Promise.all(anims);
    }

    async function showWins(step) {
      if (!step.wins.length) return;
      const all = new Set(step.wins.flatMap((w) => w.positions));
      all.forEach((p) => cellAt(p)?.classList.add("win"));
      gridEl.classList.add("has-win");
      const best = step.wins.reduce((a, b) => (b.amount > a.amount ? b : a));
      msg.textContent = def.mode === "anywhere" ? `${best.count}× ${best.sym.s} pays ${fmt(best.amount)}` : def.mode === "ways" ? `${best.sym.s} × ${best.count} reels · ${best.ways} way${best.ways > 1 ? "s" : ""} · ${fmt(best.amount)}` : `${best.count}× ${best.sym.s} on line ${best.line + 1} · ${fmt(best.amount)}${step.wins.length > 1 ? ` (+${step.wins.length - 1} more)` : ""}`;
      await sleep(turbo ? 380 : 750);
    }

    async function playSpin(stake, mult, isFree) {
      const res = spin(def, stake, rand, mult);
      gridEl.classList.remove("has-win");
      await animateSpin(res.steps[0].grid);
      renderStatic(res.steps[0].grid);
      let shown = 0;
      for (let i = 0; i < res.steps.length; i++) {
        const step = res.steps[i];
        if (i > 0) {
          // pop winners, then tumble the new grid in
          await sleep(60);
          renderStatic(step.grid, step.fresh);
          await sleep(turbo ? 220 : 380);
        }
        await showWins(step);
        shown += step.stepWin;
        if (step.wins.length) countUp(shown, isFree);
        if (step.wins.length && i < res.steps.length - 1) {
          const gone = new Set(step.wins.flatMap((w) => w.positions));
          gone.forEach((p) => cellAt(p)?.classList.add("pop"));
          await sleep(turbo ? 160 : 260);
        }
        if (!alive) break;
      }
      if (res.scatters.n >= (def.scatterNeed || 3) && def.freeSpins) res.scatters.positions.forEach((p) => cellAt(p)?.classList.add("win", "scat-hit"));
      grid = res.steps[res.steps.length - 1].grid;
      return res;
    }

    let fsTotal = 0;
    function countUp(v, isFree) { winV.textContent = fmt(CQ.round(isFree ? fsTotal + v : v, wallet.coin)); winV.classList.remove("bump"); void winV.offsetWidth; winV.classList.add("bump"); }

    async function round() {
      if (busy) return;
      const stake = bet.value;
      if (!wallet.debit(stake)) { autoLeft = 0; paintAuto(); return; }
      busy = true; spinBtn.classList.add("spinning"); bet.disable(true); winV.textContent = "0.00"; fsTotal = 0;
      msg.textContent = "Good luck!";
      const base = await playSpin(stake, 1, false);
      let total = base.total;
      if (!base.total) msg.textContent = "No win — spin again";
      if (base.trigger && alive) {
        let left = base.trigger, n = 0;
        msg.textContent = `${base.scatters.n} scatters! ${base.trigger} free spins`;
        await sleep(1100);
        fsTotal = total;
        while (left > 0 && alive && n < 100) {
          n++; left--;
          fsBanner.hidden = false;
          fsBanner.textContent = `FREE SPIN ${n} · ${left} left · wins ×${def.freeMult}`;
          const fs = await playSpin(stake, def.freeMult, true);
          fsTotal += fs.total; total = fsTotal;
          winV.textContent = fmt(CQ.round(total, wallet.coin));
          if (fs.trigger) { left += 5; msg.textContent = "+5 free spins!"; await sleep(700); }
          await sleep(turbo ? 120 : 260);
        }
        fsBanner.hidden = true;
        msg.textContent = `Free spins paid ${fmt(CQ.round(total, wallet.coin))}`;
      }
      const payout = CQ.round(total, wallet.coin);
      if (payout > 0) { wallet.credit(payout); celebrate(payout / stake); }
      record(def.name, stake, payout);
      winV.textContent = fmt(payout);
      busy = false; spinBtn.classList.remove("spinning"); bet.disable(false);
      if (autoRunning && autoLeft > 0 && alive) { autoLeft--; paintAuto(); await sleep(turbo ? 150 : 400); if (alive && autoRunning) round(); }
      else { autoRunning = false; autoLeft = 0; paintAuto(); }
    }

    function celebrate(x) {
      if (x < 5) return;
      const label = x >= 50 ? "MEGA WIN" : x >= 15 ? "BIG WIN" : "NICE WIN";
      const b = el("div", { class: "big-win" }, el("small", {}, label), el("b", {}, `${x.toFixed(2)}×`));
      frameEl.append(b);
      setTimeout(() => b.remove(), 2200);
    }

    let autoRunning = false;
    const AUTO_STEPS = [10, 25, 50];
    function paintAuto() { autoBtn.textContent = autoRunning ? `Stop (${autoLeft})` : "Auto"; autoBtn.classList.toggle("on", autoRunning); }
    autoBtn.addEventListener("click", () => {
      if (autoRunning) { autoRunning = false; autoLeft = 0; paintAuto(); return; }
      const cur = +(autoBtn.dataset.n || 0);
      const n = AUTO_STEPS[cur % AUTO_STEPS.length];
      autoBtn.dataset.n = cur + 1;
      autoRunning = true; autoLeft = n - 1; paintAuto();
      round();
    });
    turboBtn.addEventListener("click", () => { turbo = !turbo; turboBtn.classList.toggle("on", turbo); turboBtn.setAttribute("aria-pressed", String(turbo)); });
    spinBtn.addEventListener("click", () => { if (autoRunning) { autoRunning = false; autoLeft = 0; paintAuto(); } round(); });
    const onKey = (e) => { if (e.code === "Space" && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); round(); } };
    document.addEventListener("keydown", onKey);
    renderStatic(grid);
    return () => { alive = false; autoRunning = false; document.removeEventListener("keydown", onKey); bet.destroy(); };
  }

  for (const def of DEFS) {
    registerGame({
      id: def.id, name: def.name, cat: "slots", tag: def.tag, art: def.art,
      blurb: def.mode === "anywhere" ? "Pays anywhere with tumbling wins and free spins." : def.book ? "Find the book — it's wild and unlocks free spins." : def.mode === "ways" ? `${def.rows === 4 ? "1,024" : "243"} ways to win with free spins.` : def.reels === 3 ? "Three reels, five lines, old-school wins." : `${def.lines.length} lines with wilds and free spins.`,
      get rules() { return payTable(def); },
      mount: (stage) => mountSlot(def, stage),
    });
  }
})();
