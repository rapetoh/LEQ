-- ---------------------------------------------------------------------------------------------
-- Les formules deviennent des lignes.
--
-- Deux formules étaient écrites dans une contrainte et leurs droits dans des clés de
-- configuration nommées une par formule : `etapes_par_jour_gratuit`, `quota_face_a_face_complet`.
-- Ajouter une troisième formule demandait une migration, du code et une livraison.
--
-- Décision du 12 septembre : le contenu des formules se règle depuis l'espace d'administration,
-- pour qu'une troisième soit un réglage et pas une version. L'accès à la communauté est une case
-- sur une formule, jamais une formule de plus.
--
-- Les prix restent dans App Store Connect et Play Console : ils ne sont pas ici et ne bloquent
-- rien.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.formules (
  cle text primary key,
  nom text not null,
  ordre integer not null,
  etapes_par_jour integer not null default 0 check (etapes_par_jour >= 0),
  debats_par_mois integer not null default 0 check (debats_par_mois >= 0),
  duree_debat_s integer not null check (duree_debat_s > 0),
  acces_communaute boolean not null default false,
  produit_store text,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.formules is 'Le contenu de chaque formule, réglable par Rebecca. Les prix vivent dans les stores.';
comment on column public.formules.etapes_par_jour is 'Étapes validables par jour. 0 : sans limite.';
comment on column public.formules.debats_par_mois is 'Face-à-face par mois. 0 : la formule n''en donne aucun.';
comment on column public.formules.acces_communaute is 'Ouvre la communauté. Une case sur une formule, jamais une formule de plus.';

drop trigger if exists formules_modifie_le on public.formules;
create trigger formules_modifie_le before update on public.formules
  for each row execute function public.definir_modifie_le();

-- Seeded from the configuration values in force, so nothing changes the day this lands.
insert into public.formules (cle, nom, ordre, etapes_par_jour, debats_par_mois, duree_debat_s)
values
  ('gratuit', 'Gratuit', 1,
   coalesce((select (valeur #>> '{}')::integer from public.configuration where cle = 'etapes_par_jour_gratuit'), 1),
   coalesce((select (valeur #>> '{}')::integer from public.configuration where cle = 'quota_face_a_face_gratuit'), 0),
   coalesce((select (valeur #>> '{}')::integer from public.configuration where cle = 'duree_face_a_face_gratuit_s'), 180)),
  ('complet', 'Complet', 2,
   coalesce((select (valeur #>> '{}')::integer from public.configuration where cle = 'etapes_par_jour_complet'), 0),
   coalesce((select (valeur #>> '{}')::integer from public.configuration where cle = 'quota_face_a_face_complet'), 8),
   coalesce((select (valeur #>> '{}')::integer from public.configuration where cle = 'duree_face_a_face_complet_s'), 480))
on conflict (cle) do nothing;

alter table public.abonnements drop constraint if exists abonnements_formule_check;
alter table public.abonnements drop constraint if exists abonnements_formule_fkey;
alter table public.abonnements
  add constraint abonnements_formule_fkey foreign key (formule)
  references public.formules (cle) on update cascade;

alter table public.formules enable row level security;
drop policy if exists formules_select on public.formules;
create policy formules_select on public.formules for select to authenticated, anon using (true);
drop policy if exists formules_ecriture_admin on public.formules;
create policy formules_ecriture_admin on public.formules for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

/** The rights of a person's tier, with the defaults of the free one when there is no row. */
create or replace function public.droits_formule(p_uid uuid default null)
returns public.formules
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_uid, (select auth.uid()));
  v_f public.formules;
begin
  select * into v_f from public.formules where cle = public.formule_de(v_uid) and actif;
  if v_f.cle is null then
    select * into v_f from public.formules where cle = 'gratuit';
  end if;
  return v_f;
end;
$$;
revoke execute on function public.droits_formule(uuid) from public, anon;
grant execute on function public.droits_formule(uuid) to authenticated;
grant execute on function public.droits_formule(uuid) to service_role;
