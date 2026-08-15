import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ChoiceMenu from "../components/ChoiceMenu";
import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { formatDisplayNameChangeTime, getDisplayNameChangeState } from "../utils/displayNameCooldown";
import { DATE_FORMAT_OPTIONS, getDatePreferences } from "../utils/datePreferences";
import { LUMIO_DISPLAY_NAME_MAX_LENGTH, validateLumioDisplayName } from "../utils/lumioDisplayName";
import { isTradingLicensed } from "../utils/tradingLicense";

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
  const licensed = isTradingLicensed(profile);
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
  const [savingDatePreferences, setSavingDatePreferences] = useState(false);
  const [datePreferencesMessage, setDatePreferencesMessage] = useState(null);
  const displayNameFeatureEnabled = Object.hasOwn(profile || {}, "lumio_display_name");
  const notificationPreferencesFeatureEnabled = Object.hasOwn(profile || {}, "notification_preferences");
  const directOfferPreferenceFeatureEnabled = Object.hasOwn(profile || {}, "direct_offers_enabled");
  const collectionVisibilityFeatureEnabled = Object.hasOwn(profile || {}, "collection_visibility");
  const datePreferencesFeatureEnabled = Object.hasOwn(profile || {}, "date_format") && Object.hasOwn(profile || {}, "date_include_time");
  const directOffersEnabled = profile?.direct_offers_enabled !== false;
  const collectionVisibility = profile?.collection_visibility === "private" ? "private" : "public";
  const datePreferences = getDatePreferences(profile);
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

    const nameValidationError = validateLumioDisplayName(nextName);
    if (nameValidationError) {
      setDisplayNameMessage({ type: "error", text: nameValidationError });
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

  const saveDatePreferences = async (nextPreferences) => {
    if (!user || savingDatePreferences) return;

    const nextDateFormat = nextPreferences.dateFormat || datePreferences.dateFormat;
    const nextIncludeTime = nextPreferences.includeTime ?? datePreferences.includeTime;
    setSavingDatePreferences(true);
    setDatePreferencesMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        date_format: nextDateFormat,
        date_include_time: nextIncludeTime,
      })
      .eq("id", user.id);

    if (error) {
      setDatePreferencesMessage({ type: "error", text: error.message || "Unable to update date preferences." });
    } else {
      await refreshProfile();
      setDatePreferencesMessage({ type: "success", text: "Date and time preferences saved." });
    }
    setSavingDatePreferences(false);
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
        <p>{licensed ? "Manage the connections and preferences that shape your trading experience." : "Manage your connected account. Trading preferences unlock after you pass the Trading License assessment."}</p>
      </section>

      <section className="settings-grid">
        <article className="settings-card display-name-card">
          <span className="settings-card-label">Lumio identity</span>
          <h2>Display name</h2>
          <p>Choose the name Lumio members see across your profile, market listings, and offers. Lumio names use 3–15 letters only.</p>
          {displayNameFeatureEnabled ? (
            <>
              <form className="display-name-form" onSubmit={saveDisplayName}>
                <label className="sr-only" htmlFor="lumio-display-name">Lumio display name</label>
                <input
                  disabled={savingDisplayName || !displayNameChange.canChange}
                  id="lumio-display-name"
                  maxLength={LUMIO_DISPLAY_NAME_MAX_LENGTH}
                  onChange={(event) => setLumioDisplayName(event.target.value)}
                  value={lumioDisplayName}
                />
                <button className="secondary-action" disabled={savingDisplayName || !lumioDisplayName.trim() || !displayNameChange.canChange} type="submit">{savingDisplayName ? "Saving…" : "Save display name"}</button>
              </form>
              <small>Your Discord display name stays underneath and is not changed here. Discord defaults can be longer; your custom Lumio name cannot.</small>
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
        {!licensed && <article className="settings-card license-settings-card"><span className="settings-card-label">Trading access</span><h2>Trading License required</h2><p>Market, Shelf, direct offers, and trader preferences unlock only after you complete Lumio&apos;s guide and pass the assessment.</p><Link className="success-action" to="/license">Start the license guide</Link></article>}
        {licensed && <>
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
        <article className="settings-card date-preferences-card">
          <span className="settings-card-label">Regional display</span>
          <h2>Date &amp; time</h2>
          <p>Choose how Lumio presents dates across your trades and account activity. Exact trade details always retain their time.</p>
          {datePreferencesFeatureEnabled ? (
            <div className="date-preference-controls">
              <ChoiceMenu label="Date format" onChange={(dateFormat) => void saveDatePreferences({ dateFormat })} options={DATE_FORMAT_OPTIONS} value={datePreferences.dateFormat} />
              <button aria-pressed={datePreferences.includeTime} className="notification-preference" disabled={savingDatePreferences} onClick={() => void saveDatePreferences({ includeTime: !datePreferences.includeTime })} type="button">
                <span><strong>Include time with dates</strong><small>{datePreferences.includeTime ? "Dates include the local time when it is useful." : "Dates stay concise unless a screen requires exact timing."}</small></span>
                <span className={`preference-switch${datePreferences.includeTime ? " is-on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              {datePreferencesMessage && <p className={datePreferencesMessage.type === "success" ? "inline-success" : "inline-error"} role={datePreferencesMessage.type === "success" ? "status" : "alert"}>{datePreferencesMessage.text}</p>}
            </div>
          ) : (
            <small>Available as soon as the date preferences update is applied.</small>
          )}
        </article>
        <article className="settings-card direct-offer-preferences-card">
          <span className="settings-card-label">Trading availability</span>
          <h2>Receive direct trades</h2>
          <p>Control whether licensed traders can send you a private offer. Your active Shelf listings stay offerable either way.</p>
          {directOfferPreferenceFeatureEnabled ? (
            <div className="notification-preference-list">
              <button aria-pressed={directOffersEnabled} className="notification-preference" disabled={savingDirectOffers} onClick={() => void toggleDirectOffers()} type="button">
                <span><strong>Receive direct trades</strong><small>{directOffersEnabled ? "Traders can send you a private offer even when your Collection is private." : "Private offers are paused until you turn this back on."}</small></span>
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
        </>}
      </section>
    </Layout>
  );
}

export default Settings;
