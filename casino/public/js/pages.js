/* CareQuay Casino — Wallet, Bonuses, Terms & Conditions, History. */
(() => {
  "use strict";
  const { el, api, fmtUSD, toast, fail, state, onBalance } = CQ;
  const COIN_COLORS = { TRX: "#ff3b3b", BTC: "#f7931a", ETH: "#8c8cff", USDT: "#26a17b", BNB: "#f3ba2f", SOL: "#14f195", XRP: "#b8c4d6", USDC: "#2775ca", DOGE: "#c2a633", ADA: "#3468d1", TRX: "#ff3b3b", TON: "#0098ea", AVAX: "#e84142", SHIB: "#ff9f1a", LINK: "#2a5ada", DOT: "#e6007a", BCH: "#8dc351", LTC: "#a6b4c8", XLM: "#cfd8e2", POL: "#8247e5", NEAR: "#00ec97" };
  const coinIcon = (sym) => el("span", { class: "coin-ico", style: { "--c": COIN_COLORS[sym] || "#5ee6d2" } }, sym.length > 3 ? sym.slice(0, 3) : sym);
  const fmtPrice = (p) => (p == null ? "–" : p >= 1 ? `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${p.toPrecision(4)}`);
  const fmtCrypto = (v) => (v >= 1 ? v.toLocaleString("en-US", { maximumFractionDigits: 6 }) : Number(v).toPrecision(6));
  const when = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const head = (icon, title, sub) => el("div", { class: "page-head" }, el("span", { class: "section-icon" }, icon), el("div", {}, el("h1", {}, title), sub ? el("p", {}, sub) : null));

  /* ================= WALLET ================= */
  async function wallet(view) {
    const balReal = el("b", { class: "big-bal" }, fmtUSD(state.bal.real));
    const wagerV = el("span");
    const funV = el("span");
    const paintBal = () => {
      balReal.textContent = fmtUSD(state.bal.real);
      funV.textContent = fmtUSD(state.bal.fun);
      wagerV.textContent = state.bal.wagerRemaining > 0 ? `${fmtUSD(state.bal.wagerRemaining)} left to wager before you can withdraw` : "Your balance is available to withdraw";
      wagerV.className = state.bal.wagerRemaining > 0 ? "wager-pending" : "wager-ok";
    };
    const off = onBalance(paintBal); paintBal();

    const coinGrid = el("div", { class: "coin-grid" }, el("p", { class: "muted" }, "Loading live prices…"));
    const depositPanel = el("div", { class: "deposit-panel" });
    const wdCoin = el("select", { class: "boxed", "aria-label": "Coin" });
    const wdNet = el("select", { class: "boxed", "aria-label": "Network" });
    const wdAddr = el("input", { class: "text-in boxed", type: "text", placeholder: "Paste your wallet address", autocomplete: "off", spellcheck: "false" });
    const wdAmt = el("input", { class: "bet-input", type: "number", min: "0", step: "0.01", placeholder: "0.00", inputmode: "decimal" });
    const wdEst = el("p", { class: "wd-est" }, "–");
    const wdMsg = el("p", { class: "auth-msg", role: "alert" });
    const wdBtn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Request withdrawal");
    const histDep = el("div", { class: "table-wrap" });
    const histWd = el("div", { class: "table-wrap" });
    let coins = [], selected = null, minWithdraw = 20;

    const wdForm = el("form", { class: "wd-form", novalidate: true },
      el("div", { class: "wd-row" }, CQ.field("Coin", wdCoin), CQ.field("Network", wdNet)),
      CQ.field("Your wallet address", wdAddr),
      el("label", { class: "field" }, el("span", { class: "field-label" }, el("span", {}, "Amount (USD)"), el("button", { type: "button", class: "auth-inline", onclick: () => { wdAmt.value = Math.floor(state.bal.real * 100) / 100; est(); } }, "Max")), el("div", { class: "bet-row" }, el("span", { class: "coin-glyph" }, "$"), wdAmt)),
      wdEst, wdMsg, wdBtn,
      el("p", { class: "muted small" }, "Double-check the address and network — crypto sent to a wrong address can't be recovered."));

    function est() {
      const c = coins.find((x) => x.sym === wdCoin.value);
      const v = Number(wdAmt.value);
      wdEst.textContent = c && v > 0 ? `You'll receive ≈ ${fmtCrypto(v / c.usd)} ${c.sym} at ${fmtPrice(c.usd)} (live rate, fixed when you submit)` : `Minimum withdrawal ${fmtUSD(minWithdraw)}`;
    }
    function fillNets() { const c = coins.find((x) => x.sym === wdCoin.value); wdNet.replaceChildren(...(c ? c.nets : []).map((n) => el("option", { value: n }, n))); est(); }
    wdCoin.addEventListener("change", fillNets); wdAmt.addEventListener("input", est);
    wdForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      wdMsg.textContent = ""; wdBtn.disabled = true;
      try {
        const r = await api("/api/withdraw", { coin: wdCoin.value, network: wdNet.value, address: wdAddr.value.trim(), usd: Number(wdAmt.value) });
        wdMsg.className = "auth-msg ok"; wdMsg.textContent = `Withdrawal #${r.id} requested: ${fmtCrypto(r.crypto_amount)} ${wdCoin.value}. It'll be sent as soon as it's approved.`;
        wdAmt.value = ""; est(); loadHistory();
      } catch (err) { wdMsg.className = "auth-msg error"; wdMsg.textContent = err.message; }
      wdBtn.disabled = false;
    });

    function pickDeposit(c) {
      selected = c.sym;
      CQ.$$(".coin-card", coinGrid).forEach((b) => b.classList.toggle("on", b.dataset.sym === c.sym));
      const net = c.nets[0];
      if (!c.address) {
        depositPanel.replaceChildren(el("div", { class: "dep-head" }, coinIcon(c.sym), el("div", {}, el("h3", {}, `Deposit ${c.name}`))), el("div", { class: "addr-box soon" }, el("b", {}, "Deposit address coming soon"), el("span", {}, `${c.sym} deposits will open here shortly.`)));
        return;
      }
      const copyBtn = el("button", { type: "button", class: "btn btn-ghost btn-sm" }, "Copy");
      copyBtn.addEventListener("click", async () => { try { await navigator.clipboard.writeText(c.address); copyBtn.textContent = "Copied ✓"; } catch { const r = document.createRange(); r.selectNodeContents(addrText); getSelection().removeAllRanges(); getSelection().addRange(r); copyBtn.textContent = "Selected — press Ctrl+C"; } setTimeout(() => (copyBtn.textContent = "Copy"), 2500); });
      const addrText = el("code", { class: "addr" }, c.address);
      depositPanel.replaceChildren(
        el("div", { class: "dep-head" }, coinIcon(c.sym), el("div", {}, el("h3", {}, `Deposit ${c.name}`), el("p", { class: "muted" }, `1 ${c.sym} = ${fmtPrice(c.usd)}`))),
        el("div", { class: "addr-box" }, el("small", {}, `Your ${c.sym} deposit address · ${net}`), el("div", { class: "addr-row" }, addrText, copyBtn), el("span", { class: "addr-warn" }, `Send only ${c.sym} on the ${net} network to this address.`)),
        el("ul", { class: "dep-notes" },
          el("li", {}, "Deposits are credited to your balance in US dollars at the live rate once received."),
          el("li", {}, "Each deposit must be wagered at least 1× before it can be withdrawn."),
          el("li", {}, "Sending any other coin or network to this address may result in permanent loss.")));
    }

    async function loadPrices() {
      try {
        const { coins: list } = await api("/api/prices");
        coins = list;
        coinGrid.replaceChildren(...coins.map((c) => el("button", { type: "button", class: `coin-card${c.sym === selected ? " on" : ""}`, "data-sym": c.sym, onclick: () => pickDeposit(c) },
          coinIcon(c.sym),
          el("span", { class: "cc-name" }, el("b", {}, c.sym), el("small", {}, c.name)),
          el("span", { class: "cc-price" }, el("b", {}, fmtPrice(c.usd)), el("small", { class: c.change24h >= 0 ? "up" : "down" }, c.change24h == null ? "" : `${c.change24h >= 0 ? "▲" : "▼"} ${Math.abs(c.change24h).toFixed(2)}%`)))));
        if (!wdCoin.options.length) { wdCoin.replaceChildren(...coins.map((c) => el("option", { value: c.sym }, `${c.sym} — ${c.name}`))); fillNets(); }
        if (!selected) pickDeposit(coins[0]); else pickDeposit(coins.find((c) => c.sym === selected));
        est();
      } catch (err) { coinGrid.replaceChildren(el("p", { class: "muted" }, err.message)); }
    }
    async function loadHistory() {
      try {
        const w = await api("/api/wallet");
        minWithdraw = w.minWithdraw; est();
        const table = (rows, cols, empty) => el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, cols.map((c) => el("th", { class: c.num ? "num" : "" }, c.h)))), el("tbody", {}, rows.length ? rows.map((r) => el("tr", {}, cols.map((c) => el("td", { class: c.num ? "num" : "" }, c.v(r))))) : el("tr", {}, el("td", { colspan: String(cols.length), class: "empty" }, empty))));
        histDep.replaceChildren(table(w.deposits, [{ h: "Date", v: (r) => when(r.created_at) }, { h: "Coin", v: (r) => r.coin }, { h: "Amount", num: 1, v: (r) => `${fmtCrypto(r.amount)} ${r.coin}` }, { h: "Credited", num: 1, v: (r) => (r.status === "credited" ? fmtUSD(r.usd) : "–") }, { h: "Status", v: (r) => el("span", { class: `status st-${r.status === "credited" ? "paid" : r.status === "processing" ? "pending" : r.status}` }, r.status === "credited" ? "credited" : r.status === "processing" ? "pending" : r.status) }], "No deposits yet"));
        histWd.replaceChildren(table(w.withdrawals, [{ h: "Date", v: (r) => when(r.created_at) }, { h: "Coin", v: (r) => `${r.coin}${r.network ? ` · ${r.network}` : ""}` }, { h: "Address", v: (r) => `${r.address.slice(0, 8)}…${r.address.slice(-6)}` }, { h: "Amount", num: 1, v: (r) => `${fmtUSD(r.usd)} (${fmtCrypto(r.crypto_amount)} ${r.coin})` }, { h: "Status", v: (r) => el("span", { class: `status st-${r.status}` }, r.status) }], "No withdrawals yet"));
      } catch (e) { fail(e); }
    }

    view.replaceChildren(
      head("👛", "Wallet", "Deposit and withdraw in BTC, ETH, LTC, BNB and TRX. Balances are shown in US dollars."),
      el("section", { class: "wallet-top" },
        el("div", { class: "bal-card real" }, el("small", {}, "Real balance"), balReal, wagerV),
        el("div", { class: "bal-card fun" }, el("small", {}, "Fun balance"), el("b", { class: "mid-bal" }, funV), el("span", { class: "muted" }, "Practice money — reloads to $1,000 when you choose Play for fun"))),
      el("section", { class: "wallet-grid" },
        el("div", { class: "panel" }, el("h2", {}, "Deposit"), el("p", { class: "muted" }, "Pick a coin. Live prices update every minute."), coinGrid, depositPanel),
        el("div", { class: "panel" }, el("h2", {}, "Withdraw"), wdForm)),
      el("section", { class: "panel" }, el("h2", {}, "Withdrawals"), histWd),
      el("section", { class: "panel" }, el("h2", {}, "Deposits"), histDep));
    loadPrices(); loadHistory();
    const t = setInterval(loadPrices, 60000);
    return () => { clearInterval(t); off(); };
  }

  /* ================= BONUSES ================= */
  async function bonus(view) {
    const cd = el("div", { class: "countdown" });
    const local = el("p", { class: "muted" });
    const stats = el("div", { class: "cb-stats" });
    const hist = el("div", { class: "table-wrap" });
    view.replaceChildren(
      head("🎁", "Bonuses", null),
      el("section", { class: "cb-hero" },
        el("div", {}, el("p", { class: "hero-kicker" }, "Every week"), el("h2", {}, el("span", {}, "20%"), " cashback"), el("p", {}, "Get 20% of your net real-money losses back, paid automatically every Sunday at 10:00 pm UTC. No wagering requirement on cashback.")),
        el("div", { class: "cb-next" }, el("small", {}, "Next payout in"), cd, local)),
      stats,
      el("section", { class: "panel" }, el("h2", {}, "How it works"), el("ol", { class: "how" },
        el("li", {}, "Each cashback week runs from Sunday 10:00 pm UTC to the following Sunday 10:00 pm UTC."),
        el("li", {}, "Net loss = your real-money bets minus your real-money winnings for that week. Fun-mode play doesn't count."),
        el("li", {}, "If you finish the week down, 20% of the net loss is added to your real balance at 10:00 pm UTC on Sunday."),
        el("li", {}, "Cashback is credited as real balance and can be played or withdrawn straight away."))),
      el("section", { class: "panel" }, el("h2", {}, "Cashback history"), hist));
    let next = null, timer;
    const tick = () => {
      if (!next) return;
      let s = Math.max(0, Math.floor((next - Date.now()) / 1000));
      const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
      cd.replaceChildren(...[["d", d], ["h", h], ["m", m], ["s", s]].map(([u, v]) => el("span", {}, el("b", {}, String(v).padStart(2, "0")), el("small", {}, u))));
      if (next - Date.now() < -2000) load();
    };
    async function load() {
      try {
        const b = await api("/api/bonus");
        next = new Date(b.nextPayout).getTime();
        local.textContent = `That's ${new Date(b.nextPayout).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })} your time`;
        stats.replaceChildren(
          ...[["Wagered this week", fmtUSD(b.wagered)], ["Won this week", fmtUSD(b.won)], ["Net loss so far", fmtUSD(b.netLoss)], ["Cashback if the week ended now", fmtUSD(b.projected)]].map(([k, v], i) => el("div", { class: `cb-stat${i === 3 ? " hl" : ""}` }, el("small", {}, k), el("b", {}, v))));
        hist.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Paid"), el("th", {}, "Week"), el("th", { class: "num" }, "Amount"))),
          el("tbody", {}, b.history.length ? b.history.map((h) => el("tr", {}, el("td", {}, when(h.at)), el("td", {}, h.meta ? `${new Date(h.meta.from).toLocaleDateString()} – ${new Date(h.meta.to).toLocaleDateString()}` : "–"), el("td", { class: "num pay" }, fmtUSD(h.amount)))) : el("tr", {}, el("td", { colspan: "3", class: "empty" }, "No cashback paid yet")))));
        tick();
      } catch (e) { fail(e); }
    }
    load(); timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }

  /* ================= TERMS ================= */
  const TERMS = [
    ["1. About these terms", "These Terms & Conditions govern your use of CareQuay Casino (the “Site”), including all games, the fun-play mode, deposits, withdrawals and promotions. By creating an account or using the Site you agree to these terms. Please read them carefully."],
    ["2. Eligibility", "You must be at least 18 years old, or the legal gambling age where you live if that is higher. You may only play for real money if online gambling is legal in your jurisdiction, and you are responsible for checking this. Accounts opened by minors or from restricted jurisdictions will be closed and any real-money balance may be voided. [Operator to insert list of restricted jurisdictions.]"],
    ["3. Your account", "You may hold one account only. Keep your password secure and don't share your account. You must use a valid email address that you control; accounts are activated by confirming that address. We may request proof of identity, age, address and source of funds at any time, including before processing a withdrawal."],
    ["4. Deposits", "Deposits are accepted in Bitcoin (BTC), Ethereum (ETH), Litecoin (LTC), BNB (BNB Smart Chain) and TRON (TRX). Deposits are credited to your balance in US dollars at the live market rate once the transaction is confirmed on the blockchain. Only send the coin and network displayed for the deposit address; funds sent using a different coin or network may be lost. Every deposit must be wagered at least once (1×) on real-money games before the deposited amount can be withdrawn."],
    ["5. Withdrawals", "You can request a withdrawal to your own wallet address in any supported cryptocurrency once all deposits have been wagered at least 1×. The US-dollar amount is converted to cryptocurrency at the live rate when you submit the request. Withdrawals are processed as soon as they are approved. The minimum withdrawal is $20. You are responsible for entering the correct address and network — transactions sent to an address you provide cannot be reversed. We may delay or decline a withdrawal while identity or security checks are completed, or where these terms have been breached."],
    ["6. Weekly cashback", "Players receive 20% cashback on net real-money losses for each cashback week. A cashback week runs from Sunday 22:00 UTC to the following Sunday 22:00 UTC. Net loss is real-money bets minus real-money winnings in that week; fun-mode play, deposits and withdrawals are excluded. Cashback is credited automatically to your real balance at Sunday 22:00 UTC (it is applied the next time your account is accessed) and carries no wagering requirement. We may withhold cashback where we reasonably suspect bonus abuse, collusion or multiple accounts."],
    ["7. Fun mode", "Fun mode uses a practice balance of $1,000 that has no cash value. It cannot be withdrawn, transferred or exchanged, and fun-mode results do not count towards wagering or cashback."],
    ["8. Games and fairness", "Game results are generated on our servers using a cryptographically secure random number generator. The theoretical return to player for each game is shown in its rules. Minimum bet is $0.10 and maximum bet is $1,000 per round. In the event of a malfunction, system error or obvious mistake, affected bets and payouts are void. If you disconnect during a round, the round is settled according to the game's rules when you return."],
    ["9. Responsible gambling", "Gambling should be entertainment, not a way to make money. Only play with money you can afford to lose and take regular breaks. If you would like to limit or close your account, or take a break, contact support. Free, confidential help is available from organisations such as Gambling Help Online, GamCare and Gamblers Anonymous."],
    ["10. Closing accounts", "You may close your account at any time. We may suspend or close an account for breach of these terms, fraud, chargebacks, abuse or legal or regulatory reasons. Where an account is closed without breach, any withdrawable real balance will be returned to you."],
    ["11. Liability", "The Site is provided “as is”. To the extent permitted by law, we are not liable for indirect or consequential losses, or for losses caused by events outside our reasonable control, including blockchain network delays or failures."],
    ["12. Changes", "We may update these terms from time to time. The current version is always available on this page, and continued use of the Site after a change means you accept the updated terms."],
    ["13. Operator and governing law", "[Operator name, company registration number, registered address, gambling licence number and issuing authority, and governing law to be inserted before real-money deposits are accepted.]"],
  ];
  function termsBody() {
    return el("div", { class: "terms" }, el("p", { class: "muted" }, "Last updated 26 November 2026"), ...TERMS.map(([h, p]) => el("section", {}, el("h2", {}, h), el("p", {}, p))));
  }
  async function terms(view) { view.replaceChildren(head("📜", "Terms & Conditions", null), el("div", { class: "panel" }, termsBody())); }
  function termsModal() {
    const m = el("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === m) m.remove(); } },
      el("div", { class: "modal modal-wide", role: "dialog", "aria-modal": "true", "aria-label": "Terms & Conditions" },
        el("div", { class: "modal-head" }, el("h2", {}, "Terms & Conditions"), el("button", { type: "button", class: "icon-btn", "aria-label": "Close", onclick: () => m.remove() }, "✕")),
        el("div", { class: "modal-scroll" }, termsBody())));
    document.body.append(m);
  }

  /* ================= HISTORY ================= */
  async function historyPage(view) {
    const wrap = el("div", { class: "table-wrap" }, el("p", { class: "muted", style: { padding: "16px" } }, "Loading…"));
    view.replaceChildren(head("🧾", "Bet history", "Your last 40 transactions"), el("div", { class: "panel" }, wrap));
    try {
      const { rows } = await api("/api/history");
      const label = { bet: "Bet", win: "Win", deposit: "Deposit", withdraw: "Withdrawal", withdraw_refund: "Withdrawal refunded", cashback: "Cashback", fun_topup: "Fun reload" };
      wrap.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Time"), el("th", {}, "Mode"), el("th", {}, "Type"), el("th", {}, "Game"), el("th", { class: "num" }, "Amount"))),
        el("tbody", {}, rows.length ? rows.map((r) => el("tr", { class: ["win", "deposit", "cashback", "withdraw_refund"].includes(r.type) ? "won" : "" }, el("td", {}, when(r.at)), el("td", {}, el("span", { class: `mode-tag ${r.mode}` }, r.mode)), el("td", {}, label[r.type] || r.type), el("td", {}, r.game || "–"), el("td", { class: "num pay" }, `${["bet", "withdraw"].includes(r.type) ? "−" : "+"}${fmtUSD(r.amount)}`))) : el("tr", {}, el("td", { colspan: "5", class: "empty" }, "Nothing yet")))));
    } catch (e) { fail(e); }
  }

  window.CQPages = { wallet, bonus, terms, termsModal, history: historyPage, coinIcon };
})();
