-- Catalog data becomes live-editable through the Administrator Console. The
-- existing CSV bundle stays as a read-only fallback until the first publish,
-- so Lumio keeps working while a catalog is being set up.
alter table public.champions
  add column if not exists catalog_key text,
  add column if not exists stat_bonuses jsonb not null default '{}'::jsonb,
  add column if not exists stat_total integer not null default 0 check (stat_total >= 0),
  add column if not exists clan_points integer not null default 0 check (clan_points >= 0),
  add column if not exists image_url text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists champions_catalog_key_unique
  on public.champions (catalog_key)
  where catalog_key is not null;

create table if not exists public.catalog_traits (
  catalog_key text primary key check (catalog_key ~ '^[a-z0-9][a-z0-9-]{1,118}$'),
  name text not null check (char_length(name) between 1 and 100),
  rarity text not null check (char_length(rarity) between 1 and 60),
  bonuses jsonb not null default '{}'::jsonb check (jsonb_typeof(bonuses) = 'object'),
  bonus_total numeric not null default 0 check (bonus_total >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_traits_active_name_idx
  on public.catalog_traits (is_active, name);

alter table public.catalog_traits enable row level security;

drop policy if exists "catalog traits: members read active" on public.catalog_traits;
create policy "catalog traits: members read active" on public.catalog_traits
  for select to authenticated
  using (is_active or public.is_lumio_admin());

revoke all on public.catalog_traits from anon, authenticated;
grant select on public.catalog_traits to authenticated;

create or replace function public.set_catalog_record_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists champions_set_catalog_updated_at on public.champions;
create trigger champions_set_catalog_updated_at
  before update on public.champions
  for each row execute function public.set_catalog_record_updated_at();

drop trigger if exists catalog_traits_set_updated_at on public.catalog_traits;
create trigger catalog_traits_set_updated_at
  before update on public.catalog_traits
  for each row execute function public.set_catalog_record_updated_at();

create or replace function public.admin_publish_catalog(
  incoming_champions jsonb,
  incoming_traits jsonb,
  publish_mode text default 'merge'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  champion_row jsonb;
  trait_row jsonb;
  champion_key text;
  trait_key text;
  champion_id bigint;
  next_champion_id bigint;
  champion_count integer := 0;
  trait_count integer := 0;
  champion_keys text[] := '{}';
  trait_keys text[] := '{}';
  current_stat_total integer;
  current_clan_points integer;
  current_bonus_total numeric;
begin
  if not public.is_lumio_admin() then
    raise exception 'Administrator access is required';
  end if;

  if publish_mode not in ('merge', 'replace') then
    raise exception 'Publish mode must be merge or replace';
  end if;

  if jsonb_typeof(incoming_champions) <> 'array'
     or jsonb_array_length(incoming_champions) > 500
     or jsonb_typeof(incoming_traits) <> 'array'
     or jsonb_array_length(incoming_traits) > 250 then
    raise exception 'Catalog import has an invalid number of rows';
  end if;

  if publish_mode = 'replace'
     and (jsonb_array_length(incoming_champions) = 0 or jsonb_array_length(incoming_traits) = 0) then
    raise exception 'A full replacement requires both champion and trait rows';
  end if;

  perform pg_advisory_xact_lock(hashtext('lumio_catalog_publish'));
  select coalesce(max(id), 0) into next_champion_id from public.champions;

  for champion_row in select value from jsonb_array_elements(incoming_champions)
  loop
    champion_key := champion_row ->> 'catalog_key';
    if champion_key is null or champion_key !~ '^[a-z0-9][a-z0-9-]{1,118}$'
       or coalesce(char_length(champion_row ->> 'name'), 0) not between 1 and 100
       or coalesce(char_length(champion_row ->> 'rarity'), 0) not between 1 and 60
       or jsonb_typeof(coalesce(champion_row -> 'stat_bonuses', '{}'::jsonb)) <> 'object' then
      raise exception 'A champion row has invalid required fields';
    end if;

    begin
      current_stat_total := greatest(0, least(10000, coalesce((champion_row ->> 'stat_total')::integer, 0)));
      current_clan_points := greatest(0, least(100000, coalesce((champion_row ->> 'clan_points')::integer, 0)));
    exception when invalid_text_representation then
      raise exception 'Champion stat totals and Clan Points must be whole numbers';
    end;

    if champion_key = any(champion_keys) then
      raise exception 'Champion catalog keys must be unique';
    end if;
    champion_keys := array_append(champion_keys, champion_key);

    select id into champion_id from public.champions where catalog_key = champion_key;
    if champion_id is null then
      next_champion_id := next_champion_id + 1;
      insert into public.champions (id, catalog_key, name, rarity, traits, stat_bonuses, stat_total, clan_points, image_url, tradable)
      values (
        next_champion_id,
        champion_key,
        champion_row ->> 'name',
        champion_row ->> 'rarity',
        '{}'::text[],
        coalesce(champion_row -> 'stat_bonuses', '{}'::jsonb),
        current_stat_total,
        current_clan_points,
        nullif(champion_row ->> 'image_url', ''),
        true
      );
    else
      update public.champions
      set name = champion_row ->> 'name',
          rarity = champion_row ->> 'rarity',
          stat_bonuses = coalesce(champion_row -> 'stat_bonuses', '{}'::jsonb),
          stat_total = current_stat_total,
          clan_points = current_clan_points,
          image_url = nullif(champion_row ->> 'image_url', ''),
          tradable = true
      where id = champion_id;
    end if;
    champion_count := champion_count + 1;
  end loop;

  for trait_row in select value from jsonb_array_elements(incoming_traits)
  loop
    trait_key := trait_row ->> 'catalog_key';
    if trait_key is null or trait_key !~ '^[a-z0-9][a-z0-9-]{1,118}$'
       or coalesce(char_length(trait_row ->> 'name'), 0) not between 1 and 100
       or coalesce(char_length(trait_row ->> 'rarity'), 0) not between 1 and 60
       or jsonb_typeof(coalesce(trait_row -> 'bonuses', '{}'::jsonb)) <> 'object' then
      raise exception 'A trait row has invalid required fields';
    end if;

    begin
      current_bonus_total := greatest(0, least(100000, coalesce((trait_row ->> 'bonus_total')::numeric, 0)));
    exception when invalid_text_representation then
      raise exception 'Trait bonus totals must be numeric';
    end;

    if trait_key = any(trait_keys) then
      raise exception 'Trait catalog keys must be unique';
    end if;
    trait_keys := array_append(trait_keys, trait_key);

    insert into public.catalog_traits (catalog_key, name, rarity, bonuses, bonus_total, notes, is_active)
    values (
      trait_key,
      trait_row ->> 'name',
      trait_row ->> 'rarity',
      coalesce(trait_row -> 'bonuses', '{}'::jsonb),
      current_bonus_total,
      nullif(trait_row ->> 'notes', ''),
      true
    )
    on conflict (catalog_key) do update
      set name = excluded.name,
          rarity = excluded.rarity,
          bonuses = excluded.bonuses,
          bonus_total = excluded.bonus_total,
          notes = excluded.notes,
          is_active = true;
    trait_count := trait_count + 1;
  end loop;

  if publish_mode = 'replace' then
    update public.champions
      set tradable = false
      where catalog_key is not null
        and not (catalog_key = any(champion_keys));

    update public.catalog_traits
      set is_active = false
      where not (catalog_key = any(trait_keys));
  end if;

  insert into public.admin_audit_events (actor_id, action, details)
  values (
    auth.uid(),
    'catalog_published',
    jsonb_build_object(
      'mode', publish_mode,
      'champion_rows', champion_count,
      'trait_rows', trait_count
    )
  );

  return jsonb_build_object(
    'champions_published', champion_count,
    'traits_published', trait_count,
    'mode', publish_mode
  );
end;
$$;

revoke all on function public.admin_publish_catalog(jsonb, jsonb, text) from public;
grant execute on function public.admin_publish_catalog(jsonb, jsonb, text) to authenticated;
