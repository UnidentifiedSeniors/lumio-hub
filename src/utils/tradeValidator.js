import { calculateChampionValue } from "./valueCalculator";
import rarities from "../data/rarities";
import champions from "../data/champions";

function getChampionById(id) {
  // Resolve full champion data (rarity/traits) from source of truth.
  if (id && typeof id === "object" && id.rarity) return id;
  return champions.find((c) => c.id === id || c.id === Number(id));
}

function rarityRank(rarity) {
  return rarities[rarity] || 0;
}

function validateTrade(target, offer) {
  const targetRarity = rarityRank(target.rarity);
  const lowestAllowedRarity = targetRarity - 2;

  const hasBadChampion = offer.some((champion) => {
    const full = getChampionById(champion);
    return rarityRank(full.rarity) < lowestAllowedRarity;
  });

  if (hasBadChampion) {
    return { valid: false, message: "Offer contains champions that are too low rarity." };
  }

  const offerValue = offer.reduce((total, champion) => {
    const full = getChampionById(champion);
    return total + calculateChampionValue(full);
  }, 0);

  const targetValue = calculateChampionValue(target);

  if (offerValue < targetValue) {
    return { valid: false, message: "Offer value is too low." };
  }

  return { valid: true, message: "Trade accepted." };
}

export default validateTrade;
