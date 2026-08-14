-- Discord defaults intentionally remain compatible with Discord's own broad
-- display-name rules. Once a member chooses a Lumio-specific identity, it is
-- held to a much narrower, Roblox-inspired safety policy instead.
alter table public.profiles
  drop constraint if exists profiles_lumio_display_name_format;

alter table public.profiles
  add constraint profiles_lumio_display_name_format
  check (
    lumio_display_name is null
    or (
      lumio_display_name = btrim(lumio_display_name)
      and char_length(lumio_display_name) between 1 and 32
    )
  );

-- This table is deliberately not readable or writable by browser roles. It
-- gives Lumio a central, server-enforced list that can grow as moderation
-- needs evolve without placing the list in the client bundle.
create table if not exists public.lumio_display_name_blocklist (
  normalized_term text primary key,
  match_mode text not null default 'contains'
    check (match_mode in ('exact', 'contains')),
  created_at timestamptz not null default now()
);

alter table public.lumio_display_name_blocklist enable row level security;
revoke all on public.lumio_display_name_blocklist from anon, authenticated;

-- Reserved product identities and a baseline high-confidence safety list.
-- Additional terms can be added privately in Supabase as moderation evolves.
insert into public.lumio_display_name_blocklist (normalized_term, match_mode)
values
  ('admin', 'exact'),
  ('administrator', 'exact'),
  ('moderator', 'exact'),
  ('staff', 'exact'),
  ('support', 'exact'),
  ('system', 'exact'),
  ('lumio', 'contains'),
  ('discord', 'contains'),
  ('roblox', 'contains'),
  ('nigger', 'contains'),
  ('nigga', 'contains'),
  ('faggot', 'contains'),
  ('kike', 'contains'),
  ('chink', 'contains'),
  ('spic', 'contains'),
  ('wetback', 'contains'),
  ('tranny', 'contains'),
  ('retard', 'contains'),
  ('cunt', 'contains')
on conflict (normalized_term) do nothing;

create or replace function public.validate_lumio_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  discord_default_name text;
begin
  -- Discord's own display-name policy governs the default copied at account
  -- creation. This keeps valid defaults such as long names or non-Latin text
  -- intact rather than silently mutating someone's Discord identity.
  discord_default_name := coalesce(
    nullif(btrim(new.discord_display_name), ''),
    nullif(btrim(new.discord_username), ''),
    'Trader'
  );

  if tg_op = 'INSERT' and new.lumio_display_name = discord_default_name then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.lumio_display_name is not distinct from old.lumio_display_name then
    return new;
  end if;

  normalized_name := lower(btrim(coalesce(new.lumio_display_name, '')));

  if normalized_name !~ '^[a-z]{3,15}$' then
    raise exception 'Lumio display names must use 3 to 15 letters only';
  end if;

  if exists (
    select 1
    from public.lumio_display_name_blocklist as blocked
    where (blocked.match_mode = 'exact' and normalized_name = blocked.normalized_term)
       or (blocked.match_mode = 'contains' and normalized_name like '%' || blocked.normalized_term || '%')
  ) then
    raise exception 'That Lumio display name is not available';
  end if;

  return new;
end;
$$;

-- The default-name trigger executes first; then this validates custom input;
-- and finally the existing z-prefixed trigger records the 24-hour cooldown.
drop trigger if exists profiles_y_validate_lumio_display_name on public.profiles;
create trigger profiles_y_validate_lumio_display_name
  before insert or update on public.profiles
  for each row execute function public.validate_lumio_display_name();
