import championsCsv from "../Game-data/champions.csv?raw";
import traitsCsv from "../Game-data/traits.csv?raw";

const CHAMPION_STAT_COLUMNS = [
  ["strength", "Strength"],
  ["durability", "Durability"],
  ["chakra", "Chakra"],
  ["sword", "Sword"],
  ["speed", "Speed"],
  ["agility", "Agility"],
];

const TRAIT_BONUS_COLUMNS = [
  ["chakra", "Chakra Bonus"],
  ["strength", "Strength Bonus"],
  ["trainingSpeed", "Training Speed Boost"],
  ["statsGain", "Stats Gain Boost"],
  ["sword", "Sword Bonus"],
  ["lootChance", "Loot Chance Bonus"],
  ["cooldownReduction", "Cooldown Reduction"],
  ["chikara", "Chikara Bonus"],
  ["yen", "Yen Bonus"],
  ["speed", "Speed Bonus"],
  ["defense", "Defense Bonus"],
  ["allDamage", "All Damage Bonus"],
];

function parseCsv(rawCsv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < rawCsv.length; index += 1) {
    const character = rawCsv[index];
    const nextCharacter = rawCsv[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const [headers = [], ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ""), record[index] || ""])));
}

function percentage(value) {
  const parsed = Number.parseFloat(String(value || "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const traits = parseCsv(traitsCsv)
  .filter((record) => record.Trait && record.Rarity)
  .map((record) => {
    const bonuses = Object.fromEntries(TRAIT_BONUS_COLUMNS.map(([key, header]) => [key, percentage(record[header])]));
    return {
      name: record.Trait,
      rarity: record.Rarity,
      bonuses,
      bonusTotal: Object.values(bonuses).reduce((total, bonus) => total + bonus, 0),
      notes: record.Notes || null,
    };
  });

export const traitsByName = new Map(traits.map((trait) => [trait.name, trait]));
export const traitNames = traits.map((trait) => trait.name);

export const champions = parseCsv(championsCsv)
  .filter((record) => record.Champions && record["Clan Points"] && Number.isFinite(Number(record["Clan Points"])))
  .map((record, index) => {
    const statBonuses = Object.fromEntries(CHAMPION_STAT_COLUMNS.map(([key, header]) => [key, percentage(record[header])]));
    return {
      id: index + 1,
      name: record.Champions,
      // The supplied source has no rarity or image fields. Keep the catalog
      // honest rather than inventing that game data.
      rarity: "AFS Champion",
      statBonuses,
      statTotal: Object.values(statBonuses).reduce((total, bonus) => total + bonus, 0),
      clanPoints: number(record["Clan Points"]),
      traits: [],
      tradable: true,
    };
  });

export const championStatLabels = Object.fromEntries(CHAMPION_STAT_COLUMNS.map(([key, header]) => [key, header]));

export default champions;
