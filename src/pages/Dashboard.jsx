import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import NotificationList from "../components/NotificationList";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDatePreferences } from "../utils/datePreferences";
import getRank from "../utils/rankCalculator";
import { isTradingLicensed } from "../utils/tradingLicense";
import getXPProgress from "../utils/xpProgress";

function DashboardIcon({ name }) {
  const paths = {
    license: <><path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    market: <><path d="M5 8h13" /><path d="m14 4 4 4-4 4" /><path d="M19 16H6" /><path d="m10 12-4 4 4 4" /></>,
    shelf: <><path d="M4 5h16v5H4z" /><path d="M4 14h16v5H4z" /><path d="M8 5v5" /><path d="M16 14v5" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="m5 7 7 5 7-5" /><path d="M12 12v5" /><path d="m9.5 14.5 2.5 2.5 2.5-2.5" /></>,
  };

  return <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function Dashboard() {
  const { user, profile } = useAuth();
  const licensed = isTradingLicensed(profile);
  const datePreferences = getDatePreferences(profile);
  const navigate = useNavigate();
  const [recentTrades, setRecentTrades] = useState([]);
  const [completedTradeCount, setCompletedTradeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  // Use the profile (DB row) instead of raw auth user
  const displayName =
    profile?.lumio_display_name ||
    profile?.discord_display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Trader";

  const totalXP = profile?.xp ?? 0;
  const rank = getRank(totalXP);
  const progress = getXPProgress(totalXP);
  const xpPercentage = Math.max(0, Math.min(100, progress.percentage));

  useEffect(() => {
    if (!user || !licensed) {
      return;
    }

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
  }, [licensed, user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link_path, trade_id, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4);
    if (!error) setNotifications(data || []);
  }, [user]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadNotifications]);

  const openNotification = async (notification) => {
    if (!notification.read_at) {
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id);
      if (error) void loadNotifications();
    }

    navigate(notification.link_path || "/dashboard");
  };

  return (
    <Layout>
      <section className="hero-card">
        <p className="eyebrow">{licensed ? "Licensed trader workspace" : "Lumio onboarding"}</p>
        <h1>Welcome back, {displayName}</h1>

        <p>{licensed ? "Keep your marketplace listings, direct offers, and trading progress in one clear place." : "Complete the Trading License guide and assessment to unlock Lumio’s marketplace tools."}</p>

        <div className="license-status">
          <span className="license-status-label"><DashboardIcon name="license" />Trading License</span>
          <strong>{licensed ? "Active" : "Required"}</strong>
        </div>
      </section>

      {licensed && <section className="dashboard-grid">
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
      </section>}

      <section className="dashboard-card quick-actions-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{licensed ? "Quick actions" : "Your next step"}</p>
            <h2>{licensed ? "Trade without losing momentum" : "Earn your Trading License"}</h2>
          </div>
        </div>
        <div className="quick-actions">
          {licensed ? <><Link to="/trades"><span className="quick-action-icon"><DashboardIcon name="market" /></span><strong>Explore Market</strong><small>Browse public listings</small></Link><Link to="/shelf"><span className="quick-action-icon"><DashboardIcon name="shelf" /></span><strong>Manage Shelf</strong><small>List your champions</small></Link><Link to="/received-trades"><span className="quick-action-icon"><DashboardIcon name="inbox" /></span><strong>Review Offers</strong><small>See direct proposals</small></Link></> : <><Link to="/license"><span className="quick-action-icon"><DashboardIcon name="license" /></span><strong>Start the guide</strong><small>Learn Lumio’s trade standards</small></Link><Link to="/license"><span className="quick-action-icon"><DashboardIcon name="market" /></span><strong>Take the assessment</strong><small>Pass to unlock all trading tools</small></Link><Link to="/settings"><span className="quick-action-icon"><DashboardIcon name="inbox" /></span><strong>Account settings</strong><small>Manage your Discord-connected account</small></Link></>}
        </div>
      </section>

      {licensed && recentTrades.length > 0 && (
        <section className="dashboard-card">
          <h2>Recent trade activity</h2>
          {recentTrades.map((trade) => {
            const rc = trade.requested_champion || { name: "an open direct offer" };
            const statusLabels = {
              pending: "Pending",
              accepted: "Accepted",
              completed: "Completed",
              declined: "Declined",
              cancelled: "Cancelled",
            };
            const statusLabel = statusLabels[trade.status] || trade.status;
            return (
              <div className="activity-row" key={trade.id}>
                <span className={`activity-status activity-status-${trade.status || "pending"}`}>{statusLabel}</span>
                <p>
                  <strong>{trade.trade_code ? `#${trade.trade_code}` : "Trade code pending"}</strong>
                  {" · "}{trade.offered_champions?.length || 0} offered for {rc.name || "an open direct offer"}
                </p>
              </div>
            );
          })}
        </section>
      )}

      <section className="dashboard-card announcement notification-dashboard-card">
        <div className="section-heading notification-section-heading">
          <div>
            <p className="eyebrow">{licensed ? "Trade activity" : "Account activity"}</p>
            <h2>Notifications</h2>
          </div>
          {licensed ? <Link to="/received-trades">Open trade inbox</Link> : <Link to="/license">Open license guide</Link>}
        </div>
        <NotificationList datePreferences={datePreferences} emptyCopy={licensed ? "You are all caught up. New offers and trade updates will appear here." : "License updates and important Lumio notices will appear here."} notifications={notifications} onOpen={openNotification} />
      </section>
    </Layout>
  );
}

export default Dashboard;
