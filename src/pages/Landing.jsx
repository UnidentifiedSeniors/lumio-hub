import { useEffect, useState } from "react";

import LoginButton from "../components/LoginButton";
import lumioLogo from "../assets/Lumio Logo.png";
import { supabase } from "../lib/supabase";

const EMPTY_STATS = {
  completedTrades: null,
  licensedTraders: null,
  liveListings: null,
};

function formatStat(value) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function Landing() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL?.trim();

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      const { data, error } = await supabase.functions.invoke("public-community-stats", {
        method: "GET",
      });

      if (!error && data && mounted) {
        setStats({
          completedTrades: data.completedTrades,
          licensedTraders: data.licensedTraders,
          liveListings: data.liveListings,
        });
      }
    }

    void loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="/" aria-label="Lumio Hub home">
          <img src={lumioLogo} alt="" />
          <span>Lumio <em>Hub</em></span>
        </a>
        {discordInviteUrl && <a className="landing-nav-community" href={discordInviteUrl} target="_blank" rel="noreferrer">Community</a>}
      </header>

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="landing-kicker"><span />Anime Fighting Simulator trading</p>
            <h1 id="landing-title">A smarter place to<br /><strong>trade with confidence.</strong></h1>
            <p className="landing-intro">A private, Discord-licensed hub for discovering offers, coordinating clearly, and keeping every trade moving.</p>
            <div className="landing-actions">
              <div className="landing-login"><LoginButton /></div>
              {discordInviteUrl && <a className="landing-discord-button" href={discordInviteUrl} target="_blank" rel="noreferrer">Join the community <span aria-hidden="true">↗</span></a>}
            </div>
            <p className="landing-assurance">Discord-secured access · Public Roblox identity links are optional</p>
          </div>

          <aside className="landing-community-card">
            <div className="landing-community-orbit" aria-hidden="true"><i /><i /><i /></div>
            <p className="landing-card-kicker">Community desk</p>
            <h2>Trade better<br />together.</h2>
            <p>Join the Lumio Discord to share ideas, ask for help, and help shape what comes next.</p>
            {discordInviteUrl ? (
              <a href={discordInviteUrl} target="_blank" rel="noreferrer">Open Lumio Discord <span aria-hidden="true">→</span></a>
            ) : (
              <span className="landing-invite-pending">Discord community link is being connected.</span>
            )}
          </aside>
        </section>

        <section className="landing-stat-section" aria-label="Lumio marketplace activity">
          <div className="landing-stat-intro">
            <p className="landing-card-kicker">Live Lumio activity</p>
            <h2>Built on real marketplace momentum.</h2>
          </div>
          <div className="landing-stats">
            <article className="landing-stat-card">
              <strong>{formatStat(stats.licensedTraders)}</strong>
              <span>Licensed traders</span>
              <small>Discord members cleared for Lumio</small>
            </article>
            <article className="landing-stat-card">
              <strong>{formatStat(stats.liveListings)}</strong>
              <span>Live listings</span>
              <small>Offers currently available to explore</small>
            </article>
            <article className="landing-stat-card">
              <strong>{formatStat(stats.completedTrades)}</strong>
              <span>Confirmed trades</span>
              <small>Completed through Lumio coordination</small>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Landing;
