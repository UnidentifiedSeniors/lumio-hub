import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDiscordIdentity } from "../utils/discordIdentity";
import getRank from "../utils/rankCalculator";
import getXPProgress from "../utils/xpProgress";

function ProfileIcon({ name }) {
  const paths = {
    progress: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    trades: <><path d="M7 7h10" /><path d="m13 3 4 4-4 4" /><path d="M17 17H7" /><path d="m11 21-4-4 4-4" /></>,
    collection: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5V3h8v2" /><path d="M8 10h8" /><path d="M8 14h5" /></>,
    discord: <><path d="M8 7.5a15 15 0 0 1 8 0l1.5 8.5-3.1 1.9-1.4-1.1h-2l-1.4 1.1L6.5 16z" /><path d="M9.5 12h.01" /><path d="M14.5 12h.01" /></>,
    roblox: <><path d="M7 3h10l4 4v10l-4 4H7l-4-4V7z" /><path d="m9 9 6 6" /><path d="m15 9-6 6" /></>,
    badge: <><circle cx="12" cy="10" r="6" /><path d="m8.5 15.1-1 5 4.5-2.4 4.5 2.4-1-5" /></>,
  };

  return <svg aria-hidden="true" className="profile-icon" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function Profile() {
  const { user, profile } = useAuth();
  const [completedTradeCount, setCompletedTradeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const discordIdentity = getDiscordIdentity(user);

  // Use profile data from the DB (not the hardcoded 0)
  const totalXP = profile?.xp ?? 0;
  const rank = getRank(totalXP);
  const progress = getXPProgress(totalXP);

  const displayName =
    profile?.discord_display_name ||
    discordIdentity.displayName ||
    "Trader";

  const discordUsername =
    profile?.discord_username ||
    discordIdentity.username ||
    "username";

  const avatar = profile?.discord_avatar || discordIdentity.avatar;

  useEffect(() => {
    if (!user) return undefined;

    const participantFilter = `sender_id.eq.${user.id},recipient_id.eq.${user.id}`;
    Promise.all([
      supabase
        .from("trades")
        .select("id")
        .or(participantFilter)
        .eq("status", "completed"),
      supabase
        .from("user_champions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
    ]).then(([tradesResult, collectionResult]) => {
      if (!tradesResult.error) setCompletedTradeCount(tradesResult.data?.length || 0);
      if (!collectionResult.error) setCollectionCount(collectionResult.count || 0);
    });

    return undefined;
  }, [user]);

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Your Lumio account</p>
        <h1>Profile</h1>
        <p>Your verified trading identity, connected accounts, and progression at a glance.</p>
      </section>

      <section className="profile-hero">
        {avatar ? <img alt="" className="profile-hero-avatar" src={avatar} /> : <span className="profile-hero-avatar avatar-fallback">{displayName.charAt(0).toUpperCase()}</span>}
        <div className="profile-hero-copy">
          <span className="profile-license-label">Licensed trader</span>
          <h2>{displayName}</h2>
          <p className="profile-handle">@{discordUsername}</p>
          <div className="profile-meta">
            <span>{rank.title}</span>
            <span>{profile?.roblox_username ? `Roblox: ${profile.roblox_username}` : "Roblox not linked"}</span>
            {profile?.created_at && <span>Member since {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(profile.created_at))}</span>}
          </div>
        </div>
        <div className="profile-hero-actions">
          {user && <Link className="secondary-action" to={`/trader/${user.id}`}>View public profile</Link>}
          <Link className="profile-settings-link" to="/settings">Account settings</Link>
        </div>
      </section>

      <section className="profile-metrics" aria-label="Trading summary">
        <article className="profile-metric profile-progress-card">
          <div className="profile-metric-heading"><span className="profile-metric-icon"><ProfileIcon name="progress" /></span><span>Trading progress</span></div>
          <strong>{rank.title}</strong>
          <p>{totalXP.toLocaleString()} XP · Level {rank.level}</p>
          <div className="xp-bar"><div className="xp-progress" style={{ width: `${Math.max(0, Math.min(100, progress.percentage))}%` }} /></div>
          <small>{progress.next.title === rank.title ? "Maximum progression rank reached" : `${Math.max(0, progress.next.requiredXP - totalXP).toLocaleString()} XP to ${progress.next.title}`}</small>
        </article>
        <article className="profile-metric">
          <div className="profile-metric-heading"><span className="profile-metric-icon"><ProfileIcon name="trades" /></span><span>Completed trades</span></div>
          <strong>{completedTradeCount.toLocaleString()}</strong>
          <p>Confirmed in-game champion exchanges.</p>
        </article>
        <article className="profile-metric">
          <div className="profile-metric-heading"><span className="profile-metric-icon"><ProfileIcon name="collection" /></span><span>Collection</span></div>
          <strong>{collectionCount.toLocaleString()}</strong>
          <p>Champion copies available in your private inventory.</p>
        </article>
      </section>

      <section className="profile-detail-grid">
        <article className="profile-detail-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Connections</p><h2>Linked accounts</h2></div><Link to="/settings">Manage</Link></div>
          <div className="account-connection-row">
            <span className="connection-icon"><ProfileIcon name="discord" /></span>
            <div><strong>Discord</strong><span>{displayName} · @{discordUsername}</span></div>
            <span className="connected-label">Connected</span>
          </div>
          <div className="account-connection-row">
            <span className="connection-icon"><ProfileIcon name="roblox" /></span>
            <div><strong>Roblox</strong><span>{profile?.roblox_username ? `@${profile.roblox_username}` : "Not linked yet"}</span></div>
            {profile?.roblox_username ? <span className="connected-label">Linked</span> : <Link className="row-link" to="/settings">Connect</Link>}
          </div>
        </article>

        <article className="profile-detail-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Recognition</p><h2>Badges</h2></div></div>
          {profile?.badges?.length ? (
            <div className="profile-badges">{profile.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
          ) : (
            <div className="profile-badges-empty"><span className="connection-icon"><ProfileIcon name="badge" /></span><div><strong>No badges earned yet</strong><p>Trading milestones and community recognition will appear here.</p></div></div>
          )}
        </article>
      </section>
    </Layout>
  );
}

export default Profile;
