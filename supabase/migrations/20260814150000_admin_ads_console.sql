-- The admin console is authorised by a server-maintained account allowlist,
-- never a client-side route or a mutable Discord profile field.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

insert into public.admin_users (user_id)
select profile.id
from public.profiles as profile
where lower(profile.discord_username) = 'bluerose2187'
on conflict (user_id) do nothing;

create or replace function public.is_lumio_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users as admin
    where admin.user_id = auth.uid()
  );
$$;

revoke all on public.admin_users from anon, authenticated;

-- Site ads can be a once-only modal or a persistent banner. Two optional
-- linked actions cover a Discord invite, an in-app destination, or an
-- external partner page without allowing unsafe javascript: URLs.
create table if not exists public.site_ads (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  title text check (title is null or char_length(title) between 1 and 100),
  body text check (body is null or char_length(body) between 1 and 700),
  accent_color text not null default '#777cff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  placement text not null default 'modal' check (placement in ('modal', 'banner')),
  audience text not null default 'all' check (audience in ('all', 'signed_out', 'signed_in')),
  primary_button_label text check (primary_button_label is null or char_length(primary_button_label) between 1 and 40),
  primary_button_url text check (primary_button_url is null or primary_button_url ~ '^(https?://|/)'),
  secondary_button_label text check (secondary_button_label is null or char_length(secondary_button_label) between 1 and 40),
  secondary_button_url text check (secondary_button_url is null or secondary_button_url ~ '^(https?://|/)'),
  dismiss_label text not null default 'Continue to Lumio' check (char_length(dismiss_label) between 1 and 40),
  show_once boolean not null default true,
  is_dismissible boolean not null default true,
  is_active boolean not null default false,
  priority integer not null default 0 check (priority between -1000 and 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (title is not null or body is not null),
  check ((primary_button_label is null) = (primary_button_url is null)),
  check ((secondary_button_label is null) = (secondary_button_url is null)),
  check (is_dismissible or primary_button_url is not null or secondary_button_url is not null),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists site_ads_public_schedule_idx
  on public.site_ads (is_active, priority desc, starts_at, ends_at);

alter table public.site_ads enable row level security;

create or replace function public.set_site_ads_updated_at()
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

drop trigger if exists site_ads_set_updated_at on public.site_ads;
create trigger site_ads_set_updated_at
  before insert or update on public.site_ads
  for each row execute function public.set_site_ads_updated_at();

drop policy if exists "site ads: public active read" on public.site_ads;
create policy "site ads: public active read" on public.site_ads
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "site ads: admin read" on public.site_ads;
create policy "site ads: admin read" on public.site_ads
  for select to authenticated
  using (public.is_lumio_admin());

drop policy if exists "site ads: admin create" on public.site_ads;
create policy "site ads: admin create" on public.site_ads
  for insert to authenticated
  with check (public.is_lumio_admin());

drop policy if exists "site ads: admin update" on public.site_ads;
create policy "site ads: admin update" on public.site_ads
  for update to authenticated
  using (public.is_lumio_admin())
  with check (public.is_lumio_admin());

drop policy if exists "site ads: admin delete" on public.site_ads;
create policy "site ads: admin delete" on public.site_ads
  for delete to authenticated
  using (public.is_lumio_admin());

grant select on public.site_ads to anon, authenticated;
grant insert, update, delete on public.site_ads to authenticated;

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
    'pending_trades', (select count(*) from public.trades where status = 'pending'),
    'active_ads', (select count(*) from public.site_ads where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  );
end;
$$;

grant execute on function public.is_lumio_admin() to authenticated;
grant execute on function public.get_admin_dashboard_metrics() to authenticated;

insert into public.site_ads (
  slug,
  title,
  body,
  accent_color,
  placement,
  audience,
  primary_button_label,
  primary_button_url,
  dismiss_label,
  show_once,
  is_dismissible,
  is_active,
  priority
)
values (
  'lumio-discord-community',
  'Trade better together.',
  'Join the Lumio Discord to share ideas, get help with offers, and help shape the hub as the community grows.',
  '#777cff',
  'modal',
  'all',
  'Join Discord',
  'https://discord.gg/c7WftkFyFj',
  'Continue to Lumio',
  true,
  true,
  true,
  100
)
on conflict (slug) do nothing;
