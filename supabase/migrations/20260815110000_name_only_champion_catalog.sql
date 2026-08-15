-- Lumio's champion catalog is intentionally names-only. Champion artwork is
-- resolved by the web app from the matching bundled PNG, while traits remain
-- a separate, structured catalog.

alter table public.champions
  add column if not exists tier text,
  add column if not exists value integer;

update public.champions
set
  tier = coalesce(nullif(tier, ''), 'AFS Champion'),
  value = coalesce(value, 0);

alter table public.champions
  alter column tier set default 'AFS Champion',
  alter column tier set not null,
  alter column value set default 0,
  alter column value set not null;

-- Older installations can retain this legacy column for compatibility, but it
-- is no longer required or written by the names-only catalog publisher.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'champions'
      and column_name = 'rarity'
  ) then
    alter table public.champions alter column rarity drop not null;
  end if;
end;
$$;

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
  current_bonus_total numeric;
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

    if champion_key is null or champion_key !~ '^[a-z0-9][a-z0-9-]{1,118}$'
       or coalesce(char_length(btrim(champion_row ->> 'name')), 0) not between 1 and 100 then
      raise exception 'A champion row needs a valid catalog key and name';
    end if;

    if champion_key = any(champion_keys) then
      raise exception 'Champion catalog keys must be unique';
    end if;
    champion_keys := array_append(champion_keys, champion_key);

    select id into champion_id
    from public.champions
    where catalog_key = champion_key;

    if champion_id is null then
      next_champion_id := next_champion_id + 1;
      insert into public.champions (
        id, catalog_key, name, tier, value, stock, image_url, tradable,
        stat_bonuses, stat_total, clan_points
      )
      values (
        next_champion_id,
        champion_key,
        btrim(champion_row ->> 'name'),
        'AFS Champion',
        0,
        0,
        nullif(btrim(champion_row ->> 'image_url'), ''),
        true,
        '{}'::jsonb,
        0,
        0
      );
    else
      update public.champions
      set
        name = btrim(champion_row ->> 'name'),
        tier = 'AFS Champion',
        value = 0,
        stock = 0,
        image_url = nullif(btrim(champion_row ->> 'image_url'), ''),
        tradable = true,
        stat_bonuses = '{}'::jsonb,
        stat_total = 0,
        clan_points = 0
      where id = champion_id;
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
    values (
      trait_key,
      btrim(trait_row ->> 'name'),
      btrim(trait_row ->> 'rarity'),
      coalesce(trait_row -> 'bonuses', '{}'::jsonb),
      current_bonus_total,
      nullif(btrim(trait_row ->> 'notes'), ''),
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
      'trait_rows', trait_count,
      'champion_source', 'names_only'
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
