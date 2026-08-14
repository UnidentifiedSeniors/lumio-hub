-- Administrator-only member operations. These routines deliberately expose
-- only public trading identity and progression data, never email addresses or
-- Discord OAuth tokens, and every progression adjustment is auditable.
create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 80),
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);

alter table public.admin_audit_events enable row level security;

drop policy if exists "admin audit events: admin read" on public.admin_audit_events;
create policy "admin audit events: admin read" on public.admin_audit_events
  for select to authenticated
  using (public.is_lumio_admin());

revoke all on public.admin_audit_events from anon, authenticated;
grant select on public.admin_audit_events to authenticated;

create or replace function public.get_admin_member_directory()
returns table (
  id uuid,
  lumio_display_name text,
  discord_display_name text,
  discord_username text,
  rank text,
  xp bigint,
  created_at timestamptz,
  collection_count bigint,
  completed_trade_count bigint
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
    profile.id,
    profile.lumio_display_name,
    profile.discord_display_name,
    profile.discord_username,
    profile.rank,
    profile.xp,
    profile.created_at,
    (select count(*) from public.user_champions as champion where champion.owner_id = profile.id),
    (select count(*) from public.trades as trade where trade.status = 'completed' and (trade.sender_id = profile.id or trade.recipient_id = profile.id))
  from public.profiles as profile
  order by profile.created_at desc
  limit 150;
end;
$$;

create or replace function public.admin_adjust_member_xp(
  target_user_id uuid,
  xp_delta integer,
  adjustment_reason text default null
)
returns table (
  member_id uuid,
  xp bigint,
  rank text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_xp bigint;
  next_xp bigint;
  next_rank text;
  target_name text;
begin
  if not public.is_lumio_admin() then
    raise exception 'Administrator access is required';
  end if;

  if xp_delta = 0 or abs(xp_delta) > 100000 then
    raise exception 'XP adjustment must be between -100000 and 100000, excluding zero';
  end if;

  if adjustment_reason is not null and char_length(adjustment_reason) > 300 then
    raise exception 'Adjustment reason must be 300 characters or fewer';
  end if;

  select
    profile.xp,
    coalesce(profile.lumio_display_name, profile.discord_display_name, profile.discord_username, 'Licensed trader')
  into prior_xp, target_name
  from public.profiles as profile
  where profile.id = target_user_id
  for update;

  if not found then
    raise exception 'Lumio member not found';
  end if;

  next_xp := greatest(0, prior_xp + xp_delta);
  next_rank := public.trade_rank_for_xp(next_xp::integer);

  update public.profiles
  set xp = next_xp,
      rank = next_rank
  where profiles.id = target_user_id;

  insert into public.admin_audit_events (actor_id, action, target_user_id, details)
  values (
    auth.uid(),
    'member_xp_adjusted',
    target_user_id,
    jsonb_build_object(
      'member_name', target_name,
      'delta', xp_delta,
      'previous_xp', prior_xp,
      'new_xp', next_xp,
      'new_rank', next_rank,
      'reason', nullif(trim(coalesce(adjustment_reason, '')), '')
    )
  );

  return query select target_user_id, next_xp, next_rank;
end;
$$;

create or replace function public.log_admin_site_ad_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign record;
begin
  if not public.is_lumio_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    campaign := old;
  else
    campaign := new;
  end if;
  insert into public.admin_audit_events (actor_id, action, details)
  values (
    auth.uid(),
    case tg_op when 'INSERT' then 'campaign_created' when 'UPDATE' then 'campaign_updated' else 'campaign_deleted' end,
    jsonb_build_object('campaign_id', campaign.id, 'slug', campaign.slug, 'title', campaign.title, 'active', campaign.is_active)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists site_ads_log_admin_change on public.site_ads;
create trigger site_ads_log_admin_change
  after insert or update or delete on public.site_ads
  for each row execute function public.log_admin_site_ad_change();

create or replace function public.log_admin_listing_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_lumio_admin() and new.status = 'removed' and old.status is distinct from 'removed' then
    insert into public.admin_audit_events (actor_id, action, target_user_id, details)
    values (
      auth.uid(),
      'market_listing_removed',
      old.owner_id,
      jsonb_build_object('listing_id', old.id, 'previous_status', old.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists shelf_listings_log_admin_removal on public.shelf_listings;
create trigger shelf_listings_log_admin_removal
  after update on public.shelf_listings
  for each row execute function public.log_admin_listing_removal();

revoke all on function public.get_admin_member_directory() from public;
revoke all on function public.admin_adjust_member_xp(uuid, integer, text) from public;
grant execute on function public.get_admin_member_directory() to authenticated;
grant execute on function public.admin_adjust_member_xp(uuid, integer, text) to authenticated;
