-- LEQ, migration "correctifs_face_a_face". Three corrections found by the pgTAP suite of the
-- previous migration, before anything ran in production (the `face_a_face` flag is off).
--
-- 1. A turn rewritten by a retry added its seconds to the cap a second time, so a flaky network
--    quietly ate the person's speaking time. Only the difference counts now.
-- 2. Seconds were stored as an integer, so every turn was rounded and the cap drifted over a
--    long session. They are stored as they are measured.
-- 3. `ouvrir_debat` silently answered the session already open, whatever thesis was asked for.
--    Someone picking a new thesis got the old debate with no word said. It now refuses, and the
--    caller chooses: resume it, or abandon it and open another.

alter table public.debats
  alter column secondes_parlees type numeric(8, 2) using secondes_parlees::numeric;
comment on column public.debats.secondes_parlees is
  'Temps de parole de la personne, cumulé sur les reprises. Seul son temps compte, pas celui de Rétor.';

/**
 * Writes one turn and keeps the session alive. Service role only: turns come from the server,
 * which is the only side that has heard both voices.
 *
 * A turn written twice (a retry after a cut) replaces itself, and only the difference in
 * duration is added to the speaking time. Adding it twice would charge the person for our own
 * retry, which is the same mistake as charging a quota for our own outage (chapter 10).
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
declare
  v_id uuid;
  v_avant numeric;
  v_delta numeric;
begin
  select duree_s into v_avant from public.tours_debat
   where debat_id = p_debat and numero = p_numero;

  insert into public.tours_debat (debat_id, numero, locuteur, texte, duree_s)
  values (p_debat, p_numero, p_locuteur, p_texte, p_duree_s)
  on conflict (debat_id, numero) do update set texte = excluded.texte, duree_s = excluded.duree_s
  returning id into v_id;

  v_delta := case when p_locuteur = 'utilisateur'
                  then coalesce(p_duree_s, 0) - coalesce(v_avant, 0)
                  else 0 end;
  update public.debats
     set derniere_activite_le = now(),
         secondes_parlees = greatest(secondes_parlees + v_delta, 0)
   where id = p_debat;
  return v_id;
end;
$$;
revoke execute on function public.enregistrer_tour(uuid, integer, text, text, numeric) from public, anon, authenticated;
grant execute on function public.enregistrer_tour(uuid, integer, text, text, numeric) to service_role;

/** Closes the session the person had open, because they chose to start another one instead. */
create or replace function public.abandonner_debat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.debats
     set statut = 'abandonnee', issue = 'abandonnee', termine_le = now()
   where utilisateur_id = v_uid and statut = 'ouverte';
end;
$$;
revoke execute on function public.abandonner_debat() from public, anon;
grant execute on function public.abandonner_debat() to authenticated;

/**
 * Opens a session, after the checks that must never live in the interface: the flag, an
 * account, no suspension, a thesis, and a slot left this month.
 *
 * A session already open and still fresh is not silently handed back: the call is refused with
 * `debat_en_cours`, and the caller decides between `debat_a_reprendre()` and
 * `abandonner_debat()`. Answering a debate nobody asked for is worse than an error.
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

  -- The thesis is checked before anything else: a malformed request is a malformed request,
  -- whatever the state of the person's sessions.
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

  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  v_minutes := coalesce(v_minutes, 30);

  if exists (
    select 1 from public.debats
     where utilisateur_id = v_uid and statut = 'ouverte'
       and derniere_activite_le > now() - make_interval(mins => v_minutes)
  ) then
    raise exception 'debat_en_cours' using errcode = 'P0001';
  end if;

  -- An older open session was walked away from: it consumes its slot and stops blocking.
  update public.debats
     set statut = 'abandonnee', issue = 'abandonnee', termine_le = now()
   where utilisateur_id = v_uid and statut = 'ouverte';

  v_quota := public.quota_debats(v_uid);
  if (v_quota ->> 'restants')::integer <= 0 then
    raise exception 'quota_epuise' using errcode = 'P0001';
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
