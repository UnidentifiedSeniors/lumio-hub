import { Link } from "react-router-dom";
import ListingArtwork from "./ListingArtwork";

function ChampionCard({ champion }) {
  return (
    <div className="champion-card">
      <ListingArtwork imageUrl={champion.image_url} name={champion.name} />

      <div className="traits">
        {champion.traits && champion.traits.map((trait, i) => (
          <span key={i} className="trait">
            ✨ {trait}
          </span>
        ))}
      </div>

      <h2>{champion.name}</h2>

      <Link to={`/champion/${champion.id}`}>
        <button>View Champion</button>
      </Link>
    </div>
  );
}

export default ChampionCard;
