import { formatLumioDate } from "./datePreferences";
import { calculateChampionValue } from "./valueCalculator";

export function getOwnedChampionValue(champion) {
  const baseValue = Number(
    champion?.base_value ?? calculateChampionValue(champion || {})
  );
  const adjustment = Number(champion?.market_adjustment ?? 1);

  return Math.round(baseValue * adjustment);
}

export function getChampionTraits(champion) {
  if (Array.isArray(champion?.traits)) return champion.traits.filter(Boolean);
  if (champion?.trait && champion.trait !== "Standard") return [champion.trait];
  return [];
}

export function toTradeChampion(champion) {
  return {
    id: champion.champion_id || champion.id,
    user_champion_id: champion.id,
    name: champion.name,
    rarity: champion.rarity,
    traits: getChampionTraits(champion),
    trait: champion.trait || "Standard",
    value: getOwnedChampionValue(champion),
  };
}

export function formatDateTime(value, preferences, options) {
  return formatLumioDate(value, preferences, options);
}

export function getListingCode(listingId) {
  const compactId = String(listingId || "").replaceAll("-", "").slice(0, 6).toUpperCase();
  return compactId ? `L-${compactId}` : "L-PENDING";
}
