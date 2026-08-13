import { useCallback, useEffect, useState } from "react";

import Layout from "../components/Layout";
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
  const { user } = useAuth();
  const [trades, setTrades] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [respondingId, setRespondingId] = useState(null);

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
    const { error: updateError } = await supabase
      .from("trades")
      .update({ status })
      .eq("id", tradeId)
      .eq("status", "pending");

    if (updateError) {
      setError(updateError.message);
    } else {
      setTrades((current) => current.map((trade) => trade.id === tradeId ? { ...trade, status } : trade));
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
                  </div>
                  <span className={`trade-status status-${trade.status}`}>{STATUS_LABELS[trade.status] || trade.status}</span>
                </div>
                <div className="trade-details-grid">
                  <div>
                    <h3>You listed</h3>
                    {requested.map((champion) => <p key={`${trade.id}-${champion.user_champion_id || champion.id}`}><strong>{champion.name}</strong> <span>({champion.rarity})</span></p>)}
                  </div>
                  <div>
                    <h3>They offered</h3>
                    {offered.map((champion) => <p key={`${trade.id}-${champion.user_champion_id || champion.id}`}><strong>{champion.name}</strong> <span>({champion.rarity})</span></p>)}
                  </div>
                </div>
                <div className="trade-footer">
                  <span>◈ {trade.offer_value?.toLocaleString() || "0"} offered · {formatDateTime(trade.created_at)}</span>
                  {trade.status === "pending" && <div className="card-actions"><button className="secondary-action" disabled={respondingId === trade.id} onClick={() => respondToTrade(trade.id, "declined")} type="button">Decline</button><button className="primary-action" disabled={respondingId === trade.id} onClick={() => respondToTrade(trade.id, "accepted")} type="button">{respondingId === trade.id ? "Updating…" : "Accept offer"}</button></div>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </Layout>
  );
}

export default ReceivedTrades;
