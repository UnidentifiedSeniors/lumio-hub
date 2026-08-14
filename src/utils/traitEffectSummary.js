const TRAIT_BONUS_LABELS = {
  chakra: "Chakra",
  strength: "Strength",
  trainingSpeed: "Training speed",
  statsGain: "Stats gain",
  sword: "Sword",
  lootChance: "Loot chance",
  cooldownReduction: "Cooldown reduction",
  chikara: "Chikara",
  yen: "Yen",
  speed: "Speed",
  defense: "Defense",
  allDamage: "All damage",
};

export default function traitEffectSummary(trait) {
  if (!trait || trait.isStandard) return "No trait modifiers";
  const bonuses = Object.entries(trait.bonuses || {})
    .filter(([, bonus]) => bonus > 0)
    .map(([key, bonus]) => `${TRAIT_BONUS_LABELS[key]} +${bonus}%`);
  return bonuses.join(" · ") || "No bonus recorded";
}
