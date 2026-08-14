-- Public profiles need trust signals without exposing private champion records
-- or another trader's private offer history. This view exposes aggregates only.

create or replace view public.public_trader_stats
with (security_invoker = false) as
  select
    profile.id,
    (
      select count(*)
      from public.trades as trade
      where trade.status = 'completed'
        and (trade.sender_id = profile.id or trade.recipient_id = profile.id)
    ) as completed_trade_count,
    (
      select count(*)
      from public.user_champions as champion
      where champion.owner_id = profile.id
    ) as collection_count,
    (
      select count(*)
      from public.shelf_listings as listing
      where listing.owner_id = profile.id
        and listing.status = 'active'
    ) as active_listing_count
  from public.profiles as profile;

revoke all on public.public_trader_stats from anon;
grant select on public.public_trader_stats to authenticated;
