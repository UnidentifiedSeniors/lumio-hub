-- Safe public read model for the marketplace. A listing is public, but a
-- member's underlying Collection remains private under user_champions RLS.
create or replace view public.marketplace_listings
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
    profile.roblox_username,
    profile.rank
  from public.shelf_listings as listing
  join public.user_champions as champion
    on champion.id = listing.user_champion_id
  join public.profiles as profile
    on profile.id = listing.owner_id
  where listing.status = 'active';

revoke all on public.marketplace_listings from anon;
grant select on public.marketplace_listings to authenticated;
