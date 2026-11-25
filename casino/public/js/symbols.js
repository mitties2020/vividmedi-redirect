/* CareQuay Casino — slot symbol artwork (SVG sprite). Use CQSym.use("cherry") → <svg>. */
(function () {
  "use strict";
  const OUT = 'stroke="#2a1300" stroke-width="2.5" stroke-linejoin="round"';
  const SHINE = (cx, cy, rx, ry, rot = -25) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(${rot} ${cx} ${cy})"/>`;
  const grad = (id, stops, type = "linear", attrs = 'x1="0" y1="0" x2="0" y2="1"') =>
    `<${type}Gradient id="${id}" ${type === "radial" ? 'cx=".35" cy=".3" r=".8"' : attrs}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</${type}Gradient>`;

  const DEFS = [
    grad("g-red", [[0, "#ffb0b0"], [0.45, "#f0163a"], [1, "#6d0014"]], "radial"),
    grad("g-gold", [[0, "#fff6c4"], [0.45, "#ffd23f"], [1, "#b87400"]]),
    grad("g-gold-r", [[0, "#fff8d0"], [0.5, "#ffc928"], [1, "#a86200"]], "radial"),
    grad("g-leaf", [[0, "#b8f27a"], [1, "#1f7a2a"]]),
    grad("g-lemon", [[0, "#fffbd0"], [0.5, "#ffe94a"], [1, "#c99a00"]], "radial"),
    grad("g-orange", [[0, "#ffe0b0"], [0.45, "#ff9a1f"], [1, "#b04f00"]], "radial"),
    grad("g-plum", [[0, "#f1c8ff"], [0.45, "#9b30e6"], [1, "#3a0866"]], "radial"),
    grad("g-grape", [[0, "#e2ccff"], [0.5, "#7a3df0"], [1, "#2b0b70"]], "radial"),
    grad("g-rind", [[0, "#9cf08a"], [1, "#16702c"]]),
    grad("g-flesh", [[0, "#ff2e55"], [1, "#ff9aa8"]], "linear", 'x1="0" y1="1" x2="0" y2="0"'),
    grad("g-blue7", [[0, "#cfe8ff"], [0.5, "#2f86ff"], [1, "#0b2a8a"]]),
    grad("g-red7", [[0, "#ffd0d0"], [0.45, "#ff1f3d"], [1, "#7a0012"]]),
    grad("g-bar", [[0, "#3a3a3a"], [1, "#0c0c0c"]]),
    grad("g-ruby", [[0, "#ffc7d2"], [0.5, "#ff1f4b"], [1, "#6a0019"]], "radial"),
    grad("g-sapph", [[0, "#d4ecff"], [0.5, "#2f7bff"], [1, "#081f6e"]], "radial"),
    grad("g-emer", [[0, "#c8ffe0"], [0.5, "#15c06b"], [1, "#044a25"]], "radial"),
    grad("g-ameth", [[0, "#f0d8ff"], [0.5, "#a24bff"], [1, "#3a0d7a"]], "radial"),
    grad("g-topaz", [[0, "#fff4c2"], [0.5, "#ffb21a"], [1, "#8f4a00"]], "radial"),
    grad("g-wild", [[0, "#ff5fd2"], [0.5, "#8b2cff"], [1, "#2a0a78"]]),
    grad("g-green", [[0, "#c8ff9a"], [0.5, "#2fbf4a"], [1, "#0b5a1f"]], "radial"),
    grad("g-cardA", [[0, "#ffb0b0"], [1, "#c4001f"]]),
    grad("g-cardK", [[0, "#b8dcff"], [1, "#1650d8"]]),
    grad("g-cardQ", [[0, "#efc6ff"], [1, "#8a1fd8"]]),
    grad("g-cardJ", [[0, "#c6ffcf"], [1, "#14963a"]]),
    grad("g-silver", [[0, "#ffffff"], [0.5, "#cfd8e2"], [1, "#6f7c8a"]]),
  ].join("");

  const leaf = (x, y, r = 0, s = 1) => `<path d="M0 0 C 10 -14 30 -14 38 -4 C 26 6 10 8 0 0 Z" transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="url(#g-leaf)" ${OUT}/><path d="M2 -1 C 14 -6 26 -6 34 -4" transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="none" stroke="#165a1f" stroke-width="1.5"/>`;
  const letter = (ch, g, size = 70) => `<text x="50" y="${50 + size * 0.36}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="900" font-size="${size}" fill="url(#${g})" stroke="#1d0a00" stroke-width="3" paint-order="stroke">${ch}</text><text x="50" y="${50 + size * 0.36}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="900" font-size="${size}" fill="none" stroke="#fff" stroke-width="1" opacity=".55">${ch}</text>`;
  const seven = (g) => `<text x="50" y="84" text-anchor="middle" font-family="'Arial Black',Impact,'Segoe UI',sans-serif" font-weight="900" font-size="92" fill="url(#${g})" stroke="#1a0000" stroke-width="5" paint-order="stroke">7</text><text x="50" y="84" text-anchor="middle" font-family="'Arial Black',Impact,'Segoe UI',sans-serif" font-weight="900" font-size="92" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7">7</text>`;
  const barPlate = (y, h = 22) => `<rect x="10" y="${y}" width="80" height="${h}" rx="5" fill="url(#g-bar)" stroke="#ffd23f" stroke-width="2.5"/><text x="50" y="${y + h * 0.78}" text-anchor="middle" font-family="'Arial Black',Impact,sans-serif" font-weight="900" font-size="${h * 0.78}" fill="url(#g-gold)" letter-spacing="2">BAR</text>`;
  const gem = (shape, g) => {
    const shapes = {
      brilliant: `<path d="M20 38 L34 20 H66 L80 38 L50 86 Z" fill="url(#${g})" ${OUT}/><path d="M20 38 H80 M34 20 L42 38 L50 20 L58 38 L66 20 M42 38 L50 86 L58 38" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>`,
      round: `<circle cx="50" cy="52" r="34" fill="url(#${g})" ${OUT}/><path d="M50 18 L62 40 L84 52 L62 64 L50 86 L38 64 L16 52 L38 40 Z M38 40 H62 V64 H38 Z" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>`,
      emerald: `<path d="M30 16 H70 L84 30 V74 L70 88 H30 L16 74 V30 Z" fill="url(#${g})" ${OUT}/><path d="M36 26 H64 L74 36 V68 L64 78 H36 L26 68 V36 Z M30 16 L36 26 M70 16 L64 26 M84 30 L74 36 M84 74 L74 68 M70 88 L64 78 M30 88 L36 78 M16 74 L26 68 M16 30 L26 36" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>`,
      hex: `<path d="M50 12 L84 32 V72 L50 92 L16 72 V32 Z" fill="url(#${g})" ${OUT}/><path d="M50 12 V92 M16 32 L84 72 M84 32 L16 72 M50 30 L68 41 V63 L50 74 L32 63 V41 Z" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.5"/>`,
      trillion: `<path d="M50 14 L88 82 H12 Z" fill="url(#${g})" ${OUT}/><path d="M50 14 L50 60 L88 82 M50 60 L12 82 M36 44 H64 L72 70 H28 Z" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/>`,
    };
    return shapes[shape] + SHINE(38, 34, 10, 5);
  };

  const SYMBOLS = {
    cherry: `<path d="M50 14 C 46 30 36 44 30 58 M50 14 C 56 32 66 44 70 58" fill="none" stroke="#2f6b1a" stroke-width="5" stroke-linecap="round"/>${leaf(50, 16, -20, 0.9)}<circle cx="30" cy="66" r="19" fill="url(#g-red)" ${OUT}/><circle cx="70" cy="66" r="19" fill="url(#g-red)" ${OUT}/>${SHINE(24, 58, 6, 4)}${SHINE(64, 58, 6, 4)}`,
    lemon: `<path d="M12 52 C 18 26 44 18 62 22 C 78 26 88 40 90 52 C 84 74 62 84 42 80 C 26 77 14 66 12 52 Z" fill="url(#g-lemon)" ${OUT}/><path d="M8 52 L14 50 M90 52 L95 50" stroke="#c99a00" stroke-width="5" stroke-linecap="round"/>${SHINE(38, 38, 14, 6)}`,
    orange: `<circle cx="50" cy="56" r="34" fill="url(#g-orange)" ${OUT}/>${[[36, 46], [58, 40], [66, 62], [44, 70], [52, 54], [30, 62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#b04f00" opacity=".5"/>`).join("")}${leaf(50, 22, -30, 0.8)}${SHINE(38, 42, 10, 6)}`,
    plum: `<ellipse cx="50" cy="56" rx="30" ry="34" fill="url(#g-plum)" ${OUT}/><path d="M50 24 C 46 40 48 70 52 88" fill="none" stroke="#3a0866" stroke-width="2" opacity=".5"/><path d="M50 22 L52 12" stroke="#5a3a10" stroke-width="4" stroke-linecap="round"/>${leaf(52, 16, -15, 0.75)}${SHINE(38, 44, 9, 6)}`,
    grapes: `<path d="M50 12 L50 24" stroke="#5a3a10" stroke-width="4" stroke-linecap="round"/>${leaf(52, 18, -10, 0.8)}${[[34, 34], [50, 32], [66, 34], [26, 50], [42, 48], [58, 48], [74, 50], [34, 64], [50, 64], [66, 64], [42, 79], [58, 79], [50, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10.5" fill="url(#g-grape)" stroke="#1e0650" stroke-width="2"/><circle cx="${x - 3}" cy="${y - 3}" r="2.6" fill="#fff" opacity=".55"/>`).join("")}`,
    melon: `<path d="M8 40 A 42 42 0 0 0 92 40 Z" fill="url(#g-rind)" ${OUT}/><path d="M15 40 A 35 35 0 0 0 85 40 Z" fill="#f6fff0"/><path d="M19 40 A 31 31 0 0 0 81 40 Z" fill="url(#g-flesh)"/>${[[34, 52], [50, 58], [66, 52], [42, 66], [58, 66]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="4" fill="#2a0a0a"/>`).join("")}<path d="M8 40 H92" stroke="#2a1300" stroke-width="2.5"/>`,
    bell: `<path d="M50 12 C 30 12 24 30 24 48 C 24 62 18 70 12 76 H88 C 82 70 76 62 76 48 C 76 30 70 12 50 12 Z" fill="url(#g-gold)" ${OUT}/><rect x="10" y="74" width="80" height="8" rx="4" fill="url(#g-gold)" ${OUT}/><circle cx="50" cy="88" r="7" fill="url(#g-gold-r)" ${OUT}/><circle cx="50" cy="10" r="5" fill="url(#g-gold)" ${OUT}/>${SHINE(38, 34, 7, 14, 10)}`,
    bar1: barPlate(39),
    bar2: barPlate(24) + barPlate(54),
    bar3: barPlate(12, 20) + barPlate(40, 20) + barPlate(68, 20),
    seven: seven("g-red7"),
    seven_blue: seven("g-blue7"),
    star: `<path d="M50 8 L62 36 L92 38 L69 58 L77 88 L50 72 L23 88 L31 58 L8 38 L38 36 Z" fill="url(#g-gold)" ${OUT}/><path d="M50 22 L57 40 L76 41 L61 53 L66 72 L50 62 L34 72 L39 53 L24 41 L43 40 Z" fill="#fff" opacity=".28"/>`,
    wild: `<rect x="6" y="26" width="88" height="48" rx="12" fill="url(#g-wild)" stroke="#ffd23f" stroke-width="4"/><text x="50" y="62" text-anchor="middle" font-family="'Arial Black',Impact,sans-serif" font-weight="900" font-size="30" fill="url(#g-gold)" stroke="#2a0a50" stroke-width="2" paint-order="stroke" letter-spacing="1">WILD</text>${SHINE(30, 34, 16, 4, 0)}`,
    coin: `<circle cx="50" cy="50" r="40" fill="url(#g-gold-r)" ${OUT}/><circle cx="50" cy="50" r="31" fill="none" stroke="#a86200" stroke-width="3"/><text x="50" y="66" text-anchor="middle" font-family="'Arial Black',Impact,sans-serif" font-weight="900" font-size="46" fill="#a86200">$</text>${SHINE(36, 32, 12, 6)}`,
    ruby: gem("round", "g-ruby"),
    sapphire: gem("brilliant", "g-sapph"),
    emerald: gem("emerald", "g-emer"),
    amethyst: gem("hex", "g-ameth"),
    topaz: gem("trillion", "g-topaz"),
    crown: `<path d="M12 74 L16 30 L34 52 L50 22 L66 52 L84 30 L88 74 Z" fill="url(#g-gold)" ${OUT}/><rect x="12" y="72" width="76" height="14" rx="4" fill="url(#g-gold)" ${OUT}/><circle cx="16" cy="28" r="6" fill="url(#g-ruby)" ${OUT}/><circle cx="50" cy="20" r="7" fill="url(#g-sapph)" ${OUT}/><circle cx="84" cy="28" r="6" fill="url(#g-emer)" ${OUT}/><circle cx="34" cy="79" r="4" fill="url(#g-ruby)"/><circle cx="50" cy="79" r="4" fill="url(#g-sapph)"/><circle cx="66" cy="79" r="4" fill="url(#g-emer)"/>`,
    horseshoe: `<path d="M22 86 L22 50 C 22 22 78 22 78 50 L78 86 L62 86 L62 52 C 62 38 38 38 38 52 L38 86 Z" fill="url(#g-gold)" ${OUT}/>${[[30, 78], [28, 62], [33, 44], [70, 78], [72, 62], [67, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#7a4a00"/>`).join("")}${SHINE(34, 34, 8, 4, -40)}`,
    clover: `<path d="M50 52 C 52 70 58 82 66 92" fill="none" stroke="#1f6a1f" stroke-width="5" stroke-linecap="round"/>${[[0, -18], [18, 0], [0, 18], [-18, 0]].map(([dx, dy]) => `<circle cx="${50 + dx}" cy="${48 + dy}" r="17" fill="url(#g-green)" ${OUT}/>`).join("")}<circle cx="50" cy="48" r="6" fill="#1f8a2f"/>${SHINE(44, 28, 6, 3)}`,
    card_A: letter("A", "g-cardA"),
    card_K: letter("K", "g-cardK"),
    card_Q: letter("Q", "g-cardQ"),
    card_J: letter("J", "g-cardJ"),
  };

  let injected = false;
  function inject() {
    if (injected) return; injected = true;
    const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sprite.setAttribute("aria-hidden", "true");
    sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    sprite.innerHTML = `<defs>${DEFS}</defs>${Object.entries(SYMBOLS).map(([id, body]) => `<symbol id="sym-${id}" viewBox="0 0 100 100">${body}</symbol>`).join("")}`;
    document.body.prepend(sprite);
  }
  const NAMES = { cherry: "Cherry", lemon: "Lemon", orange: "Orange", plum: "Plum", grapes: "Grapes", melon: "Melon", bell: "Bell", bar1: "BAR", bar2: "Double BAR", bar3: "Triple BAR", seven: "Red 7", seven_blue: "Blue 7", star: "Star", wild: "Wild", coin: "Gold coin", ruby: "Ruby", sapphire: "Sapphire", emerald: "Emerald", amethyst: "Amethyst", topaz: "Topaz", crown: "Crown", horseshoe: "Horseshoe", clover: "Clover", card_A: "Ace", card_K: "King", card_Q: "Queen", card_J: "Jack" };
  window.CQSym = {
    inject,
    html(id, cls = "sym") { return `<svg class="${cls}" viewBox="0 0 100 100" role="img" aria-label="${NAMES[id] || id}"><use href="#sym-${id}"/></svg>`; },
    name: (id) => NAMES[id] || id,
    ids: Object.keys(SYMBOLS),
  };
})();
