import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import TradeCompletionConfirmation, { hasTwoPartyConfirmation } from "../components/TradeCompletionConfirmation";
import TradeDetailsModal, { TradeChampionList } from "../components/TradeDetailsModal";

import { supabase } from "../lib/supabase";
import useAuth from "../context/useAuth";
import { formatDateTime } from "../utils/marketplace";

function PendingTrades() {
  const { user, refreshProfile } = useAuth();

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [recipients, setRecipients] = useState({});
  const [detailsTrade, setDetailsTrade] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState(null);

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

  const cancelTrade = async (tradeId) => {
    const confirmCancel = window.confirm("Cancel this trade request?");
    if (!confirmCancel) return;

    setCancelling(tradeId);

    const { error } = await supabase
      .from("trades")
      .update({ status: "cancelled" })
      .eq("id", tradeId)
      .eq("status", "pending"); // only pending trades can be cancelled

    if (error) {
      console.error("CANCEL ERROR:", error);
    } else {
      // Edge function (UPDATE trigger) edits the Discord message.
      setTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId ? { ...t, status: "cancelled" } : t
        )
      );
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

  const statusEmoji = {
    pending: "🟡 Pending",
    accepted: "🔵 Accepted",
    declined: "⚪ Declined",
    completed: "✅ Completed",
    cancelled: "❌ Cancelled",
  };

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Private offers</p>
        <h1>Sent Trades</h1>
        <p>Track the offers you have sent directly to other traders.</p>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading sent trades...</p>
      ) : trades.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">↑</span>
          <h2>No sent trades yet</h2>
          <p>Your direct offers and their current status will appear here.</p>
        </section>
      ) : (
        <section className="trade-list">
          {trades.map((trade) => {
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
                  {statusEmoji[trade.status] || trade.status}
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

              <p className="trade-created">Sent {formatDateTime(trade.created_at)}</p>

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

              {trade.status === "completed" && <p className="trade-completed-note">Completed {formatDateTime(trade.completed_at || trade.updated_at)}{trade.xp_awarded ? ` · +${trade.xp_awarded} XP awarded to both traders` : ""}</p>}

              {trade.status === "pending" && (
                <div className="card-actions trade-card-actions">
                  <button className="secondary-action" onClick={() => setDetailsTrade(trade)} type="button">View details</button>
                  <button className="danger-action" onClick={() => cancelTrade(trade.id)} disabled={cancelling === trade.id} type="button">{cancelling === trade.id ? "Cancelling…" : "Cancel trade"}</button>
                </div>
              )}
              {trade.status !== "pending" && <button className="secondary-action trade-details-button" onClick={() => setDetailsTrade(trade)} type="button">View details</button>}
            </article>
          );
          })}
        </section>
      )}

      {detailsTrade && (
        <TradeDetailsModal
          counterpartName={recipients[detailsTrade.recipient_id]?.lumio_display_name || recipients[detailsTrade.recipient_id]?.discord_display_name || recipients[detailsTrade.recipient_id]?.discord_username}
          leftChampions={detailsTrade.requested_champions?.length ? detailsTrade.requested_champions : (detailsTrade.requested_champion ? [detailsTrade.requested_champion] : [])}
          leftLabel="You requested"
          onClose={() => setDetailsTrade(null)}
          rightChampions={detailsTrade.offered_champions || []}
          rightLabel="You offered"
          trade={detailsTrade}
        />
      )}
    </Layout>
  );
}

export default PendingTrades;
