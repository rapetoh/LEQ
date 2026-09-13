-- ---------------------------------------------------------------------------------------------
-- Six, c'est une limite d'écoute, pas une limite de parole.
--
-- Rebecca asked for six after imagining herself listening to twelve takes on the same question:
-- « imagine que tu écoutes 12 vocaux, à un moment donné, sur un même thème ». She was solving a
-- listening problem, and she said in the same breath what she wanted for speaking: « il ne faut
-- pas qu'il y ait de la hiérarchie, liberté pour tous ».
--
-- So anyone records on the week's subject, and nobody is asked to sit through more than six takes
-- in a day. Past that the Arena says the listening is done for today. The ranking keeps counting
-- votes, and the pairs are still drawn from the whole pool, so a late take is heard as much as an
-- early one.
-- ---------------------------------------------------------------------------------------------

insert into public.configuration (cle, type, valeur, description)
values ('prises_ecoutees_par_jour', 'nombre', '6'::jsonb,
        'Combien de passages une personne s''entend proposer par jour dans l''Arène. 0 : sans limite.')
on conflict (cle) do nothing;

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
  v_plafond integer;
  v_ecoutees integer;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_sujet from public.sujet_arene_actif();
  if v_sujet.id is null then
    return jsonb_build_object('raison', 'aucun_sujet');
  end if;
  if not public.a_parle_sur(v_sujet.id) then
    return jsonb_build_object('raison', 'parle_d_abord');
  end if;

  -- Six is a listening limit, not a cap on who may speak. Anyone records on the week's subject;
  -- nobody is asked to sit through a dozen takes on the same question in one sitting. Past the
  -- limit the Arena says the day's listening is done, and the ranking keeps counting votes.
  select coalesce((valeur #>> '{}')::integer, 6) into v_plafond
    from public.configuration where cle = 'prises_ecoutees_par_jour';
  v_plafond := coalesce(v_plafond, 6);
  select count(distinct i.prise_id) into v_ecoutees
    from public.impressions i
    join public.prises_publiques p on p.id = i.prise_id
   where i.votant_id = v_uid
     and p.sujet_id = v_sujet.id
     and i.cree_le >= date_trunc('day', now() at time zone coalesce(
           (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));
  if v_plafond > 0 and v_ecoutees >= v_plafond then
    return jsonb_build_object('raison', 'assez_ecoute');
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
