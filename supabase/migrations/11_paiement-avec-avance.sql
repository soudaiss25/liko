-- Appliquée en base le 30/10/2026 (déjà en place, ne pas relancer)
-- ══════════════════════════════════════════════════════════════════
--  11 — PAIEMENT AVEC AVANCE
--  Chaque produit est soit "paiement à la livraison", soit "avance demandée"
--  (montant exact en KMF par pièce, choisi par l'admin).
--  Règles :
--   - l'avance est calculée par la base, figée à la commande ;
--   - l'admin ou le collaborateur Comores enregistre l'avance reçue
--     (espèces, Huri Money, MVola) ;
--   - pas de confirmation tant que l'avance n'est pas complète ;
--   - à la livraison, on n'encaisse que le reste ;
--   - annulation : l'avance des produits déjà mis dans un envoi est conservée,
--     le reste est remboursable ; chaque remboursement est enregistré.
-- ══════════════════════════════════════════════════════════════════

-- ─────────── 1. COLONNES ───────────
alter table produits add column if not exists mode_paiement text not null default 'livraison';
alter table produits add column if not exists avance_unitaire numeric;
alter table produits drop constraint if exists produits_mode_paiement_check;
alter table produits add constraint produits_mode_paiement_check check (
  (mode_paiement = 'livraison' and avance_unitaire is null)
  or (mode_paiement = 'avance' and avance_unitaire > 0 and avance_unitaire <= prix_detail));

-- Le site doit pouvoir lire ces 2 colonnes (verrou de la migration 07 : colonne par colonne)
grant select (mode_paiement, avance_unitaire) on produits to anon, authenticated;

alter table commande_items add column if not exists avance_unitaire numeric not null default 0;
alter table commande_items drop constraint if exists commande_items_avance_positive;
alter table commande_items add constraint commande_items_avance_positive check (avance_unitaire >= 0);

alter table commandes add column if not exists montant_avance_requis numeric not null default 0;
alter table commandes add column if not exists montant_avance_recu numeric not null default 0;
alter table commandes add column if not exists montant_a_rembourser numeric not null default 0;
alter table commandes add column if not exists montant_rembourse numeric not null default 0;
alter table commandes drop constraint if exists commandes_mode_paiement_check;
alter table commandes add constraint commandes_mode_paiement_check
  check (mode_paiement in ('livraison', 'avance', 'mobile_money', 'differe'));
alter table commandes drop constraint if exists commandes_avance_coherente;
alter table commandes add constraint commandes_avance_coherente check (
  montant_avance_requis >= 0 and montant_avance_recu >= 0 and montant_a_rembourser >= 0
  and montant_avance_recu - montant_a_rembourser <= montant_avance_requis
  and montant_a_rembourser <= montant_avance_recu
  and montant_rembourse >= 0 and montant_rembourse <= montant_a_rembourser);

-- La table paiements (existante, inutilisée) trace chaque mouvement d'argent
alter table paiements add column if not exists type text;
alter table paiements add column if not exists enregistre_par uuid references users(id);
alter table paiements drop constraint if exists paiements_type_check;
alter table paiements add constraint paiements_type_check check (type in ('avance', 'remboursement'));
alter table paiements drop constraint if exists paiements_methode_check;
alter table paiements add constraint paiements_methode_check check (methode in ('especes', 'huri_money', 'mvola'));
alter table paiements drop constraint if exists paiements_montant_positif;
alter table paiements add constraint paiements_montant_positif check (montant > 0);
alter table paiements enable row level security;
revoke all on paiements from anon, authenticated;


-- ─────────── 2. COMMANDE : l'avance est calculée par la base ───────────
create or replace function public.passer_commande(p_lignes jsonb, p_infos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prenom text := trim(coalesce(p_infos->>'prenom', ''));
  v_nom text := nullif(trim(coalesce(p_infos->>'nom', '')), '');
  v_tel text := regexp_replace(coalesce(p_infos->>'telephone', ''), '[\s.()-]', '', 'g');
  v_email text := nullif(lower(trim(coalesce(p_infos->>'email', ''))), '');
  v_ile text := p_infos->>'ile';
  v_adresse text := trim(coalesce(p_infos->>'adresse', ''));
  v_ligne jsonb;
  v_p produits%rowtype;
  v_mode text;
  v_q integer;
  v_pieces integer;
  v_prix_piece numeric;
  v_avance_piece numeric;
  v_items jsonb := '[]'::jsonb;
  v_sous_total numeric := 0;
  v_avance numeric := 0;
  v_frais numeric;
  v_total numeric;
  v_en_attente integer;
  v_id uuid;
  v_numero bigint;
  v_code text;
begin
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'PANIER_VIDE';
  end if;
  if jsonb_array_length(p_lignes) > 50 then raise exception 'PANIER_TROP_GRAND'; end if;

  if length(v_prenom) < 2 then raise exception 'PRENOM_MANQUANT'; end if;
  if v_tel !~ '^\+[0-9]{8,15}$' then raise exception 'TELEPHONE_INVALIDE'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_INVALIDE';
  end if;
  if v_ile is null or v_ile not in ('Grande Comore', 'Anjouan', 'Moheli') then raise exception 'ILE_INVALIDE'; end if;
  if length(v_adresse) < 5 then raise exception 'ADRESSE_MANQUANTE'; end if;

  select count(*) into v_en_attente from commandes where telephone_invite = v_tel and statut = 'recue';
  if v_en_attente >= 3 then raise exception 'TROP_DE_COMMANDES_EN_ATTENTE'; end if;

  for v_ligne in select value from jsonb_array_elements(p_lignes) loop
    select * into v_p from produits where id = (v_ligne->>'produit_id')::uuid;
    if not found or not coalesce(v_p.actif, false) then
      raise exception 'PRODUIT_INDISPONIBLE:%', coalesce(v_p.nom, 'un produit');
    end if;

    v_mode := coalesce(v_ligne->>'mode', 'unite');
    v_q := (v_ligne->>'quantite')::int;
    if v_q is null or v_q < 1 or v_q > 999 then raise exception 'QUANTITE_INVALIDE'; end if;

    if v_mode = 'unite' then
      v_pieces := v_q;
      v_prix_piece := v_p.prix_detail;
      v_sous_total := v_sous_total + v_q * v_p.prix_detail;
    elsif v_mode = 'lot' then
      if v_p.prix_gros is null or coalesce(v_p.qte_min_gros, 0) < 2 then
        raise exception 'LOT_INDISPONIBLE:%', v_p.nom;
      end if;
      v_pieces := v_q * v_p.qte_min_gros;
      v_prix_piece := v_p.prix_gros / v_p.qte_min_gros;
      v_sous_total := v_sous_total + v_q * v_p.prix_gros;
    else
      raise exception 'PANIER_INVALIDE';
    end if;

    -- Avance par pièce : jamais plus que le prix réellement payé pour cette pièce
    v_avance_piece := case when v_p.mode_paiement = 'avance'
                           then least(v_p.avance_unitaire, v_prix_piece) else 0 end;
    v_avance := v_avance + v_pieces * v_avance_piece;

    v_items := v_items || jsonb_build_object(
      'produit_id', v_p.id, 'quantite', v_pieces, 'prix_unitaire', v_prix_piece, 'avance_unitaire', v_avance_piece);
  end loop;

  select prix into v_frais from frais_livraison where ile = v_ile order by prix limit 1;
  v_frais := coalesce(v_frais, 0);
  v_total := round(v_sous_total + v_frais);
  v_avance := round(v_avance);
  v_code := replace(gen_random_uuid()::text, '-', '');

  perform set_config('app.guichet', 'oui', true);

  insert into commandes (user_id, telephone_invite, nom_client, email_client, ile, adresse_livraison,
                         mode_paiement, montant_livraison, montant_total, montant_avance_requis, code_suivi)
  values (auth.uid(), v_tel, v_prenom || coalesce(' ' || v_nom, ''), v_email, v_ile, v_adresse,
          case when v_avance > 0 then 'avance' else 'livraison' end, v_frais, v_total, v_avance, v_code)
  returning id, numero into v_id, v_numero;

  insert into commande_items (commande_id, produit_id, quantite, prix_unitaire, avance_unitaire)
  select v_id, (x->>'produit_id')::uuid, (x->>'quantite')::int, (x->>'prix_unitaire')::numeric,
         (x->>'avance_unitaire')::numeric
  from jsonb_array_elements(v_items) as x;

  perform public._suivi(v_id, 'recue',
    case when v_avance > 0
         then 'Commande passée sur le site — avance à payer : ' || v_avance || ' KMF'
         else 'Commande passée sur le site' end);

  return jsonb_build_object('numero', v_numero, 'code_suivi', v_code, 'montant_total', v_total,
                            'montant_avance_requis', v_avance, 'montant_a_la_livraison', v_total - v_avance);
exception
  when invalid_text_representation then raise exception 'PANIER_INVALIDE';
end;
$$;


-- ─────────── 3. ENREGISTRER UNE AVANCE REÇUE (admin ou Comores) ───────────
create or replace function public.enregistrer_avance(p_commande uuid, p_montant numeric, p_moyen text, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype; v_reste numeric; v_libelle text;
begin
  if coalesce(public.mon_role(), '') not in ('collab_comores', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  select * into v_c from commandes where id = p_commande for update;
  if not found then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_c.montant_avance_requis = 0 then raise exception 'PAS_D_AVANCE'; end if;
  if v_c.statut <> 'recue' then raise exception 'AVANCE_HORS_DELAI'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'MONTANT_INVALIDE'; end if;
  if (v_c.montant_avance_recu - v_c.montant_a_rembourser) + p_montant > v_c.montant_avance_requis then
    raise exception 'AVANCE_TROP_ELEVEE';
  end if;
  if p_moyen is null or p_moyen not in ('especes', 'huri_money', 'mvola') then raise exception 'MOYEN_INVALIDE'; end if;
  if p_moyen <> 'especes' and coalesce(trim(p_reference), '') = '' then raise exception 'REFERENCE_OBLIGATOIRE'; end if;

  insert into paiements (commande_id, type, montant, methode, reference, statut, enregistre_par)
  values (p_commande, 'avance', p_montant, p_moyen, nullif(trim(p_reference), ''), 'confirme', auth.uid());

  perform set_config('app.guichet', 'oui', true);
  update commandes set montant_avance_recu = montant_avance_recu + p_montant where id = p_commande;

  v_reste := v_c.montant_avance_requis - (v_c.montant_avance_recu - v_c.montant_a_rembourser) - p_montant;
  v_libelle := case p_moyen when 'especes' then 'espèces' when 'huri_money' then 'Huri Money' else 'MVola' end;
  perform public._suivi(p_commande, 'recue',
    'Avance reçue : ' || p_montant || ' KMF (' || v_libelle || coalesce(', réf. ' || nullif(trim(p_reference), ''), '') || ')'
    || case when v_reste = 0 then ' — avance complète' else ' — reste ' || v_reste || ' KMF' end);
end;
$$;


-- ─────────── 4. CONFIRMATION : seulement avec l'avance complète ───────────
create or replace function public.confirmer_commande(p_commande uuid, p_client_joint boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype;
begin
  if not public.est_admin() then raise exception 'ACCES_REFUSE'; end if;
  if not coalesce(p_client_joint, false) then raise exception 'APPEL_NON_CONFIRME'; end if;

  select * into v_c from commandes where id = p_commande for update;
  if not found then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_c.statut <> 'recue' then raise exception 'DEJA_TRAITEE'; end if;
  if v_c.montant_avance_recu - v_c.montant_a_rembourser < v_c.montant_avance_requis then raise exception 'AVANCE_INCOMPLETE'; end if;

  perform set_config('app.guichet', 'oui', true);
  update commandes set confirmee_le = now() where id = p_commande;
  perform public._changer_statut(p_commande, 'confirmee',
    coalesce(nullif(trim(p_note), ''), 'Client joint par téléphone'));
end;
$$;


-- ─────────── 5. ANNULATION : qu'advient-il de l'avance ? ───────────
-- À appeler AVANT de libérer les lignes (la libération retire les lignes des envois en préparation).
-- Règle : l'avance des produits déjà mis dans un envoi (= achetés) est conservée ; le reste est remboursable.
create or replace function public._preparer_remboursement(p_commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype; v_non_achete numeric; v_a_rembourser numeric; v_net numeric;
begin
  select * into v_c from commandes where id = p_commande;
  v_net := v_c.montant_avance_recu - v_c.montant_a_rembourser;   -- avance encore détenue
  if v_net <= 0 then return; end if;

  select coalesce(sum(ci.quantite * ci.avance_unitaire), 0) into v_non_achete
  from commande_items ci
  where ci.commande_id = p_commande and ci.etat <> 'retiree'
    and not exists (select 1 from envoi_items ei where ei.commande_item_id = ci.id);

  v_a_rembourser := least(v_net, v_non_achete);

  perform set_config('app.guichet', 'oui', true);
  update commandes set montant_a_rembourser = montant_a_rembourser + v_a_rembourser where id = p_commande;
  perform public._suivi(p_commande, v_c.statut,
    case
      when v_a_rembourser = v_net then
        'Avance de ' || v_a_rembourser || ' KMF à rembourser au client (aucun produit acheté)'
      when v_a_rembourser = 0 then
        'Avance de ' || v_net || ' KMF conservée : produit(s) déjà acheté(s)'
      else
        'Avance : ' || v_a_rembourser || ' KMF à rembourser, ' || (v_net - v_a_rembourser)
        || ' KMF conservés (produits déjà achetés)'
    end);
end;
$$;
revoke execute on function public._preparer_remboursement(uuid) from public, anon, authenticated;

create or replace function public.annuler_commande_admin(p_commande uuid, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
declare v_statut text; v_item uuid;
begin
  if not public.est_admin() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'MOTIF_OBLIGATOIRE'; end if;

  select statut into v_statut from commandes where id = p_commande for update;
  if v_statut is null then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_statut = 'livree' then raise exception 'DEJA_LIVREE'; end if;
  if v_statut = 'annulee' then raise exception 'DEJA_ANNULEE'; end if;

  perform public._preparer_remboursement(p_commande);   -- AVANT la libération des lignes

  for v_item in select id from commande_items where commande_id = p_commande and etat <> 'retiree' loop
    perform public._liberer_ligne(v_item);
  end loop;

  perform set_config('app.guichet', 'oui', true);
  update commandes set motif_annulation = trim(p_motif) where id = p_commande;
  perform public._changer_statut(p_commande, 'annulee', trim(p_motif));
end;
$$;

create or replace function public.annuler_commande_comores(p_commande uuid, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
declare v_statut text; v_item uuid; v_prenom text;
begin
  if coalesce(public.mon_role(), '') not in ('collab_comores', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'MOTIF_OBLIGATOIRE'; end if;

  select statut into v_statut from commandes where id = p_commande for update;
  if v_statut is null then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_statut = 'annulee' then raise exception 'DEJA_ANNULEE'; end if;
  if v_statut = 'livree' then raise exception 'DEJA_LIVREE'; end if;
  if v_statut not in ('recue', 'confirmee', 'en_achat') then raise exception 'DEJA_EXPEDIEE'; end if;
  if exists (select 1 from commande_items ci join envoi_items ei on ei.commande_item_id = ci.id
             join envois e on e.id = ei.envoi_id where ci.commande_id = p_commande and e.statut <> 'brouillon') then
    raise exception 'DEJA_EXPEDIEE';
  end if;

  perform public._preparer_remboursement(p_commande);   -- AVANT la libération des lignes

  for v_item in select id from commande_items where commande_id = p_commande and etat <> 'retiree' loop
    perform public._liberer_ligne(v_item);
  end loop;

  select prenom into v_prenom from users where id = auth.uid();
  perform set_config('app.guichet', 'oui', true);
  update commandes set motif_annulation = trim(p_motif) where id = p_commande;
  perform public._changer_statut(p_commande, 'annulee',
    'Annulée par ' || coalesce(v_prenom, 'le collaborateur Comores') || ' : ' || trim(p_motif));
end;
$$;


-- ─────────── 5 bis. RETRAIT D'UN PRODUIT (indisponible…) : son avance ───────────
-- Produit pas encore acheté : son avance n'est plus due ; si elle était déjà payée, le trop-perçu
-- devient remboursable. Produit déjà mis dans un envoi : son avance reste due (règle des achats).
create or replace function public.retirer_ligne_commande(p_item uuid, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ci commande_items%rowtype;
  v_c commandes%rowtype;
  v_restantes integer;
  v_statut_envoi text;
  v_achete boolean;
  v_avance_ligne numeric;
  v_trop_percu numeric := 0;
  v_nom text;
begin
  if not public.est_admin() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(trim(p_motif), '') = '' then raise exception 'MOTIF_OBLIGATOIRE'; end if;

  select * into v_ci from commande_items where id = p_item for update;
  if not found then raise exception 'LIGNE_INTROUVABLE'; end if;
  if v_ci.etat = 'retiree' then raise exception 'DEJA_RETIREE'; end if;

  select * into v_c from commandes where id = v_ci.commande_id for update;
  if v_c.statut in ('en_livraison', 'livree', 'annulee') then raise exception 'COMMANDE_VERROUILLEE'; end if;

  select e.statut into v_statut_envoi
  from envoi_items ei join envois e on e.id = ei.envoi_id where ei.commande_item_id = p_item;
  if v_statut_envoi = 'en_route' then raise exception 'LIGNE_EN_ROUTE'; end if;
  v_achete := v_statut_envoi is not null;   -- à lire AVANT la libération

  select count(*) into v_restantes from commande_items
  where commande_id = v_ci.commande_id and etat <> 'retiree' and id <> p_item;
  if v_restantes = 0 then raise exception 'DERNIERE_LIGNE'; end if;

  perform public._liberer_ligne(p_item);

  v_avance_ligne := case when v_achete then 0 else v_ci.quantite * v_ci.avance_unitaire end;
  v_trop_percu := greatest(
    (v_c.montant_avance_recu - v_c.montant_a_rembourser) - (v_c.montant_avance_requis - v_avance_ligne), 0);

  perform set_config('app.guichet', 'oui', true);
  update commande_items set etat = 'retiree', note_etat = trim(p_motif) where id = p_item;
  update commandes
     set montant_total = greatest(coalesce(montant_total, 0) - v_ci.quantite * v_ci.prix_unitaire, 0),
         montant_avance_requis = montant_avance_requis - v_avance_ligne,
         montant_a_rembourser = montant_a_rembourser + v_trop_percu
   where id = v_ci.commande_id;

  select nom into v_nom from produits where id = v_ci.produit_id;
  perform public._suivi(v_ci.commande_id, v_c.statut, 'Produit retiré : ' || coalesce(v_nom, '?') || ' — ' || trim(p_motif)
    || case when v_trop_percu > 0 then ' — ' || v_trop_percu || ' KMF d''avance à rembourser' else '' end);
  perform public._recalculer_statut_commande(v_ci.commande_id);
end;
$$;

-- Le client ne peut plus annuler seul une fois une avance payée
create or replace function public.annuler_ma_commande(p_commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype;
begin
  select * into v_c from commandes where id = p_commande for update;
  if not found or v_c.user_id is distinct from auth.uid() then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_c.statut <> 'recue' then raise exception 'ANNULATION_IMPOSSIBLE'; end if;
  if v_c.montant_avance_recu > 0 then raise exception 'AVANCE_DEJA_PAYEE'; end if;
  perform set_config('app.guichet', 'oui', true);
  update commandes set motif_annulation = 'Annulée par le client' where id = p_commande;
  perform public._changer_statut(p_commande, 'annulee', 'Annulée par le client');
end;
$$;

create or replace function public.annuler_commande_par_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype;
begin
  select * into v_c from commandes where code_suivi = p_code for update;
  if not found or p_code is null then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_c.statut <> 'recue' then raise exception 'ANNULATION_IMPOSSIBLE'; end if;
  if v_c.montant_avance_recu > 0 then raise exception 'AVANCE_DEJA_PAYEE'; end if;
  perform set_config('app.guichet', 'oui', true);
  update commandes set motif_annulation = 'Annulée par le client' where id = v_c.id;
  perform public._changer_statut(v_c.id, 'annulee', 'Annulée par le client');
end;
$$;


-- ─────────── 6. ENREGISTRER UN REMBOURSEMENT (admin ou Comores) ───────────
create or replace function public.enregistrer_remboursement(p_commande uuid, p_montant numeric, p_moyen text, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype; v_libelle text;
begin
  if coalesce(public.mon_role(), '') not in ('collab_comores', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  select * into v_c from commandes where id = p_commande for update;
  if not found then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_c.montant_a_rembourser = 0 then raise exception 'RIEN_A_REMBOURSER'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'MONTANT_INVALIDE'; end if;
  if v_c.montant_rembourse + p_montant > v_c.montant_a_rembourser then raise exception 'REMBOURSEMENT_TROP_ELEVE'; end if;
  if p_moyen is null or p_moyen not in ('especes', 'huri_money', 'mvola') then raise exception 'MOYEN_INVALIDE'; end if;
  if p_moyen <> 'especes' and coalesce(trim(p_reference), '') = '' then raise exception 'REFERENCE_OBLIGATOIRE'; end if;

  insert into paiements (commande_id, type, montant, methode, reference, statut, enregistre_par)
  values (p_commande, 'remboursement', p_montant, p_moyen, nullif(trim(p_reference), ''), 'confirme', auth.uid());

  perform set_config('app.guichet', 'oui', true);
  update commandes set montant_rembourse = montant_rembourse + p_montant where id = p_commande;
  v_libelle := case p_moyen when 'especes' then 'espèces' when 'huri_money' then 'Huri Money' else 'MVola' end;
  perform public._suivi(p_commande, v_c.statut,
    'Remboursement : ' || p_montant || ' KMF (' || v_libelle || coalesce(', réf. ' || nullif(trim(p_reference), ''), '') || ')');
end;
$$;


-- ─────────── 7. LIVRAISON : on n'encaisse que le reste ───────────
create or replace function public.marquer_livree(p_commande uuid, p_montant numeric, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_c commandes%rowtype; v_reste numeric;
begin
  if coalesce(public.mon_role(), '') not in ('collab_comores', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  select * into v_c from commandes where id = p_commande for update;
  if not found then raise exception 'COMMANDE_INTROUVABLE'; end if;
  if v_c.statut <> 'en_livraison' then raise exception 'PAS_EN_LIVRAISON'; end if;
  if p_montant is null or p_montant < 0 then raise exception 'MONTANT_INVALIDE'; end if;

  v_reste := greatest(coalesce(v_c.montant_total, 0) - (v_c.montant_avance_recu - v_c.montant_a_rembourser), 0);
  if p_montant <> v_reste and coalesce(trim(p_note), '') = '' then raise exception 'NOTE_OBLIGATOIRE'; end if;

  perform set_config('app.guichet', 'oui', true);
  update commandes set montant_encaisse = p_montant, encaisse_le = now(), encaisse_par = auth.uid()
  where id = p_commande;
  perform public._changer_statut(p_commande, 'livree',
    'Encaissé à la livraison ' || p_montant || ' KMF'
    || case when v_c.montant_avance_recu - v_c.montant_a_rembourser > 0
            then ' (+ avance ' || (v_c.montant_avance_recu - v_c.montant_a_rembourser) || ' KMF)' else '' end
    || coalesce(' — ' || nullif(trim(p_note), ''), ''));
end;
$$;


-- ─────────── 8. LECTURES : les montants d'avance partout où il faut ───────────
create or replace function public.paiements_commande(p_commande uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.mon_role(), '') not in ('collab_comores', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('type', p.type, 'montant', p.montant, 'methode', p.methode,
           'reference', p.reference, 'created_at', p.created_at, 'par', u.prenom) order by p.created_at)
    from paiements p left join users u on u.id = p.enregistre_par where p.commande_id = p_commande
  ), '[]'::jsonb);
end;
$$;

create or replace function public.suivre_commande(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c commandes%rowtype;
begin
  if p_code is null or length(p_code) < 20 then raise exception 'COMMANDE_INTROUVABLE'; end if;
  select * into v_c from commandes where code_suivi = p_code;
  if not found then raise exception 'COMMANDE_INTROUVABLE'; end if;
  return jsonb_build_object(
    'numero', v_c.numero, 'statut', v_c.statut, 'created_at', v_c.created_at,
    'ile', v_c.ile, 'adresse_livraison', v_c.adresse_livraison,
    'prenom', split_part(coalesce(v_c.nom_client, ''), ' ', 1),
    'telephone_masque', left(v_c.telephone_invite, 4) || ' •••• ' || right(v_c.telephone_invite, 2),
    'montant_total', v_c.montant_total, 'montant_livraison', v_c.montant_livraison,
    'montant_avance_requis', v_c.montant_avance_requis, 'montant_avance_recu', v_c.montant_avance_recu,
    'montant_a_rembourser', v_c.montant_a_rembourser, 'montant_rembourse', v_c.montant_rembourse,
    'peut_annuler', v_c.statut = 'recue' and v_c.montant_avance_recu = 0,
    'rattachee', v_c.user_id is not null,
    'a_moi', coalesce(v_c.user_id = auth.uid(), false),
    'lignes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nom', p.nom, 'categorie', p.categorie, 'images', p.images,
        'quantite', ci.quantite, 'prix_unitaire', ci.prix_unitaire, 'avance_unitaire', ci.avance_unitaire, 'etat', ci.etat
      ) order by p.nom), '[]'::jsonb)
      from commande_items ci left join produits p on p.id = ci.produit_id where ci.commande_id = v_c.id),
    'etapes', (
      select coalesce(jsonb_object_agg(statut, premiere), '{}'::jsonb)
      from (select statut, min(created_at) as premiere from suivi_statuts where commande_id = v_c.id group by statut) s));
end;
$$;

create or replace function public.mes_commandes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'numero', c.numero, 'statut', c.statut, 'created_at', c.created_at,
      'montant_total', c.montant_total, 'code_suivi', c.code_suivi,
      'montant_avance_requis', c.montant_avance_requis, 'montant_avance_recu', c.montant_avance_recu,
      'nb_articles', (select coalesce(sum(quantite), 0) from commande_items where commande_id = c.id and etat <> 'retiree'),
      'apercu', (
        select coalesce(jsonb_agg(jsonb_build_object('nom', p.nom, 'categorie', p.categorie, 'images', p.images)), '[]'::jsonb)
        from (select produit_id from commande_items where commande_id = c.id and etat <> 'retiree' limit 3) ci
        join produits p on p.id = ci.produit_id)
    ) order by c.created_at desc)
    from commandes c where c.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.commandes_admin()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'numero', c.numero, 'statut', c.statut, 'created_at', c.created_at,
      'confirmee_le', c.confirmee_le, 'ile', c.ile, 'adresse_livraison', c.adresse_livraison,
      'mode_paiement', c.mode_paiement, 'montant_total', c.montant_total,
      'montant_livraison', c.montant_livraison,
      'montant_encaisse', c.montant_encaisse, 'encaisse_le', c.encaisse_le,
      'montant_avance_requis', c.montant_avance_requis, 'montant_avance_recu', c.montant_avance_recu,
      'montant_a_rembourser', c.montant_a_rembourser, 'montant_rembourse', c.montant_rembourse,
      'motif_annulation', c.motif_annulation, 'code_suivi', c.code_suivi,
      'client', jsonb_build_object(
        'nom', coalesce(c.nom_client, trim(concat(u.prenom, ' ', u.nom))),
        'telephone', coalesce(c.telephone_invite, u.telephone),
        'email', c.email_client, 'compte', u.username),
      'lignes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', ci.id, 'produit_id', ci.produit_id, 'nom', p.nom, 'categorie', p.categorie, 'images', p.images,
          'taille', v.taille, 'couleur', v.couleur,
          'quantite', ci.quantite, 'prix_unitaire', ci.prix_unitaire, 'avance_unitaire', ci.avance_unitaire,
          'etat', ci.etat, 'note_etat', ci.note_etat,
          'envoi_numero', e.numero, 'envoi_statut', e.statut, 'quantite_recue', ei.quantite_recue
        ) order by p.nom), '[]'::jsonb)
        from commande_items ci
        left join produits p on p.id = ci.produit_id
        left join variantes v on v.id = ci.variante_id
        left join envoi_items ei on ei.commande_item_id = ci.id
        left join envois e on e.id = ei.envoi_id
        where ci.commande_id = c.id),
      'suivi', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'statut', s.statut, 'note', s.note, 'created_at', s.created_at, 'par', su.prenom
        ) order by s.created_at), '[]'::jsonb)
        from suivi_statuts s left join users su on su.id = s.updated_by
        where s.commande_id = c.id)
    ) order by c.created_at desc)
    from commandes c left join users u on u.id = c.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.commandes_comores()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.mon_role(), '') not in ('collab_comores', 'admin') then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'numero', c.numero, 'statut', c.statut, 'created_at', c.created_at,
      'confirmee_le', c.confirmee_le, 'ile', c.ile, 'adresse_livraison', c.adresse_livraison,
      'montant_total', c.montant_total, 'montant_encaisse', c.montant_encaisse, 'encaisse_le', c.encaisse_le,
      'montant_avance_requis', c.montant_avance_requis, 'montant_avance_recu', c.montant_avance_recu,
      'montant_a_rembourser', c.montant_a_rembourser, 'montant_rembourse', c.montant_rembourse,
      'reste_a_encaisser', greatest(coalesce(c.montant_total, 0) - (c.montant_avance_recu - c.montant_a_rembourser), 0),
      'code_suivi', c.code_suivi, 'motif_annulation', c.motif_annulation,
      'relance_le', c.relance_le, 'relance_note', c.relance_note,
      'peut_annuler', c.statut in ('recue', 'confirmee', 'en_achat') and not exists (
        select 1 from commande_items ci2 join envoi_items ei2 on ei2.commande_item_id = ci2.id
        join envois e2 on e2.id = ei2.envoi_id where ci2.commande_id = c.id and e2.statut <> 'brouillon'),
      'client', jsonb_build_object('nom', coalesce(c.nom_client, trim(concat(u.prenom, ' ', u.nom))),
                                   'telephone', coalesce(c.telephone_invite, u.telephone)),
      'lignes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', ci.id, 'nom', p.nom, 'categorie', p.categorie, 'images', p.images,
          'taille', v.taille, 'couleur', v.couleur, 'etat', ci.etat,
          'quantite', ci.quantite, 'quantite_recue', ei.quantite_recue, 'avance_unitaire', ci.avance_unitaire,
          'envoi_numero', e.numero, 'envoi_statut', e.statut,
          'envoi_arrivee_prevue', e.date_arrivee_estimee, 'envoi_transporteur', e.transporteur
        ) order by p.nom), '[]'::jsonb)
        from commande_items ci left join produits p on p.id = ci.produit_id
        left join variantes v on v.id = ci.variante_id
        left join envoi_items ei on ei.commande_item_id = ci.id left join envois e on e.id = ei.envoi_id
        where ci.commande_id = c.id and ci.etat <> 'retiree'),
      'derniere_note', (select s.note from suivi_statuts s where s.commande_id = c.id order by s.created_at desc limit 1)
    ) order by c.created_at desc)
    from commandes c left join users u on u.id = c.user_id
    where c.statut not in ('livree', 'annulee')
       or (c.statut = 'livree' and c.encaisse_le > now() - interval '30 days')
       or (c.statut = 'annulee' and (c.created_at > now() - interval '30 days'
                                     or c.montant_rembourse < c.montant_a_rembourser))
  ), '[]'::jsonb);
end;
$$;


-- ─────────── 9. DROITS ───────────
do $$
declare f text;
begin
  foreach f in array array[
    'enregistrer_avance(uuid, numeric, text, text)',
    'enregistrer_remboursement(uuid, numeric, text, text)',
    'paiements_commande(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
