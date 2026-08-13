import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import getRank from "../utils/rankCalculator";
import getXPProgress from "../utils/xpProgress";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";

function Profile() {
  const { user, profile } = useAuth();
  const [completedTradeCount, setCompletedTradeCount] = useState(0);

  // Use profile data from the DB (not the hardcoded 0)
  const totalXP = profile?.xp ?? 0;
  const rank = getRank(totalXP);
  const progress = getXPProgress(totalXP);

  const displayName =
    profile?.discord_display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Trader";

  const discordUsername =
    profile?.discord_username ||
    user?.user_metadata?.user_name ||
    "username";

  const avatar = profile?.discord_avatar || user?.user_metadata?.avatar_url;

  useEffect(() => {
    if (!user) return undefined;

    const participantFilter = `sender_id.eq.${user.id},recipient_id.eq.${user.id}`;
    supabase
      .from("trades")
      .select("id")
      .or(participantFilter)
      .eq("status", "completed")
      .then(({ data, error }) => {
        if (!error) setCompletedTradeCount(data?.length || 0);
      });

    return undefined;
  }, [user]);

  return (
    <Layout>
      <h1>👤 Profile</h1>

      <div className="profile-card">
        {avatar && (
          <img src={avatar} alt="Discord Avatar" className="profile-avatar" />
        )}

        <h2>Welcome, {displayName}</h2>

        <p>Discord: @{discordUsername}</p>

        <p>
          Roblox:{" "}
          {profile?.roblox_username
            ? profile.roblox_username
            : "Not Connected"}
        </p>

        {user && <Link className="secondary-action profile-public-link" to={`/trader/${user.id}`}>View public profile</Link>}
      </div>

      <div className="profile-grid">
        <div className="dashboard-card">
          <h2>📈 Trading XP</h2>

          <h3>{rank.title}</h3>

          <p>{totalXP} XP</p>

          <div className="xp-bar">
            <div
              className="xp-progress"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <p>Next Rank: {progress.next.title}</p>
        </div>

        <div className="dashboard-card">
          <h2>🤝 Completed Trades</h2>

          <p className="big-number">{completedTradeCount}</p>
        </div>

        <div className="dashboard-card">
          <h2>🏅 Badges</h2>
          {profile?.badges?.length > 0 ? (
            <p>{profile.badges.join(", ")}</p>
          ) : (
            <p>No badges yet.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Profile;
