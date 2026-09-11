-- LEQ, migration "face_a_face" (Phase 8). The debate against Rétor, cahier chapter 10.
--
-- Four rules of that chapter live here, not in the interface:
--   1. the theses come from a bank prepared in advance; writing your own is possible and second,
--      because most people asked to invent a debate subject freeze or pick something they cannot
--      defend, and the session is lost before it starts;
--   2. the length is capped, more generously for subscribers, and it is a setting not a constant;
--   3. an interrupted session resumes when the person comes back soon after, and it is not
--      counted against their monthly quota when the cut came from our side. Charging a quota for
--      our own outage is the shortest road to refund requests;
--   4. the debrief reads the written transcript, never the audio, which keeps chapter 2 whole:
--      no debate audio is ever stored.
--
-- The quota is a ledger, not a counter (ADR-009): one row per session, carrying its own outcome,
-- and the month is counted by replaying them.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.theses (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  texte text not null,
  /** What the opponent is asked to be on this thesis. Rebecca's word, not a mood picker. */
  ton_suggere text not null default 'ferme' check (ton_suggere in ('ferme', 'provocateur', 'academique', 'bienveillant')),
  ordre integer not null,
  actif boolean not null default true,
  provisoire boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.theses is 'Banque de thèses du face-à-face, alimentée depuis l''espace de Rebecca (chapitre 10).';
create unique index if not exists theses_ordre_idx on public.theses (ordre);
drop trigger if exists theses_modifie_le on public.theses;
create trigger theses_modifie_le before update on public.theses
  for each row execute function public.definir_modifie_le();

create table if not exists public.debats (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  these_id uuid references public.theses (id) on delete set null,
  /** The thesis as debated, copied here: editing the bank never rewrites a past debate. */
  these_texte text not null,
  origine_these text not null check (origine_these in ('banque', 'personnelle')),
  ton_adversaire text not null,
  duree_max_s integer not null check (duree_max_s > 0),
  statut text not null default 'ouverte'
    check (statut in ('ouverte', 'terminee', 'interrompue', 'abandonnee')),
  /**
   * Whether this session eats a slot of the month. Null while it runs. `interrompue_par_nous`
   * is the outcome that does not count: our fault, our cost.
   */
  issue text check (issue in ('terminee', 'interrompue_par_nous', 'abandonnee')),
  /** Kept so the cap can be enforced across a resume, not only within one connection. */
  secondes_parlees integer not null default 0 check (secondes_parlees >= 0),
  commence_le timestamptz not null default now(),
  derniere_activite_le timestamptz not null default now(),
  termine_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
comment on table public.debats is 'Une session de face-à-face. Le registre du quota mensuel : une ligne par session, avec son issue.';
comment on column public.debats.issue is 'Décompte du quota : tout sauf interrompue_par_nous consomme une session.';
create index if not exists debats_utilisateur_idx on public.debats (utilisateur_id, commence_le desc);
create index if not exists debats_ouverts_idx on public.debats (utilisateur_id, derniere_activite_le desc)
  where statut = 'ouverte';
drop trigger if exists debats_modifie_le on public.debats;
create trigger debats_modifie_le before update on public.debats
  for each row execute function public.definir_modifie_le();

/**
 * One turn, written as it happens. This is what makes a resume possible: a machine that dies
 * mid-debate loses the connection, not the debate (E3b). Text only, never audio.
 */
create table if not exists public.tours_debat (
  id uuid primary key default gen_random_uuid(),
  debat_id uuid not null references public.debats (id) on delete cascade,
  numero integer not null check (numero > 0),
  locuteur text not null check (locuteur in ('utilisateur', 'retor')),
  texte text not null,
  duree_s numeric(6, 2) check (duree_s is null or duree_s >= 0),
  cree_le timestamptz not null default now(),
  unique (debat_id, numero)
);
comment on table public.tours_debat is 'La transcription du débat, tour par tour. Le débriefing s''appuie dessus, jamais sur l''audio (chapitre 2).';
create index if not exists tours_debat_idx on public.tours_debat (debat_id, numero);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.theses enable row level security;
alter table public.debats enable row level security;
alter table public.tours_debat enable row level security;

drop policy if exists theses_select on public.theses;
create policy theses_select on public.theses for select to authenticated
  using (actif or (select public.est_admin()));
drop policy if exists theses_admin on public.theses;
create policy theses_admin on public.theses for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- A debate is between one person and Rétor. Nobody else reads it, admin included: it is not
-- public speech, it is practice.
drop policy if exists debats_select_propre on public.debats;
create policy debats_select_propre on public.debats for select to authenticated
  using (utilisateur_id = (select auth.uid()));

drop policy if exists tours_debat_select_propre on public.tours_debat;
create policy tours_debat_select_propre on public.tours_debat for select to authenticated
  using (
    exists (
      select 1 from public.debats d
       where d.id = tours_debat.debat_id and d.utilisateur_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- The quota, read by replaying the month
-- ---------------------------------------------------------------------------

/**
 * Sessions of the current month that consumed a slot, and the cap for the caller's plan.
 * A session we cut ourselves is present in the table and absent from this count.
 */
create or replace function public.quota_debats(p_uid uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_uid, (select auth.uid()));
  v_formule text;
  v_plafond integer;
  v_utilises integer;
  v_debut timestamptz;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  v_formule := public.formule_de(v_uid);
  select coalesce((valeur #>> '{}')::integer, 0) into v_plafond
    from public.configuration
   where cle = case when v_formule = 'complet' then 'quota_face_a_face_complet'
                    else 'quota_face_a_face_gratuit' end;
  v_plafond := coalesce(v_plafond, 0);

  -- The month in the person's own zone, the one their profile records.
  v_debut := date_trunc('month', now() at time zone coalesce(
    (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));

  select count(*) into v_utilises
    from public.debats
   where utilisateur_id = v_uid
     and commence_le >= v_debut
     and issue is distinct from 'interrompue_par_nous'
     and issue is not null;

  return jsonb_build_object(
    'formule', v_formule,
    'plafond', v_plafond,
    'utilises', v_utilises,
    'restants', greatest(v_plafond - v_utilises, 0));
end;
$$;
revoke execute on function public.quota_debats(uuid) from public, anon;
grant execute on function public.quota_debats(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Opening, resuming, closing
-- ---------------------------------------------------------------------------

/** The theses offered first: the bank, in order, actives only. */
create or replace function public.theses_proposees(p_nombre integer default 3)
returns setof public.theses
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.theses
   where actif
   order by ordre
   limit greatest(coalesce(p_nombre, 3), 1);
$$;
revoke execute on function public.theses_proposees(integer) from public, anon;
grant execute on function public.theses_proposees(integer) to authenticated;

/**
 * Opens a session, after the checks that must never live in the interface: the flag, an
 * account, no suspension, and a slot left this month. An already open session inside the
 * resume window is answered instead of a new one, so coming back is resuming, not restarting.
 */
create or replace function public.ouvrir_debat(
  p_these_id uuid default null,
  p_these_texte text default null,
  p_ton text default null
)
returns public.debats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_these public.theses;
  v_texte text;
  v_origine text;
  v_ton text;
  v_duree integer;
  v_minutes integer;
  v_quota jsonb;
  v_debat public.debats;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_anonyme()) then raise exception 'compte_requis' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  if not exists (select 1 from public.drapeaux where cle = 'face_a_face' and actif) then
    raise exception 'face_a_face_eteint' using errcode = 'P0001';
  end if;

  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  v_minutes := coalesce(v_minutes, 30);

  -- A session still open and still fresh is the same session (E3b).
  select * into v_debat from public.debats
   where utilisateur_id = v_uid and statut = 'ouverte'
     and derniere_activite_le > now() - make_interval(mins => v_minutes)
   order by derniere_activite_le desc
   limit 1;
  if v_debat.id is not null then return v_debat; end if;

  -- An older open session was abandoned: it consumes its slot and stops blocking the way.
  update public.debats
     set statut = 'abandonnee', issue = 'abandonnee', termine_le = now()
   where utilisateur_id = v_uid and statut = 'ouverte';

  v_quota := public.quota_debats(v_uid);
  if (v_quota ->> 'restants')::integer <= 0 then
    raise exception 'quota_epuise' using errcode = 'P0001';
  end if;

  if p_these_id is not null then
    select * into v_these from public.theses where id = p_these_id and actif;
    if v_these.id is null then raise exception 'these_introuvable' using errcode = 'P0002'; end if;
    v_texte := v_these.texte;
    v_origine := 'banque';
    v_ton := coalesce(nullif(btrim(coalesce(p_ton, '')), ''), v_these.ton_suggere);
  else
    v_texte := btrim(coalesce(p_these_texte, ''));
    if v_texte = '' then raise exception 'these_requise' using errcode = '23514'; end if;
    v_origine := 'personnelle';
    v_ton := coalesce(nullif(btrim(coalesce(p_ton, '')), ''), 'ferme');
  end if;

  select coalesce((valeur #>> '{}')::integer, 180) into v_duree
    from public.configuration
   where cle = case when (v_quota ->> 'formule') = 'complet'
                    then 'duree_face_a_face_complet_s' else 'duree_face_a_face_gratuit_s' end;

  insert into public.debats (utilisateur_id, these_id, these_texte, origine_these,
                             ton_adversaire, duree_max_s)
  values (v_uid, p_these_id, v_texte, v_origine, v_ton, coalesce(v_duree, 180))
  returning * into v_debat;
  return v_debat;
end;
$$;
revoke execute on function public.ouvrir_debat(uuid, text, text) from public, anon;
grant execute on function public.ouvrir_debat(uuid, text, text) to authenticated;

/** The session to come back to, or null. Read by E0 and E2 to offer "reprendre". */
create or replace function public.debat_a_reprendre()
returns setof public.debats
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_minutes integer;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  return query
    select * from public.debats
     where utilisateur_id = v_uid and statut = 'ouverte'
       and derniere_activite_le > now() - make_interval(mins => coalesce(v_minutes, 30))
     order by derniere_activite_le desc
     limit 1;
end;
$$;
revoke execute on function public.debat_a_reprendre() from public, anon;
grant execute on function public.debat_a_reprendre() to authenticated;

/**
 * Writes one turn and keeps the session alive. Service role only: turns come from the server,
 * which is the only side that has heard both voices.
 */
create or replace function public.enregistrer_tour(
  p_debat uuid,
  p_numero integer,
  p_locuteur text,
  p_texte text,
  p_duree_s numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.tours_debat (debat_id, numero, locuteur, texte, duree_s)
  values (p_debat, p_numero, p_locuteur, p_texte, p_duree_s)
  on conflict (debat_id, numero) do update set texte = excluded.texte, duree_s = excluded.duree_s
  returning id into v_id;

  update public.debats
     set derniere_activite_le = now(),
         secondes_parlees = secondes_parlees
           + case when p_locuteur = 'utilisateur' then coalesce(p_duree_s, 0)::integer else 0 end
   where id = p_debat;
  return v_id;
end;
$$;
revoke execute on function public.enregistrer_tour(uuid, integer, text, text, numeric) from public, anon, authenticated;
grant execute on function public.enregistrer_tour(uuid, integer, text, text, numeric) to service_role;

/**
 * Closes a session with its outcome. `interrompue_par_nous` is the one that costs the person
 * nothing: the row stays, the quota ignores it.
 */
create or replace function public.cloturer_debat(p_debat uuid, p_issue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_issue not in ('terminee', 'interrompue_par_nous', 'abandonnee') then
    raise exception 'issue inconnue' using errcode = '23514';
  end if;
  update public.debats
     set statut = case when p_issue = 'interrompue_par_nous' then 'interrompue'
                       when p_issue = 'abandonnee' then 'abandonnee'
                       else 'terminee' end,
         issue = p_issue,
         termine_le = now()
   where id = p_debat and statut = 'ouverte';
end;
$$;
revoke execute on function public.cloturer_debat(uuid, text) from public, anon, authenticated;
grant execute on function public.cloturer_debat(uuid, text) to service_role;

/** The written transcript of a debate, in order: what the debrief reads (chapter 10). */
create or replace function public.transcription_debat(p_debat uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_lignes jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'numero', t.numero, 'locuteur', t.locuteur, 'texte', t.texte, 'duree_s', t.duree_s)
         order by t.numero), '[]'::jsonb)
    into v_lignes
    from public.tours_debat t
    join public.debats d on d.id = t.debat_id
   where t.debat_id = p_debat
     -- A signed-in client reads only its own debate. A null uid here is the server (anon has
     -- no right to execute this function at all), which reads any debate to write the debrief.
     and (d.utilisateur_id = (select auth.uid()) or (select auth.uid()) is null);
  return v_lignes;
end;
$$;
revoke execute on function public.transcription_debat(uuid) from public, anon;
grant execute on function public.transcription_debat(uuid) to authenticated, service_role;
