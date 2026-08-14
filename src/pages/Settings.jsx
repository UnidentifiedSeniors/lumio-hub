import { useEffect, useState } from "react";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { formatDisplayNameChangeTime, getDisplayNameChangeState } from "../utils/displayNameCooldown";

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
  const [savingDirectOffers, setSavingDirectOffers] = useState(false);
  const [directOfferMessage, setDirectOfferMessage] = useState(null);
  const [savingCollectionVisibility, setSavingCollectionVisibility] = useState(false);
  const [collectionVisibilityMessage, setCollectionVisibilityMessage] = useState(null);
  const displayNameFeatureEnabled = Object.hasOwn(profile || {}, "lumio_display_name");
  const notificationPreferencesFeatureEnabled = Object.hasOwn(profile || {}, "notification_preferences");
  const directOfferPreferenceFeatureEnabled = Object.hasOwn(profile || {}, "direct_offers_enabled");
  const collectionVisibilityFeatureEnabled = Object.hasOwn(profile || {}, "collection_visibility");
  const directOffersEnabled = profile?.direct_offers_enabled !== false;
  const collectionVisibility = profile?.collection_visibility === "public" ? "public" : "private";
  const displayNameChange = getDisplayNameChangeState(profile?.lumio_display_name_changed_at);
  const nextDisplayNameChange = formatDisplayNameChangeTime(displayNameChange.availableAt);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLumioDisplayName(profile?.lumio_display_name || profile?.discord_display_name || profile?.discord_username || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile?.discord_display_name, profile?.discord_username, profile?.lumio_display_name]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedPreferences = profile?.notification_preferences;
      setNotificationPreferences({
        ...savedPreferences,
        new_offers: savedPreferences?.new_offers !== false,
        trade_updates: savedPreferences?.trade_updates !== false,
      });
    }, 0);
    return () => window.clearTimeout(timer);
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

    if (!displayNameChange.canChange) {
      setDisplayNameMessage({ type: "error", text: `Your next display-name change is available ${nextDisplayNameChange}.` });
      return;
    }

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

  const toggleCollectionVisibility = async () => {
    if (!user || savingCollectionVisibility) return;

    const nextVisibility = collectionVisibility === "public" ? "private" : "public";
    setSavingCollectionVisibility(true);
    setCollectionVisibilityMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ collection_visibility: nextVisibility })
      .eq("id", user.id);

    if (error) {
      setCollectionVisibilityMessage({ type: "error", text: error.message || "Unable to update collection visibility." });
    } else {
      await refreshProfile();
      setCollectionVisibilityMessage({
        type: "success",
        text: nextVisibility === "public"
          ? "Your Collection is now visible on your public trader profile."
          : "Your Collection is now private. Active Shelf listings stay public.",
      });
    }
    setSavingCollectionVisibility(false);
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

  const toggleDirectOffers = async () => {
    if (!user || savingDirectOffers) return;

    const nextEnabled = !directOffersEnabled;
    setSavingDirectOffers(true);
    setDirectOfferMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ direct_offers_enabled: nextEnabled })
      .eq("id", user.id);

    if (error) {
      setDirectOfferMessage({ type: "error", text: error.message || "Unable to update direct-offer availability." });
    } else {
      await refreshProfile();
      setDirectOfferMessage({
        type: "success",
        text: nextEnabled
          ? "Direct offers are available from your public profile."
          : "Direct offers are paused. Your active Shelf listings remain available.",
      });
    }
    setSavingDirectOffers(false);
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
                  disabled={savingDisplayName || !displayNameChange.canChange}
                  id="lumio-display-name"
                  maxLength="32"
                  onChange={(event) => setLumioDisplayName(event.target.value)}
                  value={lumioDisplayName}
                />
                <button className="secondary-action" disabled={savingDisplayName || !lumioDisplayName.trim() || !displayNameChange.canChange} type="submit">{savingDisplayName ? "Saving…" : "Save display name"}</button>
              </form>
              <small>Your Discord display name stays underneath and is not changed here.</small>
              {!displayNameChange.canChange && <small className="display-name-cooldown">Next change available {nextDisplayNameChange}.</small>}
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
        <article className="settings-card direct-offer-preferences-card">
          <span className="settings-card-label">Trading availability</span>
          <h2>Direct offers</h2>
          <p>Control whether licensed traders can send an open offer from your public profile. Your active Shelf listings stay offerable either way.</p>
          {directOfferPreferenceFeatureEnabled ? (
            <div className="notification-preference-list">
              <button aria-pressed={directOffersEnabled} className="notification-preference" disabled={savingDirectOffers} onClick={() => void toggleDirectOffers()} type="button">
                <span><strong>Accept direct offers</strong><small>{directOffersEnabled ? "Traders can start an open offer from your profile." : "Profile-based offers are paused until you turn this back on."}</small></span>
                <span className={`preference-switch${directOffersEnabled ? " is-on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              {directOfferMessage && <p className={directOfferMessage.type === "success" ? "inline-success" : "inline-error"} role={directOfferMessage.type === "success" ? "status" : "alert"}>{directOfferMessage.text}</p>}
            </div>
          ) : (
            <small>Available as soon as the trading availability update is applied.</small>
          )}
        </article>
        <article className="settings-card collection-privacy-card">
          <span className="settings-card-label">Profile privacy</span>
          <h2>Collection visibility</h2>
          <p>Choose whether traders can browse the champions you have recorded in Lumio from your public profile.</p>
          {collectionVisibilityFeatureEnabled ? (
            <div className="notification-preference-list">
              <button aria-pressed={collectionVisibility === "public"} className="notification-preference" disabled={savingCollectionVisibility} onClick={() => void toggleCollectionVisibility()} type="button">
                <span><strong>Share my Collection publicly</strong><small>{collectionVisibility === "public" ? "Traders can view your recorded champion copies, traits, and values." : "Only you can view your recorded champion copies."}</small></span>
                <span className={`preference-switch${collectionVisibility === "public" ? " is-on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              <small className="collection-privacy-note">Your active Shelf listings are always public while they are live.</small>
              {collectionVisibilityMessage && <p className={collectionVisibilityMessage.type === "success" ? "inline-success" : "inline-error"} role={collectionVisibilityMessage.type === "success" ? "status" : "alert"}>{collectionVisibilityMessage.text}</p>}
            </div>
          ) : (
            <small>Available as soon as the profile privacy update is applied.</small>
          )}
        </article>
      </section>
    </Layout>
  );
}

export default Settings;
