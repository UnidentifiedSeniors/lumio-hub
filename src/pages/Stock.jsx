import Layout from "../components/Layout";
import ChampionCard from "../components/ChampionCard";
import champions from "../data/champions";

function Stock() {
  return (
    <Layout>
      <h1>Champion Market</h1>

      <p>
        Browse available champions and current inventory.
      </p>

      <div className="champion-grid">
        {champions.map((champion) => (
          <ChampionCard key={champion.id} champion={champion} />
        ))}
      </div>
    </Layout>
  );
}

export default Stock;