-- LEQ, migration "demandes d'export" (Phase 1, screen G3).
-- Data export is handled by hand while volume is low (cahier chapter 2): the app files
-- a request, the admin inbox of Phase 6 lists them. Nothing is exported automatically.

create table if not exists public.demandes_export (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  email text,
  traitee_le timestamptz,
  traitee_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

comment on table public.demandes_export is 'Demandes de copie des données, traitées à la main par Rebecca (chapitre 2).';

create index if not exists demandes_export_utilisateur_idx on public.demandes_export (utilisateur_id);
create index if not exists demandes_export_a_traiter_idx on public.demandes_export (cree_le) where traitee_le is null;

drop trigger if exists demandes_export_modifie_le on public.demandes_export;
create trigger demandes_export_modifie_le
  before update on public.demandes_export
  for each row execute function public.definir_modifie_le();

alter table public.demandes_export enable row level security;

-- A person files a request for themselves and sees their own; only non-anonymous users
-- (an anonymous account has no e-mail to answer to). Admin sees and updates all.
drop policy if exists demandes_export_select on public.demandes_export;
create policy demandes_export_select on public.demandes_export
  for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists demandes_export_insert_propre on public.demandes_export;
create policy demandes_export_insert_propre on public.demandes_export
  for insert to authenticated
  with check (utilisateur_id = (select auth.uid()) and not (select public.est_anonyme()));

drop policy if exists demandes_export_update_admin on public.demandes_export;
create policy demandes_export_update_admin on public.demandes_export
  for update to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));
