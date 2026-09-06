-- LEQ, migration "correctifs_parcours" (Phase 4 review). Four corrections found by reading the
-- Phase 4 code against the schema:
-- 1. An anonymous person may record a step attempt (docs/DATA-MODEL.md, Phase 4: the path is
--    open before the account; ADR-004 only closes the Arena, duels, shop and debate).
-- 2. A défi that Rebecca deactivates stays readable by the people whose path already holds it.
-- 3. The criteria of a published grid are readable by anonymous people too: they are Rebecca's
--    public wording, shown on the feedback of a step.
-- 4. `etapes.ordre` is a dense rank inside the act (1..n), not the bank position, so "défi 3 sur
--    5" and "dernier défi" hold when the bank has gaps. `defis.ordre` must be positive, so the
--    reorder function now parks a row on the first free order of the act instead of a negative.

drop policy if exists tentatives_insert_propre on public.tentatives;
create policy tentatives_insert_propre on public.tentatives
  for insert to authenticated
  with check (
    utilisateur_id = (select auth.uid())
    and statut = 'envoyee'
    and (type in ('diagnostic', 'etape') or not (select public.est_anonyme()))
  );

drop policy if exists defis_select on public.defis;
create policy defis_select on public.defis for select to authenticated
  using (
    actif
    or (select public.est_admin())
    or exists (
      select 1 from public.etapes e join public.parcours p on p.id = e.parcours_id
       where e.defi_id = defis.id and p.utilisateur_id = (select auth.uid()))
  );

drop policy if exists criteres_grille_select on public.criteres_grille;
create policy criteres_grille_select on public.criteres_grille
  for select to authenticated
  using (
    (select public.est_admin())
    or exists (
      select 1 from public.grilles g
      where g.id = criteres_grille.grille_id
        and g.publiee_le is not null
    )
  );

alter table public.defis drop constraint if exists defis_ordre_positif;
alter table public.defis add constraint defis_ordre_positif check (ordre > 0);

create or replace function public.obtenir_parcours()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_parcours uuid;
  v_acte record;
  v_acte_id uuid;
  v_defi record;
  v_ordre_global integer := 0;
  v_ordre_acte integer;
  v_premier boolean := true;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select id into v_parcours from public.parcours where utilisateur_id = v_uid;
  if v_parcours is not null then
    return v_parcours;
  end if;

  insert into public.parcours (utilisateur_id, source)
  values (v_uid, 'statique')
  on conflict (utilisateur_id) do nothing
  returning id into v_parcours;
  if v_parcours is null then
    -- a concurrent call built it first
    select id into v_parcours from public.parcours where utilisateur_id = v_uid;
    return v_parcours;
  end if;

  for v_acte in select * from public.modeles_actes order by ordre loop
    insert into public.actes (parcours_id, ordre, titre, sous_titre, statut)
    values (
      v_parcours, v_acte.ordre, v_acte.titre, v_acte.sous_titre,
      case when v_premier and exists (select 1 from public.defis d where d.ordre_acte = v_acte.ordre and d.actif)
           then 'en_cours' else 'a_venir' end
    )
    returning id into v_acte_id;

    v_ordre_acte := 0;
    for v_defi in select * from public.defis d where d.ordre_acte = v_acte.ordre and d.actif order by d.ordre loop
      v_ordre_global := v_ordre_global + 1;
      v_ordre_acte := v_ordre_acte + 1;
      insert into public.etapes (parcours_id, acte_id, ordre_global, ordre, defi_id, seuil_reussite, statut)
      values (
        v_parcours, v_acte_id, v_ordre_global, v_ordre_acte, v_defi.id, v_defi.seuil_reussite,
        case when v_premier then 'disponible' else 'verrouillee' end
      );
      v_premier := false;
    end loop;
  end loop;
  return v_parcours;
end;
$$;
revoke execute on function public.obtenir_parcours() from public, anon;
grant execute on function public.obtenir_parcours() to authenticated, service_role;

create or replace function public.echanger_ordre_defis(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a record;
  v_b record;
  v_libre integer;
begin
  if not (select public.est_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_a = p_b then
    return;
  end if;
  select id, ordre, ordre_acte into v_a from public.defis where id = p_a for update;
  select id, ordre, ordre_acte into v_b from public.defis where id = p_b for update;
  if v_a.id is null or v_b.id is null then
    raise exception 'défi introuvable' using errcode = 'P0002';
  end if;
  if v_a.ordre_acte <> v_b.ordre_acte then
    raise exception 'les deux défis doivent appartenir au même acte' using errcode = '23514';
  end if;
  -- (ordre_acte, ordre) is unique and checked row by row: park A on a free positive order first.
  select coalesce(max(ordre), 0) + 1 into v_libre from public.defis where ordre_acte = v_a.ordre_acte;
  update public.defis set ordre = v_libre where id = p_a;
  update public.defis set ordre = v_a.ordre where id = p_b;
  update public.defis set ordre = v_b.ordre where id = p_a;
end;
$$;
revoke execute on function public.echanger_ordre_defis(uuid, uuid) from public, anon;
grant execute on function public.echanger_ordre_defis(uuid, uuid) to authenticated;
