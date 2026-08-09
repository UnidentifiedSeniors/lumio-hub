import { Link } from "react-router-dom";
import { calculateChampionValue } from "../utils/valueCalculator";

function ChampionCard({ champion }) {
  const value = calculateChampionValue(champion);

  return (
    <div className="champion-card">
      <div className="rarity-badge">{champion.rarity}</div>

      <div className="traits">
        {champion.traits && champion.traits.map((trait, i) => (
          <span key={i} className="trait">
            ✨ {trait}
          </span>
        ))}
      </div>

      <h2>{champion.name}</h2>

      <p>💎 Value: {value}</p>

      <p>📦 Stock: {champion.stock}</p>

      <Link to={`/champion/${champion.id}`}>
        <button>View Champion</button>
      </Link>
    </div>
  );
}

export default ChampionCard;