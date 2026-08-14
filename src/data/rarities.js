/*
  Rarity -> numeric ranking (used for trade validation tier delta
  and as a base for value calculation).
  Higher number = rarer.
*/
const rarities = {
  "AFS Champion": 1,
  Common:        1,
  Uncommon:      2,
  Rare:          3,
  Epic:          4,
  Legendary:     5,
  Mythic:        6,
  Secret:        7,
  "Shiny Secret": 8,
  Exclusive:     9,
  "Shiny Mythic": 10,
  "Shiny Legendary": 11,
  "Shiny Epic":   12,
  "Shiny Rare":   13,
  "Shiny Uncommon": 14,
  Sovereign:     15,
};

export default rarities;
