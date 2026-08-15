import { formatLumioDate } from "./datePreferences";

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
    traits: getChampionTraits(champion),
    trait: champion.trait || "Standard",
  };
}

export function formatDateTime(value, preferences, options) {
  return formatLumioDate(value, preferences, options);
}

export function getListingCode(listingId) {
  const compactId = String(listingId || "").replaceAll("-", "").slice(0, 6).toUpperCase();
  return compactId ? `L-${compactId}` : "L-PENDING";
}
