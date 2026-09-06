-- LEQ, migration "parcours" (Phase 4). Implements the "Phase 4 additions" of docs/DATA-MODEL.md.
-- Banks (modeles_actes, defis, exercices), the path per person (parcours, actes, etapes),
-- abonnements, and the functions that build the path, describe the day's step and apply a result.

-- ---------------------------------------------------------------------------
-- Banks
-- ---------------------------------------------------------------------------

create table if not exists public.modeles_actes (
  ordre integer primary key check (ordre > 0),
  titre text not null,
  sous_titre text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.modeles_actes is 'Les actes du parcours, dans l''ordre. Rebecca les édite.';
drop trigger if exists modeles_actes_modifie_le on public.modeles_actes;
create trigger modeles_actes_modifie_le before update on public.modeles_actes
  for each row execute function public.definir_modifie_le();

create table if not exists public.defis (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  ordre_acte integer not null references public.modeles_actes (ordre) on update cascade,
  ordre integer not null,
  format text not null check (format in ('standard', 'texte', 'long')),
  titre text not null,
  consigne text not null,
  focus text,
  plan jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array'),
  texte_a_lire text,
  duree_lecture_s integer,
  duree_preparation_s integer,
  duree_max_s integer not null check (duree_max_s > 0),
  points integer not null check (points >= 0),
  competence text not null,
  seuil_reussite numeric(5, 2) not null,
  provisoire boolean not null default true,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (ordre_acte, ordre)
);
comment on table public.defis is 'Banque des défis. provisoire = contenu issu de la maquette, en attente de Rebecca.';
drop trigger if exists defis_modifie_le on public.defis;
create trigger defis_modifie_le before update on public.defis
  for each row execute function public.definir_modifie_le();

create table if not exists public.exercices (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  titre text not null,
  consigne text not null,
  duree_s integer not null check (duree_s > 0),
  competence text not null,
  provisoire boolean not null default true,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.exercices is 'Banque des exercices de rattrapage (écran X5), par compétence.';
drop trigger if exists exercices_modifie_le on public.exercices;
create trigger exercices_modifie_le before update on public.exercices
  for each row execute function public.definir_modifie_le();

-- ---------------------------------------------------------------------------
-- The path of one person
-- ---------------------------------------------------------------------------

create table if not exists public.parcours (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null unique references public.profils (id) on delete cascade,
  source text not null check (source in ('statique', 'genere')),
  version_regles text,
  genere_le timestamptz not null default now()
);
comment on table public.parcours is 'Un parcours par personne, construit une fois.';

create table if not exists public.actes (
  id uuid primary key default gen_random_uuid(),
  parcours_id uuid not null references public.parcours (id) on delete cascade,
  ordre integer not null,
  titre text not null,
  sous_titre text,
  statut text not null check (statut in ('a_venir', 'en_cours', 'traverse')),
  traverse_le timestamptz,
  unique (parcours_id, ordre)
);

create table if not exists public.etapes (
  id uuid primary key default gen_random_uuid(),
  parcours_id uuid not null references public.parcours (id) on delete cascade,
  acte_id uuid not null references public.actes (id) on delete cascade,
  ordre_global integer not null,
  ordre integer not null,
  defi_id uuid not null references public.defis (id),
  seuil_reussite numeric(5, 2) not null,
  statut text not null check (statut in ('verrouillee', 'disponible', 'validee')),
  nombre_echecs integer not null default 0,
  rattrapage_propose boolean not null default false,
  validee_le timestamptz,
  tentative_validante_id uuid references public.tentatives (id) on delete set null,
  unique (parcours_id, ordre_global)
);
create index if not exists etapes_parcours_statut_idx on public.etapes (parcours_id, statut, ordre_global);

alter table public.tentatives
  drop constraint if exists tentatives_etape_id_fkey,
  add constraint tentatives_etape_id_fkey foreign key (etape_id) references public.etapes (id) on delete set null;
create index if not exists tentatives_etape_idx on public.tentatives (etape_id) where etape_id is not null;

create table if not exists public.abonnements (
  utilisateur_id uuid primary key references public.profils (id) on delete cascade,
  formule text not null check (formule in ('gratuit', 'complet')),
  source text not null check (source in ('manuel', 'revenuecat')),
  actif_jusqu_a timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.abonnements is 'Formule de la personne. Pas de ligne = Gratuit. RevenueCat écrit ici plus tard.';
drop trigger if exists abonnements_modifie_le on public.abonnements;
create trigger abonnements_modifie_le before update on public.abonnements
  for each row execute function public.definir_modifie_le();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.modeles_actes enable row level security;
alter table public.defis enable row level security;
alter table public.exercices enable row level security;
alter table public.parcours enable row level security;
alter table public.actes enable row level security;
alter table public.etapes enable row level security;
alter table public.abonnements enable row level security;

drop policy if exists modeles_actes_select on public.modeles_actes;
create policy modeles_actes_select on public.modeles_actes for select to authenticated using (true);
drop policy if exists modeles_actes_admin on public.modeles_actes;
create policy modeles_actes_admin on public.modeles_actes for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

drop policy if exists defis_select on public.defis;
create policy defis_select on public.defis for select to authenticated
  using (actif or (select public.est_admin()));
drop policy if exists defis_admin_insert on public.defis;
create policy defis_admin_insert on public.defis for insert to authenticated with check ((select public.est_admin()));
drop policy if exists defis_admin_update on public.defis;
create policy defis_admin_update on public.defis for update to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
drop policy if exists defis_admin_delete on public.defis;
create policy defis_admin_delete on public.defis for delete to authenticated using ((select public.est_admin()));

drop policy if exists exercices_select on public.exercices;
create policy exercices_select on public.exercices for select to authenticated
  using (actif or (select public.est_admin()));
drop policy if exists exercices_admin_insert on public.exercices;
create policy exercices_admin_insert on public.exercices for insert to authenticated with check ((select public.est_admin()));
drop policy if exists exercices_admin_update on public.exercices;
create policy exercices_admin_update on public.exercices for update to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
drop policy if exists exercices_admin_delete on public.exercices;
create policy exercices_admin_delete on public.exercices for delete to authenticated using ((select public.est_admin()));

drop policy if exists parcours_select_propre on public.parcours;
create policy parcours_select_propre on public.parcours for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));
drop policy if exists actes_select_propre on public.actes;
create policy actes_select_propre on public.actes for select to authenticated
  using (exists (select 1 from public.parcours p where p.id = actes.parcours_id
                   and (p.utilisateur_id = (select auth.uid()) or (select public.est_admin()))));
drop policy if exists etapes_select_propre on public.etapes;
create policy etapes_select_propre on public.etapes for select to authenticated
  using (exists (select 1 from public.parcours p where p.id = etapes.parcours_id
                   and (p.utilisateur_id = (select auth.uid()) or (select public.est_admin()))));
drop policy if exists abonnements_select_propre on public.abonnements;
create policy abonnements_select_propre on public.abonnements for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.formule_de(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.abonnements a
       where a.utilisateur_id = p_uid and a.formule = 'complet'
         and (a.actif_jusqu_a is null or a.actif_jusqu_a > now())
    ) then 'complet'
    else 'gratuit'
  end;
$$;
grant execute on function public.formule_de(uuid) to authenticated, service_role;

-- Builds the caller's path on first call, from the acts and the active défis in order.
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

    for v_defi in select * from public.defis d where d.ordre_acte = v_acte.ordre and d.actif order by d.ordre loop
      v_ordre_global := v_ordre_global + 1;
      insert into public.etapes (parcours_id, acte_id, ordre_global, ordre, defi_id, seuil_reussite, statut)
      values (
        v_parcours, v_acte_id, v_ordre_global, v_defi.ordre, v_defi.id, v_defi.seuil_reussite,
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

-- The caller's current step with its défi and act, and the day's rhythm, as one JSON object.
create or replace function public.etape_du_jour()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_parcours uuid;
  v_tz text;
  v_jour date;
  v_formule text;
  v_lim_etapes integer;
  v_lim_essais integer;
  v_validees integer;
  v_essais integer := 0;
  v_etape record;
  v_raison text;
  v_nb_etapes_acte integer;
  v_a_des_etapes boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  v_parcours := public.obtenir_parcours();
  select coalesce(fuseau_horaire, 'Europe/Paris') into v_tz from public.profils where id = v_uid;
  v_tz := coalesce(v_tz, 'Europe/Paris');
  v_jour := (now() at time zone v_tz)::date;
  v_formule := public.formule_de(v_uid);

  select coalesce((valeur #>> '{}')::integer, 1) into v_lim_etapes
    from public.configuration
   where cle = case when v_formule = 'complet' then 'etapes_par_jour_complet' else 'etapes_par_jour_gratuit' end;
  v_lim_etapes := coalesce(v_lim_etapes, 1);
  select coalesce((valeur #>> '{}')::integer, 3) into v_lim_essais from public.configuration where cle = 'essais_max_etape_par_jour';
  v_lim_essais := coalesce(v_lim_essais, 3);

  select count(*) into v_validees
    from public.etapes e
   where e.parcours_id = v_parcours and e.statut = 'validee'
     and (e.validee_le at time zone v_tz)::date = v_jour;

  select e.id, e.ordre_global, e.ordre, e.statut, e.nombre_echecs, e.rattrapage_propose, e.seuil_reussite,
         a.ordre as acte_ordre, a.titre as acte_titre, a.sous_titre as acte_sous_titre, a.id as acte_id,
         d.id as defi_id, d.cle, d.format, d.titre, d.consigne, d.focus, d.plan, d.texte_a_lire,
         d.duree_lecture_s, d.duree_preparation_s, d.duree_max_s, d.points, d.competence, d.provisoire
    into v_etape
    from public.etapes e
    join public.actes a on a.id = e.acte_id
    join public.defis d on d.id = e.defi_id
   where e.parcours_id = v_parcours and e.statut = 'disponible'
   order by e.ordre_global
   limit 1;

  select exists (select 1 from public.etapes where parcours_id = v_parcours) into v_a_des_etapes;

  if v_etape.id is not null then
    select count(*) into v_essais
      from public.tentatives t
     where t.utilisateur_id = v_uid and t.type = 'etape' and t.etape_id = v_etape.id
       and t.statut <> 'abandon_technique'
       and (t.enregistre_le at time zone v_tz)::date = v_jour;
    select count(*) into v_nb_etapes_acte from public.etapes where acte_id = v_etape.acte_id;
  end if;

  v_raison := case
    when v_etape.id is null and v_a_des_etapes then 'parcours_termine'
    when v_etape.id is null then 'aucune_etape'
    when v_lim_etapes > 0 and v_validees >= v_lim_etapes then 'limite_jour'
    when v_lim_essais > 0 and v_essais >= v_lim_essais then 'limite_essais'
    else 'ok'
  end;

  return jsonb_build_object(
    'formule', v_formule,
    'rythme', jsonb_build_object(
      'jour', v_jour,
      'fuseau_horaire', v_tz,
      'etapes_validees_aujourdhui', v_validees,
      'essais_aujourdhui', v_essais,
      'limite_etapes', v_lim_etapes,
      'limite_essais', v_lim_essais,
      'peut_enregistrer', v_raison = 'ok',
      'raison', v_raison
    ),
    'etape', case when v_etape.id is null then null else jsonb_build_object(
      'id', v_etape.id, 'ordre_global', v_etape.ordre_global, 'ordre', v_etape.ordre, 'statut', v_etape.statut,
      'nombre_echecs', v_etape.nombre_echecs, 'rattrapage_propose', v_etape.rattrapage_propose,
      'seuil_reussite', v_etape.seuil_reussite, 'nb_etapes_acte', v_nb_etapes_acte
    ) end,
    'acte', case when v_etape.id is null then null else jsonb_build_object(
      'id', v_etape.acte_id, 'ordre', v_etape.acte_ordre, 'titre', v_etape.acte_titre, 'sous_titre', v_etape.acte_sous_titre
    ) end,
    'defi', case when v_etape.id is null then null else jsonb_build_object(
      'id', v_etape.defi_id, 'cle', v_etape.cle, 'format', v_etape.format, 'titre', v_etape.titre,
      'consigne', v_etape.consigne, 'focus', v_etape.focus, 'plan', v_etape.plan, 'texte_a_lire', v_etape.texte_a_lire,
      'duree_lecture_s', v_etape.duree_lecture_s, 'duree_preparation_s', v_etape.duree_preparation_s,
      'duree_max_s', v_etape.duree_max_s, 'points', v_etape.points, 'competence', v_etape.competence,
      'provisoire', v_etape.provisoire
    ) end
  );
end;
$$;
revoke execute on function public.etape_du_jour() from public, anon;
grant execute on function public.etape_du_jour() to authenticated, service_role;

-- The person saw the remediation proposal (X5); it is not shown again for that step.
create or replace function public.marquer_rattrapage_vu(p_etape_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.etapes e
     set rattrapage_propose = false
    from public.parcours p
   where e.id = p_etape_id and p.id = e.parcours_id and p.utilisateur_id = (select auth.uid());
end;
$$;
revoke execute on function public.marquer_rattrapage_vu(uuid) from public, anon;
grant execute on function public.marquer_rattrapage_vu(uuid) to authenticated, service_role;

-- Applies the evaluation of a step attempt to the path. Service role only (the worker
-- calls it inside the transaction that writes the evaluation).
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
