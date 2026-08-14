-- Members choose whether the champion copies they record in Lumio are visible
-- on their public trading profile. Private is the safe default.
alter table public.profiles
  add column if not exists collection_visibility text not null default 'private',
  add column if not exists lumio_display_name_changed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_collection_visibility_format;

alter table public.profiles
  add constraint profiles_collection_visibility_format
  check (collection_visibility in ('private', 'public'));

-- Add the collection visibility signal to the deliberately limited public
-- profile projection. The timestamp remains private to its account owner.
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
    direct_offers_enabled,
    collection_visibility
  from public.profiles;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- The profile summary must respect the same choice: a private Collection does
-- not disclose its number of recorded copies to other traders either.
create or replace view public.public_trader_stats
with (security_invoker = false) as
  select
    profile.id,
    (
      select count(*)
      from public.trades as trade
      where trade.status = 'completed'
        and (trade.sender_id = profile.id or trade.recipient_id = profile.id)
    ) as completed_trade_count,
    case
      when profile.collection_visibility = 'public' or profile.id = auth.uid() then (
        select count(*)
        from public.user_champions as champion
        where champion.owner_id = profile.id
      )
      else null
    end as collection_count,
    (
      select count(*)
      from public.shelf_listings as listing
      where listing.owner_id = profile.id
        and listing.status = 'active'
    ) as active_listing_count
  from public.profiles as profile;

revoke all on public.public_trader_stats from anon;
grant select on public.public_trader_stats to authenticated;

-- Owners still manage their own Collection as before. This separate read-only
-- policy exposes a member's copies only when they have opted into public view.
drop policy if exists "user champions: public profile read" on public.user_champions;
create policy "user champions: public profile read" on public.user_champions
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.profiles as profile
      where profile.id = user_champions.owner_id
        and profile.collection_visibility = 'public'
    )
  );

-- A Lumio display name is an identity field, so changes are limited to once
-- every 24 hours. The trigger, not the browser, is the authority for this.
create or replace function public.enforce_lumio_display_name_cooldown()
returns trigger
language plpgsql
as $$
begin
  if new.lumio_display_name is distinct from old.lumio_display_name then
    if old.lumio_display_name_changed_at is not null
       and old.lumio_display_name_changed_at > now() - interval '24 hours' then
      raise exception 'Lumio display names can be changed once every 24 hours';
    end if;

    new.lumio_display_name_changed_at := now();
  elsif new.lumio_display_name_changed_at is distinct from old.lumio_display_name_changed_at then
    raise exception 'Lumio display-name timing is managed by Lumio';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_z_enforce_lumio_display_name_cooldown on public.profiles;
create trigger profiles_z_enforce_lumio_display_name_cooldown
  before update on public.profiles
  for each row execute function public.enforce_lumio_display_name_cooldown();
