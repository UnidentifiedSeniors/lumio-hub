import rarities from "../data/rarities";
import { traitsByName } from "../data/traits";

const TRAIT_BONUS = 20;
const CLAN_POINT_VALUE = 75;
const TRAIT_PERCENT_VALUE = 3;

function getRarityValue(rarity) {
  return rarities[rarity] || 0;
}

function getStatTotal(champion) {
  const suppliedTotal = Number(champion?.statTotal);
  if (Number.isFinite(suppliedTotal) && suppliedTotal > 0) return suppliedTotal;

  if (champion?.statBonuses && typeof champion.statBonuses === "object") {
    return Object.values(champion.statBonuses).reduce((total, statBonus) => {
      const value = Number(statBonus);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  return 0;
}

function getTraitBonus(traits, traitLookup = traitsByName) {
  return traits.reduce((total, traitName) => total + (traitLookup.get(traitName)?.bonusTotal || 0), 0);
}

function calculateChampionValue(champion, traitLookup = traitsByName) {
  const statTotal = getStatTotal(champion);
  const clanPoints = Number(champion?.clanPoints);
  let value = statTotal > 0
    ? statTotal + (Number.isFinite(clanPoints) ? clanPoints * CLAN_POINT_VALUE : 0)
    : getRarityValue(champion?.rarity) * 50;

  const traits = Array.isArray(champion?.traits) ? champion.traits : champion?.trait && champion.trait !== "Standard" ? [champion.trait] : [];
  const sourceTraitBonus = getTraitBonus(traits, traitLookup);
  value += sourceTraitBonus > 0 ? sourceTraitBonus * TRAIT_PERCENT_VALUE : traits.length * TRAIT_BONUS;

  return Math.round(value);
}

function calculateTradeValue(champions = [], traitLookup = traitsByName) {
  return champions.reduce((total, champion) => {
    const v = calculateChampionValue(champion, traitLookup);
    return total + (v > 0 ? v : 0);
  }, 0);
}

export { calculateChampionValue, calculateTradeValue, getRarityValue, getStatTotal, getTraitBonus };
