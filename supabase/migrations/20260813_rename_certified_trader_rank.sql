-- Replace the status-sounding Certified Trader rank with a clear progression
-- rank. Existing members at this XP tier keep their progress and are updated
-- in place so their next Discord sync receives the renamed role.

update public.profiles
set rank = 'Skilled Trader'
where rank = 'Certified Trader';

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
