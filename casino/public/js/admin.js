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
    const depWrap = el("div", { class: "table-wrap" }), wdWrap = el("div", { class: "table-wrap" });
    async function load() {
      sessionStorage.setItem(KEY, tokenIn.value.trim());
      try {
        const [{ deposits }, { withdrawals }] = await Promise.all([call("/api/admin/deposits?status=pending"), call("/api/admin/withdrawals?status=pending")]);
        depWrap.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, ["When", "Player", "Coin", "Amount", "Transaction", ""].map((h) => el("th", {}, h)))),
          el("tbody", {}, deposits.length ? deposits.map((d) => {
            const amt = el("input", { class: "text-in boxed adm-amt", type: "number", step: "any", value: String(d.amount) });
            return el("tr", {}, el("td", {}, when(d.created_at)), el("td", {}, d.email), el("td", {}, d.coin), el("td", {}, amt), el("td", {}, el("code", { class: "adm-tx" }, d.txid || "–")),
              el("td", { class: "adm-act" },
                el("button", { class: "btn btn-primary btn-sm", type: "button", onclick: async () => { if (!confirm(`Credit ${amt.value} ${d.coin} to ${d.email} at the live USD rate?`)) return; try { const r = await call(`/api/admin/deposits/${d.id}`, { status: "credited", amount: Number(amt.value) }); toast(`Credited ${fmtUSD(r.credited)}`, "win"); load(); } catch (e) { toast(e.message, "warn"); } } }, "Credit"),
                el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: async () => { if (!confirm("Reject this deposit claim?")) return; try { await call(`/api/admin/deposits/${d.id}`, { status: "rejected" }); load(); } catch (e) { toast(e.message, "warn"); } } }, "Reject")));
          }) : el("tr", {}, el("td", { colspan: "6", class: "empty" }, "No pending deposits")))));
        wdWrap.replaceChildren(el("table", { class: "bets-table" }, el("thead", {}, el("tr", {}, ["When", "Player", "Send", "To address", ""].map((h) => el("th", {}, h)))),
          el("tbody", {}, withdrawals.length ? withdrawals.map((w) => {
            const tx = el("input", { class: "text-in boxed adm-amt", type: "text", placeholder: "Payout tx ID" });
            return el("tr", {}, el("td", {}, when(w.created_at)), el("td", {}, w.email), el("td", {}, `${Number(w.crypto_amount).toPrecision(8)} ${w.coin} (${fmtUSD(w.usd)}) · ${w.network || ""}`), el("td", {}, el("code", { class: "adm-tx" }, w.address)),
              el("td", { class: "adm-act" }, tx,
                el("button", { class: "btn btn-primary btn-sm", type: "button", onclick: async () => { if (!confirm("Mark this withdrawal as paid? Only do this after you've sent the crypto.")) return; try { await call(`/api/admin/withdrawals/${w.id}`, { status: "paid", txid: tx.value.trim() || null }); load(); } catch (e) { toast(e.message, "warn"); } } }, "Mark paid"),
                el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: async () => { if (!confirm("Reject and refund this withdrawal to the player's balance?")) return; try { await call(`/api/admin/withdrawals/${w.id}`, { status: "rejected" }); load(); } catch (e) { toast(e.message, "warn"); } } }, "Reject")));
          }) : el("tr", {}, el("td", { colspan: "5", class: "empty" }, "No pending withdrawals")))));
      } catch (e) { depWrap.replaceChildren(el("p", { class: "muted", style: { padding: "14px" } }, e.message)); wdWrap.replaceChildren(); }
    }
    view.replaceChildren(
      el("div", { class: "page-head" }, el("span", { class: "section-icon" }, "🔐"), el("div", {}, el("h1", {}, "Admin"), el("p", {}, "Credit deposits and pay out withdrawals."))),
      el("section", { class: "panel adm-bar" }, tokenIn, el("button", { class: "btn btn-primary", type: "button", onclick: load }, "Load")),
      el("section", { class: "panel" }, el("h2", {}, "Pending deposits"), el("p", { class: "muted small" }, "Check each transaction in your wallet or a block explorer before crediting. You can correct the amount first."), depWrap),
      el("section", { class: "panel" }, el("h2", {}, "Pending withdrawals"), el("p", { class: "muted small" }, "Send the crypto from your wallet, then mark it paid."), wdWrap));
    if (tokenIn.value) load();
  }
  CQPages.admin = admin;
})();
