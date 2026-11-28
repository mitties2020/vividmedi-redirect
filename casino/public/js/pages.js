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
    let coins = [], selected = null, minWithdraw = 20, dailyMax = 10000, dailyLeft = null;

    const wdForm = el("form", { class: "wd-form", novalidate: true },
      el("div", { class: "wd-row" }, CQ.field("Coin", wdCoin), CQ.field("Network", wdNet)),
      CQ.field("Your wallet address", wdAddr),
      el("label", { class: "field" }, el("span", { class: "field-label" }, el("span", {}, "Amount (USD)"), el("button", { type: "button", class: "auth-inline", onclick: () => { wdAmt.value = Math.floor(Math.min(state.bal.real, dailyLeft != null ? dailyLeft : dailyMax) * 100) / 100; est(); } }, "Max")), el("div", { class: "bet-row" }, el("span", { class: "coin-glyph" }, "$"), wdAmt)),
      wdEst, wdMsg, wdBtn,
      el("p", { class: "muted small" }, "Double-check the address and network — crypto sent to a wrong address can't be recovered."));

    function est() {
      const c = coins.find((x) => x.sym === wdCoin.value);
      const v = Number(wdAmt.value);
      wdEst.textContent = c && v > 0 ? `You'll receive ≈ ${fmtCrypto(v / c.usd)} ${c.sym} at ${fmtPrice(c.usd)} (live rate, fixed when you submit)` : `Minimum withdrawal ${fmtUSD(minWithdraw)} · maximum ${fmtUSD(dailyMax).replace(".00", "")} per 24 hours${dailyLeft != null && dailyLeft < dailyMax ? ` (${fmtUSD(dailyLeft)} left now)` : ""}`;
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

    let activeReq = null, reqTimer = 0, lockTimer = 0;
    const stopReq = () => { clearInterval(reqTimer); clearInterval(lockTimer); reqTimer = lockTimer = 0; };
    const copyable = (text, cls = "addr") => {
      const code = el("code", { class: cls }, text);
      const b = el("button", { type: "button", class: "btn btn-ghost btn-sm" }, "Copy");
      b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(text); b.textContent = "Copied ✓"; setTimeout(() => (b.textContent = "Copy"), 1500); } catch { const r = document.createRange(); r.selectNodeContents(code); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "Selected — press Ctrl+C"; } });
      return el("div", { class: "addr-row" }, code, b);
    };
    function pickDeposit(c, force) {
      if (activeReq && !force && activeReq.coin === c.sym) return;
      if (activeReq && activeReq.coin !== c.sym) { stopReq(); activeReq = null; }
      selected = c.sym;
      CQ.$$(".coin-card", coinGrid).forEach((b) => b.classList.toggle("on", b.dataset.sym === c.sym));
      if (!c.address) {
        depositPanel.replaceChildren(el("div", { class: "dep-head" }, coinIcon(c.sym), el("div", {}, el("h3", {}, `Deposit ${c.name}`))), el("div", { class: "addr-box soon" }, el("b", {}, "Deposit address coming soon"), el("span", {}, `${c.sym} deposits will open here shortly.`)));
        return;
      }
      const amt = el("input", { class: "bet-input", type: "number", min: "5", step: "1", placeholder: "50", inputmode: "decimal", "aria-label": "Deposit amount in US dollars" });
      const conv = el("p", { class: "wd-est" }, `Minimum $5 · 1 ${c.sym} = ${fmtPrice(c.usd)}`);
      const msg = el("p", { class: "auth-msg", role: "alert" });
      const go = el("button", { type: "submit", class: "btn btn-gold btn-lg btn-block" }, "Get my deposit amount");
      const upd = () => { const v = Number(amt.value); conv.textContent = v > 0 ? `≈ ${fmtCrypto(v / c.usd)} ${c.sym} · minimum $5` : `Minimum $5 · 1 ${c.sym} = ${fmtPrice(c.usd)}`; };
      amt.addEventListener("input", upd);
      const form = el("form", { class: "dep-form", novalidate: true },
        el("label", { class: "field" }, el("span", { class: "field-label" }, "How much do you want to deposit? (USD)"), el("div", { class: "bet-row" }, el("span", { class: "coin-glyph" }, "$"), amt)),
        el("div", { class: "sb-quick" }, [20, 50, 100, 250, 500].map((v) => el("button", { type: "button", class: "chip-btn", onclick: () => { amt.value = v; upd(); } }, `$${v}`))),
        conv, msg, go);
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); msg.textContent = ""; go.disabled = true;
        try { const r = await api("/api/deposit/start", { coin: c.sym, usd: Number(amt.value) }); showRequest(c, r); }
        catch (err) { msg.className = "auth-msg error"; msg.textContent = err.message; go.disabled = false; }
      });
      depositPanel.replaceChildren(
        el("div", { class: "dep-head" }, coinIcon(c.sym), el("div", {}, el("h3", {}, `Deposit ${c.name}`), el("p", { class: "muted" }, `${c.nets[0]} · credited automatically`))),
        form,
        el("ul", { class: "dep-notes" },
          el("li", {}, "You'll get an exact amount to send. We spot it on the blockchain within seconds and add it to your balance — no confirmations to wait for."),
          el("li", {}, "Withdrawals unlock once your deposit has 1 confirmation, and each deposit must be wagered 1×."),
          el("li", {}, "Sent crypto without starting a deposit here? Email support@carequay.com with your account email and the transaction ID.")));
    }
    function showRequest(c, r) {
      stopReq();
      activeReq = { ...r, coin: c.sym };
      const status = el("div", { class: "dep-status wait" }, el("span", { class: "spinner" }), el("div", {}, el("b", {}, "Waiting for your transaction…"), el("small", {}, "This updates by itself — keep this page open or come back later.")));
      const lock = el("small", { class: "muted" });
      const lockedUntil = new Date(r.lockedUntil).getTime();
      const tickLock = () => { const ms = lockedUntil - Date.now(); lock.textContent = ms > 0 ? `Rate locked at ${fmtPrice(r.price)} for ${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}. After that it's credited at the live rate.` : "Rate lock ended — your deposit will be credited at the live rate when it arrives."; };
      tickLock(); lockTimer = setInterval(tickLock, 1000);
      depositPanel.replaceChildren(
        el("div", { class: "dep-head" }, coinIcon(c.sym), el("div", {}, el("h3", {}, `Send exactly ${r.amount} ${c.sym}`), el("p", { class: "muted" }, `≈ ${fmtUSD(r.usd)} · ${r.network}`))),
        el("div", { class: "addr-box exact" }, el("small", {}, "1. Amount — send this exact amount"), copyable(r.amount, "addr big-amt")),
        el("div", { class: "addr-box" }, el("small", {}, `2. To this ${c.sym} address · ${r.network}`), copyable(r.address), el("span", { class: "addr-warn" }, `Send only ${c.sym} on the ${r.network} network. If your exchange takes its fee out of the amount, add the fee on top so exactly ${r.amount} arrives.`)),
        status, lock,
        el("button", { type: "button", class: "auth-inline dep-new", onclick: () => { stopReq(); activeReq = null; pickDeposit(c, true); } }, "Start a different deposit"));
      const poll = async () => {
        try {
          const d = await api(`/api/deposit/${r.id}`);
          if (d.status === "credited" || d.status === "unconfirmed") {
            stopReq(); activeReq = null;
            status.className = "dep-status ok";
            status.replaceChildren(el("span", { class: "dep-tick" }, "✓"), el("div", {}, el("b", {}, `${fmtUSD(d.usd)} added to your balance`), el("small", {}, d.status === "unconfirmed" ? "You can play now. Withdrawals unlock once it has 1 confirmation." : "Confirmed — you're all set.")));
            lock.textContent = ""; loadHistory(); window.CQSound && CQSound.play("win");
          } else if (d.status === "expired") { stopReq(); status.className = "dep-status err"; status.replaceChildren(el("div", {}, el("b", {}, "This deposit request expired"), el("small", {}, "If you sent it, email support@carequay.com with the transaction ID."))); }
        } catch { /* keep polling */ }
      };
      reqTimer = setInterval(poll, 6000); poll();
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
        if (!selected) pickDeposit(coins[0]); else if (!activeReq) pickDeposit(coins.find((c) => c.sym === selected));
        est();
      } catch (err) { coinGrid.replaceChildren(el("p", { class: "muted" }, err.message)); }
    }
    async function loadHistory() {
      try {
        const w = await api("/api/wallet");
        const open = !activeReq && w.deposits.find((d) => d.status === "awaiting" && Date.now() - new Date(d.created_at).getTime() < 3600e3);
        if (open && coins.length) { const c = coins.find((x) => x.sym === open.coin); if (c) { selected = c.sym; CQ.$$(".coin-card", coinGrid).forEach((b) => b.classList.toggle("on", b.dataset.sym === c.sym)); showRequest(c, { id: open.id, amount: Number(open.amount).toFixed(c.sym === "TRX" ? 6 : 8), usd: open.usd, price: open.price, address: c.address, network: c.nets[0], lockedUntil: new Date(new Date(open.created_at).getTime() + 3600e3).toISOString() }); } }
        minWithdraw = w.minWithdraw; if (w.dailyMax) dailyMax = w.dailyMax; if (w.dailyLeft != null) dailyLeft = w.dailyLeft; est();
        const table = (rows, cols, empty) => el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, cols.map((c) => el("th", { class: c.num ? "num" : "" }, c.h)))), el("tbody", {}, rows.length ? rows.map((r) => el("tr", {}, cols.map((c) => el("td", { class: c.num ? "num" : "" }, c.v(r))))) : el("tr", {}, el("td", { colspan: String(cols.length), class: "empty" }, empty))));
        histDep.replaceChildren(table(w.deposits, [{ h: "Date", v: (r) => when(r.created_at) }, { h: "Coin", v: (r) => r.coin }, { h: "Amount", num: 1, v: (r) => `${fmtCrypto(r.amount)} ${r.coin}` }, { h: "Credited", num: 1, v: (r) => (r.status === "credited" || r.status === "unconfirmed" ? fmtUSD(r.usd) : "–") }, { h: "Status", v: (r) => { const m = { credited: ["paid", "credited"], unconfirmed: ["paid", "credited · confirming"], awaiting: ["pending", "waiting"], processing: ["pending", "pending"], expired: ["rejected", "expired"] }[r.status] || [r.status, r.status]; return el("span", { class: `status st-${m[0]}` }, m[1]); } }], "No deposits yet"));
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
        el("div", { class: "panel" }, el("h2", {}, "Withdraw"), el("p", { class: "fast-note" }, "⚡ Fast withdrawals, usually processed in under 10 minutes."), wdForm)),
      el("section", { class: "panel" }, el("h2", {}, "Withdrawals"), histWd),
      el("section", { class: "panel" }, el("h2", {}, "Deposits"), histDep));
    loadPrices().then(() => loadHistory());
    const t = setInterval(loadPrices, 60000);
    return () => { clearInterval(t); stopReq(); off(); };
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
  const TERMS = window.CQTerms.TERMS;

  function termsBody() {
    return el("div", { class: "terms" }, el("p", { class: "muted" }, `Last updated ${window.CQTerms.UPDATED}`), ...TERMS.map(([h, p]) => el("section", {}, el("h2", {}, h), el("p", {}, p))));
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
      const label = { bet: "Bet", win: "Win", deposit: "Deposit", withdraw: "Withdrawal", withdraw_refund: "Withdrawal refunded", cashback: "Cashback", referral: "Referral earnings", fun_topup: "Fun reload" };
      wrap.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Time"), el("th", {}, "Mode"), el("th", {}, "Type"), el("th", {}, "Game"), el("th", { class: "num" }, "Amount"))),
        el("tbody", {}, rows.length ? rows.map((r) => el("tr", { class: ["win", "deposit", "cashback", "withdraw_refund"].includes(r.type) ? "won" : "" }, el("td", {}, when(r.at)), el("td", {}, el("span", { class: `mode-tag ${r.mode}` }, r.mode)), el("td", {}, label[r.type] || r.type), el("td", {}, r.game || "–"), el("td", { class: "num pay" }, `${["bet", "withdraw"].includes(r.type) ? "−" : "+"}${fmtUSD(r.amount)}`))) : el("tr", {}, el("td", { colspan: "5", class: "empty" }, "Nothing yet")))));
    } catch (e) { fail(e); }
  }

  /* ================= INVITE (referrals) ================= */
  async function invite(view) {
    const linkIn = el("input", { class: "text-in boxed ref-link", readonly: true, value: "Loading…", "aria-label": "Your invite link" });
    const copyBtn = el("button", { type: "button", class: "btn btn-gold" }, "Copy link");
    const shareRow = el("div", { class: "ref-share" });
    const stats = el("div", { class: "cb-stats" });
    const hist = el("div", { class: "table-wrap" });
    const tgPanel = el("section", { class: "panel tg-panel", hidden: true });
    api("/api/telegram/link", null, null, { noBalance: true }).then((t) => {
      if (!t.enabled || !t.url) return;
      tgPanel.hidden = false;
      tgPanel.replaceChildren(
        el("div", { class: "tg-ico" }, "✈️"),
        el("div", { class: "grow" }, el("h2", {}, t.linked ? "Telegram connected" : "Get alerts on Telegram"),
          el("p", { class: "muted" }, t.linked ? "You'll get a message when a bet settles, a deposit lands, a withdrawal is sent or you earn from referrals." : "Connect our Telegram bot to get bet results, deposit and withdrawal alerts, and your invite link on the go.")),
        el("div", { class: "tg-actions" },
          el("a", { class: "btn btn-gold", href: t.url, target: "_blank", rel: "noopener" }, t.linked ? "Reconnect" : "Connect Telegram"),
          t.channel ? el("a", { class: "btn btn-ghost", href: `https://t.me/${String(t.channel).replace(/^@/, "")}`, target: "_blank", rel: "noopener" }, "Join our channel") : null));
    }).catch(() => {});
    view.replaceChildren(
      head("🤝", "Invite friends", "Earn 10% of your friends' weekly net losses — paid every Sunday."),
      el("section", { class: "cb-hero ref-hero" },
        el("div", {}, el("p", { class: "hero-kicker" }, "Refer & earn"), el("h2", {}, el("span", {}, "10%"), " every week"), el("p", {}, "Share your link. When friends sign up through it, you get 10% of their net real-money losses for every cashback week, paid to your real balance with no wagering requirement.")),
        el("div", { class: "ref-box" }, el("small", {}, "Your invite link"), el("div", { class: "ref-row" }, linkIn, copyBtn), shareRow)),
      stats,
      tgPanel,
      el("section", { class: "panel" }, el("h2", {}, "How it works"), el("ol", { class: "how" },
        el("li", {}, "Share your link anywhere — Telegram, Discord, X, WhatsApp."),
        el("li", {}, "Friends who open it and sign up within 30 days are linked to you."),
        el("li", {}, "Each week (Sunday 10:00 pm UTC to Sunday 10:00 pm UTC) we add up each friend's real-money bets minus winnings."),
        el("li", {}, "If a friend finishes the week down, 10% of that loss is added to your real balance. There's no limit on how many friends you invite."))),
      el("section", { class: "panel" }, el("h2", {}, "Earnings history"), hist));
    copyBtn.addEventListener("click", async () => { try { await navigator.clipboard.writeText(linkIn.value); copyBtn.textContent = "Copied ✓"; setTimeout(() => (copyBtn.textContent = "Copy link"), 1600); } catch { linkIn.select(); } });
    try {
      const r = await api("/api/referral");
      linkIn.value = r.link;
      const text = encodeURIComponent("Join me on CareQuay — no-KYC crypto casino & sportsbook with 20% weekly cashback:");
      const u = encodeURIComponent(r.link);
      shareRow.replaceChildren(...[
        el("a", { class: "btn btn-ghost btn-sm", href: `https://t.me/share/url?url=${u}&text=${text}`, target: "_blank", rel: "noopener" }, "Telegram"),
        el("a", { class: "btn btn-ghost btn-sm", href: `https://twitter.com/intent/tweet?url=${u}&text=${text}`, target: "_blank", rel: "noopener" }, "X"),
        el("a", { class: "btn btn-ghost btn-sm", href: `https://wa.me/?text=${text}%20${u}`, target: "_blank", rel: "noopener" }, "WhatsApp"),
        navigator.share ? el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => navigator.share({ title: "CareQuay Casino", url: r.link }).catch(() => {}) }, "More…") : null].filter(Boolean));
      stats.replaceChildren(...[["Friends invited", String(r.invited)], ["Total earned", fmtUSD(r.earned)], ["Your share", `${Math.round(r.rate * 100)}%`], ["Next payout", new Date(r.nextPayout).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })]].map(([k, v], i) => el("div", { class: `cb-stat${i === 1 ? " hl" : ""}` }, el("small", {}, k), el("b", {}, v))));
      hist.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Week starting"), el("th", {}, "Friends"), el("th", { class: "num" }, "Earned"))),
        el("tbody", {}, r.weeks.length ? r.weeks.map((w) => el("tr", {}, el("td", {}, new Date(w.week).toLocaleDateString()), el("td", {}, String(w.players)), el("td", { class: "num pay" }, fmtUSD(w.amount)))) : el("tr", {}, el("td", { colspan: "3", class: "empty" }, "No referral earnings yet — share your link to start.")))));
    } catch (e) { fail(e); }
  }

  /* ================= HELP & FAQ ================= */
  function faq(view) {
    const q = el("input", { class: "text-in boxed faq-search", type: "search", placeholder: "Search help — e.g. withdraw, cashback, handicap", "aria-label": "Search help" });
    const body = el("div", { class: "faq" });
    const paint = () => {
      const t = q.value.trim().toLowerCase();
      const cats = window.CQFaq.FAQ.map((c) => ({ ...c, items: c.items.filter(([a, b]) => !t || (a + " " + b).toLowerCase().includes(t)) })).filter((c) => c.items.length);
      body.replaceChildren(...(cats.length ? cats.map((c) => el("section", { class: "panel faq-cat" }, el("h2", {}, el("span", { class: "faq-ico" }, c.icon), c.cat),
        ...c.items.map(([a, b]) => el("details", { class: "faq-item", open: !!t }, el("summary", {}, a), el("p", {}, b))))) : [el("p", { class: "muted" }, "No answers match that search.")]));
    };
    q.addEventListener("input", paint);
    view.replaceChildren(head("❓", "Help & FAQ", "Answers about your account, deposits, withdrawals, bonuses, games and the sportsbook."), q, body,
      el("p", { class: "muted small faq-foot" }, "Still stuck? Email ", el("a", { href: "mailto:support@carequay.com" }, "support@carequay.com"), " or see the ", el("a", { href: "#/terms" }, "Terms & Conditions"), "."));
    paint();
  }

  window.CQPages = { wallet, bonus, terms, termsModal, history: historyPage, coinIcon, invite, faq };
})();
