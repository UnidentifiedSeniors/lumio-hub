import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";

function displayName(trader) {
  return trader.lumio_display_name || trader.discord_display_name || trader.discord_username || "Licensed trader";
}

function formatCount(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString();
}

function Leaderboard() {
  const { user } = useAuth();
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tradeStatsAvailable, setTradeStatsAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from("public_profiles")
        .select("*")
        .order("xp", { ascending: false })
        .limit(100);

      if (!active) return;
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const profiles = profileData || [];
      let statsById = {};
      let hasStats = false;

      if (profiles.length) {
        const { data: statsData, error: statsError } = await supabase
          .from("public_trader_stats")
          .select("id, completed_trade_count")
          .in("id", profiles.map((profile) => profile.id));

        if (!statsError) {
          statsById = Object.fromEntries((statsData || []).map((stats) => [stats.id, stats]));
          hasStats = true;
        }
      }

      if (!active) return;
      setTradeStatsAvailable(hasStats);
      setTraders(profiles.map((profile, index) => ({
        ...profile,
        position: index + 1,
        completed_trade_count: statsById[profile.id]?.completed_trade_count,
      })));
      setLoading(false);
    };

    void loadLeaderboard();

    return () => {
      active = false;
    };
  }, []);

  const topTraders = traders.slice(0, 3);
  const currentTrader = useMemo(() => traders.find((trader) => trader.id === user?.id), [traders, user?.id]);

  return (
    <Layout>
      <section className="page-heading leaderboard-heading">
        <div>
          <p className="eyebrow">Community rankings</p>
          <h1>Leaderboard</h1>
          <p>Ranked by verified trading XP. Completed-trade totals are public aggregates only—private collections and offer details stay private.</p>
        </div>
        {currentTrader && <Link className="leaderboard-position" to={`/trader/${currentTrader.id}`}>Your position <strong>#{currentTrader.position}</strong></Link>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading the leaderboard...</p>
      ) : traders.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">◈</span>
          <h2>The first ranks are waiting</h2>
          <p>Members appear here as they earn trading XP through confirmed exchanges.</p>
          <Link className="secondary-action" to="/trades">Browse Market</Link>
        </section>
      ) : (
        <>
          <section aria-label="Top traders" className="leaderboard-podium">
            {topTraders.map((trader) => {
              const name = displayName(trader);
              return (
                <Link className={`podium-trader podium-position-${trader.position}${trader.id === user?.id ? " is-current" : ""}`} key={trader.id} to={`/trader/${trader.id}`}>
                  <span className="podium-place">#{trader.position}</span>
                  {trader.discord_avatar ? <img alt="" src={trader.discord_avatar} /> : <span className="podium-avatar-fallback">{name.charAt(0).toUpperCase()}</span>}
                  <div>
                    <strong>{name}</strong>
                    <span>{trader.rank || "Rookie Trader"}</span>
                  </div>
                  <em>{formatCount(trader.xp)} XP</em>
                </Link>
              );
            })}
          </section>

          <section className="leaderboard-table" aria-label="Trader rankings">
            <div className="leaderboard-table-heading" aria-hidden="true"><span>Rank</span><span>Trader</span><span>Trading XP</span><span>Completed</span></div>
            {traders.map((trader) => {
              const name = displayName(trader);
              const isCurrent = trader.id === user?.id;
              return (
                <Link className={`leaderboard-row${isCurrent ? " is-current" : ""}`} key={trader.id} to={`/trader/${trader.id}`}>
                  <span className="leaderboard-rank">#{trader.position}</span>
                  <span className="leaderboard-trader">
                    {trader.discord_avatar ? <img alt="" src={trader.discord_avatar} /> : <i>{name.charAt(0).toUpperCase()}</i>}
                    <span><strong>{name}{isCurrent && <em>You</em>}</strong><small>{trader.rank || "Rookie Trader"}</small></span>
                  </span>
                  <strong className="leaderboard-xp">{formatCount(trader.xp)} <small>XP</small></strong>
                  <span className="leaderboard-trades">{tradeStatsAvailable ? `${formatCount(trader.completed_trade_count)} trades` : "—"}</span>
                </Link>
              );
            })}
          </section>
        </>
      )}
    </Layout>
  );
}

export default Leaderboard;
