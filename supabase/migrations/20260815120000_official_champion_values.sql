-- Lumio's official champion value catalog. Values are an administrator-owned
-- reference based on Clan Points trained, obtainment difficulty, and a small
-- amount of revised personal judgement.

alter table public.champions
  add column if not exists obtainment text;

with source as (
  select *
  from jsonb_to_recordset(
    '[{"catalog_key":"pride","name":"Pride","rarity":"Sovereign","official_value":1100,"clan_points":3,"obtainment":"Gacha"},{"catalog_key":"liberator","name":"Liberator","rarity":"Sovereign","official_value":1300,"clan_points":3,"obtainment":"World Boss"},{"catalog_key":"naruto-beast-mode","name":"Naruto (beast mode)","rarity":"Sovereign","official_value":1500,"clan_points":3,"obtainment":"Tower"},{"catalog_key":"rengoku","name":"Rengoku","rarity":"Exclusive","official_value":650,"clan_points":2,"obtainment":"Daily Spin"},{"catalog_key":"thor","name":"Thor","rarity":"Exclusive","official_value":500,"clan_points":2,"obtainment":"7th Day"},{"catalog_key":"spangled-hero","name":"Spangled Hero","rarity":"Exclusive","official_value":900,"clan_points":2,"obtainment":"Playtime Rewards"},{"catalog_key":"silver-elf","name":"Silver Elf","rarity":"Exclusive","official_value":1005,"clan_points":2,"obtainment":"Inacessible"},{"catalog_key":"buddha","name":"Buddha","rarity":"Exclusive","official_value":1005,"clan_points":2,"obtainment":"Inacessible"},{"catalog_key":"egoist","name":"Egoist","rarity":"Exclusive","official_value":965,"clan_points":1,"obtainment":"Inacessible"},{"catalog_key":"kenpachi","name":"Kenpachi","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"vampire","name":"Vampire","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"mada-reincarnated","name":"Mada (reincarnated)","rarity":"Secret","official_value":925,"clan_points":3,"obtainment":"Raid"},{"catalog_key":"rogue-ninja","name":"Rogue Ninja","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"vasto-lorde","name":"Vasto Lorde","rarity":"Secret","official_value":945,"clan_points":3,"obtainment":"Dungeon"},{"catalog_key":"manipulator","name":"Manipulator","rarity":"Secret","official_value":820,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"king-ant","name":"King Ant","rarity":"Secret","official_value":950,"clan_points":2,"obtainment":"Dungeon"},{"catalog_key":"curse-king","name":"Curse King","rarity":"Secret","official_value":920,"clan_points":3,"obtainment":"Raid"},{"catalog_key":"shadow-monarch","name":"Shadow Monarch","rarity":"Secret","official_value":820,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"jogu","name":"Jogu","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"boron","name":"Boron","rarity":"Secret","official_value":820,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"ice-queen","name":"Ice Queen","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"rock-king","name":"Rock King","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"alquior","name":"Alquior","rarity":"Mythic","official_value":600,"clan_points":2,"obtainment":"Dungeon"},{"catalog_key":"igros","name":"Igros","rarity":"Mythic","official_value":690,"clan_points":3,"obtainment":"Mini Boss"},{"catalog_key":"puya","name":"Puya","rarity":"Mythic","official_value":600,"clan_points":2,"obtainment":"Mini Boss"},{"catalog_key":"curse-hunter","name":"Curse Hunter","rarity":"Mythic","official_value":600,"clan_points":3,"obtainment":"Mini Boss"},{"catalog_key":"bladedancer","name":"Bladedancer","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"white-tiger","name":"White Tiger","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"brokai","name":"Brokai","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"crimson-hair","name":"Crimson Hair","rarity":"Mythic","official_value":565,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"mada","name":"Mada","rarity":"Mythic","official_value":565,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"quake","name":"Quake","rarity":"Mythic","official_value":565,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"hawkeye","name":"Hawkeye","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"helios","name":"Helios","rarity":"Legendary","official_value":325,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"diro","name":"Diro","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"flamenco","name":"Flamenco","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"hurt","name":"Hurt","rarity":"Legendary","official_value":350,"clan_points":0,"obtainment":"World Boss"},{"catalog_key":"lykon","name":"Lykon","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"puu","name":"Puu","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"sparrow","name":"Sparrow","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"son-ssj1","name":"Son SSJ1","rarity":"Legendary","official_value":325,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"wagura","name":"Wagura","rarity":"Legendary","official_value":325,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"special-grade","name":"Special Grade","rarity":"Legendary","official_value":350,"clan_points":0,"obtainment":"Mini Boss"},{"catalog_key":"kuya","name":"Kuya","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"goora","name":"Goora","rarity":"Epic","official_value":125,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"natou","name":"Natou","rarity":"Epic","official_value":125,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"two-zero","name":"Two Zero","rarity":"Epic","official_value":125,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"alligator","name":"Alligator","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"club","name":"Club","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"giaro","name":"Giaro","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"hiroka","name":"Hiroka","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"kakosh","name":"Kakosh","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"specimen","name":"Specimen","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"vigo","name":"Vigo","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"}]'::jsonb
  ) as entry(catalog_key text, name text, rarity text, official_value integer, clan_points integer, obtainment text)
)
update public.champions as champion
set
  name = source.name,
  tier = source.rarity,
  value = source.official_value,
  clan_points = source.clan_points,
  obtainment = source.obtainment,
  tradable = true
from source
where champion.catalog_key = source.catalog_key;

with source as (
  select *
  from jsonb_to_recordset(
    '[{"catalog_key":"pride","name":"Pride","rarity":"Sovereign","official_value":1100,"clan_points":3,"obtainment":"Gacha"},{"catalog_key":"liberator","name":"Liberator","rarity":"Sovereign","official_value":1300,"clan_points":3,"obtainment":"World Boss"},{"catalog_key":"naruto-beast-mode","name":"Naruto (beast mode)","rarity":"Sovereign","official_value":1500,"clan_points":3,"obtainment":"Tower"},{"catalog_key":"rengoku","name":"Rengoku","rarity":"Exclusive","official_value":650,"clan_points":2,"obtainment":"Daily Spin"},{"catalog_key":"thor","name":"Thor","rarity":"Exclusive","official_value":500,"clan_points":2,"obtainment":"7th Day"},{"catalog_key":"spangled-hero","name":"Spangled Hero","rarity":"Exclusive","official_value":900,"clan_points":2,"obtainment":"Playtime Rewards"},{"catalog_key":"silver-elf","name":"Silver Elf","rarity":"Exclusive","official_value":1005,"clan_points":2,"obtainment":"Inacessible"},{"catalog_key":"buddha","name":"Buddha","rarity":"Exclusive","official_value":1005,"clan_points":2,"obtainment":"Inacessible"},{"catalog_key":"egoist","name":"Egoist","rarity":"Exclusive","official_value":965,"clan_points":1,"obtainment":"Inacessible"},{"catalog_key":"kenpachi","name":"Kenpachi","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"vampire","name":"Vampire","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"mada-reincarnated","name":"Mada (reincarnated)","rarity":"Secret","official_value":925,"clan_points":3,"obtainment":"Raid"},{"catalog_key":"rogue-ninja","name":"Rogue Ninja","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"vasto-lorde","name":"Vasto Lorde","rarity":"Secret","official_value":945,"clan_points":3,"obtainment":"Dungeon"},{"catalog_key":"manipulator","name":"Manipulator","rarity":"Secret","official_value":820,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"king-ant","name":"King Ant","rarity":"Secret","official_value":950,"clan_points":2,"obtainment":"Dungeon"},{"catalog_key":"curse-king","name":"Curse King","rarity":"Secret","official_value":920,"clan_points":3,"obtainment":"Raid"},{"catalog_key":"shadow-monarch","name":"Shadow Monarch","rarity":"Secret","official_value":820,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"jogu","name":"Jogu","rarity":"Secret","official_value":800,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"boron","name":"Boron","rarity":"Secret","official_value":820,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"ice-queen","name":"Ice Queen","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"rock-king","name":"Rock King","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"alquior","name":"Alquior","rarity":"Mythic","official_value":600,"clan_points":2,"obtainment":"Dungeon"},{"catalog_key":"igros","name":"Igros","rarity":"Mythic","official_value":690,"clan_points":3,"obtainment":"Mini Boss"},{"catalog_key":"puya","name":"Puya","rarity":"Mythic","official_value":600,"clan_points":2,"obtainment":"Mini Boss"},{"catalog_key":"curse-hunter","name":"Curse Hunter","rarity":"Mythic","official_value":600,"clan_points":3,"obtainment":"Mini Boss"},{"catalog_key":"bladedancer","name":"Bladedancer","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"white-tiger","name":"White Tiger","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"brokai","name":"Brokai","rarity":"Mythic","official_value":550,"clan_points":2,"obtainment":"W1 Gacha"},{"catalog_key":"crimson-hair","name":"Crimson Hair","rarity":"Mythic","official_value":565,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"mada","name":"Mada","rarity":"Mythic","official_value":565,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"quake","name":"Quake","rarity":"Mythic","official_value":565,"clan_points":3,"obtainment":"W1 Gacha"},{"catalog_key":"hawkeye","name":"Hawkeye","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"helios","name":"Helios","rarity":"Legendary","official_value":325,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"diro","name":"Diro","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"flamenco","name":"Flamenco","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"hurt","name":"Hurt","rarity":"Legendary","official_value":350,"clan_points":0,"obtainment":"World Boss"},{"catalog_key":"lykon","name":"Lykon","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"puu","name":"Puu","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"sparrow","name":"Sparrow","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"son-ssj1","name":"Son SSJ1","rarity":"Legendary","official_value":325,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"wagura","name":"Wagura","rarity":"Legendary","official_value":325,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"special-grade","name":"Special Grade","rarity":"Legendary","official_value":350,"clan_points":0,"obtainment":"Mini Boss"},{"catalog_key":"kuya","name":"Kuya","rarity":"Legendary","official_value":300,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"goora","name":"Goora","rarity":"Epic","official_value":125,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"natou","name":"Natou","rarity":"Epic","official_value":125,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"two-zero","name":"Two Zero","rarity":"Epic","official_value":125,"clan_points":0,"obtainment":"W2 Gacha"},{"catalog_key":"alligator","name":"Alligator","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"club","name":"Club","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"giaro","name":"Giaro","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"hiroka","name":"Hiroka","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"kakosh","name":"Kakosh","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"specimen","name":"Specimen","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"},{"catalog_key":"vigo","name":"Vigo","rarity":"Epic","official_value":100,"clan_points":0,"obtainment":"W1 Gacha"}]'::jsonb
  ) as entry(catalog_key text, name text, rarity text, official_value integer, clan_points integer, obtainment text)
), additions as (
  select
    (select coalesce(max(id), 0) from public.champions) + row_number() over (order by source.catalog_key) as id,
    source.*
  from source
  where not exists (
    select 1 from public.champions as champion where champion.catalog_key = source.catalog_key
  )
)
insert into public.champions (
  id, catalog_key, name, tier, value, stock, tradable, stat_bonuses, stat_total, clan_points, obtainment
) overriding system value
select
  id, catalog_key, name, rarity, official_value, 0, true, '{}'::jsonb, 0, clan_points, obtainment
from additions;

update public.user_champions as owned
set
  champion_id = champion.id,
  rarity = champion.tier,
  base_value = champion.value,
  market_adjustment = 1,
  image_url = coalesce(owned.image_url, champion.image_url)
from public.champions as champion
where champion.tradable
  and champion.name = owned.name;

create or replace function public.sync_user_champion_catalog_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog_champion public.champions%rowtype;
begin
  select * into catalog_champion
  from public.champions
  where tradable
    and name = new.name
  order by id
  limit 1;

  if not found then
    raise exception 'Choose a champion from Lumio''s official catalog';
  end if;

  new.champion_id := catalog_champion.id;
  new.rarity := catalog_champion.tier;
  new.base_value := catalog_champion.value;
  new.market_adjustment := 1;
  new.image_url := coalesce(new.image_url, catalog_champion.image_url);
  return new;
end;
$$;

drop trigger if exists user_champions_sync_catalog_metadata on public.user_champions;
create trigger user_champions_sync_catalog_metadata
  before insert or update on public.user_champions
  for each row execute function public.sync_user_champion_catalog_metadata();

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
  champion_keys text[] := array[]::text[];
  trait_keys text[] := array[]::text[];
  current_value integer;
  current_clan_points integer;
  current_bonus_total numeric;
  current_rarity text;
  current_obtainment text;
begin
  if not public.is_lumio_admin() then
    raise exception 'Administrator access is required';
  end if;

  if publish_mode not in ('merge', 'replace') then
    raise exception 'Publish mode must be merge or replace';
  end if;

  if jsonb_typeof(incoming_champions) <> 'array'
     or jsonb_typeof(incoming_traits) <> 'array' then
    raise exception 'Catalog import must provide champion and trait arrays';
  end if;

  if jsonb_array_length(incoming_champions) > 500
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
    current_rarity := nullif(btrim(champion_row ->> 'rarity'), '');
    current_obtainment := nullif(btrim(champion_row ->> 'obtainment'), '');

    if champion_key is null or champion_key !~ '^[a-z0-9][a-z0-9-]{1,118}$'
       or coalesce(char_length(btrim(champion_row ->> 'name')), 0) not between 1 and 100
       or (current_rarity is not null and char_length(current_rarity) > 60)
       or (current_obtainment is not null and char_length(current_obtainment) > 120) then
      raise exception 'A champion row has invalid required fields';
    end if;

    begin
      current_value := case when nullif(btrim(champion_row ->> 'official_value'), '') is null then null else greatest(0, least(1000000, (champion_row ->> 'official_value')::integer)) end;
      current_clan_points := case when nullif(btrim(champion_row ->> 'clan_points'), '') is null then null else greatest(0, least(1000, (champion_row ->> 'clan_points')::integer)) end;
    exception when invalid_text_representation then
      raise exception 'Champion values and Clan Points must be whole numbers';
    end;

    if champion_key = any(champion_keys) then
      raise exception 'Champion catalog keys must be unique';
    end if;
    champion_keys := array_append(champion_keys, champion_key);

    select id into champion_id from public.champions where catalog_key = champion_key;
    if champion_id is null then
      next_champion_id := next_champion_id + 1;
      insert into public.champions (id, catalog_key, name, tier, value, stock, image_url, tradable, stat_bonuses, stat_total, clan_points, obtainment) overriding system value
      values (next_champion_id, champion_key, btrim(champion_row ->> 'name'), coalesce(current_rarity, 'Unlisted'), coalesce(current_value, 0), 0, nullif(btrim(champion_row ->> 'image_url'), ''), true, '{}'::jsonb, 0, coalesce(current_clan_points, 0), current_obtainment);
    else
      update public.champions as stored
      set name = btrim(champion_row ->> 'name'),
          tier = coalesce(current_rarity, stored.tier),
          value = coalesce(current_value, stored.value),
          stock = 0,
          image_url = coalesce(nullif(btrim(champion_row ->> 'image_url'), ''), stored.image_url),
          tradable = true,
          stat_bonuses = '{}'::jsonb,
          stat_total = 0,
          clan_points = coalesce(current_clan_points, stored.clan_points),
          obtainment = coalesce(current_obtainment, stored.obtainment)
      where stored.id = champion_id;
    end if;

    champion_count := champion_count + 1;
  end loop;

  for trait_row in select value from jsonb_array_elements(incoming_traits)
  loop
    trait_key := trait_row ->> 'catalog_key';
    if trait_key is null or trait_key !~ '^[a-z0-9][a-z0-9-]{1,118}$'
       or coalesce(char_length(btrim(trait_row ->> 'name')), 0) not between 1 and 100
       or coalesce(char_length(btrim(trait_row ->> 'rarity')), 0) not between 1 and 60
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
    values (trait_key, btrim(trait_row ->> 'name'), btrim(trait_row ->> 'rarity'), coalesce(trait_row -> 'bonuses', '{}'::jsonb), current_bonus_total, nullif(btrim(trait_row ->> 'notes'), ''), true)
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
    update public.champions set tradable = false where catalog_key is not null and not (catalog_key = any(champion_keys));
    update public.catalog_traits set is_active = false where not (catalog_key = any(trait_keys));
  end if;

  insert into public.admin_audit_events (actor_id, action, details)
  values (auth.uid(), 'catalog_published', jsonb_build_object('mode', publish_mode, 'champion_rows', champion_count, 'trait_rows', trait_count, 'champion_source', 'official_values'));

  return jsonb_build_object('champions_published', champion_count, 'traits_published', trait_count, 'mode', publish_mode);
end;
$$;

revoke all on function public.admin_publish_catalog(jsonb, jsonb, text) from public;
grant execute on function public.admin_publish_catalog(jsonb, jsonb, text) to authenticated;
