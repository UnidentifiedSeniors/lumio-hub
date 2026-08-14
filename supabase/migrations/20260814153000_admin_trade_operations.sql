-- Trade oversight is intentionally narrow: admins can review all trade
-- activity and close only a pending offer. Accepted and completed exchanges
-- remain protected by the two-party in-game confirmation workflow.
alter table public.trades
  add column if not exists admin_note text check (admin_note is null or char_length(admin_note) between 1 and 300),
  add column if not exists admin_cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_cancelled_at timestamptz;

create or replace function public.protect_trade_admin_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.admin_note is distinct from old.admin_note
    or new.admin_cancelled_by is distinct from old.admin_cancelled_by
    or new.admin_cancelled_at is distinct from old.admin_cancelled_at
  ) and not public.is_lumio_admin() then
    raise exception 'Only a Lumio administrator can record a trade moderation action';
  end if;
  return new;
end;
$$;

drop trigger if exists trades_protect_admin_resolution on public.trades;
create trigger trades_protect_admin_resolution
  before update on public.trades
  for each row execute function public.protect_trade_admin_resolution();

create or replace function public.get_admin_trade_activity()
returns table (
  id uuid,
  trade_code text,
  status text,
  sender_name text,
  sender_username text,
  recipient_name text,
  recipient_username text,
  requested_champions jsonb,
  offered_champions jsonb,
  offer_value integer,
  requested_value integer,
  created_at timestamptz,
  updated_at timestamptz,
  accepted_at timestamptz,
  sender_confirmed_at timestamptz,
  recipient_confirmed_at timestamptz,
  admin_note text,
  admin_cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_lumio_admin() then
    raise exception 'Administrator access is required';
  end if;

  return query
  select
    trade.id,
    trade.trade_code,
    trade.status,
    coalesce(sender.lumio_display_name, sender.discord_display_name, sender.discord_username, 'Licensed trader'),
    sender.discord_username,
    coalesce(recipient.lumio_display_name, recipient.discord_display_name, recipient.discord_username, 'Licensed trader'),
    recipient.discord_username,
    coalesce(nullif(trade.requested_champions, '[]'::jsonb), jsonb_build_array(trade.requested_champion), '[]'::jsonb),
    coalesce(trade.offered_champions, '[]'::jsonb),
    trade.offer_value,
    trade.requested_value,
    trade.created_at,
    trade.updated_at,
    trade.accepted_at,
    trade.sender_confirmed_at,
    trade.recipient_confirmed_at,
    trade.admin_note,
    trade.admin_cancelled_at
  from public.trades as trade
  join public.profiles as sender on sender.id = trade.sender_id
  left join public.profiles as recipient on recipient.id = trade.recipient_id
  order by trade.updated_at desc
  limit 100;
end;
$$;

create or replace function public.admin_cancel_pending_trade(
  target_trade_id uuid,
  cancellation_reason text default null
)
returns table (
  trade_id uuid,
  trade_code text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trade public.trades%rowtype;
begin
  if not public.is_lumio_admin() then
    raise exception 'Administrator access is required';
  end if;

  if cancellation_reason is not null and char_length(cancellation_reason) > 300 then
    raise exception 'Cancellation note must be 300 characters or fewer';
  end if;

  select *
  into target_trade
  from public.trades
  where id = target_trade_id
  for update;

  if not found then
    raise exception 'Trade not found';
  end if;

  if target_trade.status <> 'pending' then
    raise exception 'Only a pending trade can be cancelled by an administrator';
  end if;

  update public.trades
  set status = 'cancelled',
      admin_note = nullif(trim(coalesce(cancellation_reason, '')), ''),
      admin_cancelled_by = auth.uid(),
      admin_cancelled_at = now()
  where id = target_trade_id
  returning * into target_trade;

  insert into public.admin_audit_events (actor_id, action, target_user_id, details)
  values (
    auth.uid(),
    'pending_trade_cancelled',
    target_trade.sender_id,
    jsonb_build_object(
      'trade_id', target_trade.id,
      'trade_code', target_trade.trade_code,
      'reason', target_trade.admin_note,
      'recipient_id', target_trade.recipient_id
    )
  );

  return query select target_trade.id, target_trade.trade_code, target_trade.status;
end;
$$;

revoke all on function public.get_admin_trade_activity() from public;
revoke all on function public.admin_cancel_pending_trade(uuid, text) from public;
grant execute on function public.get_admin_trade_activity() to authenticated;
grant execute on function public.admin_cancel_pending_trade(uuid, text) to authenticated;
