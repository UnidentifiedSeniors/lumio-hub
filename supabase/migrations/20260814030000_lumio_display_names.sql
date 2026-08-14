-- A member-controlled Lumio name. Discord identity remains separate and is
-- displayed as the secondary identity throughout the product.
alter table public.profiles
  add column if not exists lumio_display_name text;

update public.profiles
set lumio_display_name = coalesce(
  nullif(btrim(discord_display_name), ''),
  nullif(btrim(discord_username), ''),
  'Trader'
)
where lumio_display_name is null or btrim(lumio_display_name) = '';

create or replace function public.set_lumio_display_name_default()
returns trigger
language plpgsql
as $$
begin
  if new.lumio_display_name is null or btrim(new.lumio_display_name) = '' then
    new.lumio_display_name := coalesce(
      nullif(btrim(new.discord_display_name), ''),
      nullif(btrim(new.discord_username), ''),
      'Trader'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_lumio_display_name_default on public.profiles;
create trigger profiles_set_lumio_display_name_default
  before insert on public.profiles
  for each row
  execute function public.set_lumio_display_name_default();

alter table public.profiles
  drop constraint if exists profiles_lumio_display_name_format;

alter table public.profiles
  add constraint profiles_lumio_display_name_format
  check (
    lumio_display_name is null
    or (
      lumio_display_name = btrim(lumio_display_name)
      and char_length(lumio_display_name) between 2 and 32
    )
  );

-- Recreate the public-safe views so this migration also works if an older
-- version exposed a different column list.
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
    lumio_display_name
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
