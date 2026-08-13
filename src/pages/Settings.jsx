import { useState } from "react";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";

function Settings() {
  const { profile } = useAuth();
  const [syncingRank, setSyncingRank] = useState(false);
  const [rankSyncMessage, setRankSyncMessage] = useState(null);

  const syncDiscordRank = async () => {
    setSyncingRank(true);
    setRankSyncMessage(null);

    const { data, error } = await supabase.functions.invoke("discord-rank-sync", {
      body: { source: "settings" },
    });

    if (error || data?.error) {
      setRankSyncMessage({
        type: "error",
        text: data?.error || error?.message || "Unable to sync your Discord rank.",
      });
    } else {
      setRankSyncMessage({
        type: "success",
        text: `${data.rank} is now synced to Discord.`,
      });
    }
    setSyncingRank(false);
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
        <article className="settings-card">
          <span className="settings-card-label">Connections</span>
          <h2>Roblox</h2>
          <p>Connect your Roblox identity to make accepted trade coordination clearer.</p>
          <button className="secondary-action" type="button">Connect Roblox</button>
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
