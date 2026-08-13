-- Lumio Hub marketplace foundation
-- Adds personal champion ownership, public Shelf listings, direct-offer fields,
-- public profile projection, and a collision-safe trade-code trigger.
-- Existing trades and their database webhook remain intact.

-- ---------------------------------------------------------------------------
-- Public profile projection
-- ---------------------------------------------------------------------------
-- The base profiles table stays private to its owner. This view deliberately
-- exposes only the fields needed on public trader cards and listing pages.
create or replace view public.public_profiles as
  select
    id,
    discord_username,
    discord_display_name,
    discord_avatar,
    roblox_username,
    xp,
    rank,
    created_at
  from public.profiles;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Owned champions / Collection
-- ---------------------------------------------------------------------------
create table if not exists public.user_champions (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  champion_id         bigint references public.champions(id) on delete set null,
  name                text not null,
  image_url           text,
  rarity              text not null,
  trait               text not null default 'Standard',
  base_value          integer not null default 0 check (base_value >= 0),
  market_adjustment   numeric(6,3) not null default 1 check (market_adjustment > 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists user_champions_owner_id_idx
  on public.user_champions(owner_id);

alter table public.user_champions enable row level security;

drop policy if exists "user champions: manage own" on public.user_champions;
create policy "user champions: manage own" on public.user_champions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.set_user_champions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_champions_set_updated_at on public.user_champions;
create trigger user_champions_set_updated_at
  before update on public.user_champions
  for each row execute function public.set_user_champions_updated_at();

-- ---------------------------------------------------------------------------
-- Shelf listings
-- ---------------------------------------------------------------------------
create table if not exists public.shelf_listings (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  user_champion_id    uuid not null references public.user_champions(id) on delete cascade,
  status              text not null default 'active'
                      check (status in ('active', 'paused', 'removed', 'completed')),
  note                text check (char_length(note) <= 280),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists shelf_listings_owner_id_idx
  on public.shelf_listings(owner_id);

create unique index if not exists shelf_listings_one_live_listing_per_champion
  on public.shelf_listings(user_champion_id)
  where status in ('active', 'paused');

alter table public.shelf_listings enable row level security;

drop policy if exists "shelf listings: public and owner read" on public.shelf_listings;
create policy "shelf listings: public and owner read" on public.shelf_listings
  for select to authenticated
  using (status = 'active' or owner_id = auth.uid());

drop policy if exists "shelf listings: owner creates" on public.shelf_listings;
create policy "shelf listings: owner creates" on public.shelf_listings
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "shelf listings: owner updates" on public.shelf_listings;
create policy "shelf listings: owner updates" on public.shelf_listings
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "shelf listings: owner deletes" on public.shelf_listings;
create policy "shelf listings: owner deletes" on public.shelf_listings
  for delete to authenticated
  using (owner_id = auth.uid());

create or replace function public.validate_shelf_listing_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.user_champions champion
    where champion.id = new.user_champion_id
      and champion.owner_id = new.owner_id
  ) then
    raise exception 'A Shelf listing must reference one of the owner''s champions';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shelf_listings_validate_owner on public.shelf_listings;
create trigger shelf_listings_validate_owner
  before insert or update on public.shelf_listings
  for each row execute function public.validate_shelf_listing_owner();

-- ---------------------------------------------------------------------------
-- Direct trade offers
-- ---------------------------------------------------------------------------
alter table public.trades
  add column if not exists trade_code text,
  add column if not exists recipient_id uuid references auth.users(id) on delete set null,
  add column if not exists listing_id uuid references public.shelf_listings(id) on delete set null,
  add column if not exists requested_champions jsonb not null default '[]'::jsonb,
  add column if not exists requested_value integer,
  add column if not exists updated_at timestamptz not null default now();

alter table public.trades
  drop constraint if exists trades_status_check;

alter table public.trades
  add constraint trades_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'completed'));

create unique index if not exists trades_trade_code_unique
  on public.trades(trade_code)
  where trade_code is not null;

-- Locks the short code namespace per transaction so two concurrent inserts
-- cannot choose the same code between the availability check and insert.
create or replace function public.generate_trade_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  perform pg_advisory_xact_lock(hashtext('lumio_trade_code'));

  loop
    code := lpad((floor(1000 + random() * 9000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.trades where trade_code = code
    );
  end loop;

  return code;
end;
$$;

create or replace function public.prepare_trade_record()
returns trigger
language plpgsql
as $$
begin
  if new.trade_code is null then
    new.trade_code := public.generate_trade_code();
  end if;

  -- Existing integrations keep using requested_champion. New direct offers
  -- additionally store the full requested_champions array.
  if jsonb_array_length(coalesce(new.requested_champions, '[]'::jsonb)) = 0
     and new.requested_champion is not null then
    new.requested_champions := jsonb_build_array(new.requested_champion);
  end if;

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trades_prepare_public_fields on public.trades;
create trigger trades_prepare_public_fields
  before insert or update on public.trades
  for each row execute function public.prepare_trade_record();

drop policy if exists "Users can create trades" on public.trades;
drop policy if exists "Users can view own trades" on public.trades;
drop policy if exists "trades: participants read" on public.trades;
drop policy if exists "trades: sender creates" on public.trades;
drop policy if exists "trades: sender withdraws pending" on public.trades;
drop policy if exists "trades: recipient responds pending" on public.trades;

create policy "trades: participants read" on public.trades
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "trades: sender creates" on public.trades
  for insert to authenticated
  with check (sender_id = auth.uid());

create policy "trades: sender withdraws pending" on public.trades
  for update to authenticated
  using (sender_id = auth.uid() and status = 'pending')
  with check (sender_id = auth.uid() and status = 'cancelled');

create policy "trades: recipient responds pending" on public.trades
  for update to authenticated
  using (recipient_id = auth.uid() and status = 'pending')
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined'));
