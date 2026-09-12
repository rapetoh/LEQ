-- LEQ, migration "duel_est_moi". The invitee could be locked out of their own duel.
--
-- `lire_duel_par_jeton` answered `deja_repondu` as "the seat is taken", and the page turned that
-- into "quelqu'un a déjà répondu", a dead end. But the page claims the seat before the person
-- speaks, so the seat is taken by *them* from the moment they tap the button. Denying the
-- microphone, backgrounding the tab, losing the network or simply reloading then told the
-- legitimate invitee that someone else had answered, and the duel expired with no verdict.
--
-- `rejoindre_duel` has always let the same person back in (`invite_id <> v_uid`). The page just
-- never got that far. The answer now says whose seat it is.

create or replace function public.lire_duel_par_jeton(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d public.duels;
  v_uid uuid := (select auth.uid());
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
    'deja_repondu', v_d.invite_id is not null,
    -- True when the seat is this caller's own, so coming back is resuming and not a refusal.
    'c_est_moi', v_uid is not null and v_d.invite_id = v_uid,
    -- True for the person who sent the invitation: they open the link from their own phone
    -- more often than anyone, and "this is your duel" beats a wrong refusal.
    'c_est_mon_duel', v_uid is not null and v_d.inviteur_id = v_uid);
end;
$$;
grant execute on function public.lire_duel_par_jeton(text) to anon, authenticated;
