import { useEffect, useState } from "react";

import Layout from "../components/Layout";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function PendingTrades() {
  const { user } = useAuth();

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchTrades();
  }, [user]);

  const fetchTrades = async () => {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("TRADE FETCH ERROR:", error);
    } else {
      setTrades(data);
    }
    setLoading(false);
  };

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
    completed: "✅ Completed",
    cancelled: "❌ Cancelled",
  };

  return (
    <Layout>
      <h1>📋 Pending Trades</h1>

      {loading ? (
        <p>Loading trades...</p>
      ) : trades.length === 0 ? (
        <div className="dashboard-card">
          <h2>No Trades Found</h2>
          <p>Your trades will appear here once you create them.</p>
        </div>
      ) : (
        trades.map((trade) => {
          const requested = trade.requested_champion || {};
          const offered = trade.offered_champions || [];
          const code = trade.trade_code
            ? `#${trade.trade_code}`
            : `Trade ${trade.id.slice(0, 8)}`;

          return (
            <div className="dashboard-card" key={trade.id}>
              <h2>
                {code} — {statusEmoji[trade.status] || trade.status}
              </h2>

              <h3>Requested Champion:</h3>
              <p>
                <strong>{requested.name || "Unknown"}</strong>{" "}
                ({requested.rarity || "—"})
              </p>

              <h3>Offering:</h3>
              {offered.length === 0 ? (
                <p>No champions offered.</p>
              ) : (
                offered.map((champion, index) => (
                  <p key={index}>
                    {champion.name} ({champion.rarity})
                  </p>
                ))
              )}

              {trade.offer_value !== undefined && (
                <p>💎 Offer Value: {trade.offer_value}</p>
              )}

              <p>Created: {formatDate(trade.created_at)}</p>

              {trade.status === "pending" && (
                <button
                  onClick={() => cancelTrade(trade.id)}
                  disabled={cancelling === trade.id}
                >
                  {cancelling === trade.id ? "Cancelling…" : "Cancel Trade"}
                </button>
              )}
            </div>
          );
        })
      )}
    </Layout>
  );
}

export default PendingTrades;
