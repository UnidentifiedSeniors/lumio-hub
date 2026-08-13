import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";

import { supabase } from "../lib/supabase";
import useAuth from "../context/useAuth";

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function PendingTrades() {
  const { user } = useAuth();

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [recipients, setRecipients] = useState({});

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
              .select("id, discord_username, discord_display_name")
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
          const requested = trade.requested_champion || { name: "Open direct offer", rarity: "No specific champion requested" };
          const offered = trade.offered_champions || [];
          const code = trade.trade_code ? `#${trade.trade_code}` : "Trade code pending";
          const recipient = recipients[trade.recipient_id];
          const recipientName = recipient?.discord_display_name || recipient?.discord_username;

          return (
            <article className="sent-trade-card" key={trade.id}>
              <div className="trade-card-heading">
                <div>
                  <span className="trade-code">{code}</span>
                  <h2>{requested.name || "Open direct offer"}</h2>
                </div>
                <span className={`trade-status status-${trade.status}`}>
                  {statusEmoji[trade.status] || trade.status}
                </span>
              </div>

              {recipientName ? (
                <Link className="trade-participant" to={`/trader/${trade.recipient_id}`}>
                  To <strong>{recipientName}</strong> {recipient.discord_username && recipient.discord_display_name && <span>@{recipient.discord_username}</span>}
                </Link>
              ) : trade.recipient_id ? (
                <span className="trade-participant">To a licensed trader</span>
              ) : null}

              <h3>You requested</h3>
              <p>
                <strong>{requested.name || "Open direct offer"}</strong>{" "}
                {requested.rarity && requested.rarity !== "No specific champion requested" ? `(${requested.rarity})` : null}
              </p>

              <h3>You offered</h3>
              {offered.length === 0 ? (
                <p>No champions offered.</p>
              ) : (
                offered.map((champion, index) => (
                  <p key={index}>
                    {champion.name}{champion.rarity ? ` (${champion.rarity})` : ""}
                  </p>
                ))
              )}

              {trade.offer_value !== undefined && (
                <p>💎 Offer Value: {trade.offer_value}</p>
              )}

              <p className="trade-created">Sent {formatDate(trade.created_at)}</p>

              {trade.status === "accepted" && (
                <section className="trade-coordination">
                  <strong>Accepted — coordinate the in-game exchange</strong>
                  <p>Your offer is reserved. Use {code} while you and the recipient complete the real champion exchange in Anime Fighting Simulator. The recipient records completion afterward.</p>
                  {recipientName && <Link className="secondary-action coordination-link" to={`/trader/${trade.recipient_id}`}>Open trader profile</Link>}
                </section>
              )}

              {trade.status === "completed" && <p className="trade-completed-note">Completed {formatDate(trade.completed_at || trade.updated_at)}{trade.xp_awarded ? ` · +${trade.xp_awarded} XP awarded to both traders` : ""}</p>}

              {trade.status === "pending" && (
                <button
                  onClick={() => cancelTrade(trade.id)}
                  disabled={cancelling === trade.id}
                >
                  {cancelling === trade.id ? "Cancelling…" : "Cancel Trade"}
                </button>
              )}
            </article>
          );
          })}
        </section>
      )}
    </Layout>
  );
}

export default PendingTrades;
