-- Once an offer is accepted, both parties' champion copies are committed to
-- that in-game exchange. The original lifecycle trigger reserved only the
-- recipient's requested Shelf listing; this version also reserves any public
-- Shelf listings that belong to the sender's offered copies.
create or replace function public.reserve_listing_for_accepted_trade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  offered_champion_ids uuid[];
  reserved_sender_listing_ids uuid[];
begin
  if old.status <> 'pending' or new.status <> 'accepted' then
    return new;
  end if;

  -- Reserve the recipient's requested public listing, when this offer came
  -- from Market or a public Shelf profile card.
  if new.listing_id is not null then
    update public.shelf_listings
      set status = 'completed'
      where id = new.listing_id
        and owner_id = new.recipient_id
        and status in ('active', 'paused');

    if not found then
      raise exception 'This Shelf listing is no longer available for acceptance';
    end if;

    update public.trades
      set status = 'declined'
      where listing_id = new.listing_id
        and id <> new.id
        and status = 'pending';
  end if;

  -- The offer-integrity trigger records a user_champion_id for every offered
  -- copy. Use those immutable snapshots to reserve any matching sender Shelf
  -- listings as part of the same transaction.
  select array_agg((offered.item ->> 'user_champion_id')::uuid)
    into offered_champion_ids
  from jsonb_array_elements(coalesce(new.offered_champions, '[]'::jsonb)) as offered(item)
  where (offered.item ->> 'user_champion_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  if cardinality(offered_champion_ids) > 0 then
    with reserved_listings as (
      update public.shelf_listings
        set status = 'completed'
        where owner_id = new.sender_id
          and user_champion_id = any(offered_champion_ids)
          and status in ('active', 'paused')
        returning id
    )
    select array_agg(id)
      into reserved_sender_listing_ids
    from reserved_listings;

    if cardinality(reserved_sender_listing_ids) > 0 then
      update public.trades
        set status = 'declined'
        where listing_id = any(reserved_sender_listing_ids)
          and id <> new.id
          and status = 'pending';
    end if;
  end if;

  return new;
end;
$$;
