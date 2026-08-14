-- Administrators can review and take down marketplace listings while leaving
-- the underlying Collection entry untouched. All policies depend on the
-- server-maintained admin allowlist established by the admin console migration.
drop policy if exists "shelf listings: admin read" on public.shelf_listings;
create policy "shelf listings: admin read" on public.shelf_listings
  for select to authenticated
  using (public.is_lumio_admin());

drop policy if exists "shelf listings: admin moderation update" on public.shelf_listings;
create policy "shelf listings: admin moderation update" on public.shelf_listings
  for update to authenticated
  using (public.is_lumio_admin())
  with check (public.is_lumio_admin());
