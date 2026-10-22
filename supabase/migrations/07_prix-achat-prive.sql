-- ═════════════════════════════════════════════════════════════════════
-- 07 : le prix d'achat (produits.prix_achat) devient PRIVÉ
--
-- Étape 1 : lancée.
--   Deux guichets (fonctions security definer) donnent accès au prix d'achat
--   uniquement à ceux qui en ont besoin.
--
-- Étape 2 : à lancer après la fusion de la mission 4.
--   Le verrou : les visiteurs et les comptes connectés ne peuvent plus lire
--   la colonne prix_achat directement. Le site doit donc lister ses colonnes
--   (jamais select('*') sur produits) : c'est le cas depuis la mission 4.
--   ⚠ Après l'ajout d'une colonne à la table produits, relancer cette étape 2
--   pour que le site puisse lire la nouvelle colonne.
-- ═════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : les guichets (lancée)
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.produits_admin()
returns setof produits language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'ACCES_REFUSE'; end if;
  return query select * from produits order by created_at desc;
end; $$;

create or replace function public.produits_etranger()
returns table (id uuid, nom text, categorie text, images text[], actif boolean, prix_achat numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.mon_role(), '') not in ('collab_etranger', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  return query select p.id, p.nom, p.categorie, p.images, p.actif, p.prix_achat from produits p order by p.nom;
end; $$;

revoke execute on function public.produits_admin() from public, anon;
revoke execute on function public.produits_etranger() from public, anon;
grant execute on function public.produits_admin() to authenticated;
grant execute on function public.produits_etranger() to authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : le verrou (à lancer après la fusion de la mission 4)
-- ─────────────────────────────────────────────────────────────────────

do $$
declare v_colonnes text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_colonnes
  from information_schema.columns
  where table_schema = 'public' and table_name = 'produits' and column_name <> 'prix_achat';
  execute 'revoke select on public.produits from anon, authenticated';
  execute format('grant select (%s) on public.produits to anon, authenticated', v_colonnes);
end $$;
