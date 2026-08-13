import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import getRank from "../utils/rankCalculator";
import getXPProgress from "../utils/xpProgress";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Dashboard() {
  const { user, profile } = useAuth();
  const [recentTrades, setRecentTrades] = useState([]);
  const [completedTradeCount, setCompletedTradeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);

  // Use the profile (DB row) instead of raw auth user
  const displayName =
    profile?.discord_display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Trader";

  const totalXP = profile?.xp ?? 0;
  const rank = getRank(totalXP);
  const progress = getXPProgress(totalXP);
  const xpPercentage = Math.max(0, Math.min(100, progress.percentage));

  useEffect(() => {
    if (!user) return;

    const participantFilter = `sender_id.eq.${user.id},recipient_id.eq.${user.id}`;

    Promise.all([
      supabase
        .from("trades")
        .select("*")
        .or(participantFilter)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("trades")
        .select("id")
        .or(participantFilter)
        .eq("status", "completed"),
      supabase
        .from("user_champions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
    ]).then(([recentResult, completedResult, collectionResult]) => {
      if (!recentResult.error) setRecentTrades(recentResult.data || []);
      if (!completedResult.error) setCompletedTradeCount(completedResult.data?.length || 0);
      if (!collectionResult.error) setCollectionCount(collectionResult.count || 0);
    });
  }, [user]);

  return (
    <Layout>
      <section className="hero-card">
        <p className="eyebrow">Licensed trader workspace</p>
        <h1>Welcome back, {displayName}</h1>

        <p>Keep your marketplace listings, direct offers, and trading progress in one clear place.</p>

        <div className="license-status">
          <span>🪪 Trading License</span>
          <strong>Active</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card">
          <h2>Trading rank</h2>

          <p className="big-number">{rank.title}</p>

          <div className="xp-bar">
            <div
              className="xp-progress"
              style={{ width: `${xpPercentage}%` }}
            />
          </div>

          <p>{totalXP.toLocaleString()} XP · Level {rank.level}</p>
        </div>

        <div className="dashboard-card">
          <h2>Completed trades</h2>
          <p className="big-number">{completedTradeCount}</p>
          <p>Your confirmed in-game exchanges</p>
        </div>

        <div className="dashboard-card">
          <h2>Collection</h2>
          <p className="big-number">{collectionCount}</p>
          <p>Private champion copies in your inventory</p>
        </div>
      </section>

      <section className="dashboard-card quick-actions-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Quick actions</p>
            <h2>Trade without losing momentum</h2>
          </div>
        </div>
        <div className="quick-actions">
          <Link to="/trades">
            <span>↗</span>
            <strong>Explore Trades</strong>
            <small>Browse public listings</small>
          </Link>
          <Link to="/shelf">
            <span>⌁</span>
            <strong>Manage Shelf</strong>
            <small>List your champions</small>
          </Link>
          <Link to="/received-trades">
            <span>↓</span>
            <strong>Review Offers</strong>
            <small>See direct proposals</small>
          </Link>
        </div>
      </section>

      {recentTrades.length > 0 && (
        <section className="dashboard-card">
          <h2>Recent trade activity</h2>
          {recentTrades.map((trade) => {
            const rc = trade.requested_champion || { name: "an open direct offer" };
            const statusLabels = {
              pending: "🟡 Pending",
              accepted: "🔵 Accepted",
              completed: "✅ Completed",
              declined: "⚪ Declined",
              cancelled: "❌ Cancelled",
            };
            const statusLabel = statusLabels[trade.status] || trade.status;
            return (
              <div className="activity-row" key={trade.id}>
                <span className="activity-status">{statusLabel}</span>
                <p>
                  <strong>{trade.trade_code ? `#${trade.trade_code}` : "Trade code pending"}</strong>
                  {" · "}{trade.offered_champions?.length || 0} offered for {rc.name || "an open direct offer"}
                </p>
              </div>
            );
          })}
        </section>
      )}

      <section className="dashboard-card announcement">
        <h2>Notifications</h2>
        <p>You are all caught up. Trade requests, listing activity, and completion reminders will show here.</p>
      </section>
    </Layout>
  );
}

export default Dashboard;
