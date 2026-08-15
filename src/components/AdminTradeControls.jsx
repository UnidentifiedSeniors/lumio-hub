import { useMemo, useState } from "react";

import ConfirmDialog from "./ConfirmDialog";
import { supabase } from "../lib/supabase";
import { formatLumioDate } from "../utils/datePreferences";

const STATUS_OPTIONS = ["all", "pending", "accepted", "completed", "declined", "cancelled"];

function formatChampions(champions) {
  const entries = Array.isArray(champions) ? champions : [];
  if (!entries.length) return [{ label: "No champion selected", meta: "No specific copy was included" }];
  return entries.map((champion) => {
    const trait = champion?.trait || (Array.isArray(champion?.traits) ? champion.traits.filter(Boolean).join(" · ") : "") || "Standard";
    return { label: champion?.name || "Unknown champion", meta: `${trait} trait` };
  });
}

function statusLabel(status) {
  return status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : "Pending";
}

function AdminTradeControls({ datePreferences, onUpdated, trades }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [reason, setReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const visibleTrades = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trades.filter((trade) => {
      const matchesStatus = filter === "all" || trade.status === filter;
      const terms = [trade.trade_code, trade.sender_name, trade.sender_username, trade.recipient_name, trade.recipient_username, ...formatChampions(trade.requested_champions).map((item) => item.label), ...formatChampions(trade.offered_champions).map((item) => item.label)];
      return matchesStatus && (!query || terms.some((term) => String(term || "").toLowerCase().includes(query)));
    }).slice(0, 40);
  }, [filter, search, trades]);

  const selectTrade = (trade) => {
    setSelectedTrade(trade);
    setReason("");
    setMessage(null);
  };

  const cancelTrade = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_cancel_pending_trade", {
      target_trade_id: cancelTarget.id,
      cancellation_reason: reason.trim() || null,
    });
    if (error) {
      setMessage({ type: "error", text: error.message || "Unable to cancel this pending trade." });
    } else {
      setMessage({ type: "success", text: `Trade ${cancelTarget.trade_code ? `#${cancelTarget.trade_code}` : "offer"} was cancelled and logged. Both traders receive the normal Lumio update.` });
      setSelectedTrade((current) => current?.id === cancelTarget.id ? { ...current, status: "cancelled", admin_note: reason.trim() || null, admin_cancelled_at: new Date().toISOString() } : current);
      setReason("");
      await onUpdated();
    }
    setBusy(false);
    setCancelTarget(null);
  };

  return (
    <section className="admin-panel admin-trade-controls">
      <div className="admin-panel-heading"><div><p className="eyebrow">Trade oversight</p><h2>Marketplace activity</h2></div><span className="admin-trade-count">{trades.length} recent trades</span></div>
      <p className="admin-panel-copy">Review every current trade without entering either player’s private workspace. For safety, administrator cancellation is available only while an offer is pending—accepted exchanges still require both traders to confirm in-game completion.</p>

      <div className="admin-trade-filters"><div className="admin-status-filter" role="group" aria-label="Trade status filter">{STATUS_OPTIONS.map((status) => <button aria-pressed={filter === status} key={status} onClick={() => setFilter(status)} type="button">{status === "all" ? "All" : statusLabel(status)}</button>)}</div><label><span>Search trades</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Trade code, trader, or champion" type="search" value={search} /></label></div>

      <div className="admin-trade-layout">
        <div className="admin-trade-list">{visibleTrades.length ? visibleTrades.map((trade) => <button aria-pressed={selectedTrade?.id === trade.id} key={trade.id} onClick={() => selectTrade(trade)} type="button"><span className={`admin-trade-status is-${trade.status || "pending"}`}>{statusLabel(trade.status)}</span><span><strong>{trade.trade_code ? `#${trade.trade_code}` : "Trade offer"}</strong><small>{trade.sender_name} → {trade.recipient_name || "Open recipient"}</small></span><time dateTime={trade.updated_at}>{formatLumioDate(trade.updated_at, datePreferences)}</time></button>) : <p className="admin-empty-copy">No trades match the current filters.</p>}</div>

        <div className="admin-trade-detail">{selectedTrade ? <>
          <div className="admin-trade-detail-heading"><div><span className={`admin-trade-status is-${selectedTrade.status || "pending"}`}>{statusLabel(selectedTrade.status)}</span><strong>{selectedTrade.trade_code ? `Trade #${selectedTrade.trade_code}` : "Trade offer"}</strong></div><time dateTime={selectedTrade.created_at}>Created {formatLumioDate(selectedTrade.created_at, datePreferences, { forceTime: true })}</time></div>
          <div className="admin-trader-pair"><span><small>Sender</small><strong>{selectedTrade.sender_name}</strong><em>{selectedTrade.sender_username ? `@${selectedTrade.sender_username}` : "Discord member"}</em></span><span><small>Recipient</small><strong>{selectedTrade.recipient_name || "Open recipient"}</strong><em>{selectedTrade.recipient_username ? `@${selectedTrade.recipient_username}` : "—"}</em></span></div>
          <div className="admin-champion-columns"><div><small>Requested</small>{formatChampions(selectedTrade.requested_champions).map((champion, index) => <article key={`${champion.label}-${index}`}><strong>{champion.label}</strong><span>{champion.meta}</span></article>)}</div><div><small>Offering</small>{formatChampions(selectedTrade.offered_champions).map((champion, index) => <article key={`${champion.label}-${index}`}><strong>{champion.label}</strong><span>{champion.meta}</span></article>)}</div></div>
          {selectedTrade.status === "accepted" && <p className="admin-trade-safety-copy">Both-party confirmation remains active. Do not use moderation to mark this exchange complete.</p>}
          {selectedTrade.admin_cancelled_at && <p className="admin-trade-resolution"><strong>Admin resolution</strong>{selectedTrade.admin_note || "Cancelled by Lumio moderation."}</p>}
          {selectedTrade.status === "pending" && <div className="admin-trade-cancel"><label><span>Cancellation note <em>optional</em></span><input maxLength="300" onChange={(event) => setReason(event.target.value)} placeholder="Explain the moderation decision…" value={reason} /></label><button className="danger-action" onClick={() => setCancelTarget(selectedTrade)} type="button">Cancel pending trade</button></div>}
        </> : <div className="admin-member-empty"><strong>Select a trade</strong><p>Choose a record to see both sides of the offer and its current coordination state.</p></div>}
        {message && <p className={message.type === "success" ? "inline-success" : "inline-error"} role={message.type === "success" ? "status" : "alert"}>{message.text}</p>}</div>
      </div>

      {cancelTarget && <ConfirmDialog busy={busy} cancelLabel="Keep trade open" confirmLabel="Cancel pending trade" danger description={`Cancel ${cancelTarget.trade_code ? `trade #${cancelTarget.trade_code}` : "this pending offer"}? This cannot complete, transfer, or award XP; it only closes the pending offer and records your moderation action.`} onCancel={() => setCancelTarget(null)} onConfirm={() => void cancelTrade()} title="Cancel pending trade?" />}
    </section>
  );
}

export default AdminTradeControls;
