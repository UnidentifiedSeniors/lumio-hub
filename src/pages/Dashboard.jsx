import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import getRank from "../utils/rankCalculator";
import getXPProgress from "../utils/xpProgress";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Dashboard() {
  const { user, profile } = useAuth();
  const [recentTrades, setRecentTrades] = useState([]);

  // Use the profile (DB row) instead of raw auth user
  const displayName =
    profile?.discord_display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Trader";

  const totalXP = profile?.xp ?? 0;
  const rank = getRank(totalXP);
  const progress = getXPProgress(totalXP);

  useEffect(() => {
    if (!user) return;

    // Fetch recent trades (last 5)
    supabase
      .from("trades")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (!error) setRecentTrades(data || []);
      });
  }, [user]);

  return (
    <Layout>
      <section className="hero-card">
        <h1>Welcome back, {displayName}</h1>

        <p>Your Lumio Hub trading command center.</p>

        <div className="license-status">
          <span>🪪 Trading License</span>
          <strong>Active</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card">
          <h2>📈 Trading Level</h2>

          <p className="big-number">{rank.title} (Lvl {rank.level})</p>

          <div className="xp-bar">
            <div
              className="xp-progress"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <p>{totalXP} XP</p>
        </div>

        <div className="dashboard-card">
          <h2>🤝 Your Trades</h2>
          <p className="big-number">{profile?.trades_completed ?? 0}</p>
          <p>Trades Completed</p>
        </div>

        <div className="dashboard-card">
          <h2>📦 Champion Stock</h2>
          <p className="big-number">—</p>
          <p>Champions Available</p>
        </div>
      </section>

      {recentTrades.length > 0 && (
        <section className="dashboard-card">
          <h2>📜 Recent Trades</h2>
          {recentTrades.map((trade) => {
            const rc = trade.requested_champion || {};
            const statusLabel =
              trade.status === "pending"
                ? "🟡 Pending"
                : trade.status === "completed"
                ? "✅ Completed"
                : "❌ Cancelled";
            return (
              <p key={trade.id}>
                Trade #{trade.trade_code || trade.id.slice(0, 8)} —{" "}
                {trade.offered_champions?.length || 0} offered for{" "}
                <strong>{rc.name || "Unknown"}</strong> — {statusLabel}
              </p>
            );
          })}
        </section>
      )}

      <section className="dashboard-card announcement">
        <h2>📢 Announcements</h2>
        <p>Welcome to Lumio Hub! Trading services are being prepared.</p>
      </section>
    </Layout>
  );
}

export default Dashboard;
