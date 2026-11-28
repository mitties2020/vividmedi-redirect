"use strict";
/* Public, search-friendly pages (no login needed). Rendered on the server so search engines and link previews can read them. */
const S = require("./support");
const TERMS = require("../public/js/shared/terms.js");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LOGO = (size = 34, id = "lgp") => `<svg class="cq-mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${id}" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c8fff6"/><stop offset=".5" stop-color="#5ee6d2"/><stop offset="1" stop-color="#f5c451"/></linearGradient></defs><path d="M23.5 15a9 9 0 1 0 6.4 15.4" fill="none" stroke="#9ff3e6" stroke-width="4" stroke-linecap="round" opacity=".55"/><path d="M23.5 5a19 19 0 1 0 12.8 33" fill="none" stroke="url(#${id})" stroke-width="5" stroke-linecap="round"/><path d="m28 28 11 11" fill="none" stroke="url(#${id})" stroke-width="5" stroke-linecap="round"/></svg>`;

/* ---------------- Content ---------------- */
const SPORTS = {
  soccer: { name: "Soccer", emoji: "⚽", app: "sports-soccer", intro: "Bet on the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League and the A-League before kick-off. Back the home side, the draw or the away team, or take a handicap if you think a team will win by more than a goal.", settle: "Soccer bets are settled on the result after 90 minutes plus stoppage time — extra time and penalties don't count." },
  basketball: { name: "Basketball", emoji: "🏀", app: "sports-basketball", intro: "Pre-match odds on the NBA, Australia's NBL and the EuroLeague. Pick the winner, or bet on the handicap line — for example a team −4.5 must win by 5 or more.", settle: "Basketball bets include overtime." },
  tennis: { name: "Tennis", emoji: "🎾", app: "sports-tennis", intro: "Match-winner odds on ATP and WTA tournaments, including the Grand Slams, whenever a tournament is running.", settle: "If a player retires or is disqualified before the match finishes, bets are void and stakes are refunded." },
  cricket: { name: "Cricket", emoji: "🏏", app: "sports-cricket", intro: "Odds on the Big Bash, international T20s, one-day internationals and Test matches. Test matches include a draw price.", settle: "Cricket bets are settled on the official result. In matches without a draw price, a tie or no result is void." },
};
const LEAGUES = [
  { sport: "soccer", slug: "epl", key: "soccer_epl", name: "English Premier League", short: "EPL" },
  { sport: "soccer", slug: "la-liga", key: "soccer_spain_la_liga", name: "La Liga", short: "La Liga" },
  { sport: "soccer", slug: "serie-a", key: "soccer_italy_serie_a", name: "Serie A", short: "Serie A" },
  { sport: "soccer", slug: "bundesliga", key: "soccer_germany_bundesliga", name: "Bundesliga", short: "Bundesliga" },
  { sport: "soccer", slug: "ligue-1", key: "soccer_france_ligue_one", name: "Ligue 1", short: "Ligue 1" },
  { sport: "soccer", slug: "champions-league", key: "soccer_uefa_champs_league", name: "UEFA Champions League", short: "Champions League" },
  { sport: "soccer", slug: "a-league", key: "soccer_australia_aleague", name: "A-League Men", short: "A-League" },
  { sport: "basketball", slug: "nba", key: "basketball_nba", name: "NBA", short: "NBA" },
  { sport: "basketball", slug: "nbl", key: "basketball_nbl", name: "NBL (Australia)", short: "NBL" },
  { sport: "basketball", slug: "euroleague", key: "basketball_euroleague", name: "EuroLeague", short: "EuroLeague" },
  { sport: "cricket", slug: "big-bash", key: "cricket_big_bash", name: "Big Bash League", short: "Big Bash" },
  { sport: "cricket", slug: "test-matches", key: "cricket_test_match", name: "Test matches", short: "Tests" },
  { sport: "cricket", slug: "odi", key: "cricket_odi", name: "One Day Internationals", short: "ODI" },
  { sport: "cricket", slug: "t20-internationals", key: "cricket_international_t20", name: "T20 Internationals", short: "T20I" },
];

const GAMES = [
  { slug: "slots", name: "Slots", app: "#/slots", img: "slots", rtp: "about 94%", title: "Crypto Slots — Triple Sevens, Crown Royale, Gem Cascade & more",
    desc: "Play five premium video slots with Bitcoin, Ethereum, Litecoin, BNB or TRON: classic sevens, 243 ways, tumbling gems and free spins.",
    body: [
      ["Five slots, five styles", "<b>Triple Sevens</b> is a classic three-reel machine with five paylines. <b>Burning Sevens</b> has ten lines, wilds and free spins. <b>Crown Royale</b> runs twenty lines on a 5×4 grid with triple-paying free spins. <b>Hot Gems</b> pays 243 ways — any matching symbols on adjacent reels count. <b>Gem Cascade</b> pays anywhere: eight or more matching gems win, then vanish so new ones tumble in."],
      ["How to play", "Choose your total bet (from $0.10 to $1,000), then spin. Turbo speeds up the reels and Auto plays 10, 25 or 50 spins in a row. Every slot has a full pay table under <i>How it works</i>."],
      ["Return to player", "All five slots are set to return about 94% of stakes over the long run. Results are decided on our server with a cryptographically secure random number generator before the reels stop."],
    ] },
  { slug: "blackjack", name: "Blackjack", app: "#/play/blackjack", img: "blackjack", rtp: "about 99.4% with basic strategy", title: "Crypto Blackjack — 3:2 payouts, six decks",
    desc: "Online blackjack with crypto: six decks, blackjack pays 3:2, double on any first two cards and split pairs.",
    body: [
      ["Rules", "Six decks are shuffled for every shoe. Blackjack pays 3:2 and other wins pay 1:1. You can double down on your first two cards and split a pair once (split aces receive one card each). The dealer hits soft 17 and peeks for blackjack when showing an ace or a ten."],
      ["Strategy", "Basic strategy matters: stand on 12–16 against a dealer 2–6, hit them against 7 or higher, always split aces and eights, and double 11 against anything but an ace. With good play the return to player is about 99.4%."],
      ["Your hand is saved", "If you lose connection mid-hand, the hand is still there when you come back."],
    ] },
  { slug: "roulette", name: "Roulette", app: "#/play/roulette", img: "roulette", rtp: "97.3%", title: "Crypto Roulette — European single-zero wheel",
    desc: "European roulette with a single zero and a 97.3% return. Bet on numbers, colours, dozens and columns with Bitcoin and other crypto.",
    body: [
      ["European wheel", "Our wheel has 37 pockets — 1 to 36 and a single zero — so the return to player is 97.3%, better than the double-zero American game."],
      ["Bets and payouts", "A straight number pays 35:1. Dozens and columns pay 2:1. Red or black, odd or even, and 1–18 or 19–36 pay 1:1. Zero loses all outside bets. Pick a chip, click the table to place it (right-click to remove), and spin."],
    ] },
  { slug: "crash", name: "Crash", app: "#/play/crash", img: "crash", rtp: "97%", title: "Crash — cash out before the rocket crashes",
    desc: "The crypto crash game: the multiplier climbs until it crashes. Cash out in time to win your bet times the multiplier.",
    body: [
      ["How it works", "Place a bet and the rocket launches. The multiplier rises from 1.00× and can crash at any moment. Cash out before it does to win your bet multiplied by the current figure. If it crashes first, the bet is lost."],
      ["Auto cash-out", "Set an auto cash-out (for example 2.00×) and the server cashes you out at that point automatically — even if you close the page."],
      ["Odds", "The crash point is decided on our server when the round starts. The return to player is 97%."],
    ] },
  { slug: "plinko", name: "Plinko", app: "#/play/plinko", img: "plinko", rtp: "about 97%", title: "Crypto Plinko — drop the ball, hit the multipliers",
    desc: "Plinko with 8, 12 or 16 rows and three risk levels. Edge slots pay up to hundreds of times your bet.",
    body: [
      ["How it works", "Each ball bounces left or right off every peg and lands in a payout slot at the bottom. The middle slots are the most likely and pay the least; the edges are rare and pay the most."],
      ["Rows and risk", "Choose 8, 12 or 16 rows and low, medium or high risk. More rows and higher risk widen the gap between the middle and the edges. The return to player is about 97% on every setting."],
    ] },
  { slug: "mines", name: "Mines", app: "#/play/mines", img: "mines", rtp: "97%", title: "Mines — find the gems, avoid the bombs",
    desc: "Pick how many mines hide in a 5×5 grid, reveal gems to raise your multiplier and cash out before you hit a bomb.",
    body: [
      ["How it works", "Choose between 1 and 24 mines, place your bet and start revealing tiles. Every gem raises your multiplier; a mine ends the round. Cash out any time to take your bet times the current multiplier."],
      ["Risk", "More mines mean bigger multipliers per gem but a higher chance of hitting a bomb. The return to player is 97% whatever you choose, and your round is saved if you leave."],
    ] },
];
const COIN_SLUG = { bitcoin: "BTC", ethereum: "ETH", litecoin: "LTC", bnb: "BNB", tron: "TRX" };
const COIN_TIPS = {
  BTC: "Bitcoin transactions usually take 10–60 minutes to confirm depending on network fees. Use a normal (not \"economy\") fee if you want it to arrive quickly.",
  ETH: "Send ETH on the Ethereum main network (ERC-20). Don't send from Arbitrum, Base, Optimism or other layer-2 networks — those deposits would be lost.",
  LTC: "Litecoin is fast and cheap: transactions usually confirm in a few minutes, which makes it one of the quickest ways to fund your account.",
  BNB: "Send BNB on BNB Smart Chain (BEP-20). Don't use the old BNB Beacon Chain (BEP-2) or the Ethereum network.",
  TRX: "Send TRX on the TRON network (TRC-20). TRON transfers are near-instant and fees are tiny.",
};
const FAQ = [
  ["Do I need to verify my identity?", "No. CareQuay is a no-KYC casino: you sign up with an email address and password, and we don't ask for ID documents to deposit or withdraw."],
  ["Which cryptocurrencies can I use?", "Bitcoin (BTC), Ethereum (ETH), Litecoin (LTC), BNB on BNB Smart Chain and TRON (TRX). Your balance is shown in US dollars; deposits are converted at the live market rate."],
  ["How fast are withdrawals?", "Withdrawals are usually processed in under 10 minutes. Occasionally they take longer, for example during network congestion or when a payout needs a security review. The minimum withdrawal is $20."],
  ["Is there a wagering requirement?", "Each deposit must be wagered once (1×) on real-money games or sports bets before it can be withdrawn. Cashback and referral earnings have no wagering requirement."],
  ["How does the 20% cashback work?", "Every week (Sunday 22:00 UTC to Sunday 22:00 UTC) we add up your real-money bets minus your real-money winnings. If that's a loss, 20% of it is paid back to your real balance automatically."],
  ["Can I play for free?", "Yes. Every game and the sportsbook have a Fun mode with a $1,000 practice balance that you can reload any time. Fun-mode money has no cash value."],
  ["Can I bet on matches that have started?", "No. The sportsbook is pre-match only — betting on each match closes just before it starts."],
  ["Are the games fair?", "Every result is decided on our server using a cryptographically secure random number generator, and each game's return to player is shown in its rules."],
  ["How does the referral program work?", "Every player gets a personal invite link. When someone signs up through it, you earn 10% of their weekly net real-money losses, paid to your real balance every Sunday."],
  ["Who can play?", "You must be 18 or over (or older if the law where you live says so), and online gambling must be legal where you are. You're responsible for checking your local laws."],
];

/* ---------------- Layout ---------------- */
module.exports = function createSite({ store, SP, currentUser }) {
  const base = (req) => (process.env.SITE_URL || `${(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`).replace(/\/$/, "");
  const fmtTime = (iso) => new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";

  function page(req, { path, title, desc, h1, kicker, body, crumbs = [], ld = [], img = "og.jpg", user }) {
    const url = base(req) + path;
    const fullTitle = path === "/" ? title : `${title} | CareQuay`;
    const bc = crumbs.length ? { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ name: "Home", path: "/" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: base(req) + c.path })) } : null;
    const lds = [...ld, bc].filter(Boolean).map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("");
    const cta = user ? `<a class="btn btn-gold" href="/#/">Open lobby</a>` : `<a class="btn btn-ghost" href="/login">Log in</a><a class="btn btn-gold" href="/signup">Sign up</a>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}"><meta name="theme-color" content="#0a1418">
<meta property="og:type" content="website"><meta property="og:site_name" content="CareQuay Casino"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(base(req))}/img/${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(base(req))}/img/${img}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/site.css">${lds}</head>
<body><header class="s-top"><div class="s-wrap s-top-in"><a class="s-brand" href="/">${LOGO(34)}<span><b>CareQuay</b><small>Casino</small></span></a>
<nav class="s-nav" aria-label="Main"><a href="/sports">Sports</a><a href="/casino">Casino</a><a href="/bonus/cashback">Promotions</a><a href="/faq">FAQ</a></nav><div class="s-cta">${cta}</div></div></header>
<main>${crumbs.length ? `<nav class="s-wrap s-crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${crumbs.map((c, i) => i === crumbs.length - 1 ? `<span>›</span><span>${esc(c.name)}</span>` : `<span>›</span><a href="${c.path}">${esc(c.name)}</a>`).join("")}</nav>` : ""}
${h1 ? `<section class="s-wrap s-head">${kicker ? `<p class="s-kicker">${kicker}</p>` : ""}<h1>${h1}</h1><p class="s-lead">${esc(desc)}</p></section>` : ""}
${body}
<section class="s-wrap s-join"><div><h2>${user ? "Ready to play?" : "Play in under a minute"}</h2><p>No KYC — just an email and password. Try every game free with $1,000 in fun money, or deposit crypto to play for real.</p></div>${user ? `<a class="btn btn-gold btn-lg" href="/#/">Open the lobby</a>` : `<a class="btn btn-gold btn-lg" href="/signup">Sign up to play</a>`}</section>
</main>
<footer class="s-foot"><div class="s-wrap s-foot-grid">
<div><a class="s-brand" href="/">${LOGO(30, "lgf")}<span><b>CareQuay</b><small>Casino</small></span></a><p class="s-badges"><span class="kyc-badge">No KYC</span><span class="kyc-badge gold">Fast withdrawals</span></p><p class="s-coins">${S.COINS.map((c) => `<span class="coin c-${c.sym}">${c.sym}</span>`).join("")}</p></div>
<div><h3>Sports</h3>${Object.entries(SPORTS).map(([k, s]) => `<a href="/sports/${k}">${s.name} odds</a>`).join("")}<a href="/sports/soccer/epl">EPL odds</a><a href="/sports/basketball/nba">NBA odds</a></div>
<div><h3>Casino</h3>${GAMES.map((g) => `<a href="/${g.slug}">${g.name}</a>`).join("")}</div>
<div><h3>Deposits</h3>${Object.entries(COIN_SLUG).map(([slug, sym]) => `<a href="/deposit/${slug}">Deposit ${S.COINS.find((c) => c.sym === sym).name}</a>`).join("")}</div>
<div><h3>Help</h3><a href="/bonus/cashback">20% cashback</a><a href="/invite">Refer a friend</a><a href="/faq">FAQ</a><a href="/terms">Terms &amp; Conditions</a><a href="/responsible-gambling">Responsible gambling</a></div>
</div><div class="s-wrap s-legal"><span class="age">18+</span><p>Gambling can be addictive — please play responsibly. Only play where online gambling is legal. Need help? <a href="https://www.gamblinghelponline.org.au" rel="noopener" target="_blank">Gambling Help Online</a> · <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a></p><p>© ${new Date().getUTCFullYear()} CareQuay Casino</p></div></footer>
</body></html>`;
  }

  const playHref = (user, appHash) => (user ? `/${appHash}` : "/signup");
  const card = (href, emoji, title, text, cls = "") => `<a class="s-card ${cls}" href="${href}"><span class="s-card-ico">${emoji}</span><b>${esc(title)}</b><span>${esc(text)}</span></a>`;
  const prose = (sections) => `<section class="s-wrap s-prose">${sections.map(([h, p]) => `<h2>${esc(h)}</h2><p>${p}</p>`).join("")}</section>`;

  /* ---------------- Fixtures from the odds cache (never spends API credits) ---------------- */
  async function fixtures(key, limit = 12) {
    const c = await store.kvGet(`odds:${key}`);
    if (!c) return [];
    const now = Date.now();
    return c.events.filter((e) => new Date(e.commence).getTime() > now + 60e3).sort((a, b) => new Date(a.commence) - new Date(b.commence)).slice(0, limit);
  }
  function fixtureTable(evs, user, appId) {
    if (!evs.length) return `<p class="s-muted">No fixtures with odds right now — new matches are added as the markets open. <a href="${playHref(user, `#/play/${appId}`)}">Open the sportsbook</a> to see the latest.</p>`;
    return `<div class="s-fixtures">${evs.map((e) => {
      const h = e.markets.h2h || [];
      return `<article class="s-fx"><div class="s-fx-when">${esc(fmtTime(e.commence))}</div><div class="s-fx-teams"><b>${esc(e.home)}</b><span>v</span><b>${esc(e.away)}</b></div>
<div class="s-fx-odds">${h.map((o) => `<a href="${playHref(user, `#/play/${appId}`)}" class="s-odd"><small>${o.name === "Draw" ? "Draw" : o.name === e.home ? "Home" : "Away"}</small><b>${o.price.toFixed(2)}</b><em>${Math.round(o.prob * 100)}%</em></a>`).join("")}</div></article>`;
    }).join("")}</div>`;
  }
  const eventLd = (evs, req) => evs.slice(0, 10).map((e) => ({ "@context": "https://schema.org", "@type": "SportsEvent", name: `${e.home} v ${e.away}`, startDate: e.commence, eventStatus: "https://schema.org/EventScheduled", homeTeam: { "@type": "SportsTeam", name: e.home }, awayTeam: { "@type": "SportsTeam", name: e.away }, location: { "@type": "Place", name: "TBC" }, url: base(req) + "/sports" }));

  /* ---------------- Pages ---------------- */
  const P = {};
  P["/"] = async (req, user) => page(req, { path: "/", user, title: "CareQuay — No KYC Crypto Casino & Sportsbook", desc: "No-KYC crypto casino and pre-match sportsbook. Play slots, blackjack, roulette and crash, bet on soccer, basketball, tennis and cricket, and get 20% weekly cashback. Deposit BTC, ETH, LTC, BNB or TRX.",
    body: `<section class="s-hero"><div class="s-wrap s-hero-in"><div><p class="s-badges"><span class="kyc-badge big">No KYC Casino</span><span class="kyc-badge big gold">Fast withdrawals</span></p><h1>Bet. Spin. Deal.<br><span>Cash out in crypto.</span></h1><p class="s-lead">Sports betting, slots, blackjack, roulette and crash games — with 20% cashback every week and no ID checks.</p><div class="s-hero-cta">${user ? `<a class="btn btn-gold btn-lg" href="/#/">Open the lobby</a>` : `<a class="btn btn-gold btn-lg" href="/signup">Sign up free</a><a class="btn btn-ghost btn-lg" href="/login">Log in</a>`}</div><p class="s-coins">${S.COINS.map((c) => `<span class="coin c-${c.sym}">${c.sym}</span>`).join("")}</p></div><div class="s-hero-art" aria-hidden="true"><img src="/img/slots.jpg" alt="" width="560" height="350"></div></div></section>
<section class="s-wrap s-perks">${[["🛡️", "No KYC", "Sign up with just an email."], ["⚡", "Fast withdrawals", "Usually processed in under 10 minutes."], ["💸", "20% weekly cashback", "On net losses, paid every Sunday."], ["🤝", "Refer & earn", "10% of your friends' weekly net losses."]].map(([i, t, d]) => `<div class="s-perk"><span>${i}</span><div><b>${t}</b><small>${d}</small></div></div>`).join("")}</section>
<section class="s-wrap"><h2 class="s-h2">Sportsbook</h2><div class="s-cards">${Object.entries(SPORTS).map(([k, s]) => card(`/sports/${k}`, s.emoji, `${s.name} odds`, "Pre-match odds")).join("")}</div></section>
<section class="s-wrap"><h2 class="s-h2">Casino games</h2><div class="s-cards">${GAMES.map((g) => card(`/${g.slug}`, { slots: "🎰", blackjack: "🃏", roulette: "🎡", crash: "🚀", plinko: "🔻", mines: "💣" }[g.slug], g.name, `RTP ${g.rtp}`)).join("")}</div></section>`,
    ld: [{ "@context": "https://schema.org", "@type": "Organization", name: "CareQuay Casino", url: base(req), logo: `${base(req)}/favicon.svg` }, { "@context": "https://schema.org", "@type": "WebSite", name: "CareQuay Casino", url: base(req) }] });

  P["/sports"] = async (req, user) => {
    const ls = await SP.leagues().catch(() => []);
    const active = new Set(ls.map((l) => l.key));
    return page(req, { path: "/sports", user, title: "Crypto Sports Betting — Pre-match Odds", h1: "Crypto sports betting", kicker: "Sportsbook", crumbs: [{ name: "Sports", path: "/sports" }],
      desc: "Pre-match odds on soccer, basketball, tennis and cricket. Bet with Bitcoin, Ethereum, Litecoin, BNB or TRON — win, draw or lose and handicap markets.",
      body: `<section class="s-wrap"><div class="s-cards">${Object.entries(SPORTS).map(([k, s]) => card(`/sports/${k}`, s.emoji, s.name, s.intro.split(".")[0] + ".")).join("")}</div></section>
<section class="s-wrap"><h2 class="s-h2">Popular leagues</h2><div class="s-chips">${LEAGUES.map((l) => `<a class="s-chip${active.has(l.key) ? " on" : ""}" href="/sports/${l.sport}/${l.slug}">${esc(l.short)}</a>`).join("")}</div></section>
${prose([["How our odds work", "Our prices come from the live betting market: we take the average of the major bookmakers' odds, remove their margin to get each team's real chance, and add a small margin of our own. Under every price you'll see the market's estimated chance as a percentage."], ["Pre-match only", "Betting on each match closes just before it starts — there is no in-play betting. The price you see when you place a bet is the price you get."], ["Win, draw or lose — and margins", "Every match has a <b>match result</b> market. Soccer and basketball also have a <b>handicap</b> market: −1.5 means your team must win by 2 or more, +1.5 means it wins if it wins, draws or loses by 1."], ["Limits", "Stakes from $0.10 up to $500 per bet, with a maximum return of $5,000 per bet."]])}` });
  };
  for (const [k, s] of Object.entries(SPORTS)) {
    P[`/sports/${k}`] = async (req, user) => {
      const leagues = LEAGUES.filter((l) => l.sport === k);
      const all = (await SP.leagues().catch(() => [])).filter((l) => l.group === k);
      const keys = [...new Set([...leagues.map((l) => l.key), ...all.map((l) => l.key)])];
      const evs = (await Promise.all(keys.map((key) => fixtures(key, 6)))).flat().sort((a, b) => new Date(a.commence) - new Date(b.commence)).slice(0, 12);
      return page(req, { path: `/sports/${k}`, user, title: `${s.name} Betting Odds — Bet with Crypto`, h1: `${s.emoji} ${s.name} betting odds`, kicker: "Sportsbook", crumbs: [{ name: "Sports", path: "/sports" }, { name: s.name, path: `/sports/${k}` }],
        desc: `${s.intro.split(".")[0]}. Pre-match ${s.name.toLowerCase()} odds with Bitcoin and crypto at CareQuay.`,
        body: `${leagues.length ? `<section class="s-wrap"><div class="s-chips">${leagues.map((l) => `<a class="s-chip" href="/sports/${k}/${l.slug}">${esc(l.name)}</a>`).join("")}</div></section>` : ""}
<section class="s-wrap"><h2 class="s-h2">Upcoming matches</h2>${fixtureTable(evs, user, s.app)}</section>
${prose([[`About ${s.name.toLowerCase()} betting at CareQuay`, s.intro], ["Settlement", `${s.settle} Matches that are abandoned or postponed are void and stakes are refunded.`]])}`,
        ld: eventLd(evs, req) });
    };
  }
  for (const l of LEAGUES) {
    P[`/sports/${l.sport}/${l.slug}`] = async (req, user) => {
      const evs = await fixtures(l.key, 20);
      const s = SPORTS[l.sport];
      return page(req, { path: `/sports/${l.sport}/${l.slug}`, user, title: `${l.name} Odds — ${l.short} Betting with Crypto`, h1: `${l.name} odds`, kicker: `${s.emoji} ${s.name}`, crumbs: [{ name: "Sports", path: "/sports" }, { name: s.name, path: `/sports/${l.sport}` }, { name: l.short, path: `/sports/${l.sport}/${l.slug}` }],
        desc: `Pre-match ${l.name} odds for the next round. Bet on ${l.short} with Bitcoin, Ethereum, Litecoin, BNB or TRON — ${l.sport === "soccer" ? "home, draw, away and handicap" : l.sport === "basketball" ? "match winner and handicap" : "match winner"} markets.`,
        body: `<section class="s-wrap"><h2 class="s-h2">Next ${esc(l.short)} matches</h2>${fixtureTable(evs, user, s.app)}<p class="s-muted s-small">Odds shown are our latest prices and can change. Times are in UTC.</p></section>
${prose([[`Betting on the ${l.name}`, `${s.intro}`], ["Settlement", s.settle]])}`,
        ld: eventLd(evs, req) });
    };
  }

  P["/casino"] = async (req, user) => page(req, { path: "/casino", user, title: "Crypto Casino Games — Slots, Blackjack, Roulette, Crash", h1: "Crypto casino games", kicker: "Casino", crumbs: [{ name: "Casino", path: "/casino" }],
    desc: "Slots, blackjack, baccarat, three card poker, video poker, roulette and crypto originals like crash, plinko, mines, dice, limbo and keno.",
    body: `<section class="s-wrap"><div class="s-cards">${GAMES.map((g) => card(`/${g.slug}`, { slots: "🎰", blackjack: "🃏", roulette: "🎡", crash: "🚀", plinko: "🔻", mines: "💣" }[g.slug], g.name, `Return to player ${g.rtp}`)).join("")}</div></section>
${prose([["Also in the lobby", "Baccarat (punto banco, 8 decks), Three Card Poker with Pair Plus, Jacks or Better video poker, Dice, Limbo and Keno."], ["Play free first", "Every game has a Fun mode with a $1,000 practice balance, so you can learn the rules before playing for real."], ["Fair results", "Every outcome is decided on our server with a cryptographically secure random number generator before the animation starts. Each game's return to player is published in its rules."]])}` });
  for (const g of GAMES) {
    P[`/${g.slug}`] = async (req, user) => page(req, { path: `/${g.slug}`, user, title: g.title, h1: esc(g.title.split(" — ")[0]), kicker: "Casino", crumbs: [{ name: "Casino", path: "/casino" }, { name: g.name, path: `/${g.slug}` }], desc: g.desc, img: `${g.img}.jpg`,
      body: `<section class="s-wrap s-game"><figure><img src="/img/${g.img}.jpg" alt="${esc(g.name)} at CareQuay Casino" width="1200" height="630" loading="lazy"></figure><div class="s-game-side"><div class="s-stat"><small>Return to player</small><b>${esc(g.rtp)}</b></div><div class="s-stat"><small>Bets</small><b>$0.10 – $1,000</b></div><a class="btn btn-gold btn-lg btn-block" href="${playHref(user, g.app)}">${user ? "Play now" : "Sign up to play"}</a><p class="s-muted s-small">Or try it free in Fun mode with $1,000 practice money.</p></div></section>
${prose(g.body)}` });
  }

  P["/bonus/cashback"] = async (req, user) => page(req, { path: "/bonus/cashback", user, title: "20% Weekly Cashback on Losses", h1: "20% weekly cashback", kicker: "Promotions", crumbs: [{ name: "Promotions", path: "/bonus/cashback" }],
    desc: "Get 20% of your net weekly real-money losses back every Sunday at 22:00 UTC — paid automatically, with no wagering requirement.",
    body: `<section class="s-wrap s-steps">${[["1", "Play for real", "Casino games and sports bets all count."], ["2", "Week ends Sunday 22:00 UTC", "We add up your real-money bets minus your winnings."], ["3", "Get 20% back", "If it's a loss, 20% goes straight to your real balance."]].map(([n, t, d]) => `<div class="s-step"><span>${n}</span><b>${t}</b><small>${d}</small></div>`).join("")}</section>
${prose([["Example", "You bet $500 in a week and win back $300. Your net loss is $200, so you receive $40 cashback when the week closes."], ["The details", "Cashback weeks run from Sunday 22:00 UTC to the following Sunday 22:00 UTC. Fun-mode play, deposits and withdrawals don't count. Cashback is paid to your real balance with no wagering requirement, and you can withdraw it straight away. We may withhold cashback where we reasonably suspect bonus abuse or multiple accounts."]])}` });

  P["/invite"] = async (req, user) => page(req, { path: "/invite", user, title: "Refer a Friend — Earn 10% Every Week", h1: "Refer friends, earn every week", kicker: "Promotions", crumbs: [{ name: "Refer a friend", path: "/invite" }],
    desc: "Share your invite link and earn 10% of your friends' weekly net real-money losses, paid every Sunday with no wagering requirement.",
    body: `<section class="s-wrap s-steps">${[["1", "Get your link", "Find it on the Invite page once you've signed up."], ["2", "Share it", "Friends who sign up through it are linked to you."], ["3", "Earn 10%", "Of their weekly net real-money losses, every Sunday."]].map(([n, t, d]) => `<div class="s-step"><span>${n}</span><b>${t}</b><small>${d}</small></div>`).join("")}</section>
${prose([["How earnings are worked out", "For each friend, we add up their real-money bets minus real-money winnings for the cashback week (Sunday 22:00 UTC to Sunday 22:00 UTC). If it's a loss, 10% of it is paid to your real balance. There's no limit on how many friends you can invite."], ["Fair play", "You can't refer yourself or your own other accounts. We may withhold or reverse referral earnings where we suspect duplicate accounts or abuse."]])}
<section class="s-wrap s-center">${user ? `<a class="btn btn-gold btn-lg" href="/#/invite">Get my invite link</a>` : `<a class="btn btn-gold btn-lg" href="/signup">Sign up to get your link</a>`}</section>` });

  for (const [slug, sym] of Object.entries(COIN_SLUG)) {
    const c = S.COINS.find((x) => x.sym === sym);
    P[`/deposit/${slug}`] = async (req, user) => page(req, { path: `/deposit/${slug}`, user, title: `How to Deposit ${c.name} (${sym}) at a Crypto Casino`, h1: `How to deposit ${c.name} (${sym})`, kicker: "Deposits", crumbs: [{ name: "Deposits", path: "/faq" }, { name: c.name, path: `/deposit/${slug}` }],
      desc: `Step-by-step guide to depositing ${c.name} (${sym}) at CareQuay Casino on the ${c.nets[0]} network — no KYC, credited in US dollars at the live rate.`,
      body: `<section class="s-wrap s-howto"><ol>${[
        ["Create your account", "Sign up with your email and a password — no ID needed."],
        ["Open the Wallet", `Go to Wallet and choose <b>${c.name} (${sym})</b>. Your deposit address is shown with a Copy button.`],
        ["Send from your wallet or exchange", `In your own wallet or exchange, withdraw ${sym} to that address using the <b>${esc(c.nets[0])}</b> network. Double-check the first and last few characters of the address after pasting.`],
        ["Wait for it to arrive", `Your deposit is credited to your balance in US dollars at the live ${sym} rate once it's received. ${COIN_TIPS[sym]}`],
        ["Play", "Deposits need to be wagered once (1×) before you can withdraw them. Then withdraw back to any of the five supported coins."],
      ].map(([t, d]) => `<li><b>${t}</b><p>${d}</p></li>`).join("")}</ol></section>
${prose([["Important", `Only send ${sym} on the ${esc(c.nets[0])} network to your ${sym} deposit address. Coins sent on a different network or to the wrong address can't be recovered.`], ["Other ways to deposit", Object.entries(COIN_SLUG).filter(([s2]) => s2 !== slug).map(([s2, sy]) => `<a href="/deposit/${s2}">${S.COINS.find((x) => x.sym === sy).name}</a>`).join(" · ")]])}`,
      ld: [{ "@context": "https://schema.org", "@type": "HowTo", name: `How to deposit ${c.name} at CareQuay Casino`, step: ["Create your account", "Open the Wallet", `Send ${sym} on ${c.nets[0]}`, "Wait for it to arrive", "Play"].map((t, i) => ({ "@type": "HowToStep", position: i + 1, name: t })) }] });
  }

  P["/faq"] = async (req, user) => page(req, { path: "/faq", user, title: "FAQ — Deposits, Withdrawals, Cashback & Sports", h1: "Frequently asked questions", kicker: "Help", crumbs: [{ name: "FAQ", path: "/faq" }],
    desc: "Answers about no-KYC sign-up, crypto deposits and withdrawals, wagering, 20% cashback, the sportsbook and referrals at CareQuay Casino.",
    body: `<section class="s-wrap s-faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>`,
    ld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] });

  P["/terms"] = async (req, user) => page(req, { path: "/terms", user, title: "Terms & Conditions", h1: "Terms &amp; Conditions", crumbs: [{ name: "Terms & Conditions", path: "/terms" }],
    desc: "The terms that apply to your CareQuay Casino account, deposits, withdrawals, cashback, referrals, casino games and sports bets.",
    body: `<section class="s-wrap s-prose"><p class="s-muted">Last updated ${esc(TERMS.UPDATED)}</p>${TERMS.TERMS.map(([h, p]) => `<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join("")}</section>` });

  P["/responsible-gambling"] = async (req, user) => page(req, { path: "/responsible-gambling", user, title: "Responsible Gambling", h1: "Responsible gambling", crumbs: [{ name: "Responsible gambling", path: "/responsible-gambling" }],
    desc: "Gambling should be fun. Tips to stay in control, signs of a problem, and where to get free, confidential help.",
    body: prose([
      ["Stay in control", "Treat gambling as paid entertainment, not a way to make money. Decide on a budget before you play and stick to it. Never chase losses, never gamble with money you need for bills, and take regular breaks. Fun mode lets you enjoy every game without risking anything."],
      ["Warning signs", "Spending more than you planned, borrowing to gamble, hiding it from people close to you, feeling anxious when you're not playing, or playing to win back losses are all signs it may be time to stop."],
      ["Take a break or close your account", "If you want to take a break or close your account, contact support and we'll do it. Closing an account returns any withdrawable real balance to you."],
      ["Free, confidential help", `<a href="https://www.gamblinghelponline.org.au" rel="noopener" target="_blank">Gambling Help Online</a> (Australia, 24/7: 1800 858 858) · <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a> (UK) · <a href="https://www.gamblersanonymous.org" rel="noopener" target="_blank">Gamblers Anonymous</a> · <a href="https://www.ncpgambling.org" rel="noopener" target="_blank">National Council on Problem Gambling</a> (US: 1-800-GAMBLER).`],
      ["Under 18s", "Gambling is strictly for adults. Accounts opened by anyone under 18 are closed. If you share a device with children, keep your login private."],
    ]) });

  function sitemap(req) {
    const urls = Object.keys(P);
    const today = new Date().toISOString().slice(0, 10);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(base(req) + u)}</loc><lastmod>${today}</lastmod><changefreq>${u.startsWith("/sports") ? "hourly" : u === "/" ? "daily" : "weekly"}</changefreq><priority>${u === "/" ? "1.0" : u.split("/").length <= 2 ? "0.8" : "0.6"}</priority></url>`).join("\n")}\n</urlset>\n`;
  }
  const robots = (req) => `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /r/\nDisallow: /login\n\nSitemap: ${base(req)}/sitemap.xml\n`;
  const notFound = (req, user) => page(req, { path: req.url.split("?")[0], user, title: "Page not found", h1: "Page not found", desc: "That page doesn't exist. Try the sportsbook, the casino or the FAQ.", body: `<section class="s-wrap"><div class="s-cards">${card("/sports", "⚽", "Sportsbook", "Pre-match odds")}${card("/casino", "🎰", "Casino", "Slots and table games")}${card("/faq", "❓", "FAQ", "Help and answers")}</div></section>` });

  /** Returns true if it handled the request. */
  async function handle(req, res, url) {
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const send = (status, type, body, extra = {}) => { res.writeHead(status, { "Content-Type": type, "Cache-Control": "public, max-age=300", ...extra }); res.end(req.method === "HEAD" ? undefined : body); return true; };
    if (path === "/sitemap.xml") return send(200, "application/xml; charset=utf-8", sitemap(req));
    if (path === "/robots.txt") return send(200, "text/plain; charset=utf-8", robots(req));
    const fn = P[path];
    if (!fn && /\.[a-z0-9]+$/i.test(path)) return false; // static file
    const user = await currentUser(req).catch(() => null);
    if (!fn) return send(404, "text/html; charset=utf-8", notFound(req, user), { "Cache-Control": "no-cache" });
    return send(200, "text/html; charset=utf-8", await fn(req, user), { "Cache-Control": user ? "private, no-cache" : "public, max-age=300", Vary: "Cookie" });
  }
  return { handle, paths: () => Object.keys(P) };
};
