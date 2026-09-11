-- LEQ, migration "duel_invite_anonyme" (Phase 7). Chapter 11: "Le lien d'invitation fonctionne
-- sans que l'autre ait installé l'application." An invitee arriving by the token is identified
-- by an anonymous sign-in, so a duel take must be allowed for an anonymous principal. The Arena
-- keeps needing an account: a public take lives among the others and its author is ranked.

drop policy if exists tentatives_insert_propre on public.tentatives;
create policy tentatives_insert_propre on public.tentatives
  for insert to authenticated
  with check (
    utilisateur_id = (select auth.uid())
    and statut = 'envoyee'
    and (type in ('diagnostic', 'etape', 'duel') or not (select public.est_anonyme()))
    and not (select public.est_suspendu())
  );

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
  -- The Arena needs an account (the author is ranked); a duel invitee may stay anonymous.
  if v_t.type = 'arene' and (select public.est_anonyme()) then
    raise exception 'compte_requis' using errcode = '42501';
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
