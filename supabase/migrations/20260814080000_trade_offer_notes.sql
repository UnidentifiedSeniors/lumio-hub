-- A short note lets traders clarify an offer before the real in-game exchange.
-- It is part of the original offer snapshot and cannot be edited afterward.
alter table public.trades
  add column if not exists offer_note text;

alter table public.trades
  drop constraint if exists trades_offer_note_length;

alter table public.trades
  add constraint trades_offer_note_length
  check (offer_note is null or char_length(offer_note) between 1 and 280);

create or replace function public.manage_trade_offer_note()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.offer_note := nullif(btrim(new.offer_note), '');
  elsif new.offer_note is distinct from old.offer_note then
    raise exception 'An offer note cannot be changed after the trade is sent';
  end if;

  return new;
end;
$$;

drop trigger if exists trades_manage_offer_note on public.trades;
create trigger trades_manage_offer_note
  before insert or update on public.trades
  for each row execute function public.manage_trade_offer_note();
