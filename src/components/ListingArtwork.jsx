import { useState } from "react";
import { getChampionImageUrl } from "../data/gameCatalog";

function ListingArtwork({ imageUrl, name, trait }) {
  const localImageUrl = getChampionImageUrl(name);
  const [failedImageUrls, setFailedImageUrls] = useState(() => new Set());
  const [loadedImageUrl, setLoadedImageUrl] = useState(null);
  const resolvedImageUrl = [imageUrl, localImageUrl]
    .filter(Boolean)
    .find((candidate) => !failedImageUrls.has(candidate));
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  const imageHasLoaded = loadedImageUrl === resolvedImageUrl;

  const handleImageError = () => {
    if (!resolvedImageUrl) return;
    setLoadedImageUrl(null);
    setFailedImageUrls((current) => new Set([...current, resolvedImageUrl]));
  };

  return (
    <div className="listing-artwork">
      {!imageHasLoaded && <span aria-hidden="true" className="listing-artwork-fallback">{initial}</span>}
      {resolvedImageUrl && <img alt={`${name} champion artwork`} onError={handleImageError} onLoad={() => setLoadedImageUrl(resolvedImageUrl)} src={resolvedImageUrl} />}
      {trait && <span className="listing-artwork-trait">{trait}</span>}
    </div>
  );
}

export default ListingArtwork;
