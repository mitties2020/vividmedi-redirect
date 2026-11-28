/* CareQuay Casino — owner admin page (#/admin). Requires the ADMIN_TOKEN set on the server. */
(() => {
  "use strict";
  const { el, fmtUSD, toast } = CQ;
  const KEY = "cq-admin-token";
  async function call(path, body) {
    const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "x-admin-token": sessionStorage.getItem(KEY) || "", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    return d;
  }
  const when = (d) => new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

  async function admin(view) {
    const tokenIn = el("input", { class: "text-in boxed", type: "password", placeholder: "Admin token", value: sessionStorage.getItem(KEY) || "" });
    const wdWrap = el("div", { class: "table-wrap" });
    const spWrap = el("div", { class: "adm-sports" }), spStatus = el("p", { class: "muted small" });
    const cEmail = el("input", { class: "text-in boxed", type: "email", placeholder: "Player email" });
    const cCoin = el("select", { class: "boxed" }, ["BTC", "ETH", "LTC", "BNB", "TRX"].map((c) => el("option", { value: c }, c)));
    const cAmt = el("input", { class: "text-in boxed", type: "number", step: "any", min: "0", placeholder: "Amount in coin" });
    const creditForm = el("form", { class: "adm-bar" }, cEmail, cCoin, cAmt, el("button", { class: "btn btn-primary", type: "submit" }, "Credit"));
    creditForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!confirm(`Credit ${cAmt.value} ${cCoin.value} to ${cEmail.value.trim()} at the live USD rate?`)) return;
      try { sessionStorage.setItem(KEY, tokenIn.value.trim()); const r = await call("/api/admin/deposit", { email: cEmail.value.trim(), coin: cCoin.value, amount: Number(cAmt.value) }); toast(`Credited ${fmtUSD(r.credited)} to ${cEmail.value.trim()}`, "win"); cAmt.value = ""; }
      catch (err) { toast(err.message, "warn"); }
    });
    async function load() {
      sessionStorage.setItem(KEY, tokenIn.value.trim());
      try {
        const { withdrawals } = await call("/api/admin/withdrawals?status=pending");
        wdWrap.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, ["When", "Player", "Send", "To address", ""].map((h) => el("th", {}, h)))),
          el("tbody", {}, withdrawals.length ? withdrawals.map((w) => {
            return el("tr", {}, el("td", {}, when(w.created_at)), el("td", {}, w.email), el("td", {}, `${Number(w.crypto_amount).toPrecision(8)} ${w.coin} (${fmtUSD(w.usd)}) · ${w.network || ""}`), el("td", {}, el("code", { class: "adm-tx" }, w.address)),
              el("td", { class: "adm-act" },
                el("button", { class: "btn btn-primary btn-sm", type: "button", onclick: async () => { if (!confirm("Mark this withdrawal as paid? Only do this after you've sent the crypto.")) return; try { await call(`/api/admin/withdrawals/${w.id}`, { status: "paid" }); load(); } catch (e) { toast(e.message, "warn"); } } }, "Mark paid"),
                el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: async () => { if (!confirm("Reject and refund this withdrawal to the player's balance?")) return; try { await call(`/api/admin/withdrawals/${w.id}`, { status: "rejected" }); load(); } catch (e) { toast(e.message, "warn"); } } }, "Reject")));
          }) : el("tr", {}, el("td", { colspan: "5", class: "empty" }, "No pending withdrawals")))));
      } catch (e) { wdWrap.replaceChildren(el("p", { class: "muted", style: { padding: "14px" } }, e.message)); }
      loadSports();
    }
    async function loadSports() {
      try {
        const r = await call("/api/admin/sports");
        const c = r.status.credits;
        spStatus.textContent = !r.status.enabled ? "Odds feed is off — set ODDS_API_KEY on the server." : `Odds API credits left: ${c ? c.remaining : "not used yet"}${c ? ` (checked ${when(c.at)})` : ""} · used today: ${r.status.spend && r.status.spend.day === new Date().toISOString().slice(0, 10) ? r.status.spend.used : 0} · margin ${Math.round(r.status.config.margin * 100)}%`;
        if (!r.events.length) { spWrap.replaceChildren(el("p", { class: "muted", style: { padding: "6px 2px" } }, "No open sports bets.")); return; }
        spWrap.replaceChildren(...r.events.map((e) => {
          const hs = el("input", { class: "text-in boxed adm-score", type: "number", min: "0", step: "1", placeholder: e.home.split(" ").slice(-1)[0] });
          const as = el("input", { class: "text-in boxed adm-score", type: "number", min: "0", step: "1", placeholder: e.away.split(" ").slice(-1)[0] });
          const started = new Date(e.commence) < new Date();
          const go = async (result, label) => {
            if (!confirm(`Settle ${e.home} v ${e.away} as: ${label}${hs.value !== "" ? ` (${hs.value}–${as.value})` : ""}? This pays out and can't be undone.`)) return;
            try { const x = await call("/api/admin/sports/settle", { eventId: e.eventId, result, homeScore: hs.value, awayScore: as.value }); toast(`Settled ${x.settled} bet${x.settled === 1 ? "" : "s"}${x.skipped ? ` · ${x.skipped} need the final score` : ""}`, "win"); loadSports(); }
            catch (err) { toast(err.message, "warn"); }
          };
          return el("div", { class: "adm-ev" },
            el("div", { class: "adm-ev-head" }, el("b", {}, `${e.home} v ${e.away}`), el("span", { class: "muted small" }, `${e.league} · ${when(e.commence)}${started ? "" : " · not started"}`)),
            el("p", { class: "small" }, `${e.bets} open bet${e.bets === 1 ? "" : "s"} · staked ${fmtUSD(e.staked)} · potential payouts: `, Object.entries(e.liability).map(([k, v]) => `${k} ${fmtUSD(v)}`).join(" · ")),
            el("div", { class: "adm-bar" },
              el("label", { class: "small muted" }, "Final score"), hs, el("span", {}, "–"), as,
              el("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !started, onclick: () => go("home", `${e.home} won`) }, `${e.home.split(" ").slice(-1)[0]} won`),
              e.draw ? el("button", { class: "btn btn-ghost btn-sm", type: "button", disabled: !started, onclick: () => go("draw", "Draw") }, "Draw") : null,
              el("button", { class: "btn btn-primary btn-sm", type: "button", disabled: !started, onclick: () => go("away", `${e.away} won`) }, `${e.away.split(" ").slice(-1)[0]} won`),
              el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => go("void", "VOID (refund all)") }, "Void")),
            e.needsScores ? el("p", { class: "muted small" }, "Handicap bets on this match need the final score entered.") : null);
        }));
      } catch (err) { spWrap.replaceChildren(el("p", { class: "muted" }, err.message)); }
    }
    view.replaceChildren(
      el("div", { class: "page-head" }, el("span", { class: "section-icon" }, "🔐"), el("div", {}, el("h1", {}, "Admin"), el("p", {}, "Credit deposits, pay out withdrawals and settle sports bets."))),
      el("section", { class: "panel adm-bar" }, tokenIn, el("button", { class: "btn btn-primary", type: "button", onclick: load }, "Load")),
      el("section", { class: "panel" }, el("h2", {}, "Credit a deposit"), el("p", { class: "muted small" }, "When a deposit arrives in your wallet, add it to the player's balance here. It's converted to US dollars at the live rate."), creditForm),
      el("section", { class: "panel" }, el("h2", {}, "Pending withdrawals"), el("p", { class: "muted small" }, "Send the crypto from your wallet, then mark it paid."), wdWrap),
      el("section", { class: "panel" }, el("h2", {}, "Sports bets to settle"), el("p", { class: "muted small" }, "Soccer and basketball settle automatically from final scores. Tennis and cricket (and anything the feed misses) are settled here once the match is over."), spStatus, spWrap));
    if (tokenIn.value) load();
  }
  CQPages.admin = admin;
})();
