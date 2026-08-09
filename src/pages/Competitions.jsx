import Layout from "../components/Layout";
import competitions from "../data/competitions";

function Competitions() {
  return (
    <Layout>
      <h1>🔥 Competitions</h1>

      <div className="competition-grid">
        {competitions.map((competition) => (
          <div className="dashboard-card" key={competition.id}>
            <h2>{competition.name}</h2>

            <p>{competition.description}</p>

            <p>🏆 Reward: {competition.reward}</p>

            <p>⏳ Ends: {competition.ends}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export default Competitions;
