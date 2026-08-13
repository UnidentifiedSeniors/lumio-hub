-- In-app notifications are generated from the authoritative trade lifecycle.
-- Clients can read and mark only their own notifications; no browser can forge
-- another trader's alerts.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'new_offer',
    'offer_accepted',
    'offer_declined',
    'offer_withdrawn',
    'trade_completed'
  )),
  title text not null,
  body text not null,
  link_path text not null default '/dashboard',
  trade_id uuid references public.trades(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_at_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Members may only acknowledge an alert. Its trade context and ownership stay
-- server-controlled even though a normal browser request marks it as read.
create or replace function public.protect_notification_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.link_path is distinct from old.link_path
    or new.trade_id is distinct from old.trade_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Only a notification read state can be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_protect_update on public.notifications;
create trigger notifications_protect_update
  before update on public.notifications
  for each row execute function public.protect_notification_update();

create or replace function public.create_trade_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code_label text := '#' || coalesce(new.trade_code, '----');
  requested_name text := coalesce(
    new.requested_champions -> 0 ->> 'name',
    new.requested_champion ->> 'name',
    'your collection'
  );
begin
  if tg_op = 'INSERT' then
    if new.recipient_id is not null then
      insert into public.notifications (user_id, type, title, body, link_path, trade_id)
      values (
        new.recipient_id,
        'new_offer',
        'New trade offer ' || code_label,
        'A trader wants ' || requested_name || '. Review the champions and respond when ready.',
        '/received-trades',
        new.id
      );
    end if;
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'accepted' then
    insert into public.notifications (user_id, type, title, body, link_path, trade_id)
    values (
      new.sender_id,
      'offer_accepted',
      'Trade ' || code_label || ' accepted',
      'Your offer was accepted. Coordinate the in-game exchange in Anime Fighting Simulator.',
      '/sent-trades',
      new.id
    );
  elsif new.status = 'declined' then
    insert into public.notifications (user_id, type, title, body, link_path, trade_id)
    values (
      new.sender_id,
      'offer_declined',
      'Trade ' || code_label || ' declined',
      'The recipient declined this offer. Your champion collection is unchanged.',
      '/sent-trades',
      new.id
    );
  elsif new.status = 'cancelled' and new.recipient_id is not null then
    insert into public.notifications (user_id, type, title, body, link_path, trade_id)
    values (
      new.recipient_id,
      'offer_withdrawn',
      'Trade ' || code_label || ' withdrawn',
      'The sender withdrew their pending offer before it was accepted.',
      '/received-trades',
      new.id
    );
  elsif new.status = 'completed' then
    insert into public.notifications (user_id, type, title, body, link_path, trade_id)
    values (
      new.sender_id,
      'trade_completed',
      'Trade ' || code_label || ' completed',
      'The in-game exchange is confirmed. Trading XP was awarded to both traders.',
      '/sent-trades',
      new.id
    );

    if new.recipient_id is not null and new.recipient_id <> new.sender_id then
      insert into public.notifications (user_id, type, title, body, link_path, trade_id)
      values (
        new.recipient_id,
        'trade_completed',
        'Trade ' || code_label || ' completed',
        'The in-game exchange is confirmed. Trading XP was awarded to both traders.',
        '/received-trades',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trades_create_in_app_notifications on public.trades;
create trigger trades_create_in_app_notifications
  after insert or update on public.trades
  for each row execute function public.create_trade_notifications();
