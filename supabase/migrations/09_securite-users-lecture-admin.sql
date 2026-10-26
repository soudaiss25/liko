-- Appliquée en base le 26/10/2026

drop policy if exists "Users can insert own data" on public.users;
drop policy if exists "Users can update own data" on public.users;
revoke insert, update, delete on public.users from anon, authenticated;
drop policy if exists "Admins lisent toutes les commandes" on public.commandes;
create policy "Admins lisent toutes les commandes" on public.commandes
  for select to authenticated using (public.est_admin());
drop policy if exists "Admins lisent toutes les lignes de commande" on public.commande_items;
create policy "Admins lisent toutes les lignes de commande" on public.commande_items
  for select to authenticated using (public.est_admin());
