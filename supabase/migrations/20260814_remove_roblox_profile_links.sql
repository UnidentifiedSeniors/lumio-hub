-- Retire the former public-username lookup. It did not verify ownership, so
-- Lumio no longer stores or exposes Roblox account identities until a future
-- OAuth implementation can do that correctly.
drop view if exists public.marketplace_listings;
drop view if exists public.public_profiles;

alter table public.profiles
  drop column if exists roblox_id,
  drop column if exists roblox_username;

create view public.public_profiles as
  select
    id,
    discord_username,
    discord_display_name,
    discord_avatar,
    xp,
    rank,
    created_at
  from public.profiles;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

create view public.marketplace_listings
with (security_invoker = false) as
  select
    listing.id,
    listing.owner_id,
    listing.user_champion_id,
    listing.note,
    listing.created_at,
    listing.updated_at,
    champion.name,
    champion.image_url,
    champion.rarity,
    champion.trait,
    champion.base_value,
    champion.market_adjustment,
    profile.discord_username,
    profile.discord_display_name,
    profile.discord_avatar,
    profile.rank
  from public.shelf_listings as listing
  join public.user_champions as champion
    on champion.id = listing.user_champion_id
  join public.profiles as profile
    on profile.id = listing.owner_id
  where listing.status = 'active';

revoke all on public.marketplace_listings from anon;
grant select on public.marketplace_listings to authenticated;
