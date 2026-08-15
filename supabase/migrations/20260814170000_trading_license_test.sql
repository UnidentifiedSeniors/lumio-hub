-- Trading on Lumio is a privilege earned by passing this server-scored
-- assessment. Browser code never receives the answer key, and database RLS
-- separately enforces the same license requirement for every trade action.

alter table public.profiles
  add column if not exists trading_license_status text not null default 'unlicensed',
  add column if not exists trading_license_passed_at timestamptz,
  add column if not exists trading_license_score integer;

alter table public.profiles
  drop constraint if exists profiles_trading_license_status_check;

alter table public.profiles
  add constraint profiles_trading_license_status_check
  check (trading_license_status in ('unlicensed', 'licensed'));

alter table public.profiles
  drop constraint if exists profiles_trading_license_score_check;

alter table public.profiles
  add constraint profiles_trading_license_score_check
  check (trading_license_score is null or trading_license_score between 0 and 100);

create or replace function public.has_trading_license(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = coalesce(target_user_id, auth.uid())
      and profile.trading_license_status = 'licensed'
  );
$$;

-- Only the exam submission function may set a pass. This prevents a browser
-- profile update from turning an unlicensed account into a trader.
create or replace function public.protect_trading_license_fields()
returns trigger
language plpgsql
as $$
begin
  if new.trading_license_status is distinct from old.trading_license_status
     or new.trading_license_passed_at is distinct from old.trading_license_passed_at
     or new.trading_license_score is distinct from old.trading_license_score then
    if current_setting('app.lumio_license_transition', true) is distinct from 'exam-pass' then
      raise exception 'Trading License status is awarded only by passing the Lumio assessment';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_y_protect_trading_license_fields on public.profiles;
create trigger profiles_y_protect_trading_license_fields
  before update on public.profiles
  for each row execute function public.protect_trading_license_fields();

create table if not exists public.trading_license_questions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  topic text not null check (char_length(topic) between 2 and 60),
  prompt text not null check (char_length(prompt) between 10 and 500),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_option text not null check (char_length(correct_option) between 1 and 12),
  explanation text not null check (char_length(explanation) between 10 and 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trading_license_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_ids uuid[] not null,
  submitted_answers jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'passed', 'failed', 'abandoned')),
  score integer,
  total_questions integer not null check (total_questions between 1 and 20),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (score is null or score between 0 and total_questions)
);

create index if not exists trading_license_attempts_user_started_idx
  on public.trading_license_attempts (user_id, started_at desc);

alter table public.trading_license_questions enable row level security;
alter table public.trading_license_attempts enable row level security;

revoke all on public.trading_license_questions from anon, authenticated;
revoke all on public.trading_license_attempts from anon, authenticated;

create or replace function public.set_trading_license_question_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trading_license_questions_set_updated_at on public.trading_license_questions;
create trigger trading_license_questions_set_updated_at
  before update on public.trading_license_questions
  for each row execute function public.set_trading_license_question_updated_at();

insert into public.trading_license_questions (slug, topic, prompt, options, correct_option, explanation)
values
  ('accurate-listing', 'Accurate listings', 'What should a Lumio listing describe?', '[{"id":"a","label":"The exact champion copy, rarity, trait, and any relevant condition"},{"id":"b","label":"Only the highest value someone once offered"},{"id":"c","label":"Whatever details make it sell fastest"}]', 'a', 'Accurate details let traders evaluate the same champion copy and keep offers clear.'),
  ('trait-matters', 'Champion identity', 'Why should a champion trait be included in a trade discussion?', '[{"id":"a","label":"Traits are only cosmetic, so they do not matter"},{"id":"b","label":"A trait can materially affect a champion identity and perceived value"},{"id":"c","label":"Traits should be kept secret until after completion"}]', 'b', 'Traits are part of the specific copy being discussed, so both traders should see them before accepting.'),
  ('private-offers', 'Private offers', 'What is the right way to handle a counteroffer in Lumio?', '[{"id":"a","label":"Send a new or revised private offer with clear details"},{"id":"b","label":"Change the original offer after it has been sent"},{"id":"c","label":"Ask other members to pressure the trader publicly"}]', 'a', 'Offers are snapshots. A clear new proposal gives both traders an accurate record.'),
  ('in-game-exchange', 'Safe exchange', 'After a trade is accepted in Lumio, what still needs to happen?', '[{"id":"a","label":"Lumio automatically transfers Roblox champions"},{"id":"b","label":"Both traders complete the real exchange inside Anime Fighting Simulator"},{"id":"c","label":"Nothing; acceptance is the transfer"}]', 'b', 'Lumio coordinates and records trades. The actual champion exchange happens in-game between the traders.'),
  ('completion-confirmation', 'Completion', 'When should you confirm a trade as completed?', '[{"id":"a","label":"Only after you have completed the agreed in-game exchange"},{"id":"b","label":"Immediately after sending an offer"},{"id":"c","label":"As soon as the other person says they will trade"}]', 'a', 'Completion is the final record of a real in-game exchange, not a promise or an intent.'),
  ('trade-code', 'Coordination', 'What is the purpose of a Lumio trade code?', '[{"id":"a","label":"It helps both traders identify the same offer while coordinating"},{"id":"b","label":"It is a password that gives someone access to your account"},{"id":"c","label":"It replaces checking the champion details"}]', 'a', 'A trade code is a shared reference for the offer. It never replaces reviewing the champion details.'),
  ('account-security', 'Account safety', 'Which information should you never ask another trader to provide?', '[{"id":"a","label":"Their Roblox or Discord password, login code, or recovery details"},{"id":"b","label":"The trait on the champion they listed"},{"id":"c","label":"Whether their Collection is public"}]', 'a', 'No legitimate Lumio trade needs account credentials, recovery codes, or login information.'),
  ('verify-before-accepting', 'Good judgment', 'Before accepting an offer, what should you verify?', '[{"id":"a","label":"The requested and offered champion copies, traits, and the agreed terms"},{"id":"b","label":"Only that the other trader has a high rank"},{"id":"c","label":"Only the total reference value"}]', 'a', 'Reference value is useful, but the exact champion copies, traits, and terms are what both traders agree to exchange.'),
  ('dispute-handling', 'Disputes', 'If a trade feels misleading or unsafe, what should you do?', '[{"id":"a","label":"Pause the trade, keep records, and report it to Lumio staff through the community"},{"id":"b","label":"Complete it quickly so it does not become awkward"},{"id":"c","label":"Share the other trader’s private information publicly"}]', 'a', 'Pause before you accept or confirm. Clear records and a staff report are safer than escalating publicly.'),
  ('respectful-trading', 'Community standards', 'Which behavior builds a healthy Lumio market?', '[{"id":"a","label":"Respectful negotiation, clear communication, and accepting a no"},{"id":"b","label":"Repeatedly pressuring someone after they decline"},{"id":"c","label":"Posting private offer screenshots to shame someone"}]', 'a', 'Good trading is clear and respectful. Traders are always allowed to decline an offer.'),
  ('listing-availability', 'Listings', 'What does an active Shelf listing mean?', '[{"id":"a","label":"The owner is inviting offers for that exact recorded champion copy"},{"id":"b","label":"The champion has already been transferred"},{"id":"c","label":"Anyone can edit the champion details"}]', 'a', 'A live Shelf listing is an invitation to offer for a specific copy. It is not an automatic sale or transfer.'),
  ('reporting-evidence', 'Reporting', 'What is most useful in a trade report?', '[{"id":"a","label":"The trade code, relevant details, and a concise explanation of the concern"},{"id":"b","label":"A rumor without any trade reference"},{"id":"c","label":"The other trader’s account credentials"}]', 'a', 'A trade code and clear facts help staff review the actual Lumio record fairly.')
on conflict (slug) do update
  set topic = excluded.topic,
      prompt = excluded.prompt,
      options = excluded.options,
      correct_option = excluded.correct_option,
      explanation = excluded.explanation,
      is_active = true;

create or replace function public.begin_trading_license_exam()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_questions jsonb;
  selected_ids uuid[];
  attempt_id uuid;
  last_failure timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in to begin the Trading License assessment';
  end if;

  if public.has_trading_license(auth.uid()) then
    raise exception 'Your Trading License is already active';
  end if;

  select max(completed_at)
    into last_failure
  from public.trading_license_attempts
  where user_id = auth.uid()
    and status = 'failed';

  if last_failure is not null and last_failure > now() - interval '10 minutes' then
    raise exception 'Review the learning guide, then try again after %', to_char(last_failure + interval '10 minutes', 'FMMon FMDD, YYYY at FMHH12:MI AM');
  end if;

  update public.trading_license_attempts
    set status = 'abandoned', completed_at = now()
  where user_id = auth.uid()
    and status = 'in_progress';

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', question.id,
      'topic', question.topic,
      'prompt', question.prompt,
      'options', question.options
    )), '[]'::jsonb)
    into selected_questions
  from (
    select id, topic, prompt, options
    from public.trading_license_questions
    where is_active
    order by random()
    limit 8
  ) as question;

  select array_agg((item ->> 'id')::uuid)
    into selected_ids
  from jsonb_array_elements(selected_questions) as item;

  if cardinality(selected_ids) <> 8 then
    raise exception 'The Trading License question bank needs at least eight active questions';
  end if;

  insert into public.trading_license_attempts (user_id, question_ids, total_questions)
  values (auth.uid(), selected_ids, cardinality(selected_ids))
  returning id into attempt_id;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'questions', selected_questions,
    'passing_score', 7,
    'total_questions', cardinality(selected_ids)
  );
end;
$$;

create or replace function public.submit_trading_license_exam(
  target_attempt_id uuid,
  answer_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.trading_license_attempts%rowtype;
  total_count integer;
  passing_score integer;
  final_score integer;
  passed boolean;
  review jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to submit the Trading License assessment';
  end if;
  if jsonb_typeof(answer_payload) <> 'object' then
    raise exception 'Assessment answers are invalid';
  end if;

  select * into attempt
  from public.trading_license_attempts
  where id = target_attempt_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Trading License assessment not found';
  end if;
  if attempt.status <> 'in_progress' then
    raise exception 'This assessment has already been submitted';
  end if;

  total_count := cardinality(attempt.question_ids);
  if (select count(*) from jsonb_object_keys(answer_payload)) <> total_count
     or exists (
       select 1
       from jsonb_object_keys(answer_payload) as answer_key(key)
       where answer_key.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or not exists (
            select 1
            from unnest(attempt.question_ids) as assigned_question(id)
            where assigned_question.id::text = answer_key.key
          )
     ) then
    raise exception 'Answer every assessment question before submitting';
  end if;

  select count(*) into final_score
  from public.trading_license_questions as question
  where question.id = any(attempt.question_ids)
    and question.correct_option = answer_payload ->> question.id::text;

  passing_score := ceil(total_count * 0.8)::integer;
  passed := final_score >= passing_score;

  select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', question.id,
      'correct_option', question.correct_option,
      'explanation', question.explanation
    )), '[]'::jsonb)
    into review
  from public.trading_license_questions as question
  where question.id = any(attempt.question_ids);

  update public.trading_license_attempts
  set submitted_answers = answer_payload,
      score = final_score,
      status = case when passed then 'passed' else 'failed' end,
      completed_at = now()
  where id = attempt.id;

  if passed then
    perform set_config('app.lumio_license_transition', 'exam-pass', true);
    update public.profiles
      set trading_license_status = 'licensed',
          trading_license_passed_at = now(),
          trading_license_score = round((final_score::numeric / total_count) * 100)::integer
    where id = auth.uid();
  end if;

  return jsonb_build_object(
    'passed', passed,
    'score', final_score,
    'total_questions', total_count,
    'passing_score', passing_score,
    'review', review,
    'next_attempt_at', case when passed then null else now() + interval '10 minutes' end
  );
end;
$$;

-- A license gate is enforced in RLS as well as routing. This protects against
-- direct API calls and keeps the test as the only browser-accessible path to
-- market participation.
drop policy if exists "user champions: manage own" on public.user_champions;
create policy "user champions: licensed owners manage own" on public.user_champions
  for all to authenticated
  using (owner_id = auth.uid() and public.has_trading_license(auth.uid()))
  with check (owner_id = auth.uid() and public.has_trading_license(auth.uid()));

drop policy if exists "user champions: public profile read" on public.user_champions;
create policy "user champions: licensed public profile read" on public.user_champions
  for select to authenticated
  using (
    public.has_trading_license(auth.uid())
    and (
      owner_id = auth.uid()
      or exists (
        select 1
        from public.profiles as profile
        where profile.id = user_champions.owner_id
          and profile.collection_visibility = 'public'
      )
    )
  );

drop policy if exists "shelf listings: public and owner read" on public.shelf_listings;
create policy "shelf listings: licensed trader read" on public.shelf_listings
  for select to authenticated
  using (public.has_trading_license(auth.uid()) and (status = 'active' or owner_id = auth.uid()));

drop policy if exists "shelf listings: owner creates" on public.shelf_listings;
create policy "shelf listings: licensed owner creates" on public.shelf_listings
  for insert to authenticated
  with check (owner_id = auth.uid() and public.has_trading_license(auth.uid()));

drop policy if exists "shelf listings: owner updates" on public.shelf_listings;
create policy "shelf listings: licensed owner updates" on public.shelf_listings
  for update to authenticated
  using (owner_id = auth.uid() and public.has_trading_license(auth.uid()))
  with check (owner_id = auth.uid() and public.has_trading_license(auth.uid()));

drop policy if exists "shelf listings: owner deletes" on public.shelf_listings;
create policy "shelf listings: licensed owner deletes" on public.shelf_listings
  for delete to authenticated
  using (owner_id = auth.uid() and public.has_trading_license(auth.uid()));

drop policy if exists "trades: participants read" on public.trades;
create policy "trades: licensed participants read" on public.trades
  for select to authenticated
  using (public.has_trading_license(auth.uid()) and (sender_id = auth.uid() or recipient_id = auth.uid()));

drop policy if exists "trades: sender creates" on public.trades;
create policy "trades: licensed sender creates" on public.trades
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.has_trading_license(sender_id)
    and public.has_trading_license(recipient_id)
  );

drop policy if exists "trades: sender withdraws pending" on public.trades;
create policy "trades: licensed sender withdraws pending" on public.trades
  for update to authenticated
  using (sender_id = auth.uid() and status = 'pending' and public.has_trading_license(auth.uid()))
  with check (sender_id = auth.uid() and status = 'cancelled' and public.has_trading_license(auth.uid()));

drop policy if exists "trades: recipient responds pending" on public.trades;
create policy "trades: licensed recipient responds pending" on public.trades
  for update to authenticated
  using (recipient_id = auth.uid() and status = 'pending' and public.has_trading_license(auth.uid()))
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined') and public.has_trading_license(auth.uid()));

drop policy if exists "trades: recipient completes accepted" on public.trades;
drop policy if exists "trades: participants confirm accepted" on public.trades;
create policy "trades: licensed participants confirm accepted" on public.trades
  for update to authenticated
  using (
    status = 'accepted'
    and (sender_id = auth.uid() or recipient_id = auth.uid())
    and public.has_trading_license(auth.uid())
  )
  with check (
    status in ('accepted', 'completed')
    and (sender_id = auth.uid() or recipient_id = auth.uid())
    and public.has_trading_license(auth.uid())
  );

drop view if exists public.marketplace_listings;
create view public.marketplace_listings
with (security_invoker = false) as
  select
    listing.id,
    listing.owner_id,
    listing.user_champion_id,
    listing.note,
    listing.created_at,
    listing.updated_at,
    champion.name,
    champion.image_url,
    champion.rarity,
    champion.trait,
    champion.base_value,
    champion.market_adjustment,
    profile.discord_username,
    profile.discord_display_name,
    profile.discord_avatar,
    profile.rank,
    profile.lumio_display_name
  from public.shelf_listings as listing
  join public.user_champions as champion on champion.id = listing.user_champion_id
  join public.profiles as profile on profile.id = listing.owner_id
  where listing.status = 'active'
    and (public.has_trading_license(auth.uid()) or public.is_lumio_admin());

revoke all on public.marketplace_listings from anon;
grant select on public.marketplace_listings to authenticated;

revoke all on function public.has_trading_license(uuid) from public;
revoke all on function public.begin_trading_license_exam() from public;
revoke all on function public.submit_trading_license_exam(uuid, jsonb) from public;
grant execute on function public.has_trading_license(uuid) to authenticated;
grant execute on function public.begin_trading_license_exam() to authenticated;
grant execute on function public.submit_trading_license_exam(uuid, jsonb) to authenticated;
