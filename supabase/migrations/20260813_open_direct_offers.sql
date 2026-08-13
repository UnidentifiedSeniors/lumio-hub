-- Direct offers can be addressed to a trader without targeting a Shelf item.
-- Listing offers continue to store their requested champion snapshot as before.
alter table public.trades
  alter column requested_champion drop not null;
