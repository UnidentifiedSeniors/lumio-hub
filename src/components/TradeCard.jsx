import { calculateChampionValue } from "../utils/valueCalculator";

function TradeCard({ champion, action, label, value }) {
  const unavailable = champion.stock <= 0;
  const displayValue = value ?? calculateChampionValue(champion);

  return (
    <div className="trade-card">
      <div>
        <h3>{champion.name}</h3>
        <p className="rarity-badge">{champion.rarity}</p>
        <p>💎 {displayValue}</p>
        <p>📦 Stock: {champion.stock}</p>
        {champion.traits && champion.traits.length > 0 && (
          <p>✨ {champion.traits.join(", ")}</p>
        )}
      </div>

      <button disabled={unavailable} onClick={action}>
        {unavailable ? "Out of Stock" : label}
      </button>
    </div>
  );
}

export default TradeCard;
