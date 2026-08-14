-- Official Drops gives Lumio its own first-party marketplace layer without
-- treating community-owned Shelf listings as admin inventory. Official drops
-- are informational/actionable cards: fulfilment remains wherever the admin
-- links the player (for example, Discord, a game event, or a partner page).

create table if not exists public.official_market_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  title text not null check (char_length(title) between 2 and 100),
  summary text check (summary is null or char_length(summary) <= 300),
  accent_color text not null default '#777cff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'ended')),
  is_featured boolean not null default false,
  display_order integer not null default 0 check (display_order between -1000 and 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists official_market_events_schedule_idx
  on public.official_market_events (status, is_featured desc, display_order desc, starts_at, ends_at);

create table if not exists public.official_market_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  event_id uuid references public.official_market_events(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  rarity text not null check (char_length(rarity) between 1 and 60),
  trait text not null default 'Standard' check (char_length(trait) between 1 and 100),
  image_url text,
  reference_value integer not null default 0 check (reference_value >= 0),
  description text check (description is null or char_length(description) <= 500),
  badge_label text not null default 'Official drop' check (char_length(badge_label) between 1 and 40),
  availability_note text check (availability_note is null or char_length(availability_note) <= 120),
  quantity_total integer check (quantity_total is null or quantity_total between 1 and 1000000),
  quantity_remaining integer check (quantity_remaining is null or quantity_remaining between 0 and 1000000),
  accent_color text not null default '#777cff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  cta_label text check (cta_label is null or char_length(cta_label) between 1 and 40),
  cta_url text check (cta_url is null or cta_url ~ '^(https?://|/)'),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'ended')),
  is_featured boolean not null default false,
  display_order integer not null default 0 check (display_order between -1000 and 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cta_label is null) = (cta_url is null)),
  check (quantity_total is null or quantity_remaining is null or quantity_remaining <= quantity_total),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists official_market_listings_schedule_idx
  on public.official_market_listings (status, is_featured desc, display_order desc, starts_at, ends_at);

create index if not exists official_market_listings_event_idx
  on public.official_market_listings (event_id);

alter table public.official_market_events enable row level security;
alter table public.official_market_listings enable row level security;

create or replace function public.set_official_market_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists official_market_events_set_updated_at on public.official_market_events;
create trigger official_market_events_set_updated_at
  before insert or update on public.official_market_events
  for each row execute function public.set_official_market_updated_at();

drop trigger if exists official_market_listings_set_updated_at on public.official_market_listings;
create trigger official_market_listings_set_updated_at
  before insert or update on public.official_market_listings
  for each row execute function public.set_official_market_updated_at();

drop policy if exists "official events: admin read" on public.official_market_events;
create policy "official events: admin read" on public.official_market_events
  for select to authenticated using (public.is_lumio_admin());

drop policy if exists "official events: admin create" on public.official_market_events;
create policy "official events: admin create" on public.official_market_events
  for insert to authenticated with check (public.is_lumio_admin());

drop policy if exists "official events: admin update" on public.official_market_events;
create policy "official events: admin update" on public.official_market_events
  for update to authenticated using (public.is_lumio_admin()) with check (public.is_lumio_admin());

drop policy if exists "official events: admin delete" on public.official_market_events;
create policy "official events: admin delete" on public.official_market_events
  for delete to authenticated using (public.is_lumio_admin());

drop policy if exists "official listings: admin read" on public.official_market_listings;
create policy "official listings: admin read" on public.official_market_listings
  for select to authenticated using (public.is_lumio_admin());

drop policy if exists "official listings: admin create" on public.official_market_listings;
create policy "official listings: admin create" on public.official_market_listings
  for insert to authenticated with check (public.is_lumio_admin());

drop policy if exists "official listings: admin update" on public.official_market_listings;
create policy "official listings: admin update" on public.official_market_listings
  for update to authenticated using (public.is_lumio_admin()) with check (public.is_lumio_admin());

drop policy if exists "official listings: admin delete" on public.official_market_listings;
create policy "official listings: admin delete" on public.official_market_listings
  for delete to authenticated using (public.is_lumio_admin());

grant select, insert, update, delete on public.official_market_events to authenticated;
grant select, insert, update, delete on public.official_market_listings to authenticated;

-- The public Market reads only records that are explicitly live and currently
-- scheduled. An event pauses every attached drop automatically without
-- changing the listings themselves.
create or replace view public.official_marketplace_listings
with (security_invoker = false) as
  select
    listing.id,
    listing.slug,
    listing.event_id,
    listing.name,
    listing.rarity,
    listing.trait,
    listing.image_url,
    listing.reference_value,
    listing.description,
    listing.badge_label,
    listing.availability_note,
    listing.quantity_total,
    listing.quantity_remaining,
    listing.accent_color,
    listing.cta_label,
    listing.cta_url,
    listing.is_featured,
    listing.display_order,
    listing.starts_at,
    listing.ends_at,
    listing.created_at,
    event.slug as event_slug,
    event.title as event_title,
    event.summary as event_summary,
    event.accent_color as event_accent_color,
    event.is_featured as event_is_featured,
    event.starts_at as event_starts_at,
    event.ends_at as event_ends_at
  from public.official_market_listings as listing
  left join public.official_market_events as event on event.id = listing.event_id
  where listing.status = 'live'
    and (listing.starts_at is null or listing.starts_at <= now())
    and (listing.ends_at is null or listing.ends_at > now())
    and (
      listing.event_id is null
      or (
        event.status = 'live'
        and (event.starts_at is null or event.starts_at <= now())
        and (event.ends_at is null or event.ends_at > now())
      )
    );

revoke all on public.official_marketplace_listings from anon;
grant select on public.official_marketplace_listings to authenticated;

create or replace function public.log_admin_official_market_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_data record;
  action_name text;
begin
  if not public.is_lumio_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    record_data := old;
  else
    record_data := new;
  end if;
  action_name := case
    when tg_table_name = 'official_market_events' and tg_op = 'INSERT' then 'official_event_created'
    when tg_table_name = 'official_market_events' and tg_op = 'UPDATE' then 'official_event_updated'
    when tg_table_name = 'official_market_events' then 'official_event_deleted'
    when tg_op = 'INSERT' then 'official_drop_created'
    when tg_op = 'UPDATE' then 'official_drop_updated'
    else 'official_drop_deleted'
  end;

  if tg_table_name = 'official_market_events' then
    insert into public.admin_audit_events (actor_id, action, details)
    values (
      auth.uid(),
      action_name,
      jsonb_build_object(
        'id', record_data.id,
        'slug', record_data.slug,
        'name', record_data.title,
        'status', record_data.status
      )
    );
  else
    insert into public.admin_audit_events (actor_id, action, details)
    values (
      auth.uid(),
      action_name,
      jsonb_build_object(
        'id', record_data.id,
        'slug', record_data.slug,
        'name', record_data.name,
        'status', record_data.status,
        'event_id', record_data.event_id
      )
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists official_market_events_log_admin_change on public.official_market_events;
create trigger official_market_events_log_admin_change
  after insert or update or delete on public.official_market_events
  for each row execute function public.log_admin_official_market_change();

drop trigger if exists official_market_listings_log_admin_change on public.official_market_listings;
create trigger official_market_listings_log_admin_change
  after insert or update or delete on public.official_market_listings
  for each row execute function public.log_admin_official_market_change();

create or replace function public.get_admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_lumio_admin() then
    raise exception 'Administrator access is required';
  end if;

  return jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'champion_copies', (select count(*) from public.user_champions),
    'active_listings', (select count(*) from public.shelf_listings where status = 'active'),
    'official_drops', (select count(*) from public.official_marketplace_listings),
    'pending_trades', (select count(*) from public.trades where status = 'pending'),
    'active_ads', (select count(*) from public.site_ads where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  );
end;
$$;
