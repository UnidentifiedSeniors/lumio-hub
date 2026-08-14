import { useState } from "react";

function ListingArtwork({ imageUrl, name, rarity, trait }) {
  const [imageUnavailable, setImageUnavailable] = useState(!imageUrl);
  const initial = name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`listing-artwork listing-artwork-${rarity?.toLowerCase().replaceAll(" ", "-") || "unknown"}`}>
      <span aria-hidden="true" className="listing-artwork-fallback">{initial}</span>
      {!imageUnavailable && <img alt={`${name} champion artwork`} onError={() => setImageUnavailable(true)} src={imageUrl} />}
      {trait && <span className="listing-artwork-trait">{trait}</span>}
    </div>
  );
}

export default ListingArtwork;
