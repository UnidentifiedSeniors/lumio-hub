import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import champions from "../data/champions";
import { calculateChampionValue } from "../utils/valueCalculator";

function Champion() {
  const { id } = useParams();

  const champion = champions.find((item) => item.id === Number(id));

  if (!champion) {
    return (
      <Layout>
        <h1>Champion not found</h1>
      </Layout>
    );
  }

  const value = calculateChampionValue(champion);

  return (
    <Layout>
      <div className="champion-details">
        <div className="rarity-badge">{champion.rarity}</div>

        <div className="traits">
          {champion.traits.map((trait, i) => (
            <span key={i} className="trait">
              ✨ {trait}
            </span>
          ))}
        </div>

        <h1>{champion.name}</h1>

        <div className="details-grid">
          <div className="dashboard-card">
            <h2>💎 Value</h2>
            <p className="big-number">{value}</p>
          </div>

          <div className="dashboard-card">
            <h2>📦 Stock</h2>
            <p className="big-number">{champion.stock}</p>
          </div>
        </div>

        <Link to="/trading">
          <button>Go to Trade Terminal</button>
        </Link>
      </div>
    </Layout>
  );
}

export default Champion;
