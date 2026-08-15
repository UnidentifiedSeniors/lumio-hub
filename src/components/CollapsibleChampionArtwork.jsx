import { useState } from "react";

import ListingArtwork from "./ListingArtwork";

function CollapsibleChampionArtwork({ compact = false, imageUrl, name, trait }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasBeenExpanded, setHasBeenExpanded] = useState(false);

  const toggleArtwork = () => {
    if (!isExpanded) setHasBeenExpanded(true);
    setIsExpanded((current) => !current);
  };

  return (
    <div className={`champion-artwork-disclosure${compact ? " is-compact" : ""}${isExpanded ? " is-expanded" : ""}`}>
      <button aria-expanded={isExpanded} className="champion-artwork-toggle" onClick={toggleArtwork} type="button">
        <span className="champion-artwork-toggle-icon" aria-hidden="true">▧</span>
        <span>{isExpanded ? "Hide artwork" : compact ? "Preview" : "Show artwork"}</span>
        <span className="champion-artwork-toggle-chevron" aria-hidden="true">⌄</span>
      </button>
      <div aria-hidden={!isExpanded} className="champion-artwork-reveal">
        {hasBeenExpanded && <ListingArtwork imageUrl={imageUrl} name={name} trait={trait} />}
      </div>
    </div>
  );
}

export default CollapsibleChampionArtwork;
