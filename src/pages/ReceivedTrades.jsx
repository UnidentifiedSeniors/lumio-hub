import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import TradeDetailsModal, { TradeChampionList } from "../components/TradeDetailsModal";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../utils/marketplace";

const STATUS_LABELS = {
  pending: "Pending review",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

function tradeRequestedChampions(trade) {
  if (trade.requested_champions?.length) return trade.requested_champions;
  return trade.requested_champion ? [trade.requested_champion] : [];
}

function ReceivedTrades() {
  const { user, refreshProfile } = useAuth();
  const [trades, setTrades] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [respondingId, setRespondingId] = useState(null);
  const [acceptingTrade, setAcceptingTrade] = useState(null);
  const [detailsTrade, setDetailsTrade] = useState(null);

  const loadTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (tradeError) {
      setError(tradeError.message);
      setLoading(false);
      return;
    }

    const senderIds = [...new Set((data || []).map((trade) => trade.sender_id).filter(Boolean))];
    if (senderIds.length) {
      const { data: profileData, error: profileError } = await supabase
        .from("public_profiles")
        .select("id, discord_username, discord_display_name, discord_avatar")
        .in("id", senderIds);
      if (profileError) setError(profileError.message);
      setProfiles(Object.fromEntries((profileData || []).map((profile) => [profile.id, profile])));
    } else {
      setProfiles({});
    }

    setTrades(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTrades();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTrades]);

  const respondToTrade = async (tradeId, status) => {
    setRespondingId(tradeId);
    setError(null);
    const expectedStatus = status === "completed" ? "accepted" : "pending";
    const { data, error: updateError } = await supabase
      .from("trades")
      .update({ status })
      .eq("id", tradeId)
      .eq("status", expectedStatus)
      .select("id, status, accepted_at, completed_at, updated_at, xp_awarded");

    if (updateError || !data?.length) {
      setError(updateError?.message || "This offer changed before it could be updated. Refresh and try again.");
    } else {
      setTrades((current) => current.map((trade) => trade.id === tradeId ? { ...trade, ...data[0] } : trade));
      if (status === "completed") await refreshProfile();
    }
    setRespondingId(null);
  };

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Private offers</p>
        <h1>Received Trades</h1>
        <p>Review every champion offered to you, then accept or decline from one secure place.</p>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading received trades...</p>
      ) : trades.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">↓</span>
          <h2>No incoming offers</h2>
          <p>When a trader chooses <strong>Make an offer</strong> from one of your Shelf listings, their proposal appears here with every requested and offered champion.</p>
        </section>
      ) : (
        <section className="trade-list">
          {trades.map((trade) => {
            const sender = profiles[trade.sender_id];
            const senderName = sender?.discord_display_name || sender?.discord_username || "Licensed trader";
            const requested = tradeRequestedChampions(trade);
            const offered = trade.offered_champions || [];
            return (
              <article className="sent-trade-card received-trade-card" key={trade.id}>
                <div className="trade-card-heading">
                  <div>
                    <span className="trade-code">{trade.trade_code ? `#${trade.trade_code}` : "Trade code pending"}</span>
                    <h2>{senderName} made an offer</h2>
                    {sender?.id && <Link className="trade-participant" to={`/trader/${sender.id}`}>View trader profile</Link>}
                  </div>
                  <span className={`trade-status status-${trade.status}`}>{STATUS_LABELS[trade.status] || trade.status}</span>
                </div>
                <div className="trade-details-grid">
                  <div>
                    <h3>You listed</h3>
                    <TradeChampionList champions={requested} emptyCopy="Open direct offer — no specific champion was requested." />
                  </div>
                  <div>
                    <h3>They offered</h3>
                    <TradeChampionList champions={offered} emptyCopy="No champions were included in this offer." />
                  </div>
                </div>
                <div className="trade-footer">
                  <span>◈ {trade.offer_value?.toLocaleString() || "0"} offered · {formatDateTime(trade.created_at)}</span>
                  <div className="card-actions">
                    <button className="secondary-action" onClick={() => setDetailsTrade(trade)} type="button">View details</button>
                    {trade.status === "pending" && <><button className="secondary-action" disabled={respondingId === trade.id} onClick={() => respondToTrade(trade.id, "declined")} type="button">Decline</button><button className="primary-action" disabled={respondingId === trade.id} onClick={() => setAcceptingTrade(trade)} type="button">Accept offer</button></>}
                  </div>
                </div>
                {trade.status === "accepted" && (
                  <section className="trade-coordination">
                    <strong>Accepted — coordinate in Anime Fighting Simulator</strong>
                    <p>Share trade code {trade.trade_code ? `#${trade.trade_code}` : "with the sender"}, complete the actual exchange in-game, then record it here. {trade.listing_id ? "This Shelf listing is now unavailable to other traders." : "This was an open direct offer."}</p>
                    <button className="primary-action" disabled={respondingId === trade.id} onClick={() => respondToTrade(trade.id, "completed")} type="button">{respondingId === trade.id ? "Updating…" : "Mark exchange completed"}</button>
                  </section>
                )}
                {trade.status === "completed" && <p className="trade-completed-note">Completed {formatDateTime(trade.completed_at || trade.updated_at)}{trade.xp_awarded ? ` · +${trade.xp_awarded} XP awarded to both traders` : ""}</p>}
              </article>
            );
          })}
        </section>
      )}

      {acceptingTrade && (
        <div className="modal-overlay" role="presentation">
          <section aria-modal="true" className="trade-modal acceptance-modal" role="dialog">
            <p className="eyebrow">Accept trade offer</p>
            <h2>Reserve this trade?</h2>
            <p className="modal-copy">Lumio will not move any Roblox champions. You and the sender must complete the exchange inside Anime Fighting Simulator.</p>
            {acceptingTrade.listing_id && <div className="form-value-preview"><span>Public Shelf</span><strong>This listing will become unavailable</strong></div>}
            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setAcceptingTrade(null)} type="button">Keep reviewing</button>
              <button className="primary-action" disabled={respondingId === acceptingTrade.id} onClick={async () => { await respondToTrade(acceptingTrade.id, "accepted"); setAcceptingTrade(null); }} type="button">{respondingId === acceptingTrade.id ? "Accepting…" : "Accept & coordinate"}</button>
            </div>
          </section>
        </div>
      )}

      {detailsTrade && (
        <TradeDetailsModal
          counterpartName={profiles[detailsTrade.sender_id]?.discord_display_name || profiles[detailsTrade.sender_id]?.discord_username}
          leftChampions={tradeRequestedChampions(detailsTrade)}
          leftLabel="You listed"
          onClose={() => setDetailsTrade(null)}
          rightChampions={detailsTrade.offered_champions || []}
          rightLabel="They offered"
          trade={detailsTrade}
        />
      )}
    </Layout>
  );
}

export default ReceivedTrades;
