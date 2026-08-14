import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ConfirmDialog from "../components/ConfirmDialog";
import Layout from "../components/Layout";
import TradeCompletionConfirmation from "../components/TradeCompletionConfirmation";
import TradeDetailsModal, { TradeChampionList } from "../components/TradeDetailsModal";

import { supabase } from "../lib/supabase";
import useAuth from "../context/useAuth";
import { readBooleanPreference, saveBooleanPreference } from "../utils/clientPreferences";
import { getDatePreferences } from "../utils/datePreferences";
import { formatDateTime } from "../utils/marketplace";
import { filterTradeActivity, TRADE_OUTCOME_FILTERS } from "../utils/tradeActivityVisibility";
import { hasTwoPartyConfirmation } from "../utils/tradeCompletion";

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

function PendingTrades() {
  const { user, profile, refreshProfile } = useAuth();
  const datePreferences = getDatePreferences(profile);

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [recipients, setRecipients] = useState({});
  const [detailsTrade, setDetailsTrade] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const cancelledPreferenceKey = user?.id ? `lumio-sent-trades-hide-cancelled:${user.id}` : "";
  const completedPreferenceKey = user?.id ? `lumio-sent-trades-hide-completed:${user.id}` : "";
  const [hideCancelled, setHideCancelled] = useState(() => readBooleanPreference(cancelledPreferenceKey));
  const [hideCompleted, setHideCompleted] = useState(() => readBooleanPreference(completedPreferenceKey));
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  useEffect(() => {
    if (!user) return undefined;

    let active = true;

    supabase
      .from("trades")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("TRADE FETCH ERROR:", error);
        } else {
          setTrades(data || []);
          const recipientIds = [...new Set((data || []).map((trade) => trade.recipient_id).filter(Boolean))];
          if (recipientIds.length) {
            const { data: profileData, error: profileError } = await supabase
              .from("public_profiles")
              .select("*")
              .in("id", recipientIds);
            if (active && !profileError) {
              setRecipients(Object.fromEntries((profileData || []).map((profile) => [profile.id, profile])));
            }
          }
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const cancelTrade = async () => {
    if (!cancelTarget) return;
    const tradeId = cancelTarget.id;
    setCancelling(tradeId);
    setError(null);

    const { error } = await supabase
      .from("trades")
      .update({ status: "cancelled" })
      .eq("id", tradeId)
      .eq("status", "pending"); // only pending trades can be cancelled

    if (error) {
      setError(error.message || "Unable to cancel that trade request.");
    } else {
      // Edge function (UPDATE trigger) edits the Discord message.
      setTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId ? { ...t, status: "cancelled" } : t
        )
      );
      setCancelTarget(null);
    }
    setCancelling(null);
  };

  const confirmExchange = async (trade) => {
    if (!user) return;
    const confirmationField = user.id === trade.sender_id ? "sender_confirmed_at" : "recipient_confirmed_at";

    setConfirmingId(trade.id);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("trades")
      .update({ [confirmationField]: new Date().toISOString() })
      .eq("id", trade.id)
      .eq("status", "accepted")
      .select("*")
      .maybeSingle();

    if (updateError || !data) {
      setError(updateError?.message || "This trade changed before your confirmation could be recorded. Refresh and try again.");
    } else {
      setTrades((current) => current.map((item) => item.id === trade.id ? data : item));
      if (data.status === "completed") await refreshProfile();
    }
    setConfirmingId(null);
  };

  const visibleTrades = filterTradeActivity(trades, outcomeFilter, { hideCancelled, hideCompleted });
  const completedTradeCount = trades.filter((trade) => trade.status === "completed").length;
  const cancelledTradeCount = trades.filter((trade) => trade.status === "cancelled").length;

  const toggleCancelledVisibility = () => {
    const next = !hideCancelled;
    setHideCancelled(next);
    saveBooleanPreference(cancelledPreferenceKey, next);
  };

  const toggleCompletedVisibility = () => {
    const next = !hideCompleted;
    setHideCompleted(next);
    saveBooleanPreference(completedPreferenceKey, next);
  };

  const hiddenOutcomes = [hideCompleted && "completed", hideCancelled && "cancelled"].filter(Boolean);

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Private offers</p>
        <h1>Sent Trades</h1>
        <p>Track the offers you have sent directly to other traders.</p>
      </section>

      {(completedTradeCount > 0 || cancelledTradeCount > 0) && (
        <section className="activity-filter-toolbar history-toolbar" aria-label="Sent trade filters">
          <div>
            <p className="eyebrow">Trade activity</p>
            <h2>{visibleTrades.length} {visibleTrades.length === 1 ? "offer" : "offers"}</h2>
          </div>
          <div className="history-filters" role="group" aria-label="Filter sent trades by outcome">
            {TRADE_OUTCOME_FILTERS.map((option) => (
              <button aria-pressed={outcomeFilter === option.key} className={outcomeFilter === option.key ? "active" : ""} key={option.key} onClick={() => setOutcomeFilter(option.key)} type="button">{option.label}</button>
            ))}
          </div>
        </section>
      )}

      {(completedTradeCount > 0 || cancelledTradeCount > 0) && (
        <section className="activity-visibility-bar">
          <span>{hiddenOutcomes.length ? `${hiddenOutcomes.join(" and ")} trades are hidden from your default view. Outcome filters still let you review them.` : "Hide completed or cancelled activity from your default view without deleting its record."}</span>
          <div className="activity-visibility-actions">
            {completedTradeCount > 0 && <button aria-pressed={hideCompleted} className="activity-visibility-control" onClick={toggleCompletedVisibility} type="button">{hideCompleted ? "Show completed" : "Hide completed"}</button>}
            {cancelledTradeCount > 0 && <button aria-pressed={hideCancelled} className="activity-visibility-control" onClick={toggleCancelledVisibility} type="button">{hideCancelled ? "Show cancelled" : "Hide cancelled"}</button>}
          </div>
        </section>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading sent trades...</p>
      ) : visibleTrades.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">↑</span>
          <h2>{trades.length ? "No offers match this view" : "No sent trades yet"}</h2>
          <p>{trades.length ? "Use a different outcome filter, or show hidden activity from the controls above." : "Your direct offers and their current status will appear here."}</p>
          {trades.length && outcomeFilter !== "all" && <button className="secondary-action" onClick={() => setOutcomeFilter("all")} type="button">Return to default view</button>}
        </section>
      ) : (
        <section className="trade-list">
          {visibleTrades.map((trade) => {
          const requested = trade.requested_champions?.length
            ? trade.requested_champions
            : (trade.requested_champion ? [trade.requested_champion] : []);
          const offered = trade.offered_champions || [];
          const code = trade.trade_code ? `#${trade.trade_code}` : "Trade code pending";
          const recipient = recipients[trade.recipient_id];
          const recipientName = recipient?.lumio_display_name || recipient?.discord_display_name || recipient?.discord_username;

          return (
            <article className="sent-trade-card" key={trade.id}>
              <div className="trade-card-heading">
                <div>
                  <span className="trade-code">{code}</span>
                  <h2>{requested[0]?.name || "Open direct offer"}</h2>
                </div>
                <span className={`trade-status status-${trade.status}`}>
                  {STATUS_LABELS[trade.status] || trade.status}
                </span>
              </div>

              {recipientName ? (
                <Link className="trade-participant" to={`/trader/${trade.recipient_id}`}>
                  To <strong>{recipientName}</strong> {recipient.discord_display_name && <span>Discord · {recipient.discord_display_name}</span>}
                </Link>
              ) : trade.recipient_id ? (
                <span className="trade-participant">To a licensed trader</span>
              ) : null}

              <h3>You requested</h3>
              <TradeChampionList champions={requested} emptyCopy="Open direct offer — no specific champion was requested." />

              <h3>You offered</h3>
              <TradeChampionList champions={offered} emptyCopy="No champions were included in this offer." />

              {trade.offer_value !== undefined && (
                <p className="trade-offer-total">Offer value: <strong>◈ {Number(trade.offer_value || 0).toLocaleString()}</strong></p>
              )}

              {trade.offer_note && <section className="trade-note-preview trade-note-inline"><span>Your note</span><p>{trade.offer_note}</p></section>}

              <p className="trade-created">Sent {formatDateTime(trade.created_at, datePreferences)}</p>

              {trade.status === "accepted" && (
                hasTwoPartyConfirmation(trade) ? (
                  <TradeCompletionConfirmation busy={confirmingId === trade.id} counterpartName={recipientName} currentUserId={user?.id} onConfirm={confirmExchange} trade={trade} />
                ) : (
                  <section className="trade-coordination">
                    <strong>Accepted — coordinate the in-game exchange</strong>
                    <p>Your offer is reserved. Use {code} while you and the recipient complete the real champion exchange in Anime Fighting Simulator. The recipient records completion afterward.</p>
                    {recipientName && <Link className="secondary-action coordination-link" to={`/trader/${trade.recipient_id}`}>Open trader profile</Link>}
                  </section>
                )
              )}

              {trade.status === "completed" && <p className="trade-completed-note">Completed {formatDateTime(trade.completed_at || trade.updated_at, datePreferences)}{trade.xp_awarded ? ` · +${trade.xp_awarded} XP awarded to both traders` : ""}</p>}

              {trade.status === "pending" && (
                <div className="card-actions trade-card-actions">
                  <button className="secondary-action" onClick={() => setDetailsTrade(trade)} type="button">View details</button>
                  <button className="danger-action" onClick={() => setCancelTarget(trade)} disabled={cancelling === trade.id} type="button">{cancelling === trade.id ? "Cancelling…" : "Cancel trade"}</button>
                </div>
              )}
              {trade.status !== "pending" && <button className="secondary-action trade-details-button" onClick={() => setDetailsTrade(trade)} type="button">View details</button>}
            </article>
          );
          })}
        </section>
      )}

      {cancelTarget && <ConfirmDialog busy={cancelling === cancelTarget.id} cancelLabel="Keep trade" confirmLabel="Cancel trade" danger description="Cancel this pending offer? The recipient will no longer be able to accept it, and Lumio will update the associated Discord trade message." onCancel={() => setCancelTarget(null)} onConfirm={() => void cancelTrade()} title="Cancel this trade request?" />}

      {detailsTrade && (
        <TradeDetailsModal
          counterpartName={recipients[detailsTrade.recipient_id]?.lumio_display_name || recipients[detailsTrade.recipient_id]?.discord_display_name || recipients[detailsTrade.recipient_id]?.discord_username}
          leftChampions={detailsTrade.requested_champions?.length ? detailsTrade.requested_champions : (detailsTrade.requested_champion ? [detailsTrade.requested_champion] : [])}
          leftLabel="You requested"
          onClose={() => setDetailsTrade(null)}
          rightChampions={detailsTrade.offered_champions || []}
          rightLabel="You offered"
          trade={detailsTrade}
          datePreferences={datePreferences}
        />
      )}
    </Layout>
  );
}

export default PendingTrades;
