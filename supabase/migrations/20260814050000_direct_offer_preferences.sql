-- A trader can pause unsolicited, profile-based offers without taking down
-- their public Shelf listings. Shelf offers remain available because listing a
-- champion is an explicit invitation to receive offers for that item.
alter table public.profiles
  add column if not exists direct_offers_enabled boolean not null default true;

-- Recreate the public projection with the availability signal needed to give
-- other members an accurate profile action. No private identity fields are
-- added to the view.
drop view if exists public.marketplace_listings;
drop view if exists public.public_profiles;

create view public.public_profiles as
  select
    id,
    discord_username,
    discord_display_name,
    discord_avatar,
    xp,
    rank,
    created_at,
    lumio_display_name,
    direct_offers_enabled
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
    profile.rank,
    profile.lumio_display_name
  from public.shelf_listings as listing
  join public.user_champions as champion
    on champion.id = listing.user_champion_id
  join public.profiles as profile
    on profile.id = listing.owner_id
  where listing.status = 'active';

revoke all on public.marketplace_listings from anon;
grant select on public.marketplace_listings to authenticated;

create or replace function public.validate_direct_offer_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.listing_id is null then
    if new.recipient_id is null then
      raise exception 'A direct offer needs a recipient';
    end if;

    if new.sender_id = new.recipient_id then
      raise exception 'You cannot send a direct offer to yourself';
    end if;

    if not coalesce(
      (
        select direct_offers_enabled
        from public.profiles
        where id = new.recipient_id
      ),
      false
    ) then
      raise exception 'This trader is not accepting direct offers right now';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trades_validate_direct_offer_availability on public.trades;
create trigger trades_validate_direct_offer_availability
  before insert on public.trades
  for each row execute function public.validate_direct_offer_availability();
