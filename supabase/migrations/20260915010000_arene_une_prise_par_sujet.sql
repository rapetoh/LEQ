-- One passage per person per Arena subject. The app says so ("Une seule version est
-- acceptée") and the duel side enforces it with prises_publiques_une_par_duel_idx, but the
-- Arena side had nothing: publier_prise only refused the same tentative twice, so a second
-- analysed take on the same subject went in, and the ranking held two entries for one voice.
-- Withdrawing a passage (statut = 'retiree') frees the slot, which is what the app promises.
-- The function body is the one of 20260912120000 plus the guard.

create unique index if not exists prises_publiques_une_par_sujet_idx
  on public.prises_publiques (sujet_id, utilisateur_id)
  where sujet_id is not null and statut <> 'retiree';

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
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;

  select * into v_t from public.tentatives where id = p_tentative_id and utilisateur_id = v_uid;
  if v_t.id is null then raise exception 'tentative_introuvable' using errcode = 'P0002'; end if;
  if v_t.type not in ('arene', 'duel') then
    raise exception 'type_incompatible' using errcode = '23514';
  end if;
  if v_t.type = 'arene' and (select public.est_anonyme()) then
    raise exception 'compte_requis' using errcode = '42501';
  end if;
  if v_t.statut <> 'retour_disponible' then
    raise exception 'analyse_incomplete' using errcode = 'P0001';
  end if;
  -- The copy kept for the length of the contest is what an Arena card and a duel verdict play.
  -- Without it the row would be published mute, and a silent card costs the person their whole
  -- week: nobody votes for a voice they cannot hear.
  if v_t.chemin_audio_public is null then
    raise exception 'analyse_incomplete' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prises_publiques where tentative_id = p_tentative_id) then
    return (select id from public.prises_publiques where tentative_id = p_tentative_id);
  end if;

  if v_t.type = 'arene' then
    select * into v_sujet from public.sujet_arene_actif();
    if v_sujet.id is null then raise exception 'aucun_sujet' using errcode = 'P0001'; end if;
    -- A clean refusal, so the person reads a sentence instead of a constraint error.
    if exists (select 1 from public.prises_publiques
                where sujet_id = v_sujet.id and utilisateur_id = v_uid and statut <> 'retiree') then
      raise exception 'deja_publie' using errcode = 'P0001';
    end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, sujet_id, chemin_audio)
    values (v_uid, p_tentative_id, 'arene', v_sujet.id, v_t.chemin_audio_public)
    returning id into v_id;
  else
    select * into v_duel from public.duels
     where id = v_t.duel_id and statut = 'ouvert'
       and (inviteur_id = v_uid or invite_id = v_uid);
    if v_duel.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, duel_id, chemin_audio)
    values (v_uid, p_tentative_id, 'duel', v_duel.id, v_t.chemin_audio_public)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.publier_prise(uuid) from public, anon;
grant execute on function public.publier_prise(uuid) to authenticated;
