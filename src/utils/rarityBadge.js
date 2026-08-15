export function rarityBadgeClassName(rarity) {
  const key = String(rarity || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `rarity-badge${key ? ` rarity-badge-${key}` : ""}`;
}
