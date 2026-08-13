-- XP is awarded only when the accepting recipient records the real in-game
-- exchange as completed. The calculation happens inside the same transaction
-- so browser code cannot award progress early or more than once.

alter table public.trades
  add column if not exists xp_awarded integer check (xp_awarded is null or xp_awarded >= 0);

create or replace function public.trade_rarity_score(rarity text)
returns integer
language sql
immutable
as $$
  select case rarity
    when 'Common' then 1
    when 'Uncommon' then 2
    when 'Rare' then 3
    when 'Epic' then 4
    when 'Legendary' then 5
    when 'Mythic' then 6
    when 'Secret' then 7
    when 'Shiny Secret' then 8
    when 'Exclusive' then 9
    when 'Shiny Mythic' then 10
    when 'Shiny Legendary' then 11
    when 'Shiny Epic' then 12
    when 'Shiny Rare' then 13
    when 'Shiny Uncommon' then 14
    when 'Sovereign' then 15
    else 0
  end;
$$;

create or replace function public.trade_completion_xp(trade_row public.trades)
returns integer
language plpgsql
stable
as $$
declare
  champion_payload jsonb;
  rarity_bonus integer := 0;
  involved_value integer := 0;
  offered_count integer := 0;
begin
  champion_payload := coalesce(trade_row.offered_champions, '[]'::jsonb)
    || coalesce(trade_row.requested_champions, '[]'::jsonb)
    || case
      when trade_row.requested_champion is null then '[]'::jsonb
      else jsonb_build_array(trade_row.requested_champion)
    end;

  select coalesce(max(public.trade_rarity_score(item ->> 'rarity')), 0)
    into rarity_bonus
    from jsonb_array_elements(champion_payload) as item;

  offered_count := jsonb_array_length(coalesce(trade_row.offered_champions, '[]'::jsonb));
  involved_value := greatest(0, coalesce(trade_row.offer_value, 0))
    + greatest(0, coalesce(trade_row.requested_value, 0));

  -- Base 40, rarity 15 each tier, value 1 per 20 combined value, then a
  -- modest bonus for multi-champion offers. Keep the result bounded so future
  -- market adjustments cannot create runaway progression.
  return least(500, greatest(50,
    40 + (rarity_bonus * 15) + floor(involved_value / 20.0)::integer
    + greatest(0, offered_count - 1) * 10
  ));
end;
$$;

create or replace function public.trade_rank_for_xp(total_xp integer)
returns text
language sql
immutable
as $$
  select case
    when total_xp >= 60000 then 'Lumio Legend'
    when total_xp >= 30000 then 'Master Trader'
    when total_xp >= 15000 then 'Elite Trader'
    when total_xp >= 5000 then 'Advanced Trader'
    when total_xp >= 1500 then 'Skilled Trader'
    when total_xp >= 500 then 'Beginner Trader'
    else 'Rookie Trader'
  end;
$$;

-- Never let a browser change the champion payload or value snapshot after an
-- offer is created. The completion trigger below then calculates XP from a
-- trusted snapshot rather than from user-submitted update data.
create or replace function public.protect_trade_payload()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or new.listing_id is distinct from old.listing_id
    or new.trade_code is distinct from old.trade_code
    or new.requested_champion is distinct from old.requested_champion
    or new.requested_champions is distinct from old.requested_champions
    or new.offered_champions is distinct from old.offered_champions
    or new.offer_value is distinct from old.offer_value
    or new.requested_value is distinct from old.requested_value then
    raise exception 'Trade champions and values cannot be changed after an offer is sent';
  end if;

  if new.xp_awarded is distinct from old.xp_awarded
     and not (old.status = 'accepted' and new.status = 'completed') then
    raise exception 'Trade XP is set only when an accepted exchange is completed';
  end if;

  return new;
end;
$$;

drop trigger if exists trades_protect_payload on public.trades;
create trigger trades_protect_payload
  before update on public.trades
  for each row execute function public.protect_trade_payload();

-- The previously-created timestamp trigger is intentionally replaced so a
-- client cannot set arbitrary acceptance/completion timestamps.
create or replace function public.set_trade_lifecycle_timestamps()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status and new.status = 'accepted' then
    new.accepted_at := now();
  end if;

  if old.status is distinct from new.status and new.status = 'completed' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.apply_trade_completion_progression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'accepted' and new.status = 'completed' then
    new.xp_awarded := public.trade_completion_xp(new);

    update public.profiles as profile
      set xp = profile.xp + new.xp_awarded,
          rank = public.trade_rank_for_xp(profile.xp + new.xp_awarded)
      where profile.id in (new.sender_id, new.recipient_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trades_apply_completion_progression on public.trades;
create trigger trades_apply_completion_progression
  before update on public.trades
  for each row execute function public.apply_trade_completion_progression();
