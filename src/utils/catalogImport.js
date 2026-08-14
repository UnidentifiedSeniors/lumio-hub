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
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, "").trim(), record[index] || ""])));
}

function getColumn(record, alternatives) {
  const lookup = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.trim().toLowerCase(), value]));
  return alternatives.map((name) => lookup[name.toLowerCase()]).find((value) => value !== undefined) || "";
}

function percentage(value) {
  const parsed = Number.parseFloat(String(value || "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function wholeNumber(value) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function catalogKey(...parts) {
  return parts.join("-").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 119);
}

export function parseChampionCatalogCsv(rawCsv) {
  const rows = [];
  const issues = [];

  parseCsv(rawCsv).forEach((record, index) => {
    const name = getColumn(record, ["Champions", "Champion", "Name"]).trim();
    const rarity = getColumn(record, ["Rarity"]).trim();
    if (!name || rarity === "/") return;
    if (!rarity) {
      issues.push(`Row ${index + 2}: ${name} is missing a rarity.`);
      return;
    }
    const statBonuses = Object.fromEntries(CHAMPION_STAT_COLUMNS.map(([key, header]) => [key, percentage(getColumn(record, [header]))]));
    const statTotal = Object.values(statBonuses).reduce((total, bonus) => total + bonus, 0);
    rows.push({
      catalog_key: catalogKey(name, rarity),
      name,
      rarity,
      stat_bonuses: statBonuses,
      stat_total: Math.round(statTotal),
      clan_points: wholeNumber(getColumn(record, ["Clan Points", "Clan Point"])),
      image_url: getColumn(record, ["Image URL", "Image"]),
    });
  });

  return { rows, issues };
}

export function parseTraitCatalogCsv(rawCsv) {
  const rows = [];
  const issues = [];

  parseCsv(rawCsv).forEach((record, index) => {
    const name = getColumn(record, ["Trait", "Name"]).trim();
    const rarity = getColumn(record, ["Rarity"]).trim();
    if (!name) return;
    if (!rarity) {
      issues.push(`Row ${index + 2}: ${name} is missing a rarity.`);
      return;
    }
    const bonuses = Object.fromEntries(TRAIT_BONUS_COLUMNS.map(([key, header]) => [key, percentage(getColumn(record, [header]))]));
    rows.push({
      catalog_key: catalogKey(name),
      name,
      rarity,
      bonuses,
      bonus_total: Object.values(bonuses).reduce((total, bonus) => total + bonus, 0),
      notes: getColumn(record, ["Notes"]),
    });
  });

  return { rows, issues };
}

export function catalogChampionPayload(champion) {
  const statBonuses = champion.statBonuses || {};
  return {
    catalog_key: catalogKey(champion.name, champion.rarity),
    name: champion.name,
    rarity: champion.rarity,
    stat_bonuses: statBonuses,
    stat_total: Math.round(Number(champion.statTotal) || Object.values(statBonuses).reduce((total, bonus) => total + (Number(bonus) || 0), 0)),
    clan_points: wholeNumber(champion.clanPoints),
    image_url: champion.image_url || "",
  };
}

export function catalogTraitPayload(trait) {
  const bonuses = trait.bonuses || {};
  return {
    catalog_key: catalogKey(trait.name),
    name: trait.name,
    rarity: trait.rarity,
    bonuses,
    bonus_total: Number(trait.bonusTotal) || Object.values(bonuses).reduce((total, bonus) => total + (Number(bonus) || 0), 0),
    notes: trait.notes || "",
  };
}
