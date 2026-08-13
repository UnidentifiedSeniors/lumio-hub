function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

// Discord's OAuth payload exposes the stable username and the display name in
// different fields. Keep them separate so the product never renders the same
// account identifier twice when Discord provides both.
export function getDiscordIdentity(user) {
  const metadata = user?.user_metadata || {};
  const discordIdentity = user?.identities?.find((identity) => identity.provider === "discord")?.identity_data || {};
  // Prefer Discord's provider payload. Supabase metadata can contain a
  // generic email-derived name, which is not a member's Discord @handle.
  const sources = [discordIdentity, metadata];

  const username = firstText(
    ...sources.map((source) => source.user_name),
    ...sources.map((source) => source.preferred_username),
    ...sources.map((source) => source.username),
  );

  const displayName = firstText(
    ...sources.map((source) => source.global_name),
    ...sources.map((source) => source.display_name),
    ...sources.map((source) => source.full_name),
    ...sources.map((source) => source.nickname),
    ...sources.map((source) => source.name),
    username,
    "Trader",
  );

  const avatar = firstText(
    ...sources.map((source) => source.avatar_url),
    ...sources.map((source) => source.picture),
  );

  const discordId = firstText(
    ...sources.map((source) => source.provider_id),
    ...sources.map((source) => source.id),
    user?.id,
  );

  return { avatar, discordId, displayName, username: username || displayName };
}
