-- Deleting a Collection copy cascades its Shelf listing. The trade record
-- keeps immutable champion snapshots, but PostgreSQL must clear listing_id on
-- historic offers whose listing no longer exists. Permit only that exact
-- database-driven cleanup; browser updates still cannot redirect a trade.
create or replace function public.protect_trade_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or (
      new.listing_id is distinct from old.listing_id
      and not (
        old.listing_id is not null
        and new.listing_id is null
        and not exists (
          select 1
          from public.shelf_listings as listing
          where listing.id = old.listing_id
        )
      )
    )
    or new.trade_code is distinct from old.trade_code
    or new.requested_champion is distinct from old.requested_champion
    or new.requested_champions is distinct from old.requested_champions
    or new.offered_champions is distinct from old.offered_champions
    or new.offer_value is distinct from old.offer_value
    or new.requested_value is distinct from old.requested_value then
    raise exception 'Trade champions and values cannot be changed after an offer is sent';
  end if;

  if new.xp_awarded is distinct from old.xp_awarded
     and not (old.status = 'accepted' and new.status = 'completed') then
    raise exception 'Trade XP is set only when an accepted exchange is completed';
  end if;

  return new;
end;
$$;
