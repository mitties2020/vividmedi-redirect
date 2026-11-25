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
    }
    view.replaceChildren(
      el("div", { class: "page-head" }, el("span", { class: "section-icon" }, "🔐"), el("div", {}, el("h1", {}, "Admin"), el("p", {}, "Credit deposits and pay out withdrawals."))),
      el("section", { class: "panel adm-bar" }, tokenIn, el("button", { class: "btn btn-primary", type: "button", onclick: load }, "Load")),
      el("section", { class: "panel" }, el("h2", {}, "Credit a deposit"), el("p", { class: "muted small" }, "When a deposit arrives in your wallet, add it to the player's balance here. It's converted to US dollars at the live rate."), creditForm),
      el("section", { class: "panel" }, el("h2", {}, "Pending withdrawals"), el("p", { class: "muted small" }, "Send the crypto from your wallet, then mark it paid."), wdWrap));
    if (tokenIn.value) load();
  }
  CQPages.admin = admin;
})();
