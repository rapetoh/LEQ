-- LEQ, migration "serie_points" (Phase 5). Implements the "Phase 5 additions" of
-- docs/DATA-MODEL.md and ADR-009 (ledgers, not counters): points are an append-only ledger,
-- the streak is replayed from the days with a recording, one recovery a month covers one
-- missed day, rewards are exchanged in one transaction under a monthly quantity cap.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.mouvements_points (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  montant integer not null check (montant <> 0),
  motif text not null check (motif in ('defi_valide', 'vote', 'echange', 'remboursement', 'ajustement')),
  reference text,
  cree_le timestamptz not null default now(),
  unique (motif, reference)
);
create index if not exists mouvements_points_utilisateur_idx on public.mouvements_points (utilisateur_id, cree_le desc);
comment on table public.mouvements_points is 'Grand livre des points, jamais modifié : le solde est la somme. reference rend chaque crédit idempotent (tentative, vote, échange).';

create table if not exists public.recuperations_serie (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  jour_couvert date not null,
  cree_le timestamptz not null default now(),
  unique (utilisateur_id, jour_couvert)
);
comment on table public.recuperations_serie is 'Un jour manqué couvert par la personne elle-même (cahier chapitre 6), une fois par mois.';

create table if not exists public.recompenses (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  ordre integer not null,
  type text not null check (type in ('contenu', 'reduction', 'atelier', 'distinction')),
  titre text not null,
  sous_titre text,
  description text,
  cout_points integer check (cout_points is null or cout_points > 0),
  plafond_par_mois integer check (plafond_par_mois is null or plafond_par_mois > 0),
  echangeable boolean not null default true,
  provisoire boolean not null default true,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (not echangeable or cout_points is not null)
);
comment on table public.recompenses is 'La boutique (cahier chapitre 7). plafond_par_mois borne ce qui coûte de l''argent réel à Rebecca. type distinction = ne s''achète pas.';
drop trigger if exists recompenses_modifie_le on public.recompenses;
create trigger recompenses_modifie_le before update on public.recompenses
  for each row execute function public.definir_modifie_le();

create table if not exists public.echanges_recompenses (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  recompense_id uuid not null references public.recompenses (id),
  cout_points integer not null,
  statut text not null default 'a_traiter' check (statut in ('a_traiter', 'honore', 'annule')),
  note text,
  cree_le timestamptz not null default now(),
  traite_le timestamptz
);
create index if not exists echanges_recompense_idx on public.echanges_recompenses (recompense_id, cree_le);
create index if not exists echanges_utilisateur_idx on public.echanges_recompenses (utilisateur_id, cree_le desc);
comment on table public.echanges_recompenses is 'Un échange de points contre une récompense. Rebecca l''honore à la main (a_traiter -> honore) ou l''annule (les points reviennent).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.mouvements_points enable row level security;
alter table public.recuperations_serie enable row level security;
alter table public.recompenses enable row level security;
alter table public.echanges_recompenses enable row level security;

drop policy if exists mouvements_points_select_propre on public.mouvements_points;
create policy mouvements_points_select_propre on public.mouvements_points for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists recuperations_serie_select_propre on public.recuperations_serie;
create policy recuperations_serie_select_propre on public.recuperations_serie for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists recompenses_select on public.recompenses;
create policy recompenses_select on public.recompenses for select to authenticated
  using (actif or (select public.est_admin()));
drop policy if exists recompenses_admin_insert on public.recompenses;
create policy recompenses_admin_insert on public.recompenses for insert to authenticated with check ((select public.est_admin()));
drop policy if exists recompenses_admin_update on public.recompenses;
create policy recompenses_admin_update on public.recompenses for update to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
drop policy if exists recompenses_admin_delete on public.recompenses;
create policy recompenses_admin_delete on public.recompenses for delete to authenticated using ((select public.est_admin()));

drop policy if exists echanges_select_propre on public.echanges_recompenses;
create policy echanges_select_propre on public.echanges_recompenses for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

-- ---------------------------------------------------------------------------
-- Helpers: local day, timezone of a person
-- ---------------------------------------------------------------------------

create or replace function public.jour_local(p_instant timestamptz, p_fuseau text)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  return (p_instant at time zone coalesce(p_fuseau, 'Europe/Paris'))::date;
exception when others then
  return (p_instant at time zone 'Europe/Paris')::date;
end;
$$;

create or replace function public.fuseau_de(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select fuseau_horaire from public.profils where id = p_uid), 'Europe/Paris');
$$;
revoke execute on function public.fuseau_de(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The streak: replayed, never counted
-- ---------------------------------------------------------------------------

create or replace function public.jours_actifs(p_uid uuid)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select public.jour_local(t.enregistre_le, t.fuseau_horaire) from public.tentatives t where t.utilisateur_id = p_uid
  union
  select r.jour_couvert from public.recuperations_serie r where r.utilisateur_id = p_uid;
$$;
revoke execute on function public.jours_actifs(uuid) from public, anon, authenticated;

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
  -- One recovery repairs exactly one missed day: yesterday, when the last active day is the day before.
  if v_derniere = p_aujourdhui - 2 then
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

create or replace function public.ma_serie()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.calculer_serie((select auth.uid()), public.jour_local(now(), public.fuseau_de((select auth.uid()))));
$$;
revoke execute on function public.ma_serie() from public, anon;
grant execute on function public.ma_serie() to authenticated;

create or replace function public.activer_recuperation(p_uid uuid, p_aujourdhui date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_serie jsonb;
  v_jour date;
begin
  perform pg_advisory_xact_lock(hashtext('recuperation:' || p_uid::text));
  v_serie := public.calculer_serie(p_uid, p_aujourdhui);
  if (v_serie #>> '{recuperation,jour_reparable}') is null then
    raise exception 'rien_a_couvrir' using errcode = 'P0001';
  end if;
  if (v_serie #>> '{recuperation,jour_a_couvrir}') is null then
    raise exception 'quota_epuise' using errcode = 'P0001';
  end if;
  v_jour := (v_serie #>> '{recuperation,jour_a_couvrir}')::date;
  insert into public.recuperations_serie (utilisateur_id, jour_couvert) values (p_uid, v_jour);
  return v_jour;
end;
$$;
revoke execute on function public.activer_recuperation(uuid, date) from public, anon, authenticated;

create or replace function public.activer_recuperation_serie()
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  return public.activer_recuperation(v_uid, public.jour_local(now(), public.fuseau_de(v_uid)));
end;
$$;
revoke execute on function public.activer_recuperation_serie() from public, anon;
grant execute on function public.activer_recuperation_serie() to authenticated;

-- ---------------------------------------------------------------------------
-- Points
-- ---------------------------------------------------------------------------

create or replace function public.solde_points(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(montant), 0)::integer from public.mouvements_points where utilisateur_id = p_uid;
$$;
revoke execute on function public.solde_points(uuid) from public, anon, authenticated;

create or replace function public.points_de(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'solde', public.solde_points(p_uid),
    'cumul', coalesce((select sum(montant) from public.mouvements_points where utilisateur_id = p_uid and montant > 0), 0),
    'cette_semaine', coalesce((select sum(montant) from public.mouvements_points
                                where utilisateur_id = p_uid and montant > 0 and cree_le >= now() - interval '7 days'), 0),
    'formule', public.formule_de(p_uid));
$$;
revoke execute on function public.points_de(uuid) from public, anon, authenticated;

create or replace function public.mes_points()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.points_de((select auth.uid()));
$$;
revoke execute on function public.mes_points() from public, anon;
grant execute on function public.mes_points() to authenticated;

-- appliquer_resultat now credits the défi's points when the step is validated.
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
    -- The défi's points, once per attempt (the ledger's unique key makes a replay harmless).
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

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------

create or replace function public.mois_courant_boutique()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', public.jour_local(now(), 'Europe/Paris'))::date;
$$;

create or replace function public.echanges_du_mois(p_recompense uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.echanges_recompenses e
   where e.recompense_id = p_recompense
     and e.statut <> 'annule'
     and date_trunc('month', public.jour_local(e.cree_le, 'Europe/Paris'))::date = public.mois_courant_boutique();
$$;
revoke execute on function public.echanges_du_mois(uuid) from public, anon, authenticated;

create or replace function public.mes_recompenses()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'points', public.points_de((select auth.uid())),
    'recompenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'cle', r.cle, 'ordre', r.ordre, 'type', r.type, 'titre', r.titre,
        'sous_titre', r.sous_titre, 'description', r.description, 'cout_points', r.cout_points,
        'plafond_par_mois', r.plafond_par_mois, 'echangeable', r.echangeable, 'provisoire', r.provisoire,
        'restantes_ce_mois', case when r.plafond_par_mois is null then null
                                  else greatest(r.plafond_par_mois - public.echanges_du_mois(r.id), 0) end,
        'mes_echanges', (select count(*) from public.echanges_recompenses e
                          where e.recompense_id = r.id and e.utilisateur_id = (select auth.uid()) and e.statut <> 'annule'))
        order by r.ordre)
      from public.recompenses r where r.actif), '[]'::jsonb),
    'echanges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'recompense_id', e.recompense_id, 'titre', r.titre, 'cout_points', e.cout_points,
        'statut', e.statut, 'cree_le', e.cree_le, 'traite_le', e.traite_le)
        order by e.cree_le desc)
      from public.echanges_recompenses e join public.recompenses r on r.id = e.recompense_id
      where e.utilisateur_id = (select auth.uid())), '[]'::jsonb));
$$;
revoke execute on function public.mes_recompenses() from public, anon;
grant execute on function public.mes_recompenses() to authenticated;

create or replace function public.echanger_recompense(p_recompense uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_r record;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_anonyme()) then raise exception 'compte_requis' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('points:' || v_uid::text));
  select * into v_r from public.recompenses where id = p_recompense and actif for share;
  if v_r.id is null then raise exception 'recompense_indisponible' using errcode = 'P0001'; end if;
  if not v_r.echangeable or v_r.cout_points is null then
    raise exception 'recompense_non_echangeable' using errcode = 'P0001';
  end if;
  if public.solde_points(v_uid) < v_r.cout_points then
    raise exception 'points_insuffisants' using errcode = 'P0001';
  end if;
  if v_r.plafond_par_mois is not null then
    perform pg_advisory_xact_lock(hashtext('recompense:' || v_r.id::text));
    if public.echanges_du_mois(v_r.id) >= v_r.plafond_par_mois then
      raise exception 'plafond_atteint' using errcode = 'P0001';
    end if;
  end if;
  insert into public.echanges_recompenses (utilisateur_id, recompense_id, cout_points)
  values (v_uid, v_r.id, v_r.cout_points) returning id into v_id;
  insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
  values (v_uid, -v_r.cout_points, 'echange', v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.echanger_recompense(uuid) from public, anon;
grant execute on function public.echanger_recompense(uuid) to authenticated;

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
  if p_statut = 'annule' and v_e.statut <> 'annule' then
    insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
    values (v_e.utilisateur_id, v_e.cout_points, 'remboursement', v_e.id::text)
    on conflict (motif, reference) do nothing;
  end if;
  if p_statut <> 'annule' and v_e.statut = 'annule' then
    -- Re-opening a cancelled exchange takes the points again, only if they are still there.
    if public.solde_points(v_e.utilisateur_id) < v_e.cout_points then
      raise exception 'points_insuffisants' using errcode = 'P0001';
    end if;
    delete from public.mouvements_points where motif = 'remboursement' and reference = v_e.id::text;
  end if;
  update public.echanges_recompenses
     set statut = p_statut, note = coalesce(p_note, note), traite_le = case when p_statut = 'a_traiter' then null else now() end
   where id = p_echange;
end;
$$;
revoke execute on function public.traiter_echange(uuid, text, text) from public, anon;
grant execute on function public.traiter_echange(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Progress (D1, D1b)
-- ---------------------------------------------------------------------------

create or replace function public.resume_progres_de(p_uid uuid, p_aujourdhui date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mois_debut date := date_trunc('month', p_aujourdhui)::date;
  v_mois jsonb;
  v_premiere jsonb;
  v_derniere jsonb;
  v_semaines jsonb;
begin
  select jsonb_build_object(
    'prises', count(*),
    'duree_parole_s', coalesce(sum((a.mesures ->> 'duree_parole_s')::numeric), 0),
    'defis_releves', (select count(*) from public.etapes e join public.parcours p on p.id = e.parcours_id
                       where p.utilisateur_id = p_uid and e.statut = 'validee'
                         and public.jour_local(e.validee_le, public.fuseau_de(p_uid)) >= v_mois_debut))
    into v_mois
    from public.tentatives t left join public.analyses a on a.tentative_id = t.id
   where t.utilisateur_id = p_uid
     and public.jour_local(t.enregistre_le, t.fuseau_horaire) >= v_mois_debut;

  select jsonb_build_object(
      'enregistre_le', t.enregistre_le,
      'debit', (a.mesures #>> '{debit,mots_par_minute}')::numeric,
      'bequilles_par_minute', (a.mesures #>> '{mots_bequilles,par_minute}')::numeric,
      'silences_tenus', (a.mesures #>> '{silences,tenus}')::integer)
    into v_premiere
    from public.tentatives t join public.analyses a on a.tentative_id = t.id
   where t.utilisateur_id = p_uid and t.statut = 'retour_disponible'
   order by t.enregistre_le asc limit 1;

  select jsonb_build_object(
      'enregistre_le', t.enregistre_le,
      'debit', (a.mesures #>> '{debit,mots_par_minute}')::numeric,
      'bequilles_par_minute', (a.mesures #>> '{mots_bequilles,par_minute}')::numeric,
      'silences_tenus', (a.mesures #>> '{silences,tenus}')::integer)
    into v_derniere
    from public.tentatives t join public.analyses a on a.tentative_id = t.id
   where t.utilisateur_id = p_uid and t.statut = 'retour_disponible'
   order by t.enregistre_le desc limit 1;

  with prises as (
    select date_trunc('week', public.jour_local(t.enregistre_le, t.fuseau_horaire))::date as semaine,
           t.id, a.mesures
      from public.tentatives t join public.analyses a on a.tentative_id = t.id
     where t.utilisateur_id = p_uid and t.statut = 'retour_disponible'
       and public.jour_local(t.enregistre_le, t.fuseau_horaire) >= p_aujourdhui - 41
  ), mots as (
    select p.semaine, kv.key as mot, sum(kv.value::integer) as total
      from prises p cross join lateral jsonb_each_text(coalesce(p.mesures #> '{mots_bequilles,par_type}', '{}'::jsonb)) kv
     group by p.semaine, kv.key
  ), par_semaine as (
    select p.semaine, count(*) as prises,
           coalesce((select jsonb_object_agg(m.mot, m.total) from mots m where m.semaine = p.semaine), '{}'::jsonb) as par_type
      from prises p group by p.semaine
  )
  select coalesce(jsonb_agg(jsonb_build_object('semaine', to_char(semaine, 'YYYY-MM-DD'), 'prises', prises, 'par_type', par_type) order by semaine), '[]'::jsonb)
    into v_semaines from par_semaine;

  return jsonb_build_object(
    'serie', public.calculer_serie(p_uid, p_aujourdhui),
    'points', public.points_de(p_uid),
    'mois', v_mois,
    'premiere', v_premiere,
    'derniere', v_derniere,
    'bequilles_semaines', v_semaines);
end;
$$;
revoke execute on function public.resume_progres_de(uuid, date) from public, anon, authenticated;

create or replace function public.resume_progres()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.resume_progres_de((select auth.uid()), public.jour_local(now(), public.fuseau_de((select auth.uid()))));
$$;
revoke execute on function public.resume_progres() from public, anon;
grant execute on function public.resume_progres() to authenticated;
