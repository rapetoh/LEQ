-- LEQ, migration "socle phase 1".
-- Implements the "Phase 1 additions" section of docs/DATA-MODEL.md, name for name.

-- ---------------------------------------------------------------------------
-- profils: notification switches, reminder time, deletion request
-- ---------------------------------------------------------------------------

alter table public.profils
  add column if not exists notif_rappel boolean not null default true,
  add column if not exists notif_serie boolean not null default true,
  add column if not exists notif_social boolean not null default true,
  add column if not exists notif_annonces boolean not null default true,
  add column if not exists heure_rappel time not null default '21:30',
  add column if not exists suppression_demandee_le timestamptz;

comment on column public.profils.heure_rappel is 'Heure locale du rappel quotidien (notification locale).';
comment on column public.profils.suppression_demandee_le is 'Posé par demander_suppression_compte(); le worker supprime ensuite le compte.';

-- suppression_demandee_le joins role and suspendu_le under the protection trigger.
create or replace function public.proteger_colonnes_profil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role
      or new.suspendu_le is distinct from old.suspendu_le
      or new.suppression_demandee_le is distinct from old.suppression_demandee_le)
     and coalesce((select auth.role()), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'profils.role, profils.suspendu_le and profils.suppression_demandee_le can only be changed by a privileged connection'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- reponses_accueil
-- ---------------------------------------------------------------------------

create table if not exists public.reponses_accueil (
  utilisateur_id uuid primary key references public.profils (id) on delete cascade,
  contexte text not null check (contexte in ('travail', 'etudes', 'public', 'quotidien')),
  blocage text not null check (blocage in ('trac', 'mots', 'regard', 'notes')),
  objectif text not null check (objectif in ('stress', 'clarte', 'rythme', 'presence')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.reponses_accueil is 'Les trois réponses de l''accueil : contexte, blocage, objectif. Codes fixes, libellés dans l''application.';

drop trigger if exists reponses_accueil_modifie_le on public.reponses_accueil;
create trigger reponses_accueil_modifie_le
  before update on public.reponses_accueil
  for each row execute function public.definir_modifie_le();

alter table public.reponses_accueil enable row level security;

drop policy if exists reponses_accueil_select_propre on public.reponses_accueil;
create policy reponses_accueil_select_propre on public.reponses_accueil
  for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists reponses_accueil_insert_propre on public.reponses_accueil;
create policy reponses_accueil_insert_propre on public.reponses_accueil
  for insert to authenticated
  with check (utilisateur_id = (select auth.uid()));

drop policy if exists reponses_accueil_update_propre on public.reponses_accueil;
create policy reponses_accueil_update_propre on public.reponses_accueil
  for update to authenticated
  using (utilisateur_id = (select auth.uid()))
  with check (utilisateur_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- jetons_push
-- ---------------------------------------------------------------------------

create table if not exists public.jetons_push (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  jeton text not null unique,
  plateforme text not null check (plateforme in ('ios', 'android')),
  derniere_erreur text,
  desactive_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.jetons_push is 'Jetons Expo push, un par appareil. desactive_le posé par le worker quand Expo répond DeviceNotRegistered.';

create index if not exists jetons_push_utilisateur_idx on public.jetons_push (utilisateur_id);

drop trigger if exists jetons_push_modifie_le on public.jetons_push;
create trigger jetons_push_modifie_le
  before update on public.jetons_push
  for each row execute function public.definir_modifie_le();

alter table public.jetons_push enable row level security;

drop policy if exists jetons_push_select_propre on public.jetons_push;
create policy jetons_push_select_propre on public.jetons_push
  for select to authenticated
  using (utilisateur_id = (select auth.uid()));

drop policy if exists jetons_push_insert_propre on public.jetons_push;
create policy jetons_push_insert_propre on public.jetons_push
  for insert to authenticated
  with check (utilisateur_id = (select auth.uid()));

drop policy if exists jetons_push_update_propre on public.jetons_push;
create policy jetons_push_update_propre on public.jetons_push
  for update to authenticated
  using (utilisateur_id = (select auth.uid()))
  with check (utilisateur_id = (select auth.uid()));

drop policy if exists jetons_push_delete_propre on public.jetons_push;
create policy jetons_push_delete_propre on public.jetons_push
  for delete to authenticated
  using (utilisateur_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- demander_suppression_compte()
-- ---------------------------------------------------------------------------

create or replace function public.demander_suppression_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profils
    set suppression_demandee_le = coalesce(suppression_demandee_le, now())
    where id = v_uid;
  insert into public.jobs (type, charge, cle_idempotence)
  values ('supprimer_compte', jsonb_build_object('utilisateur_id', v_uid), 'supprimer:' || v_uid::text)
  on conflict (cle_idempotence) do nothing;
end;
$$;

revoke execute on function public.demander_suppression_compte() from public, anon;
grant execute on function public.demander_suppression_compte() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime: the phone follows its own tentatives (RLS applies)
-- ---------------------------------------------------------------------------

do $leq$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tentatives'
     ) then
    alter publication supabase_realtime add table public.tentatives;
  end if;
end
$leq$;
