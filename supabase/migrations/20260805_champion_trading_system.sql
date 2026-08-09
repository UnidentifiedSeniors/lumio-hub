-- Lumio Hub — Champion Trading System migration
-- Aligns profiles/trades schema with the new champion + trade_code system
------------------------------------------------------------
-- 1. PROFILES  (unify on profiles — code read profiles, createProfile wrote users)
------------------------------------------------------------
drop table if exists public.users cascade;

create table if not exists public.profiles (
  id                uuid primary key references auth.users on delete cascade,

  discord_id        text,
  discord_username  text,   -- raw discord username (for @handle)
  discord_display_name text, -- friendly name shown in Discord embeds
  discord_avatar    text,

  roblox_id         text,
  roblox_username   text,

  xp                bigint default 0 not null,
  rank              text default 'Rookie Trader' not null,

  badges            text[] default '{}'::text[] not null,

  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);

------------------------------------------------------------
-- 2. CHAMPIONS
------------------------------------------------------------
create table if not exists public.champions (
  id         bigint primary key,
  name       text not null,
  rarity     text not null,
  traits     text[] default '{}'::text[] not null,
  stock      integer default 0 not null,
  tradable   boolean default true not null,
  created_at timestamptz default now() not null
);

create type if not exists public.rarity_enum as enum (
  'common','uncommon','rare','epic','legendary','mythic','secret','exclusive','sovereign'
);

------------------------------------------------------------
-- 3. TRADES
------------------------------------------------------------
create table if not exists public.trades (
  id                   uuid primary key default gen_random_uuid(),

  trade_code           text unique,                  -- 4-digit human code e.g. #4829

  sender_id            uuid references auth.users not null,

  requested_champion   jsonb not null,               -- {name,rarity,traits}
  offered_champions    jsonb not null default '[]'::jsonb,  -- [{name,rarity,traits},...]
  offer_value          integer not null,             -- internal validation only
  requested_value      integer not null,

  status               text default 'pending' not null
                       check (status in ('pending','completed','cancelled')),

  discord_message_id   text,                         -- so we can edit the webhook msg later
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

-- Add columns idempotently if table pre-existed
alter table public.trades add column if not exists trade_code           text unique;
alter table public.trades add column if not exists requested_champion   jsonb;
alter table public.trades add column if not exists offered_champions     jsonb default '[]'::jsonb;
alter table public.trades add column if not exists offer_value           integer;
alter table public.trades add column if not exists requested_value       integer;
alter table public.trades add column if not exists discord_message_id    text;
alter table public.trades add column if not exists updated_at            timestamptz default now();

------------------------------------------------------------
-- 4. TRADE CODE helper + triggers
------------------------------------------------------------
create or replace function public.generate_trade_code()
returns text language plpgsql as $$
declare
  code text;
begin
  loop
    code := lpad(ceil(random()*9000 + 999)::int::text, 4, '0');
    exit when not exists (select 1 from public.trades where trade_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.trades_set_code_and_ts()
returns trigger language plpgsql as $$
begin
  if new.trade_code is null then
    new.trade_code := public.generate_trade_code();
  end if;
  new.created_at := now();
  new.updated_at  := now();
  return new;
end;
$$;

drop trigger if exists trg_trades_set_code on public.trades;
create trigger trg_trades_set_code
  before insert on public.trades
  for each row execute function public.trades_set_code_and_ts();

create or replace function public.trades_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_trades_set_updated_ts on public.trades;
create trigger trg_trades_set_updated_ts
  before update on public.trades
  for each row execute function public.trades_set_updated_at();

------------------------------------------------------------
-- 5. RLS
------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trades   enable row level security;
alter table public.champions enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "champions: readable by all" on public.champions for select using (true);

create policy "trades: read own" on public.trades
  for select using (auth.uid() = sender_id);
create policy "trades: insert own" on public.trades
  for insert with check (auth.uid() = sender_id);
create policy "trades: update own pending" on public.trades
  for update using (auth.uid() = sender_id and status = 'pending')
  with check (auth.uid() = sender_id and status = 'pending');

create policy "profiles: public leaderboard read" on public.profiles
  for select using (true);
