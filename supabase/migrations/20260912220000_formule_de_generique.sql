-- ---------------------------------------------------------------------------------------------
-- La formule d'une personne, quelle qu'elle soit.
--
-- `formule_de` ne connaissait que deux noms, écrits dedans : tout ce qui n'était pas « complet »
-- devenait « gratuit ». Une troisième formule pouvait donc exister en base, être vendue et être
-- posée sur un compte sans que rien ne la voie.
--
-- Elle rend maintenant la formule de l'abonnement, si elle est en cours et si la formule est
-- active, et sinon la première formule active dans l'ordre, qui est la gratuite.
-- ---------------------------------------------------------------------------------------------

create or replace function public.formule_de(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.formule
       from public.abonnements a
       join public.formules f on f.cle = a.formule and f.actif
      where a.utilisateur_id = p_uid
        and (a.actif_jusqu_a is null or a.actif_jusqu_a > now())
      limit 1),
    (select cle from public.formules where actif order by ordre limit 1),
    'gratuit');
$$;
grant execute on function public.formule_de(uuid) to authenticated, service_role;
