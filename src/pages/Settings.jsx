import { useEffect, useState } from "react";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";

async function edgeFunctionErrorMessage(data, error, fallback) {
  if (data?.error) return data.error;

  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const errorBody = await response.json();
      if (errorBody?.error) return errorBody.error;
    } catch {
      // The response body may already be consumed. Use the generic SDK error.
    }
  }

  return error?.message || fallback;
}

function Settings() {
  const { profile, refreshProfile, user } = useAuth();
  const [syncingRank, setSyncingRank] = useState(false);
  const [rankSyncMessage, setRankSyncMessage] = useState(null);
  const [lumioDisplayName, setLumioDisplayName] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameMessage, setDisplayNameMessage] = useState(null);
  const [notificationPreferences, setNotificationPreferences] = useState({ new_offers: true, trade_updates: true });
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [notificationPreferenceMessage, setNotificationPreferenceMessage] = useState(null);
  const displayNameFeatureEnabled = Object.hasOwn(profile || {}, "lumio_display_name");
  const notificationPreferencesFeatureEnabled = Object.hasOwn(profile || {}, "notification_preferences");

  useEffect(() => {
    setLumioDisplayName(profile?.lumio_display_name || profile?.discord_display_name || profile?.discord_username || "");
  }, [profile?.discord_display_name, profile?.discord_username, profile?.lumio_display_name]);

  useEffect(() => {
    const savedPreferences = profile?.notification_preferences;
    setNotificationPreferences({
      ...savedPreferences,
      new_offers: savedPreferences?.new_offers !== false,
      trade_updates: savedPreferences?.trade_updates !== false,
    });
  }, [profile?.notification_preferences]);

  const syncDiscordRank = async () => {
    setSyncingRank(true);
    setRankSyncMessage(null);

    const { data, error } = await supabase.functions.invoke("discord-rank-sync", {
      body: { source: "settings" },
    });

    if (error || data?.error) {
      setRankSyncMessage({
        type: "error",
        text: await edgeFunctionErrorMessage(data, error, "Unable to sync your Discord rank."),
      });
    } else {
      setRankSyncMessage({
        type: "success",
        text: `${data.rank} is now synced to Discord.`,
      });
    }
    setSyncingRank(false);
  };

  const saveDisplayName = async (event) => {
    event.preventDefault();
    const nextName = lumioDisplayName.trim().replace(/\s+/g, " ");

    if (nextName.length < 2 || nextName.length > 32) {
      setDisplayNameMessage({ type: "error", text: "Use a display name between 2 and 32 characters." });
      return;
    }
    if (!user) return;

    setSavingDisplayName(true);
    setDisplayNameMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ lumio_display_name: nextName })
      .eq("id", user.id);

    if (error) {
      setDisplayNameMessage({ type: "error", text: error.message || "Unable to update your display name." });
    } else {
      await refreshProfile();
      setDisplayNameMessage({ type: "success", text: "Your Lumio display name has been updated." });
    }
    setSavingDisplayName(false);
  };

  const toggleNotificationPreference = async (preference) => {
    if (!user || savingNotificationPreferences) return;

    const nextPreferences = {
      ...notificationPreferences,
      [preference]: !notificationPreferences[preference],
    };

    setSavingNotificationPreferences(true);
    setNotificationPreferenceMessage(null);
    setNotificationPreferences(nextPreferences);

    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: nextPreferences })
      .eq("id", user.id);

    if (error) {
      setNotificationPreferences(notificationPreferences);
      setNotificationPreferenceMessage({ type: "error", text: error.message || "Unable to update notification preferences." });
    } else {
      await refreshProfile();
      setNotificationPreferenceMessage({ type: "success", text: "Notification preferences saved." });
    }
    setSavingNotificationPreferences(false);
  };

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Account preferences</p>
        <h1>Settings</h1>
        <p>Manage the connections and preferences that shape your trading experience.</p>
      </section>

      <section className="settings-grid">
        <article className="settings-card display-name-card">
          <span className="settings-card-label">Lumio identity</span>
          <h2>Display name</h2>
          <p>Choose the name Lumio members see across your profile, market listings, and offers.</p>
          {displayNameFeatureEnabled ? (
            <>
              <form className="display-name-form" onSubmit={saveDisplayName}>
                <label className="sr-only" htmlFor="lumio-display-name">Lumio display name</label>
                <input
                  disabled={savingDisplayName}
                  id="lumio-display-name"
                  maxLength="32"
                  onChange={(event) => setLumioDisplayName(event.target.value)}
                  value={lumioDisplayName}
                />
                <button className="secondary-action" disabled={savingDisplayName || !lumioDisplayName.trim()} type="submit">{savingDisplayName ? "Saving…" : "Save display name"}</button>
              </form>
              <small>Your Discord display name stays underneath and is not changed here.</small>
              {displayNameMessage && <p className={displayNameMessage.type === "success" ? "inline-success" : "inline-error"} role={displayNameMessage.type === "success" ? "status" : "alert"}>{displayNameMessage.text}</p>}
            </>
          ) : (
            <small>Available as soon as the account settings update is applied.</small>
          )}
        </article>
        <article className="settings-card">
          <span className="settings-card-label">Connections</span>
          <h2>Discord</h2>
          <p>Your Discord account is used to verify your trader license and send trade updates.</p>
          <span className="connected-label">Connected</span>
        </article>
        <article className="settings-card rank-sync-card">
          <span className="settings-card-label">Discord roles</span>
          <h2>Rank sync</h2>
          <p>Keep your Lumio rank aligned with the dedicated Discord role for your current progression level.</p>
          <div className="rank-sync-footer">
            <span className="rank-sync-current">Current rank: <strong>{profile?.rank || "Rookie Trader"}</strong></span>
            <button className="secondary-action" disabled={syncingRank} onClick={syncDiscordRank} type="button">{syncingRank ? "Syncing…" : "Sync my Discord rank"}</button>
          </div>
          {rankSyncMessage && <p className={rankSyncMessage.type === "success" ? "inline-success" : "inline-error"} role={rankSyncMessage.type === "success" ? "status" : "alert"}>{rankSyncMessage.text}</p>}
        </article>
        <article className="settings-card notification-preferences-card">
          <span className="settings-card-label">Trading</span>
          <h2>Offer notifications</h2>
          <p>Choose which in-app alerts Lumio creates for your trading activity.</p>
          {notificationPreferencesFeatureEnabled ? (
            <div className="notification-preference-list">
              <button aria-pressed={notificationPreferences.new_offers} className="notification-preference" disabled={savingNotificationPreferences} onClick={() => void toggleNotificationPreference("new_offers")} type="button">
                <span><strong>New offers</strong><small>When another trader wants to trade with you.</small></span>
                <span className={`preference-switch${notificationPreferences.new_offers ? " is-on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              <button aria-pressed={notificationPreferences.trade_updates} className="notification-preference" disabled={savingNotificationPreferences} onClick={() => void toggleNotificationPreference("trade_updates")} type="button">
                <span><strong>Trade updates</strong><small>Accepted, declined, withdrawn, and completed trades.</small></span>
                <span className={`preference-switch${notificationPreferences.trade_updates ? " is-on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              {notificationPreferenceMessage && <p className={notificationPreferenceMessage.type === "success" ? "inline-success" : "inline-error"} role={notificationPreferenceMessage.type === "success" ? "status" : "alert"}>{notificationPreferenceMessage.text}</p>}
            </div>
          ) : (
            <small>Available as soon as the account settings update is applied.</small>
          )}
        </article>
      </section>
    </Layout>
  );
}

export default Settings;
