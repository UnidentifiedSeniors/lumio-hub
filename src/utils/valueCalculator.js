import rarities from "../data/rarities";

const TRAIT_BONUS = 20;

function getRarityValue(rarity) {
  return rarities[rarity] || 0;
}

function calculateChampionValue(champion) {
  let value = getRarityValue(champion.rarity) * 50;

  const traits = champion.traits || [];
  value += traits.length * TRAIT_BONUS;

  return value;
}

function calculateTradeValue(champions = []) {
  return champions.reduce((total, champion) => {
    const v = calculateChampionValue(champion);
    return total + (v > 0 ? v : 0);
  }, 0);
}

export { calculateChampionValue, calculateTradeValue, getRarityValue };
