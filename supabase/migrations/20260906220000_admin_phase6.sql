-- LEQ, migration "admin_phase6" (Phase 6). Implements the "Phase 6 additions" of
-- docs/DATA-MODEL.md: Rebecca's workshops and announcements (cahier chapter 12: a region filter
-- and a cap of two a month, both enforced here and not in the admin's interface), account
-- suspension (chapter 8), and what a suspended account can no longer do.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ateliers (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  sous_titre text,
  description text,
  lieu text not null,
  en_ligne boolean not null default false,
  region text,
  date_debut timestamptz not null,
  places integer check (places is null or places > 0),
  lien text,
  recompense_id uuid references public.recompenses (id) on delete set null,
  publie boolean not null default false,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.ateliers is 'Les ateliers de Rebecca (F1, B1b). region = code de la liste fixe ; en_ligne = concerne tout le monde. recompense_id = la récompense qui donne une place.';
drop trigger if exists ateliers_modifie_le on public.ateliers;
create trigger ateliers_modifie_le before update on public.ateliers
  for each row execute function public.definir_modifie_le();

create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  corps text not null,
  atelier_id uuid references public.ateliers (id) on delete set null,
  regions text[],
  envoyee_le timestamptz not null default now(),
  destinataires integer,
  envoyes integer not null default 0,
  echecs integer not null default 0,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now()
);
comment on table public.annonces is 'Une annonce de Rebecca, envoyée une fois par le job envoyer_annonce. regions null = tout le monde. Deux par mois au plus (configuration).';
create index if not exists annonces_envoyee_idx on public.annonces (envoyee_le desc);

create table if not exists public.suspensions (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  motif text not null,
  cree_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  levee_le timestamptz,
  levee_par uuid references public.profils (id) on delete set null
);
comment on table public.suspensions is 'Journal des suspensions de compte (chapitre 8). Une ligne par suspension, levée ou non.';
create index if not exists suspensions_utilisateur_idx on public.suspensions (utilisateur_id, cree_le desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ateliers enable row level security;
alter table public.annonces enable row level security;
alter table public.suspensions enable row level security;

drop policy if exists ateliers_select on public.ateliers;
create policy ateliers_select on public.ateliers for select to authenticated
  using (publie or (select public.est_admin()));
drop policy if exists ateliers_admin_insert on public.ateliers;
create policy ateliers_admin_insert on public.ateliers for insert to authenticated with check ((select public.est_admin()));
drop policy if exists ateliers_admin_update on public.ateliers;
create policy ateliers_admin_update on public.ateliers for update to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
drop policy if exists ateliers_admin_delete on public.ateliers;
create policy ateliers_admin_delete on public.ateliers for delete to authenticated using ((select public.est_admin()));

drop policy if exists annonces_select on public.annonces;
create policy annonces_select on public.annonces for select to authenticated using (true);

drop policy if exists suspensions_select on public.suspensions;
create policy suspensions_select on public.suspensions for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

-- ---------------------------------------------------------------------------
-- Suspension
-- ---------------------------------------------------------------------------

create or replace function public.est_suspendu()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select suspendu_le is not null from public.profils where id = (select auth.uid())), false);
$$;
grant execute on function public.est_suspendu() to authenticated;

create or replace function public.suspendre_compte(p_uid uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_motif is null or btrim(p_motif) = '' then raise exception 'motif requis' using errcode = '23514'; end if;
  select role into v_role from public.profils where id = p_uid;
  if v_role is null then raise exception 'profil introuvable' using errcode = 'P0002'; end if;
  if v_role = 'admin' then raise exception 'un compte admin ne se suspend pas ici' using errcode = '42501'; end if;
  update public.profils set suspendu_le = coalesce(suspendu_le, now()) where id = p_uid;
  insert into public.suspensions (utilisateur_id, motif, cree_par) values (p_uid, btrim(p_motif), (select auth.uid()));
end;
$$;
revoke execute on function public.suspendre_compte(uuid, text) from public, anon;
grant execute on function public.suspendre_compte(uuid, text) to authenticated;

create or replace function public.reactiver_compte(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  update public.profils set suspendu_le = null where id = p_uid;
  update public.suspensions set levee_le = now(), levee_par = (select auth.uid())
   where utilisateur_id = p_uid and levee_le is null;
end;
$$;
revoke execute on function public.reactiver_compte(uuid) from public, anon;
grant execute on function public.reactiver_compte(uuid) to authenticated;

-- A suspended account records nothing and spends nothing.
drop policy if exists tentatives_insert_propre on public.tentatives;
create policy tentatives_insert_propre on public.tentatives
  for insert to authenticated
  with check (
    utilisateur_id = (select auth.uid())
    and statut = 'envoyee'
    and (type in ('diagnostic', 'etape') or not (select public.est_anonyme()))
    and not (select public.est_suspendu())
  );

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
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
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

-- ---------------------------------------------------------------------------
-- Announcements: the cap and the filter live here (plan, decision 11)
-- ---------------------------------------------------------------------------

create or replace function public.annonces_du_mois()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.annonces a
   where date_trunc('month', public.jour_local(a.envoyee_le, 'Europe/Paris'))::date = public.mois_courant_boutique();
$$;
grant execute on function public.annonces_du_mois() to authenticated;

create or replace function public.publier_annonce(p_titre text, p_corps text, p_atelier uuid default null, p_regions text[] default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plafond integer;
  v_id uuid;
  v_regions text[] := case when p_regions is null or cardinality(p_regions) = 0 then null else p_regions end;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_titre is null or btrim(p_titre) = '' or p_corps is null or btrim(p_corps) = '' then
    raise exception 'titre et corps requis' using errcode = '23514';
  end if;
  if p_atelier is not null and not exists (select 1 from public.ateliers where id = p_atelier) then
    raise exception 'atelier introuvable' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('annonces'));
  select coalesce((valeur #>> '{}')::integer, 2) into v_plafond from public.configuration where cle = 'plafond_annonces_par_mois';
  v_plafond := coalesce(v_plafond, 2);
  if public.annonces_du_mois() >= v_plafond then
    raise exception 'plafond_annonces_atteint' using errcode = 'P0001';
  end if;
  insert into public.annonces (titre, corps, atelier_id, regions, cree_par)
  values (btrim(p_titre), btrim(p_corps), p_atelier, v_regions, (select auth.uid()))
  returning id into v_id;
  insert into public.jobs (type, charge, cle_idempotence)
  values ('envoyer_annonce', jsonb_build_object('annonce_id', v_id), 'annonce:' || v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.publier_annonce(text, text, uuid, text[]) from public, anon;
grant execute on function public.publier_annonce(text, text, uuid, text[]) to authenticated;
