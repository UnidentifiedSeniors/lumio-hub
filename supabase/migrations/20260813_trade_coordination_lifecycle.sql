-- Accepted trades represent an agreement to coordinate an in-game exchange.
-- Lumio never transfers Roblox champions; it reserves the public listing and
-- records the outcome after the traders finish inside Anime Fighting Simulator.

alter table public.trades
  add column if not exists accepted_at timestamptz,
  add column if not exists completed_at timestamptz;

-- A recipient can accept or decline only while the offer is pending.
drop policy if exists "trades: recipient responds pending" on public.trades;
create policy "trades: recipient responds pending" on public.trades
  for update to authenticated
  using (recipient_id = auth.uid() and status = 'pending')
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined'));

-- The recipient who accepted the offer records the real in-game exchange as
-- completed after both traders have finished it in Anime Fighting Simulator.
drop policy if exists "trades: recipient completes accepted" on public.trades;
create policy "trades: recipient completes accepted" on public.trades
  for update to authenticated
  using (recipient_id = auth.uid() and status = 'accepted')
  with check (recipient_id = auth.uid() and status = 'completed');

create or replace function public.set_trade_lifecycle_timestamps()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status and new.status = 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;

  if old.status is distinct from new.status and new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trades_set_lifecycle_timestamps on public.trades;
create trigger trades_set_lifecycle_timestamps
  before update on public.trades
  for each row execute function public.set_trade_lifecycle_timestamps();

-- A listing can only be accepted once. The trigger atomically completes that
-- Shelf item and declines any remaining pending offers for the same listing.
-- Direct offers have no listing_id and remain unaffected.
create or replace function public.reserve_listing_for_accepted_trade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending'
     and new.status = 'accepted'
     and new.listing_id is not null then
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

  return new;
end;
$$;

drop trigger if exists trades_reserve_listing_on_acceptance on public.trades;
create trigger trades_reserve_listing_on_acceptance
  before update on public.trades
  for each row execute function public.reserve_listing_for_accepted_trade();
