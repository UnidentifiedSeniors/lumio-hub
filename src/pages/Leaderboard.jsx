import Layout from "../components/Layout";
import leaderboard from "../data/leaderboard";

function Leaderboard() {
  return (
    <Layout>
      <h1>🏆 Leaderboard</h1>

      <div className="leaderboard">
        {leaderboard.map((player) => (
          <div className="leader-card" key={player.rank}>
            <h2>
              #{player.rank} {player.username}
            </h2>

            <p>⭐ Level: {player.level}</p>

            <p>XP: {player.xp.toLocaleString()}</p>

            <p>Trades: {player.trades}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export default Leaderboard;
