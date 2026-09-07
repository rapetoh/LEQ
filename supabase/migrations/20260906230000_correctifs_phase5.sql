-- LEQ, migration "correctifs_phase5" (review of Phases 5 and 6, 2026-09-06). Four corrections:
-- 1. "Today" for the streak follows the person's zone even when the profile has none: the zone
--    of the most recent take, then Europe/Paris.
-- 2. appliquer_resultat is idempotent on both branches: an attempt that already carries its
--    result returns it without counting a second failure.
-- 3. One recovery repairs yesterday whenever yesterday is missing and the day before was active,
--    even if the person already recorded today (the replay then yields one continuous run).
-- 4. Re-opening a cancelled exchange takes the person's points lock and writes a compensating
--    movement instead of deleting the refund (ADR-009: the ledger is append-only).

create or replace function public.fuseau_de(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select fuseau_horaire from public.profils where id = p_uid),
    (select t.fuseau_horaire from public.tentatives t where t.utilisateur_id = p_uid order by t.enregistre_le desc limit 1),
    'Europe/Paris');
$$;
revoke execute on function public.fuseau_de(uuid) from public, anon, authenticated;

create or replace function public.calculer_serie(p_uid uuid, p_aujourdhui date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_jours date[];
  v_j date;
  v_prec date := null;
  v_run integer := 0;
  v_record integer := 0;
  v_courante integer := 0;
  v_derniere date := null;
  v_semaine jsonb := '[]'::jsonb;
  v_i integer;
  v_par_mois integer;
  v_utilisees integer;
  v_tz text := public.fuseau_de(p_uid);
  v_jour_reparable date := null;
begin
  select coalesce(array_agg(j order by j), '{}'::date[]) into v_jours from public.jours_actifs(p_uid) j;
  foreach v_j in array v_jours loop
    if v_prec is not null and v_j = v_prec + 1 then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    if v_run > v_record then v_record := v_run; end if;
    v_prec := v_j;
  end loop;
  v_derniere := v_prec;
  -- The run ending on the last active day is alive while that day is today or yesterday.
  if v_derniere is not null and v_derniere >= p_aujourdhui - 1 then
    v_courante := v_run;
  end if;

  for v_i in reverse 6..0 loop
    v_semaine := v_semaine || jsonb_build_object(
      'jour', to_char(p_aujourdhui - v_i, 'YYYY-MM-DD'),
      'actif', (p_aujourdhui - v_i) = any (v_jours));
  end loop;

  select coalesce((valeur #>> '{}')::integer, 1) into v_par_mois
    from public.configuration where cle = 'recuperations_serie_par_mois';
  v_par_mois := coalesce(v_par_mois, 1);
  select count(*) into v_utilisees
    from public.recuperations_serie r
   where r.utilisateur_id = p_uid
     and date_trunc('month', public.jour_local(r.cree_le, v_tz)) = date_trunc('month', p_aujourdhui);
  -- One recovery repairs exactly one missed day: yesterday, when it is missing and the day before was active.
  if not ((p_aujourdhui - 1) = any (v_jours)) and (p_aujourdhui - 2) = any (v_jours) then
    v_jour_reparable := p_aujourdhui - 1;
  end if;

  return jsonb_build_object(
    'aujourdhui', to_char(p_aujourdhui, 'YYYY-MM-DD'),
    'courante', v_courante,
    'record', v_record,
    'semaines_gagnees', v_courante / 7,
    'derniere_journee', case when v_derniere is null then null else to_char(v_derniere, 'YYYY-MM-DD') end,
    'validee_aujourdhui', p_aujourdhui = any (v_jours),
    'semaine', v_semaine,
    'recuperation', jsonb_build_object(
      'par_mois', v_par_mois,
      'utilisees_ce_mois', v_utilisees,
      'restantes', greatest(v_par_mois - v_utilisees, 0),
      'jour_reparable', case when v_jour_reparable is null then null else to_char(v_jour_reparable, 'YYYY-MM-DD') end,
      'jour_a_couvrir', case when v_jour_reparable is null or v_utilisees >= v_par_mois then null
                            else to_char(v_jour_reparable, 'YYYY-MM-DD') end));
end;
$$;
revoke execute on function public.calculer_serie(uuid, date) from public, anon, authenticated;

create or replace function public.appliquer_resultat(p_tentative_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_e record;
  v_note numeric;
  v_res text;
  v_suivante record;
begin
  select * into v_t from public.tentatives where id = p_tentative_id;
  if v_t.id is null or v_t.type <> 'etape' or v_t.etape_id is null then
    return null;
  end if;
  -- Already applied by a previous run of the pipeline: same answer, no second count.
  if v_t.resultat is not null then
    return v_t.resultat;
  end if;
  select * into v_e from public.etapes where id = v_t.etape_id for update;
  if v_e.id is null or v_e.statut = 'validee' then
    return null;
  end if;
  select note_totale into v_note from public.evaluations where tentative_id = p_tentative_id;
  if v_note is null then
    return null;
  end if;

  if v_note >= v_e.seuil_reussite then
    update public.etapes
       set statut = 'validee', validee_le = now(), tentative_validante_id = p_tentative_id
     where id = v_e.id;
    select * into v_suivante
      from public.etapes
     where parcours_id = v_e.parcours_id and ordre_global > v_e.ordre_global
     order by ordre_global limit 1;
    if v_suivante.id is not null then
      update public.etapes set statut = 'disponible' where id = v_suivante.id and statut = 'verrouillee';
      if v_suivante.acte_id <> v_e.acte_id then
        update public.actes set statut = 'traverse', traverse_le = now() where id = v_e.acte_id;
        update public.actes set statut = 'en_cours' where id = v_suivante.acte_id;
      end if;
    else
      update public.actes set statut = 'traverse', traverse_le = now() where id = v_e.acte_id;
    end if;
    insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
    select v_t.utilisateur_id, d.points, 'defi_valide', p_tentative_id::text
      from public.defis d where d.id = v_e.defi_id and d.points > 0
    on conflict (motif, reference) do nothing;
    v_res := 'etape_validee';
  else
    update public.etapes
       set nombre_echecs = nombre_echecs + 1,
           rattrapage_propose = (nombre_echecs + 1 >= 2)
     where id = v_e.id;
    v_res := 'etape_echouee';
  end if;

  update public.tentatives set resultat = v_res where id = p_tentative_id;
  return v_res;
end;
$$;
revoke execute on function public.appliquer_resultat(uuid) from public, anon, authenticated;
grant execute on function public.appliquer_resultat(uuid) to service_role;

create or replace function public.traiter_echange(p_echange uuid, p_statut text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_e record;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_statut not in ('a_traiter', 'honore', 'annule') then
    raise exception 'statut inconnu' using errcode = '23514';
  end if;
  select * into v_e from public.echanges_recompenses where id = p_echange for update;
  if v_e.id is null then raise exception 'echange introuvable' using errcode = 'P0002'; end if;
  -- The same lock as echanger_recompense: no spend can slip between the check and the write.
  perform pg_advisory_xact_lock(hashtext('points:' || v_e.utilisateur_id::text));
  if p_statut = 'annule' and v_e.statut <> 'annule' then
    insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
    values (v_e.utilisateur_id, v_e.cout_points, 'remboursement', v_e.id::text)
    on conflict (motif, reference) do nothing;
  end if;
  if p_statut <> 'annule' and v_e.statut = 'annule' then
    -- Re-opening takes the points again through a compensating movement, never by deleting the refund.
    if public.solde_points(v_e.utilisateur_id) < v_e.cout_points then
      raise exception 'points_insuffisants' using errcode = 'P0001';
    end if;
    insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
    values (v_e.utilisateur_id, -v_e.cout_points, 'ajustement', 'reprise:' || v_e.id::text)
    on conflict (motif, reference) do nothing;
  end if;
  update public.echanges_recompenses
     set statut = p_statut, note = coalesce(p_note, note), traite_le = case when p_statut = 'a_traiter' then null else now() end
   where id = p_echange;
end;
$$;
revoke execute on function public.traiter_echange(uuid, text, text) from public, anon;
grant execute on function public.traiter_echange(uuid, text, text) to authenticated;
