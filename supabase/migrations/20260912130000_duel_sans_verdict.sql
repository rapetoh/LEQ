-- ---------------------------------------------------------------------------------------------
-- « Personne n'a répondu à temps » se disait de deux personnes qui avaient répondu.
--
-- `cloturer_duel` decided whether someone had answered by reading their grid score. No grid is
-- published yet, so both scores are null, and two people who had each spoken and each spent a
-- take were told at the deadline that nobody had answered. Even with a grid, one take whose
-- evaluation never landed would have done the same to the other person.
--
-- Presence is now a question about the take. When both are there and the analysis cannot
-- separate them, the duel closes on `sans_verdict`: it says what happened instead of inventing a
-- winner or blaming someone for a silence that was not theirs.
-- ---------------------------------------------------------------------------------------------

alter table public.duels drop constraint if exists duels_verdict_check;
alter table public.duels add constraint duels_verdict_check
  check (verdict in ('inviteur', 'invite', 'egalite', 'sans_verdict'));

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
  v_a_parle_inviteur boolean;
  v_a_parle_invite boolean;
  v_verdict text;
begin
  select * into v_d from public.duels where id = p_duel for update;
  if v_d.id is null or v_d.statut <> 'ouvert' then return null; end if;

  -- Whether someone answered is a question about their take, not about its score. Reading the
  -- note to decide presence meant that two people who had both spoken, on a project where no
  -- grid is published yet, were told at the deadline that nobody had answered.
  select exists (select 1 from public.prises_publiques p
                  where p.duel_id = v_d.id and p.utilisateur_id = v_d.inviteur_id),
         exists (select 1 from public.prises_publiques p
                  where p.duel_id = v_d.id and p.utilisateur_id = v_d.invite_id)
    into v_a_parle_inviteur, v_a_parle_invite;

  if not v_a_parle_inviteur or not v_a_parle_invite then
    if v_d.echeance > now() then return null; end if;  -- still time to answer
    update public.duels set statut = 'expire', clos_le = now() where id = v_d.id;
    update public.prises_publiques set date_suppression = now()
     where duel_id = v_d.id and date_suppression is null;
    return 'expire';
  end if;

  select e.note_totale into v_inviteur
    from public.prises_publiques p
    join public.evaluations e on e.tentative_id = p.tentative_id
   where p.duel_id = v_d.id and p.utilisateur_id = v_d.inviteur_id;
  select e.note_totale into v_invite
    from public.prises_publiques p
    join public.evaluations e on e.tentative_id = p.tentative_id
   where p.duel_id = v_d.id and p.utilisateur_id = v_d.invite_id;

  -- Both spoke, and the analysis cannot separate them: no grid published yet, or a take whose
  -- evaluation never landed. The duel closes and says so, instead of pretending to a winner or
  -- pretending nobody came.
  v_verdict := case
    when v_inviteur is null or v_invite is null then 'sans_verdict'
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
