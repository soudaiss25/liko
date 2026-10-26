-- Appliquée en base le 26/10/2026

alter function public.proteger_commande() set search_path = public;
alter function public.proteger_ligne_commande() set search_path = public;
alter function public.proteger_suivi() set search_path = public;
revoke execute on function public.est_admin() from public, anon;
revoke execute on function public.mon_role() from public, anon;
grant execute on function public.est_admin() to authenticated;
grant execute on function public.mon_role() to authenticated;
