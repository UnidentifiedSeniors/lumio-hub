-- Let members decide which future in-app trade alerts are created for them.
-- Both switches default on, preserving the current notification behavior.
alter table public.profiles
  add column if not exists notification_preferences jsonb
  not null default '{"new_offers": true, "trade_updates": true}'::jsonb;

update public.profiles
set notification_preferences = '{"new_offers": true, "trade_updates": true}'::jsonb
where notification_preferences is null;

alter table public.profiles
  drop constraint if exists profiles_notification_preferences_format;

alter table public.profiles
  add constraint profiles_notification_preferences_format
  check (
    jsonb_typeof(notification_preferences) = 'object'
    and jsonb_typeof(notification_preferences -> 'new_offers') = 'boolean'
    and jsonb_typeof(notification_preferences -> 'trade_updates') = 'boolean'
  );

create or replace function public.is_trade_notification_enabled(target_profile_id uuid, preference_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (notification_preferences ->> preference_key)::boolean
      from public.profiles
      where id = target_profile_id
    ),
    true
  );
$$;

revoke all on function public.is_trade_notification_enabled(uuid, text) from public;

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
    if new.recipient_id is not null
      and public.is_trade_notification_enabled(new.recipient_id, 'new_offers') then
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

  if new.status = 'accepted'
    and public.is_trade_notification_enabled(new.sender_id, 'trade_updates') then
    insert into public.notifications (user_id, type, title, body, link_path, trade_id)
    values (
      new.sender_id,
      'offer_accepted',
      'Trade ' || code_label || ' accepted',
      'Your offer was accepted. Coordinate the in-game exchange in Anime Fighting Simulator.',
      '/sent-trades',
      new.id
    );
  elsif new.status = 'declined'
    and public.is_trade_notification_enabled(new.sender_id, 'trade_updates') then
    insert into public.notifications (user_id, type, title, body, link_path, trade_id)
    values (
      new.sender_id,
      'offer_declined',
      'Trade ' || code_label || ' declined',
      'The recipient declined this offer. Your champion collection is unchanged.',
      '/sent-trades',
      new.id
    );
  elsif new.status = 'cancelled' and new.recipient_id is not null
    and public.is_trade_notification_enabled(new.recipient_id, 'trade_updates') then
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
    if public.is_trade_notification_enabled(new.sender_id, 'trade_updates') then
      insert into public.notifications (user_id, type, title, body, link_path, trade_id)
      values (
        new.sender_id,
        'trade_completed',
        'Trade ' || code_label || ' completed',
        'The in-game exchange is confirmed. Trading XP was awarded to both traders.',
        '/sent-trades',
        new.id
      );
    end if;

    if new.recipient_id is not null
      and new.recipient_id <> new.sender_id
      and public.is_trade_notification_enabled(new.recipient_id, 'trade_updates') then
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
