import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDiscordIdentity } from "../utils/discordIdentity";
import { formatDisplayNameChangeTime, getDisplayNameChangeState } from "../utils/displayNameCooldown";
import getRank from "../utils/rankCalculator";
import getXPProgress from "../utils/xpProgress";

function ProfileIcon({ name }) {
  const paths = {
    progress: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    trades: <><path d="M7 7h10" /><path d="m13 3 4 4-4 4" /><path d="M17 17H7" /><path d="m11 21-4-4 4-4" /></>,
    collection: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5V3h8v2" /><path d="M8 10h8" /><path d="M8 14h5" /></>,
    discord: <><path d="M8 7.5a15 15 0 0 1 8 0l1.5 8.5-3.1 1.9-1.4-1.1h-2l-1.4 1.1L6.5 16z" /><path d="M9.5 12h.01" /><path d="M14.5 12h.01" /></>,
    badge: <><circle cx="12" cy="10" r="6" /><path d="m8.5 15.1-1 5 4.5-2.4 4.5 2.4-1-5" /></>,
    edit: <><path d="m14.5 5.5 4 4" /><path d="M5 19l3.2-.7L19 7.5a2.8 2.8 0 0 0-4-4L4.2 14.3z" /><path d="M4 20h16" /></>,
  };

  return <svg aria-hidden="true" className="profile-icon" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [completedTradeCount, setCompletedTradeCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [displayNameEditorOpen, setDisplayNameEditorOpen] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState(null);
  const discordIdentity = getDiscordIdentity(user);

  // Use profile data from the DB (not the hardcoded 0)
  const totalXP = profile?.xp ?? 0;
  const rank = getRank(totalXP);
  const progress = getXPProgress(totalXP);

  const displayName =
    profile?.lumio_display_name ||
    profile?.discord_display_name ||
    discordIdentity.displayName ||
    "Trader";

  const discordDisplayName =
    profile?.discord_display_name ||
    discordIdentity.displayName ||
    "Discord member";

  const avatar = profile?.discord_avatar || discordIdentity.avatar;
  const displayNameFeatureEnabled = Object.hasOwn(profile || {}, "lumio_display_name");
  const displayNameChange = getDisplayNameChangeState(profile?.lumio_display_name_changed_at);
  const nextDisplayNameChange = formatDisplayNameChangeTime(displayNameChange.availableAt);

  const openDisplayNameEditor = () => {
    if (!displayNameChange.canChange) return;
    setDisplayNameDraft(displayName);
    setDisplayNameError(null);
    setDisplayNameEditorOpen(true);
  };

  const saveDisplayName = async (event) => {
    event.preventDefault();
    if (!user) return;

    if (!displayNameChange.canChange) {
      setDisplayNameError(`Your next display-name change is available ${nextDisplayNameChange}.`);
      return;
    }

    const nextName = displayNameDraft.trim().replace(/\s+/g, " ");
    if (nextName.length < 2 || nextName.length > 32) {
      setDisplayNameError("Use a display name between 2 and 32 characters.");
      return;
    }

    setSavingDisplayName(true);
    setDisplayNameError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ lumio_display_name: nextName })
      .eq("id", user.id);

    if (updateError) {
      setDisplayNameError(updateError.message || "Unable to update your Lumio display name.");
    } else {
      await refreshProfile();
      setDisplayNameEditorOpen(false);
    }
    setSavingDisplayName(false);
  };

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
          <p className="profile-handle">Discord · {discordDisplayName}</p>
          <div className="profile-meta">
            <span>{rank.title}</span>
            {profile?.created_at && <span>Member since {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(profile.created_at))}</span>}
          </div>
        </div>
        <div className="profile-hero-actions">
          {user && <Link className="secondary-action" to={`/trader/${user.id}`}>View public profile</Link>}
          {displayNameFeatureEnabled ? <>
            <button aria-label="Edit Lumio display name" className="profile-edit-display-name" disabled={!displayNameChange.canChange} onClick={openDisplayNameEditor} title={displayNameChange.canChange ? "Edit Lumio display name" : `Available ${nextDisplayNameChange}`} type="button"><ProfileIcon name="edit" /><span>Edit display name</span></button>
            {!displayNameChange.canChange && <small className="profile-name-cooldown">Available {nextDisplayNameChange}</small>}
          </> : <Link className="profile-settings-link" to="/settings">Account settings</Link>}
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
          <p>Champion copies you have recorded in Lumio.</p>
        </article>
      </section>

      <section className="profile-detail-grid">
        <article className="profile-detail-panel">
          <div className="profile-panel-heading"><div><p className="eyebrow">Connections</p><h2>Linked accounts</h2></div><Link to="/settings">Manage</Link></div>
          <div className="account-connection-row">
            <span className="connection-icon"><ProfileIcon name="discord" /></span>
            <div><strong>Discord</strong><span>{discordDisplayName}</span></div>
            <span className="connected-label">Connected</span>
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

      {displayNameEditorOpen && (
        <div className="modal-overlay" role="presentation">
          <form aria-modal="true" className="trade-modal display-name-editor-modal" onSubmit={saveDisplayName} role="dialog" aria-labelledby="profile-display-name-title">
            <p className="eyebrow">Lumio identity</p>
            <h2 id="profile-display-name-title">Edit display name</h2>
            <p className="modal-copy">This name appears across Lumio. Your Discord display name remains below it and is never changed here.</p>
            <label className="field-label" htmlFor="profile-display-name">Lumio display name</label>
            <input autoFocus disabled={savingDisplayName} id="profile-display-name" maxLength="32" onChange={(event) => setDisplayNameDraft(event.target.value)} value={displayNameDraft} />
            {displayNameError && <p className="inline-error" role="alert">{displayNameError}</p>}
            <div className="modal-buttons">
              <button className="secondary-action" disabled={savingDisplayName} onClick={() => setDisplayNameEditorOpen(false)} type="button">Cancel</button>
              <button className="primary-action" disabled={savingDisplayName || !displayNameDraft.trim() || !displayNameChange.canChange} type="submit">{savingDisplayName ? "Saving…" : "Save display name"}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}

export default Profile;
