import { useState } from "react";

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
  const { profile, refreshProfile } = useAuth();
  const [syncingRank, setSyncingRank] = useState(false);
  const [rankSyncMessage, setRankSyncMessage] = useState(null);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [linkingRoblox, setLinkingRoblox] = useState(false);
  const [robloxMessage, setRobloxMessage] = useState(null);

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

  const linkRoblox = async (event) => {
    event.preventDefault();
    setLinkingRoblox(true);
    setRobloxMessage(null);

    const { data, error } = await supabase.functions.invoke("roblox-profile-link", {
      body: { username: robloxUsername },
    });

    if (error || data?.error) {
      setRobloxMessage({ type: "error", text: await edgeFunctionErrorMessage(data, error, "Unable to link that Roblox account.") });
    } else {
      setRobloxUsername("");
      await refreshProfile();
      setRobloxMessage({ type: "success", text: `@${data.roblox.username} is linked to your Lumio profile.` });
    }
    setLinkingRoblox(false);
  };

  const unlinkRoblox = async () => {
    if (!window.confirm("Disconnect this Roblox account from Lumio?")) return;

    setLinkingRoblox(true);
    setRobloxMessage(null);
    const { data, error } = await supabase.functions.invoke("roblox-profile-link", {
      body: { action: "unlink" },
    });

    if (error || data?.error) {
      setRobloxMessage({ type: "error", text: await edgeFunctionErrorMessage(data, error, "Unable to disconnect Roblox right now.") });
    } else {
      await refreshProfile();
      setRobloxMessage({ type: "success", text: "Your Roblox account has been disconnected." });
    }
    setLinkingRoblox(false);
  };

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Account preferences</p>
        <h1>Settings</h1>
        <p>Manage the connections and preferences that shape your trading experience.</p>
      </section>

      <section className="settings-grid">
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
        <article className="settings-card roblox-link-card">
          <span className="settings-card-label">Connections</span>
          <h2>Roblox</h2>
          <p>Optionally add the public Roblox username you use for Anime Fighting Simulator so accepted trades are easier to coordinate.</p>
          <div className="roblox-connection-panel">
            {profile?.roblox_username && <span className="connected-label">Linked · @{profile.roblox_username}</span>}
            <form className="roblox-link-form" onSubmit={linkRoblox}>
              <label className="sr-only" htmlFor="roblox-username">Roblox username</label>
              <input
                autoComplete="off"
                disabled={linkingRoblox}
                id="roblox-username"
                maxLength="20"
                onChange={(event) => setRobloxUsername(event.target.value)}
                placeholder={profile?.roblox_username ? "Replace Roblox username" : "Roblox username"}
                value={robloxUsername}
              />
              <div className="roblox-link-actions">
                <button className="secondary-action" disabled={linkingRoblox || !robloxUsername.trim()} type="submit">{linkingRoblox ? "Looking up…" : profile?.roblox_username ? "Update link" : "Connect Roblox"}</button>
                {profile?.roblox_username && <button className="text-action danger-action" disabled={linkingRoblox} onClick={() => void unlinkRoblox()} type="button">Disconnect</button>}
              </div>
            </form>
            <small>Public identity link only — we check that the account exists, not that you own it. Lumio never asks for Roblox credentials; Discord remains your secure Lumio sign-in.</small>
            {robloxMessage && <p className={robloxMessage.type === "success" ? "inline-success" : "inline-error"} role={robloxMessage.type === "success" ? "status" : "alert"}>{robloxMessage.text}</p>}
          </div>
        </article>
        <article className="settings-card">
          <span className="settings-card-label">Trading</span>
          <h2>Offer notifications</h2>
          <p>Choose how Lumio Hub should alert you when your trade activity changes.</p>
          <span className="coming-soon-label">Preference controls next</span>
        </article>
      </section>
    </Layout>
  );
}

export default Settings;
