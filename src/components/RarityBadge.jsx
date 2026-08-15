import { rarityBadgeClassName } from "../utils/rarityBadge";

function RarityBadge({ rarity }) {
  const label = rarity || "Unlisted";
  return <span className={rarityBadgeClassName(label)}>{label}</span>;
}

export default RarityBadge;
