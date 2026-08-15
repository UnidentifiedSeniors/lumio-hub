import { formatLumioDate } from "./datePreferences";

export function getOfficialChampionValue(champion) {
  const value = Number(champion?.officialValue ?? champion?.base_value ?? champion?.value ?? 0);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
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
    rarity: champion.rarity || "Unlisted",
    traits: getChampionTraits(champion),
    trait: champion.trait || "Standard",
    value: getOfficialChampionValue(champion),
  };
}

export function formatDateTime(value, preferences, options) {
  return formatLumioDate(value, preferences, options);
}

export function getListingCode(listingId) {
  const compactId = String(listingId || "").replaceAll("-", "").slice(0, 6).toUpperCase();
  return compactId ? `L-${compactId}` : "L-PENDING";
}
