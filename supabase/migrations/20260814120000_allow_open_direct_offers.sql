-- A direct offer can be an open private proposal. When a recipient shares a
-- public Collection, the sender may optionally name one specific copy; private
-- Collections never prevent a member from receiving a direct offer.
create or replace function public.validate_trade_offer_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  offered_ids uuid[];
  offered_count integer;
  canonical_offered jsonb;
  listing_champion public.user_champions%rowtype;
  direct_requested_champion public.user_champions%rowtype;
  requested_champion_id uuid;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.sender_id is null or new.recipient_id is null then
    raise exception 'A trade offer needs both a sender and recipient';
  end if;

  if new.sender_id = new.recipient_id then
    raise exception 'You cannot send a trade offer to yourself';
  end if;

  if new.status is distinct from 'pending' then
    raise exception 'New trade offers must start pending';
  end if;

  if jsonb_typeof(coalesce(new.offered_champions, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(new.offered_champions, '[]'::jsonb)) not between 1 and 4 then
    raise exception 'Choose between one and four champion copies to offer';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.offered_champions) as offered(item)
    where (offered.item ->> 'user_champion_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'Each offered champion must identify one of your Collection copies';
  end if;

  select array_agg((offered.item ->> 'user_champion_id')::uuid)
    into offered_ids
  from jsonb_array_elements(new.offered_champions) as offered(item);

  offered_count := cardinality(offered_ids);
  if offered_count is null or offered_count <> (
    select count(distinct champion_id)
    from unnest(offered_ids) as offered(champion_id)
  ) then
    raise exception 'The same champion copy cannot be offered twice';
  end if;

  if offered_count <> (
    select count(*)
    from public.user_champions as champion
    where champion.owner_id = new.sender_id
      and champion.id = any(offered_ids)
  ) then
    raise exception 'Every offered champion must belong to the sender''s Collection';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', coalesce(champion.champion_id::text, champion.id::text),
        'user_champion_id', champion.id,
        'name', champion.name,
        'rarity', champion.rarity,
        'traits', case
          when champion.trait is null or champion.trait = 'Standard' then '[]'::jsonb
          else jsonb_build_array(champion.trait)
        end,
        'trait', coalesce(champion.trait, 'Standard'),
        'value', round(champion.base_value * champion.market_adjustment)::integer
      )
      order by champion.id
    ),
    '[]'::jsonb
  )
    into canonical_offered
  from public.user_champions as champion
  where champion.owner_id = new.sender_id
    and champion.id = any(offered_ids);

  new.offered_champions := canonical_offered;
  new.offer_value := coalesce(
    (
      select sum(round(champion.base_value * champion.market_adjustment)::integer)
      from public.user_champions as champion
      where champion.owner_id = new.sender_id
        and champion.id = any(offered_ids)
    ),
    0
  );

  if new.listing_id is null then
    if jsonb_typeof(coalesce(new.requested_champions, '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(new.requested_champions, '[]'::jsonb)) not between 0 and 1 then
      raise exception 'Choose at most one public Collection champion to request';
    end if;

    if jsonb_array_length(coalesce(new.requested_champions, '[]'::jsonb)) = 0 then
      new.requested_champion := null;
      new.requested_champions := '[]'::jsonb;
      new.requested_value := null;
    else
      if (new.requested_champions -> 0 ->> 'user_champion_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'The requested champion must identify a public Collection copy';
      end if;

      requested_champion_id := (new.requested_champions -> 0 ->> 'user_champion_id')::uuid;

      select champion.*
        into direct_requested_champion
      from public.user_champions as champion
      join public.profiles as profile
        on profile.id = champion.owner_id
      where champion.id = requested_champion_id
        and champion.owner_id = new.recipient_id
        and profile.collection_visibility = 'public';

      if not found then
        raise exception 'This champion is not available for a direct offer';
      end if;

      new.requested_champion := jsonb_build_object(
        'id', coalesce(direct_requested_champion.champion_id::text, direct_requested_champion.id::text),
        'user_champion_id', direct_requested_champion.id,
        'name', direct_requested_champion.name,
        'rarity', direct_requested_champion.rarity,
        'traits', case
          when direct_requested_champion.trait is null or direct_requested_champion.trait = 'Standard' then '[]'::jsonb
          else jsonb_build_array(direct_requested_champion.trait)
        end,
        'trait', coalesce(direct_requested_champion.trait, 'Standard'),
        'value', round(direct_requested_champion.base_value * direct_requested_champion.market_adjustment)::integer
      );
      new.requested_champions := jsonb_build_array(new.requested_champion);
      new.requested_value := round(direct_requested_champion.base_value * direct_requested_champion.market_adjustment)::integer;
    end if;
  else
    select champion.*
      into listing_champion
    from public.shelf_listings as listing
    join public.user_champions as champion
      on champion.id = listing.user_champion_id
    where listing.id = new.listing_id
      and listing.owner_id = new.recipient_id
      and listing.status = 'active';

    if not found then
      raise exception 'This Shelf listing is no longer available for offers';
    end if;

    new.requested_champion := jsonb_build_object(
      'id', coalesce(listing_champion.champion_id::text, listing_champion.id::text),
      'user_champion_id', listing_champion.id,
      'name', listing_champion.name,
      'rarity', listing_champion.rarity,
      'traits', case
        when listing_champion.trait is null or listing_champion.trait = 'Standard' then '[]'::jsonb
        else jsonb_build_array(listing_champion.trait)
      end,
      'trait', coalesce(listing_champion.trait, 'Standard'),
      'value', round(listing_champion.base_value * listing_champion.market_adjustment)::integer
    );
    new.requested_champions := jsonb_build_array(new.requested_champion);
    new.requested_value := round(listing_champion.base_value * listing_champion.market_adjustment)::integer;
  end if;

  return new;
end;
$$;
