import championsCsv from "../Game-data/champions.csv?raw";
import championValuesCsv from "../Game-data/champion_values.csv?raw";
import traitsCsv from "../Game-data/traits.csv?raw";

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

const championImageModules = import.meta.glob("../AFS Champions pngs/*.png", {
  eager: true,
  import: "default",
});

function championKey(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

const championImagesByKey = new Map(
  Object.entries(championImageModules).map(([path, imageUrl]) => [
    championKey(path.split("/").pop()?.replace(/\.png$/i, "")),
    imageUrl,
  ]),
);

export function getChampionImageUrl(name) {
  return championImagesByKey.get(championKey(name)) || null;
}

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

function wholeNumber(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function isChampionName(name) {
  return Boolean(name)
    && name !== "Best for Each Stat"
    && !/^\d+(?:st|nd|rd|th)$/i.test(name);
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

export const championValues = parseCsv(championValuesCsv)
  .filter((record) => isChampionName(record.Champions?.trim()))
  .map((record) => ({
    name: record.Champions.trim(),
    rarity: record.Rarity?.trim() || "Unlisted",
    officialValue: wholeNumber(record.Value),
    clanPoints: wholeNumber(record["Clan Points"]),
    obtainment: record.Obtainment?.trim() || null,
  }));

export const championValuesByKey = new Map(
  championValues.map((champion) => [championKey(champion.name), champion]),
);

export const champions = parseCsv(championsCsv)
  .filter((record) => {
    const name = record.Champions?.trim();
    return isChampionName(name);
  })
  .map((record, index) => {
    const valueInfo = championValuesByKey.get(championKey(record.Champions));
    return {
      id: index + 1,
      name: record.Champions,
      image_url: getChampionImageUrl(record.Champions),
      traits: [],
      tradable: true,
      rarity: valueInfo?.rarity || "Unlisted",
      officialValue: valueInfo?.officialValue || 0,
      clanPoints: valueInfo?.clanPoints || 0,
      obtainment: valueInfo?.obtainment || null,
    };
  });

export default champions;
