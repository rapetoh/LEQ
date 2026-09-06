-- LEQ, migration "socle" (Phase 0).
-- Implements docs/DATA-MODEL.md, Phase 0 section, name for name.
-- Valid for PostgreSQL 17. Idempotent where cheap (extensions, tables, buckets,
-- triggers and policies are dropped and recreated by name).
--
-- Layout:
--   1. extensions
--   2. helper functions (est_admin, est_anonyme, modifie_le trigger)
--   3. tables: profils, configuration, drapeaux, jobs, tentatives, analyses,
--      grilles, criteres_grille, evaluations
--   4. job queue functions (security definer, service role only)
--   5. row level security
--   6. access token hook
--   7. storage buckets and policies
--   8. pg_cron schedules (guarded)

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- pg_cron needs shared_preload_libraries. It is present on hosted Supabase and
-- in the CLI image, but a bare Postgres would fail here, so the creation is
-- guarded and the schedules at the end are only created when it exists.
do $leq$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron is listed but could not be enabled: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not available on this server, schedules are skipped';
  end if;
end
$leq$;

-- ---------------------------------------------------------------------------
-- 2. Helper functions
-- ---------------------------------------------------------------------------

-- True when the JWT carries app_metadata.role = 'admin' (set by the hook).
create or replace function public.est_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- True for a Supabase anonymous sign-in (claim is_anonymous = true).
create or replace function public.est_anonyme()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

grant execute on function public.est_admin() to anon, authenticated, service_role;
grant execute on function public.est_anonyme() to anon, authenticated, service_role;

-- Maintains modifie_le on every mutable table.
create or replace function public.definir_modifie_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

-- Records who changed a configuration or a flag when the change comes from a
-- signed-in user. Service role writes keep whatever was provided.
create or replace function public.definir_modifie_par()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_par := coalesce((select auth.uid()), new.modifie_par);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

-- profils -------------------------------------------------------------------

create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text,
  region text,
  fuseau_horaire text,
  publier_sous_prenom boolean not null default false,
  role text not null default 'utilisateur' check (role in ('utilisateur', 'admin')),
  suspendu_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.profils is 'Une ligne par utilisateur auth, créée par trigger.';
comment on column public.profils.region is 'Code de région, liste fixe côté application.';
comment on column public.profils.fuseau_horaire is 'Fuseau IANA, par exemple Europe/Paris.';
comment on column public.profils.suspendu_le is 'Null tant que le compte est actif.';

drop trigger if exists profils_modifie_le on public.profils;
create trigger profils_modifie_le
  before update on public.profils
  for each row execute function public.definir_modifie_le();

-- One profil per auth.users row. Security definer because GoTrue inserts as
-- supabase_auth_admin, which has no rights on public.profils.
create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists creer_profil_apres_insertion on auth.users;
create trigger creer_profil_apres_insertion
  after insert on auth.users
  for each row execute function public.creer_profil();

-- role and suspendu_le can only be changed by a privileged connection: the
-- service role through the API, or a direct database connection (the worker,
-- an operator granting Rebecca the admin role). Never by a signed-in client.
create or replace function public.proteger_colonnes_profil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.suspendu_le is distinct from old.suspendu_le)
     and coalesce((select auth.role()), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'profils.role and profils.suspendu_le can only be changed by the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profils_proteger_colonnes on public.profils;
create trigger profils_proteger_colonnes
  before update on public.profils
  for each row execute function public.proteger_colonnes_profil();

-- configuration -------------------------------------------------------------

create table if not exists public.configuration (
  cle text primary key,
  valeur jsonb not null,
  type text not null check (type in ('nombre', 'texte', 'booleen', 'json')),
  description text not null,
  modifie_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  -- valeur must match the declared type so the admin UI cannot store garbage
  constraint configuration_valeur_selon_type check (
    case type
      when 'nombre' then jsonb_typeof(valeur) = 'number'
      when 'texte' then jsonb_typeof(valeur) = 'string'
      when 'booleen' then jsonb_typeof(valeur) = 'boolean'
      else true
    end
  )
);

comment on table public.configuration is 'Réglages typés, modifiés par Rebecca, lus par l''application au démarrage.';

drop trigger if exists configuration_modifie_le on public.configuration;
create trigger configuration_modifie_le
  before update on public.configuration
  for each row execute function public.definir_modifie_le();

drop trigger if exists configuration_modifie_par on public.configuration;
create trigger configuration_modifie_par
  before update on public.configuration
  for each row execute function public.definir_modifie_par();

-- drapeaux ------------------------------------------------------------------

create table if not exists public.drapeaux (
  cle text primary key check (cle in ('arene', 'duels', 'face_a_face')),
  actif boolean not null default false,
  modifie_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.drapeaux is 'Interrupteurs de fonctionnalités, livrés éteints.';

drop trigger if exists drapeaux_modifie_le on public.drapeaux;
create trigger drapeaux_modifie_le
  before update on public.drapeaux
  for each row execute function public.definir_modifie_le();

drop trigger if exists drapeaux_modifie_par on public.drapeaux;
create trigger drapeaux_modifie_par
  before update on public.drapeaux
  for each row execute function public.definir_modifie_par();

-- jobs ----------------------------------------------------------------------
-- Created before tentatives because the tentatives insert trigger writes here.

create table if not exists public.jobs (
  id bigint generated always as identity primary key,
  type text not null,
  charge jsonb not null default '{}'::jsonb,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'en_cours', 'termine', 'echoue')),
  essais integer not null default 0,
  essais_max integer not null default 5,
  disponible_a timestamptz not null default now(),
  verrouille_a timestamptz,
  verrouille_par text,
  erreur text,
  cle_idempotence text unique,
  termine_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.jobs is 'File de travail. pg_cron insère, le worker exécute.';

create index if not exists jobs_a_reclamer_idx
  on public.jobs (disponible_a, id)
  where statut = 'en_attente';

create index if not exists jobs_en_cours_idx
  on public.jobs (verrouille_a)
  where statut = 'en_cours';

drop trigger if exists jobs_modifie_le on public.jobs;
create trigger jobs_modifie_le
  before update on public.jobs
  for each row execute function public.definir_modifie_le();

-- tentatives ----------------------------------------------------------------

create table if not exists public.tentatives (
  id uuid primary key,
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  type text not null check (type in ('diagnostic', 'etape', 'arene', 'duel')),
  etape_id uuid,
  enregistre_le timestamptz not null,
  fuseau_horaire text not null,
  decalage_minutes integer not null,
  duree_s numeric(6, 2),
  chemin_audio text,
  statut text not null check (statut in (
    'envoyee', 'en_transcription', 'en_mesure', 'en_evaluation',
    'audio_supprime', 'retour_disponible', 'echec_technique', 'abandon_technique'
  )),
  resultat text check (resultat in ('etape_validee', 'etape_echouee')),
  essais_techniques integer not null default 0,
  derniere_erreur text,
  audio_supprime_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.tentatives is 'Un enregistrement envoyé pour analyse. Id généré sur le téléphone.';
comment on column public.tentatives.chemin_audio is 'Chemin dans le bucket audio-tentatives: {utilisateur_id}/{id}.m4a, null une fois supprimé.';

create index if not exists tentatives_utilisateur_idx
  on public.tentatives (utilisateur_id, enregistre_le desc);

drop trigger if exists tentatives_modifie_le on public.tentatives;
create trigger tentatives_modifie_le
  before update on public.tentatives
  for each row execute function public.definir_modifie_le();

-- Date plausibility is checked on insert only (a CHECK constraint with now()
-- would also fire on later status updates by the worker).
create or replace function public.verifier_tentative_avant_insertion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.enregistre_le > now() + interval '5 minutes' then
    raise exception 'tentatives.enregistre_le is in the future'
      using errcode = '23514';
  end if;
  if new.enregistre_le < now() - interval '8 days' then
    raise exception 'tentatives.enregistre_le is older than 8 days'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tentatives_verifier_avant_insertion on public.tentatives;
create trigger tentatives_verifier_avant_insertion
  before insert on public.tentatives
  for each row execute function public.verifier_tentative_avant_insertion();

-- Every new tentative queues one analyser_tentative job. Security definer
-- because clients have no rights on jobs.
create or replace function public.creer_job_analyse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.jobs (type, charge, cle_idempotence)
  values (
    'analyser_tentative',
    jsonb_build_object('tentative_id', new.id),
    'analyser:' || new.id::text
  )
  on conflict (cle_idempotence) do nothing;
  return new;
end;
$$;

drop trigger if exists tentatives_creer_job_analyse on public.tentatives;
create trigger tentatives_creer_job_analyse
  after insert on public.tentatives
  for each row execute function public.creer_job_analyse();

-- analyses ------------------------------------------------------------------

create table if not exists public.analyses (
  tentative_id uuid primary key references public.tentatives (id) on delete cascade,
  version_schema integer not null default 1,
  mesures jsonb not null,
  transcription jsonb not null,
  fournisseur_transcription text not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.analyses is 'Mesures et transcription, la seule chose conservée de la voix.';

drop trigger if exists analyses_modifie_le on public.analyses;
create trigger analyses_modifie_le
  before update on public.analyses
  for each row execute function public.definir_modifie_le();

-- grilles and criteres_grille ------------------------------------------------

create table if not exists public.grilles (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  publiee_le timestamptz,
  notes text,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.grilles is 'Grille de Rebecca, versionnée. Vide tant qu''elle ne l''a pas fournie.';

drop trigger if exists grilles_modifie_le on public.grilles;
create trigger grilles_modifie_le
  before update on public.grilles
  for each row execute function public.definir_modifie_le();

create table if not exists public.criteres_grille (
  id uuid primary key default gen_random_uuid(),
  grille_id uuid not null references public.grilles (id) on delete cascade,
  cle text not null,
  nom text not null,
  definition text not null,
  regle jsonb not null check (jsonb_typeof(regle) = 'object'),
  ordre integer not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (grille_id, cle)
);

comment on column public.criteres_grille.regle is 'Règle déclarative v1: { version, score_max, elements: [{ mesure, bandes, poids }] }.';

drop trigger if exists criteres_grille_modifie_le on public.criteres_grille;
create trigger criteres_grille_modifie_le
  before update on public.criteres_grille
  for each row execute function public.definir_modifie_le();

-- evaluations ---------------------------------------------------------------

create table if not exists public.evaluations (
  tentative_id uuid primary key references public.tentatives (id) on delete cascade,
  grille_id uuid references public.grilles (id),
  version_grille integer,
  sous_notes jsonb not null default '{}'::jsonb,
  note_totale numeric(5, 2),
  seuil_reussite numeric(5, 2),
  points_forts jsonb not null default '[]'::jsonb,
  axes_travail jsonb not null default '[]'::jsonb,
  exercice_court jsonb,
  redaction jsonb,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.evaluations is 'Sous-notes et champs de retour, calculés avec la grille active. Jamais renotés.';

drop trigger if exists evaluations_modifie_le on public.evaluations;
create trigger evaluations_modifie_le
  before update on public.evaluations
  for each row execute function public.definir_modifie_le();

-- ---------------------------------------------------------------------------
-- 4. Job queue functions (service role only)
-- ---------------------------------------------------------------------------

-- Hands out at most one job. An empty or null p_types means any type.
create or replace function public.reclamer_job(p_worker text, p_types text[])
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  with candidat as (
    select j.id
    from public.jobs j
    where j.statut = 'en_attente'
      and j.disponible_a <= now()
      and (p_types is null or cardinality(p_types) = 0 or j.type = any (p_types))
    order by j.disponible_a, j.id
    limit 1
    for update skip locked
  )
  update public.jobs j
  set statut = 'en_cours',
      verrouille_a = now(),
      verrouille_par = p_worker,
      essais = j.essais + 1
  from candidat
  where j.id = candidat.id
  returning j.*;
$$;

create or replace function public.terminer_job(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs
  set statut = 'termine',
      termine_le = now()
  where id = p_id;
$$;

-- Backoff: 30 s * 2^essais. Terminal failure once essais reaches essais_max.
create or replace function public.echouer_job(p_id bigint, p_erreur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jobs
  set erreur = p_erreur,
      statut = case when essais >= essais_max then 'echoue' else 'en_attente' end,
      disponible_a = case
        when essais >= essais_max then disponible_a
        else now() + (interval '30 seconds' * power(2, essais))
      end,
      verrouille_a = null,
      verrouille_par = null
  where id = p_id;
end;
$$;

-- Returns en_cours jobs older than the timeout to the queue. Returns how many.
create or replace function public.liberer_jobs_bloques(p_timeout interval)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.jobs
  set statut = 'en_attente',
      verrouille_a = null,
      verrouille_par = null
  where statut = 'en_cours'
    and verrouille_a < now() - p_timeout;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.reclamer_job(text, text[]) from public, anon, authenticated;
revoke execute on function public.terminer_job(bigint) from public, anon, authenticated;
revoke execute on function public.echouer_job(bigint, text) from public, anon, authenticated;
revoke execute on function public.liberer_jobs_bloques(interval) from public, anon, authenticated;

grant execute on function public.reclamer_job(text, text[]) to service_role;
grant execute on function public.terminer_job(bigint) to service_role;
grant execute on function public.echouer_job(bigint, text) to service_role;
grant execute on function public.liberer_jobs_bloques(interval) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------

alter table public.profils enable row level security;
alter table public.configuration enable row level security;
alter table public.drapeaux enable row level security;
alter table public.jobs enable row level security;
alter table public.tentatives enable row level security;
alter table public.analyses enable row level security;
alter table public.grilles enable row level security;
alter table public.criteres_grille enable row level security;
alter table public.evaluations enable row level security;

-- profils: own row (select, update), admin selects all. Anonymous users included.
drop policy if exists profils_select_propre on public.profils;
create policy profils_select_propre on public.profils
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profils_select_admin on public.profils;
create policy profils_select_admin on public.profils
  for select to authenticated
  using ((select public.est_admin()));

drop policy if exists profils_update_propre on public.profils;
create policy profils_update_propre on public.profils
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- configuration: everyone signed in reads, only admin updates, no insert/delete.
drop policy if exists configuration_select on public.configuration;
create policy configuration_select on public.configuration
  for select to authenticated
  using (true);

drop policy if exists configuration_update_admin on public.configuration;
create policy configuration_update_admin on public.configuration
  for update to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- drapeaux: same as configuration.
drop policy if exists drapeaux_select on public.drapeaux;
create policy drapeaux_select on public.drapeaux
  for select to authenticated
  using (true);

drop policy if exists drapeaux_update_admin on public.drapeaux;
create policy drapeaux_update_admin on public.drapeaux
  for update to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- jobs: no client access at all. RLS with no policy, plus revoked privileges.
revoke all on table public.jobs from anon, authenticated;

-- tentatives: own rows; insert only as envoyee for oneself; anonymous users
-- only insert diagnostic; no client update or delete.
drop policy if exists tentatives_select_propre on public.tentatives;
create policy tentatives_select_propre on public.tentatives
  for select to authenticated
  using (utilisateur_id = (select auth.uid()));

drop policy if exists tentatives_insert_propre on public.tentatives;
create policy tentatives_insert_propre on public.tentatives
  for insert to authenticated
  with check (
    utilisateur_id = (select auth.uid())
    and statut = 'envoyee'
    and (type = 'diagnostic' or not (select public.est_anonyme()))
  );

-- analyses: own rows, read only. Service role writes.
drop policy if exists analyses_select_propre on public.analyses;
create policy analyses_select_propre on public.analyses
  for select to authenticated
  using (
    exists (
      select 1 from public.tentatives t
      where t.id = analyses.tentative_id
        and t.utilisateur_id = (select auth.uid())
    )
  );

-- evaluations: own rows, read only. Service role writes.
drop policy if exists evaluations_select_propre on public.evaluations;
create policy evaluations_select_propre on public.evaluations
  for select to authenticated
  using (
    exists (
      select 1 from public.tentatives t
      where t.id = evaluations.tentative_id
        and t.utilisateur_id = (select auth.uid())
    )
  );

-- grilles: non-anonymous users read published grids, admin reads and writes all.
drop policy if exists grilles_select on public.grilles;
create policy grilles_select on public.grilles
  for select to authenticated
  using (
    (select public.est_admin())
    or (publiee_le is not null and not (select public.est_anonyme()))
  );

drop policy if exists grilles_insert_admin on public.grilles;
create policy grilles_insert_admin on public.grilles
  for insert to authenticated
  with check ((select public.est_admin()));

drop policy if exists grilles_update_admin on public.grilles;
create policy grilles_update_admin on public.grilles
  for update to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

drop policy if exists grilles_delete_admin on public.grilles;
create policy grilles_delete_admin on public.grilles
  for delete to authenticated
  using ((select public.est_admin()));

-- criteres_grille: same rule, through the owning grid.
drop policy if exists criteres_grille_select on public.criteres_grille;
create policy criteres_grille_select on public.criteres_grille
  for select to authenticated
  using (
    (select public.est_admin())
    or (
      not (select public.est_anonyme())
      and exists (
        select 1 from public.grilles g
        where g.id = criteres_grille.grille_id
          and g.publiee_le is not null
      )
    )
  );

drop policy if exists criteres_grille_insert_admin on public.criteres_grille;
create policy criteres_grille_insert_admin on public.criteres_grille
  for insert to authenticated
  with check ((select public.est_admin()));

drop policy if exists criteres_grille_update_admin on public.criteres_grille;
create policy criteres_grille_update_admin on public.criteres_grille
  for update to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

drop policy if exists criteres_grille_delete_admin on public.criteres_grille;
create policy criteres_grille_delete_admin on public.criteres_grille
  for delete to authenticated
  using ((select public.est_admin()));

-- ---------------------------------------------------------------------------
-- 6. Access token hook
-- ---------------------------------------------------------------------------
-- Copies profils.role into claims.app_metadata.role. Security invoker, as the
-- Supabase docs recommend, so supabase_auth_admin needs select on profils and
-- a policy of its own. Register it in Authentication > Hooks on the hosted
-- project (config.toml covers the local stack).

create or replace function public.hook_jeton_acces(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb;
  v_role text;
begin
  select p.role into v_role
  from public.profils p
  where p.id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if jsonb_typeof(claims -> 'app_metadata') is distinct from 'object' then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(coalesce(v_role, 'utilisateur')));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_jeton_acces(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_jeton_acces(jsonb) from public, anon, authenticated;

grant select on table public.profils to supabase_auth_admin;

drop policy if exists profils_select_auth_admin on public.profils;
create policy profils_select_auth_admin on public.profils
  for select to supabase_auth_admin
  using (true);

-- ---------------------------------------------------------------------------
-- 7. Storage
-- ---------------------------------------------------------------------------

-- audio-tentatives: private. 20 MiB is far above a 90 s take at 16 kHz AAC and
-- still bounds an 8 minute debate turn; adjust if the capture spike says so.
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio-tentatives', 'audio-tentatives', false, 20971520)
on conflict (id) do nothing;

-- audio-public: private, served by signed URL. Used from Phase 7 (Arena and
-- duels). No client policy at all for now, the service role does everything.
insert into storage.buckets (id, name, public)
values ('audio-public', 'audio-public', false)
on conflict (id) do nothing;

-- Signed-in users (anonymous included, the diagnostic needs it) may only create
-- objects at {auth.uid()}/{uuid}.m4a. No client select, update or delete.
drop policy if exists audio_tentatives_insert_propre on storage.objects;
create policy audio_tentatives_insert_propre on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audio-tentatives'
    and name ~ (
      '^' || (select auth.uid())::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.m4a$'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. pg_cron schedules (only when pg_cron is installed)
-- ---------------------------------------------------------------------------
-- pg_cron only inserts jobs; the worker executes them. cron.schedule with a
-- name replaces an existing schedule of the same name, so this is idempotent.

do $leq$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'leq_balayer_audio',
      '*/30 * * * *',
      $job$
        insert into public.jobs (type, charge, cle_idempotence)
        values ('balayer_audio', '{}'::jsonb, 'balayer:' || date_trunc('hour', now())::text)
        on conflict (cle_idempotence) do nothing
      $job$
    );

    perform cron.schedule(
      'leq_purger_anonymes',
      '0 * * * *',
      $job$
        insert into public.jobs (type, charge, cle_idempotence)
        values ('purger_anonymes', '{}'::jsonb, 'purger:' || date_trunc('hour', now())::text)
        on conflict (cle_idempotence) do nothing
      $job$
    );

    perform cron.schedule(
      'leq_liberer_jobs_bloques',
      '*/5 * * * *',
      $job$ select public.liberer_jobs_bloques(interval '15 minutes') $job$
    );
  else
    raise notice 'pg_cron absent: leq_balayer_audio, leq_purger_anonymes and leq_liberer_jobs_bloques were not scheduled';
  end if;
end
$leq$;
