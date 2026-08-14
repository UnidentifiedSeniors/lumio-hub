-- Keep the concise written date as Lumio's default, while allowing each
-- member to choose their own display convention. These fields stay private to
-- the account; they affect only that member's client-side presentation.
alter table public.profiles
  add column if not exists date_format text not null default 'month_day_year',
  add column if not exists date_include_time boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_date_format;

alter table public.profiles
  add constraint profiles_date_format
  check (date_format in ('month_day_year', 'month_day_year_numeric', 'day_month_year', 'year_month_day'));

-- A Collection is meant to be shareable by default. Existing members who
-- deliberately made theirs private retain that choice.
alter table public.profiles
  alter column collection_visibility set default 'public';
