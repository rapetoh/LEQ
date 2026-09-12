-- LEQ, migration "garde_fous_arene". Three gaps the review found, none of them reachable from
-- the application, all of them reachable from the API with a publishable key and an account.

-- ---------------------------------------------------------------------------
-- 1. The flags were a claim the interface made, not a rule
-- ---------------------------------------------------------------------------
-- `ouvrir_debat` checks the `face_a_face` flag. Nothing checked `arene` or `duels`, so while the
-- application hid the tabs, anyone could call `creer_duel` directly, get a token, and mail the
-- invitation to strangers who would then record takes against a feature that is not open. The
-- migration that introduced them says nothing is visible until the flags are on; now it is true
-- of the database and not only of the screens.

create or replace function public.drapeau_actif(p_cle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select actif from public.drapeaux where cle = p_cle), false);
$$;
revoke execute on function public.drapeau_actif(text) from public, anon;
grant execute on function public.drapeau_actif(text) to authenticated, service_role;

create or replace function public.creer_duel(p_sujet text)
returns public.duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_heures integer;
  v_duree integer;
  v_cle text;
  v_duel public.duels;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not public.drapeau_actif('duels') then raise exception 'duels_eteints' using errcode = 'P0001'; end if;
  if (select public.est_anonyme()) then raise exception 'compte_requis' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  if p_sujet is null or btrim(p_sujet) = '' then raise exception 'sujet_requis' using errcode = '23514'; end if;

  select coalesce((valeur #>> '{}')::integer, 48) into v_heures
    from public.configuration where cle = 'duree_duel_heures';
  v_cle := case when public.formule_de(v_uid) = 'complet'
                then 'plafond_duree_duel_complet_s' else 'plafond_duree_duel_gratuit_s' end;
  select coalesce((valeur #>> '{}')::integer, 90) into v_duree
    from public.configuration where cle = v_cle;

  insert into public.duels (inviteur_id, sujet, jeton, duree_max_s, echeance)
  values (v_uid, btrim(p_sujet), public.jeton_duel(), coalesce(v_duree, 90),
          now() + make_interval(hours => coalesce(v_heures, 48)))
  returning * into v_duel;
  return v_duel;
end;
$$;
revoke execute on function public.creer_duel(text) from public, anon;
grant execute on function public.creer_duel(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. One take per person per week
-- ---------------------------------------------------------------------------
-- A duel already had `prises_publiques_une_par_duel_idx`. The Arena had nothing, so one person
-- could publish three takes on the same subject, take three of the podium's places, and be
-- offered to a voter as two takes to compare with each other. The ranking and the pairing both
-- read as one take per person per week; now they are.

create unique index if not exists prises_publiques_une_par_semaine_idx
  on public.prises_publiques (sujet_id, utilisateur_id)
  where sujet_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Deleting a subject erased the week it belonged to
-- ---------------------------------------------------------------------------
-- Admins hold `for all` on `sujets_arene`, and `prises_publiques.sujet_id` cascaded on delete.
-- Tidying up one provisional seed subject through the API would have taken every take of that
-- week with it, and every vote, impression and moderation decision under them. `roter_sujet_arene`
-- promises the opposite in its own comment: the audio goes, the ranking stays. Restricting the
-- delete makes the promise real, and a subject can still be switched off.

alter table public.prises_publiques
  drop constraint if exists prises_publiques_sujet_id_fkey;
alter table public.prises_publiques
  add constraint prises_publiques_sujet_id_fkey
  foreign key (sujet_id) references public.sujets_arene (id) on delete restrict;
