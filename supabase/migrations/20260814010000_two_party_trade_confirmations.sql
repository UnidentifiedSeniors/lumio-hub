-- A completed Lumio trade now requires confirmation from both participants.
-- The second confirmation atomically completes the trade, which lets the
-- existing completion trigger award XP and lets the Discord webhook update the
-- original message only after the real in-game exchange is mutually confirmed.

alter table public.trades
  add column if not exists sender_confirmed_at timestamptz,
  add column if not exists recipient_confirmed_at timestamptz;

-- Historical completed records predate two-party confirmations. Preserve them
-- as completed history without changing their awarded XP or timestamps.
update public.trades
set sender_confirmed_at = coalesce(sender_confirmed_at, completed_at, updated_at, created_at),
    recipient_confirmed_at = coalesce(recipient_confirmed_at, completed_at, updated_at, created_at)
where status = 'completed'
  and (sender_confirmed_at is null or recipient_confirmed_at is null);

alter table public.trades
  drop constraint if exists trades_completed_requires_both_confirmations;

alter table public.trades
  add constraint trades_completed_requires_both_confirmations
  check (
    status <> 'completed'
    or (sender_confirmed_at is not null and recipient_confirmed_at is not null)
  );

-- Replace the previous recipient-only completion policy. Participants may only
-- update an accepted offer; the trigger below restricts that update to their
-- own one-time confirmation and advances the status when both are present.
drop policy if exists "trades: recipient completes accepted" on public.trades;
drop policy if exists "trades: participants confirm accepted" on public.trades;
create policy "trades: participants confirm accepted" on public.trades
  for update to authenticated
  using (
    status = 'accepted'
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  )
  with check (
    status in ('accepted', 'completed')
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  );

create or replace function public.confirm_trade_completion()
returns trigger
language plpgsql
as $$
begin
  -- This trigger only owns the accepted-to-completed workflow. Pending offer
  -- responses and all other lifecycle guards continue through their existing
  -- triggers and policies.
  if old.status <> 'accepted' then
    return new;
  end if;

  if new.accepted_at is distinct from old.accepted_at
     or new.completed_at is distinct from old.completed_at
     or new.xp_awarded is distinct from old.xp_awarded then
    raise exception 'Trade lifecycle timestamps and XP are managed by Lumio';
  end if;

  if auth.uid() = old.sender_id then
    if old.sender_confirmed_at is not null then
      raise exception 'You have already confirmed this exchange';
    end if;
    if new.sender_confirmed_at is null
       or new.recipient_confirmed_at is distinct from old.recipient_confirmed_at then
      raise exception 'A trader can only confirm their own exchange';
    end if;
    new.sender_confirmed_at := now();
  elsif auth.uid() = old.recipient_id then
    if old.recipient_confirmed_at is not null then
      raise exception 'You have already confirmed this exchange';
    end if;
    if new.recipient_confirmed_at is null
       or new.sender_confirmed_at is distinct from old.sender_confirmed_at then
      raise exception 'A trader can only confirm their own exchange';
    end if;
    new.recipient_confirmed_at := now();
  else
    raise exception 'Only trade participants can confirm an exchange';
  end if;

  -- Clients never set a completed status themselves. The second valid
  -- confirmation is the only path that advances this lifecycle state.
  if new.status is distinct from old.status then
    raise exception 'Trade status is set after both traders confirm';
  end if;

  if new.sender_confirmed_at is not null and new.recipient_confirmed_at is not null then
    new.status := 'completed';
  else
    new.status := 'accepted';
  end if;

  return new;
end;
$$;

drop trigger if exists trades_confirm_in_game_exchange on public.trades;
create trigger trades_confirm_in_game_exchange
  before update on public.trades
  for each row execute function public.confirm_trade_completion();

-- The confirmation trigger alphabetically runs before this progression trigger,
-- so the latter sees the final completed status created by the second trader.
drop trigger if exists trades_apply_completion_progression on public.trades;
drop trigger if exists trades_z_apply_completion_progression on public.trades;
create trigger trades_z_apply_completion_progression
  before update on public.trades
  for each row execute function public.apply_trade_completion_progression();
