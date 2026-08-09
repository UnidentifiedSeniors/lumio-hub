import Layout from "../components/Layout";
import missions from "../data/missions";
import user from "../data/user";

function Missions() {
  return (
    <Layout>
      <h1>🎯 Missions</h1>

      <div className="mission-grid">
        {missions.map((mission) => (
          <div className="dashboard-card" key={mission.id}>
            <h2>{mission.name}</h2>

            <p>{mission.description}</p>

            <p>
              Reward: ⭐ {mission.rewardXP}
              XP
            </p>

            <p>
              Status:{" "}
              {user.completedMissions.includes(mission.id)
                ? "✅ Completed"
                : "🔒 Locked"}
            </p>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export default Missions;
