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
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function catalogKey(...parts) {
  return parts.join("-").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 119);
}

export function parseChampionCatalogCsv(rawCsv) {
  const rows = [];
  const issues = [];

  parseCsv(rawCsv).forEach((record) => {
    const name = getColumn(record, ["Champions", "Champion", "Name"]).trim();
    if (!name || name === "Best for Each Stat" || /^\d+(?:st|nd|rd|th)$/i.test(name)) return;
    rows.push({
      catalog_key: catalogKey(name),
      name,
      image_url: getColumn(record, ["Image URL", "Image"]),
    });
  });

  return { rows, issues };
}

export function parseChampionValuesCsv(rawCsv) {
  const rows = [];
  const issues = [];

  parseCsv(rawCsv).forEach((record, index) => {
    const name = getColumn(record, ["Champions", "Champion", "Name"]).trim();
    if (!name || name === "Best for Each Stat" || /^\d+(?:st|nd|rd|th)$/i.test(name)) return;

    const rarity = getColumn(record, ["Rarity"]).trim();
    const officialValue = wholeNumber(getColumn(record, ["Value", "Official Value"]));
    const clanPointsText = getColumn(record, ["Clan Points"]);
    const clanPoints = clanPointsText.trim() ? wholeNumber(clanPointsText) : 0;
    const obtainment = getColumn(record, ["Obtainment", "How to obtain", "How to get"]).trim();

    if (!rarity || officialValue === null || clanPoints === null || !obtainment) {
      issues.push(`Row ${index + 2}: ${name} needs rarity, a whole-number value, Clan Points, and obtainment.`);
      return;
    }

    rows.push({
      catalog_key: catalogKey(name),
      name,
      rarity,
      official_value: officialValue,
      clan_points: clanPoints,
      obtainment,
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
  return {
    catalog_key: catalogKey(champion.name),
    name: champion.name,
    image_url: champion.image_url || "",
    rarity: champion.rarity || "",
    official_value: Number(champion.officialValue) || 0,
    clan_points: Number(champion.clanPoints) || 0,
    obtainment: champion.obtainment || "",
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
