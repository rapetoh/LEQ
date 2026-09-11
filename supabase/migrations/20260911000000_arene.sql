-- LEQ, migration "arene" (Phase 7). The Arena and duels of cahier chapter 11, shipped off:
-- nothing here is visible in the app until the `arene` and `duels` flags are turned on.
--
-- The rules that live in the database, not in the interface:
--   - one subject at a time, seven days, derived from the activation dates;
--   - nothing becomes public without a deliberate gesture (publier_prise);
--   - until you have spoken on the subject, the others' takes stay hidden;
--   - voting is by pairs, anonymous, never your own take, never the same pair twice;
--   - the verdict of a duel is rendered by the analysis, on Rebecca's grid, and says so.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.sujets_arene (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  texte text not null,
  consigne text,
  ordre integer not null,
  duree_max_s integer not null default 90 check (duree_max_s > 0),
  actif_le timestamptz,
  ferme_le timestamptz,
  provisoire boolean not null default true,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (ferme_le is null or actif_le is not null)
);
comment on table public.sujets_arene is 'Banque des sujets de l''Arène. Un seul actif à la fois, sept jours, par actif_le et ferme_le.';
create unique index if not exists sujets_arene_ordre_idx on public.sujets_arene (ordre);
drop trigger if exists sujets_arene_modifie_le on public.sujets_arene;
create trigger sujets_arene_modifie_le before update on public.sujets_arene
  for each row execute function public.definir_modifie_le();

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  inviteur_id uuid not null references public.profils (id) on delete cascade,
  invite_id uuid references public.profils (id) on delete set null,
  sujet text not null,
  jeton text not null unique,
  duree_max_s integer not null check (duree_max_s > 0),
  statut text not null default 'ouvert' check (statut in ('ouvert', 'clos', 'expire')),
  verdict text check (verdict in ('inviteur', 'invite', 'egalite')),
  echeance timestamptz not null,
  clos_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.duels is 'Duel privé : deux personnes, un sujet, 48 h. Le lien d''invitation marche sans l''application.';
create index if not exists duels_inviteur_idx on public.duels (inviteur_id, cree_le desc);
create index if not exists duels_invite_idx on public.duels (invite_id, cree_le desc);
drop trigger if exists duels_modifie_le on public.duels;
create trigger duels_modifie_le before update on public.duels
  for each row execute function public.definir_modifie_le();

create table if not exists public.prises_publiques (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  tentative_id uuid not null unique references public.tentatives (id) on delete cascade,
  contexte text not null check (contexte in ('arene', 'duel')),
  sujet_id uuid references public.sujets_arene (id) on delete cascade,
  duel_id uuid references public.duels (id) on delete cascade,
  chemin_audio text,
  statut text not null default 'en_moderation'
    check (statut in ('en_moderation', 'publiee', 'retiree')),
  motif_retrait text,
  votes_recus integer not null default 0,
  date_suppression timestamptz,
  audio_supprime_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (
    (contexte = 'arene' and sujet_id is not null and duel_id is null)
    or (contexte = 'duel' and duel_id is not null and sujet_id is null)
  )
);
comment on table public.prises_publiques is 'Une prise rendue publique par un geste délibéré. L''audio vit le temps du concours, puis date_suppression.';
create index if not exists prises_publiques_sujet_idx on public.prises_publiques (sujet_id, statut);
create index if not exists prises_publiques_duel_idx on public.prises_publiques (duel_id);
create unique index if not exists prises_publiques_une_par_duel_idx
  on public.prises_publiques (duel_id, utilisateur_id) where duel_id is not null;
drop trigger if exists prises_publiques_modifie_le on public.prises_publiques;
create trigger prises_publiques_modifie_le before update on public.prises_publiques
  for each row execute function public.definir_modifie_le();

create table if not exists public.impressions (
  id uuid primary key default gen_random_uuid(),
  votant_id uuid not null references public.profils (id) on delete cascade,
  prise_id uuid not null references public.prises_publiques (id) on delete cascade,
  cree_le timestamptz not null default now(),
  unique (votant_id, prise_id)
);
comment on table public.impressions is 'Prises déjà montrées à un votant : sert à équilibrer les paires.';

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  votant_id uuid not null references public.profils (id) on delete cascade,
  sujet_id uuid not null references public.sujets_arene (id) on delete cascade,
  gagnante_id uuid not null references public.prises_publiques (id) on delete cascade,
  perdante_id uuid not null references public.prises_publiques (id) on delete cascade,
  paire text not null,
  cree_le timestamptz not null default now(),
  unique (votant_id, paire),
  check (gagnante_id <> perdante_id)
);
comment on table public.votes is 'Vote par paires, anonyme. paire = les deux identifiants triés, pour ne voter qu''une fois sur une paire.';
create index if not exists votes_sujet_idx on public.votes (sujet_id);

create table if not exists public.moderations (
  id uuid primary key default gen_random_uuid(),
  prise_id uuid references public.prises_publiques (id) on delete cascade,
  decision text not null check (decision in ('publiee', 'retiree')),
  motif text,
  decide_par uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now()
);
comment on table public.moderations is 'Journal des décisions de modération (chapitre 11).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sujets_arene enable row level security;
alter table public.duels enable row level security;
alter table public.prises_publiques enable row level security;
alter table public.impressions enable row level security;
alter table public.votes enable row level security;
alter table public.moderations enable row level security;

drop policy if exists sujets_arene_select on public.sujets_arene;
create policy sujets_arene_select on public.sujets_arene for select to authenticated
  using ((actif and actif_le is not null) or (select public.est_admin()));
drop policy if exists sujets_arene_admin on public.sujets_arene;
create policy sujets_arene_admin on public.sujets_arene for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

drop policy if exists duels_select_participant on public.duels;
create policy duels_select_participant on public.duels for select to authenticated
  using (
    inviteur_id = (select auth.uid())
    or invite_id = (select auth.uid())
    or (select public.est_admin())
  );

/**
 * The rule of chapter 11: until you have spoken on the subject, the others' takes stay hidden.
 * Own takes are always visible; an admin sees everything, including what waits for moderation.
 */
create or replace function public.a_parle_sur(p_sujet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.prises_publiques p
     where p.sujet_id = p_sujet
       and p.utilisateur_id = (select auth.uid())
       and p.statut <> 'retiree');
$$;
grant execute on function public.a_parle_sur(uuid) to authenticated;

drop policy if exists prises_publiques_select on public.prises_publiques;
create policy prises_publiques_select on public.prises_publiques for select to authenticated
  using (
    utilisateur_id = (select auth.uid())
    or (select public.est_admin())
    or (
      statut = 'publiee'
      and (
        (contexte = 'arene' and public.a_parle_sur(sujet_id))
        or (
          contexte = 'duel'
          and exists (
            select 1 from public.duels d
             where d.id = duel_id
               and (d.inviteur_id = (select auth.uid()) or d.invite_id = (select auth.uid()))
               and d.statut = 'clos')
        )
      )
    )
  );
drop policy if exists prises_publiques_admin on public.prises_publiques;
create policy prises_publiques_admin on public.prises_publiques for update to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

drop policy if exists impressions_select_propre on public.impressions;
create policy impressions_select_propre on public.impressions for select to authenticated
  using (votant_id = (select auth.uid()) or (select public.est_admin()));

-- Votes are anonymous: a person reads their own, an admin reads all, nobody reads who voted for whom.
drop policy if exists votes_select_propre on public.votes;
create policy votes_select_propre on public.votes for select to authenticated
  using (votant_id = (select auth.uid()) or (select public.est_admin()));

drop policy if exists moderations_select_admin on public.moderations;
create policy moderations_select_admin on public.moderations for select to authenticated
  using ((select public.est_admin()));
drop policy if exists moderations_admin on public.moderations;
create policy moderations_admin on public.moderations for insert to authenticated
  with check ((select public.est_admin()));

-- ---------------------------------------------------------------------------
-- The active subject, derived from the dates (plan, decision 9)
-- ---------------------------------------------------------------------------

create or replace function public.sujet_arene_actif()
returns public.sujets_arene
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.sujets_arene
   where actif and actif_le is not null and actif_le <= now()
     and (ferme_le is null or ferme_le > now())
   order by actif_le desc
   limit 1;
$$;
grant execute on function public.sujet_arene_actif() to authenticated;

/**
 * Closes the current subject and activates the next one of the bank. Called by the weekly job,
 * never by a client. An empty bank is a handled state: nothing is activated and the Arena shows
 * its "no subject" screen.
 */
create or replace function public.roter_sujet_arene()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jours integer;
  v_courant public.sujets_arene;
  v_suivant public.sujets_arene;
begin
  select coalesce((valeur #>> '{}')::integer, 7) into v_jours
    from public.configuration where cle = 'duree_sujet_arene_jours';
  v_jours := coalesce(v_jours, 7);

  select * into v_courant from public.sujet_arene_actif();
  if v_courant.id is not null then
    if v_courant.actif_le + make_interval(days => v_jours) > now() then
      return v_courant.id;  -- the week is not over
    end if;
    update public.sujets_arene set ferme_le = now() where id = v_courant.id;
    -- The audio of the closed week goes; the ranking stays (chapter 2).
    update public.prises_publiques
       set date_suppression = now()
     where sujet_id = v_courant.id and date_suppression is null;
  end if;

  select * into v_suivant from public.sujets_arene
   where actif and actif_le is null
   order by ordre
   limit 1;
  if v_suivant.id is null then
    return null;
  end if;
  update public.sujets_arene set actif_le = now() where id = v_suivant.id;
  return v_suivant.id;
end;
$$;
revoke execute on function public.roter_sujet_arene() from public, anon, authenticated;
grant execute on function public.roter_sujet_arene() to service_role;

-- ---------------------------------------------------------------------------
-- Publishing a take: the deliberate gesture of chapter 11
-- ---------------------------------------------------------------------------

create or replace function public.publier_prise(p_tentative_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_t record;
  v_sujet public.sujets_arene;
  v_duel record;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_anonyme()) then raise exception 'compte_requis' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;

  select * into v_t from public.tentatives where id = p_tentative_id and utilisateur_id = v_uid;
  if v_t.id is null then raise exception 'tentative_introuvable' using errcode = 'P0002'; end if;
  if v_t.type not in ('arene', 'duel') then
    raise exception 'type_incompatible' using errcode = '23514';
  end if;
  if v_t.statut <> 'retour_disponible' then
    raise exception 'analyse_incomplete' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prises_publiques where tentative_id = p_tentative_id) then
    return (select id from public.prises_publiques where tentative_id = p_tentative_id);
  end if;

  if v_t.type = 'arene' then
    select * into v_sujet from public.sujet_arene_actif();
    if v_sujet.id is null then raise exception 'aucun_sujet' using errcode = 'P0001'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, sujet_id, chemin_audio)
    values (v_uid, p_tentative_id, 'arene', v_sujet.id, v_t.chemin_audio)
    returning id into v_id;
  else
    select * into v_duel from public.duels
     where id = v_t.duel_id and statut = 'ouvert'
       and (inviteur_id = v_uid or invite_id = v_uid);
    if v_duel.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, duel_id, chemin_audio)
    values (v_uid, p_tentative_id, 'duel', v_duel.id, v_t.chemin_audio)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.publier_prise(uuid) from public, anon;
grant execute on function public.publier_prise(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Voting by pairs
-- ---------------------------------------------------------------------------

/** The pair key: the two identifiers sorted, so a pair is voted at most once. */
create or replace function public.cle_paire(p_a uuid, p_b uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_a < p_b then p_a::text || ':' || p_b::text else p_b::text || ':' || p_a::text end;
$$;

/**
 * Two takes to compare on the active subject: never the caller's own, only published ones,
 * never a pair already voted, and the least shown first (balanced sampling through impressions).
 * Answers null when the caller has not spoken yet or there is nothing left to compare.
 */
create or replace function public.paire_a_voter()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sujet public.sujets_arene;
  v_a record;
  v_b record;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_sujet from public.sujet_arene_actif();
  if v_sujet.id is null then
    return jsonb_build_object('raison', 'aucun_sujet');
  end if;
  if not public.a_parle_sur(v_sujet.id) then
    return jsonb_build_object('raison', 'parle_d_abord');
  end if;

  -- The least shown take, then the least shown one that makes an unvoted pair with it.
  select p.id, p.utilisateur_id,
         (select count(*) from public.impressions i where i.prise_id = p.id and i.votant_id = v_uid) as vues
    into v_a
    from public.prises_publiques p
   where p.sujet_id = v_sujet.id and p.statut = 'publiee' and p.utilisateur_id <> v_uid
   order by vues, p.votes_recus, random()
   limit 1;
  if v_a.id is null then
    return jsonb_build_object('raison', 'rien_a_comparer');
  end if;

  select p.id
    into v_b
    from public.prises_publiques p
   where p.sujet_id = v_sujet.id and p.statut = 'publiee' and p.utilisateur_id <> v_uid
     and p.id <> v_a.id
     and not exists (
       select 1 from public.votes v
        where v.votant_id = v_uid and v.paire = public.cle_paire(v_a.id, p.id))
   order by (select count(*) from public.impressions i where i.prise_id = p.id and i.votant_id = v_uid),
            p.votes_recus, random()
   limit 1;
  if v_b.id is null then
    return jsonb_build_object('raison', 'rien_a_comparer');
  end if;

  insert into public.impressions (votant_id, prise_id) values (v_uid, v_a.id), (v_uid, v_b.id)
  on conflict (votant_id, prise_id) do nothing;

  return jsonb_build_object(
    'raison', 'ok',
    'sujet', jsonb_build_object('id', v_sujet.id, 'texte', v_sujet.texte, 'consigne', v_sujet.consigne),
    'a', jsonb_build_object('id', v_a.id),
    'b', jsonb_build_object('id', v_b.id));
end;
$$;
revoke execute on function public.paire_a_voter() from public, anon;
grant execute on function public.paire_a_voter() to authenticated;

create or replace function public.voter(p_gagnante uuid, p_perdante uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_g record;
  v_p record;
  v_points integer;
  v_vote uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_gagnante = p_perdante then raise exception 'paire_invalide' using errcode = '23514'; end if;
  select * into v_g from public.prises_publiques where id = p_gagnante and statut = 'publiee';
  select * into v_p from public.prises_publiques where id = p_perdante and statut = 'publiee';
  if v_g.id is null or v_p.id is null then raise exception 'prise_introuvable' using errcode = 'P0002'; end if;
  if v_g.sujet_id is null or v_g.sujet_id <> v_p.sujet_id then
    raise exception 'paire_invalide' using errcode = '23514';
  end if;
  if v_g.utilisateur_id = v_uid or v_p.utilisateur_id = v_uid then
    raise exception 'vote_sur_soi' using errcode = '42501';
  end if;
  if not public.a_parle_sur(v_g.sujet_id) then
    raise exception 'parle_d_abord' using errcode = '42501';
  end if;

  insert into public.votes (votant_id, sujet_id, gagnante_id, perdante_id, paire)
  values (v_uid, v_g.sujet_id, p_gagnante, p_perdante, public.cle_paire(p_gagnante, p_perdante))
  on conflict (votant_id, paire) do nothing
  returning id into v_vote;
  if v_vote is null then
    raise exception 'deja_vote' using errcode = 'P0001';
  end if;

  update public.prises_publiques set votes_recus = votes_recus + 1 where id = p_gagnante;
  select coalesce((valeur #>> '{}')::integer, 5) into v_points
    from public.configuration where cle = 'points_par_vote';
  insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
  values (v_uid, coalesce(v_points, 5), 'vote', v_vote::text)
  on conflict (motif, reference) do nothing;
end;
$$;
revoke execute on function public.voter(uuid, uuid) from public, anon;
grant execute on function public.voter(uuid, uuid) to authenticated;

/** The ranking of a subject: by votes received. Names only for those who opted in (G3). */
create or replace function public.classement_arene(p_sujet uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sujet uuid := p_sujet;
  v_lignes jsonb;
begin
  if v_sujet is null then
    select id into v_sujet from public.sujet_arene_actif();
  end if;
  if v_sujet is null then return jsonb_build_object('sujet_id', null, 'classement', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(ligne order by (ligne ->> 'rang')::int), '[]'::jsonb) into v_lignes
    from (
      select jsonb_build_object(
               'rang', row_number() over (order by p.votes_recus desc, p.cree_le),
               'prise_id', p.id,
               'votes', p.votes_recus,
               'moi', p.utilisateur_id = (select auth.uid()),
               'nom', case when pr.publier_sous_prenom and pr.prenom is not null then pr.prenom
                           else 'Voix ' || row_number() over (order by p.votes_recus desc, p.cree_le) end
             ) as ligne
        from public.prises_publiques p
        join public.profils pr on pr.id = p.utilisateur_id
       where p.sujet_id = v_sujet and p.statut = 'publiee'
    ) lignes;
  return jsonb_build_object('sujet_id', v_sujet, 'classement', v_lignes);
end;
$$;
revoke execute on function public.classement_arene(uuid) from public, anon;
grant execute on function public.classement_arene(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Duels
-- ---------------------------------------------------------------------------

-- An attempt of type `duel` belongs to a duel; an attempt of type `arene` is attached to the
-- active subject when it is published.
alter table public.tentatives
  add column if not exists duel_id uuid references public.duels (id) on delete set null;
create index if not exists tentatives_duel_idx on public.tentatives (duel_id) where duel_id is not null;

/** 32 hexadecimal characters: the invitation link works without the app (apps/web). */
create or replace function public.jeton_duel()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;

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

/**
 * Joining by the invitation token. The invitee never hears the inviter before recording, so this
 * answers the subject and the deadline, nothing else.
 */
create or replace function public.lire_duel_par_jeton(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_d public.duels;
begin
  select * into v_d from public.duels where jeton = p_jeton;
  if v_d.id is null then return jsonb_build_object('raison', 'introuvable'); end if;
  return jsonb_build_object(
    'raison', 'ok',
    'id', v_d.id,
    'sujet', v_d.sujet,
    'statut', v_d.statut,
    'duree_max_s', v_d.duree_max_s,
    'echeance', v_d.echeance,
    'deja_repondu', v_d.invite_id is not null);
end;
$$;
grant execute on function public.lire_duel_par_jeton(text) to anon, authenticated;

create or replace function public.rejoindre_duel(p_jeton text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_d public.duels;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_d from public.duels where jeton = p_jeton for update;
  if v_d.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'ouvert' then raise exception 'duel_clos' using errcode = 'P0001'; end if;
  if v_d.echeance <= now() then raise exception 'duel_expire' using errcode = 'P0001'; end if;
  if v_d.inviteur_id = v_uid then raise exception 'duel_sur_soi' using errcode = '42501'; end if;
  if v_d.invite_id is not null and v_d.invite_id <> v_uid then
    raise exception 'duel_complet' using errcode = 'P0001';
  end if;
  update public.duels set invite_id = v_uid where id = v_d.id;
  return v_d.id;
end;
$$;
revoke execute on function public.rejoindre_duel(text) from public, anon;
grant execute on function public.rejoindre_duel(text) to authenticated;

/**
 * Closes a duel. With two takes the verdict is the grid's total, said to be automatic by the app;
 * with one take only it expires without verdict and the inviter is told (cahier chapter 11).
 * Service role only: the worker calls it at the deadline or when both have spoken.
 */
create or replace function public.cloturer_duel(p_duel uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.duels;
  v_inviteur numeric;
  v_invite numeric;
  v_verdict text;
begin
  select * into v_d from public.duels where id = p_duel for update;
  if v_d.id is null or v_d.statut <> 'ouvert' then return null; end if;

  select e.note_totale into v_inviteur
    from public.prises_publiques p
    join public.evaluations e on e.tentative_id = p.tentative_id
   where p.duel_id = v_d.id and p.utilisateur_id = v_d.inviteur_id;
  select e.note_totale into v_invite
    from public.prises_publiques p
    join public.evaluations e on e.tentative_id = p.tentative_id
   where p.duel_id = v_d.id and p.utilisateur_id = v_d.invite_id;

  if v_inviteur is null or v_invite is null then
    if v_d.echeance > now() then return null; end if;  -- still time to answer
    update public.duels set statut = 'expire', clos_le = now() where id = v_d.id;
    update public.prises_publiques set date_suppression = now()
     where duel_id = v_d.id and date_suppression is null;
    return 'expire';
  end if;

  v_verdict := case
    when v_inviteur > v_invite then 'inviteur'
    when v_invite > v_inviteur then 'invite'
    else 'egalite' end;
  update public.duels set statut = 'clos', verdict = v_verdict, clos_le = now() where id = v_d.id;
  -- The audio of a duel lives the time of the contest, then goes (chapter 2).
  update public.prises_publiques set date_suppression = now()
   where duel_id = v_d.id and date_suppression is null;
  return v_verdict;
end;
$$;
revoke execute on function public.cloturer_duel(uuid) from public, anon, authenticated;
grant execute on function public.cloturer_duel(uuid) to service_role;

/** Moderation (chapter 11): the admin publishes or withdraws a public take, with a reason. */
create or replace function public.moderer_prise(p_prise uuid, p_decision text, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_decision not in ('publiee', 'retiree') then
    raise exception 'decision inconnue' using errcode = '23514';
  end if;
  update public.prises_publiques
     set statut = p_decision,
         motif_retrait = case when p_decision = 'retiree' then p_motif else null end,
         date_suppression = case when p_decision = 'retiree' then now() else date_suppression end
   where id = p_prise;
  if not found then raise exception 'prise introuvable' using errcode = 'P0002'; end if;
  insert into public.moderations (prise_id, decision, motif, decide_par)
  values (p_prise, p_decision, p_motif, (select auth.uid()));
end;
$$;
revoke execute on function public.moderer_prise(uuid, text, text) from public, anon;
grant execute on function public.moderer_prise(uuid, text, text) to authenticated;
