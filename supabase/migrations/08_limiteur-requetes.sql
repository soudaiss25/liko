-- Appliquée en base le 26/10/2026 (déjà en place, ne pas relancer)

create table if not exists public.limites_requetes (
  id bigint generated always as identity primary key,
  cle text not null,
  created_at timestamptz not null default now()
);
create index if not exists limites_requetes_cle_date on public.limites_requetes (cle, created_at);
alter table public.limites_requetes enable row level security;
revoke all on public.limites_requetes from anon, authenticated;

create or replace function public.verifier_limite(p_cle text, p_max integer, p_fenetre_secondes integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_nb integer;
begin
  if p_cle is null or length(p_cle) > 200 or p_max < 1 or p_fenetre_secondes < 1 then
    raise exception 'PARAMETRES_INVALIDES';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_cle));
  delete from limites_requetes where created_at < now() - interval '1 day';
  select count(*) into v_nb from limites_requetes
   where cle = p_cle and created_at > now() - make_interval(secs => p_fenetre_secondes);
  if v_nb >= p_max then return false; end if;
  insert into limites_requetes (cle) values (p_cle);
  return true;
end; $$;

revoke execute on function public.verifier_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.verifier_limite(text, integer, integer) to service_role;
