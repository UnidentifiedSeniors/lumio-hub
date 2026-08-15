import CollapsibleChampionArtwork from "./CollapsibleChampionArtwork";

function TradeCard({ champion, action, label }) {
  const unavailable = champion.stock <= 0;

  return (
    <div className="trade-card">
      <div>
        <CollapsibleChampionArtwork imageUrl={champion.image_url} name={champion.name} />
        <h3>{champion.name}</h3>
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
