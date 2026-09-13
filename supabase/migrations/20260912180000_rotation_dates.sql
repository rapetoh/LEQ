-- ---------------------------------------------------------------------------------------------
-- Un sujet daté pour plus tard ne passait pas devant, il passait tout court.
--
-- The first ordering tied an undated subject with one planned for next week, and then sorted
-- dates before nulls: a subject scheduled for a future Monday jumped the queue today. Two keys
-- were needed and there was one.
--
-- A subject whose day has come goes first, oldest date first. Everything else follows the order
-- and ignores its date until that date arrives.
-- ---------------------------------------------------------------------------------------------

create or replace function public.roter_sujet_arene()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jours integer;
  v_courant public.sujets_arene;
  v_suivant public.sujets_arene;
  v_ferme uuid;
begin
  select coalesce((valeur #>> '{}')::integer, 7) into v_jours
    from public.configuration where cle = 'duree_sujet_arene_jours';
  v_jours := coalesce(v_jours, 7);

  select * into v_courant from public.sujet_arene_actif();
  if v_courant.id is not null then
    if v_courant.actif_le + make_interval(days => v_jours) > now() then
      -- The week is not over: nothing closed, the same subject stays active.
      return jsonb_build_object('ferme', null, 'actif', v_courant.id);
    end if;
    update public.sujets_arene set ferme_le = now() where id = v_courant.id;
    v_ferme := v_courant.id;
    -- The audio of the closed week goes; the ranking stays (chapter 2).
    update public.prises_publiques
       set date_suppression = now()
     where sujet_id = v_courant.id and date_suppression is null;
  end if;

  -- A subject whose day has come goes first, oldest date first. The rest keep following the
  -- order, so nothing has to be dated for the Arena to run.
  select * into v_suivant from public.sujets_arene
   where actif and actif_le is null
   order by (prevu_le is not null and prevu_le <= current_date) desc,
            case when prevu_le is not null and prevu_le <= current_date then prevu_le end,
            ordre
   limit 1;
  if v_suivant.id is null then
    return jsonb_build_object('ferme', v_ferme, 'actif', null);
  end if;
  update public.sujets_arene set actif_le = now() where id = v_suivant.id;
  return jsonb_build_object('ferme', v_ferme, 'actif', v_suivant.id);
end;
$$;
revoke execute on function public.roter_sujet_arene() from public;
revoke execute on function public.roter_sujet_arene() from anon, authenticated;
grant execute on function public.roter_sujet_arene() to service_role;
