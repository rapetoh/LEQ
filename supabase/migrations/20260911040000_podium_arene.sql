-- LEQ, migration "podium_arene" (Phase 7, C8). The end of an Arena week: the ranking is shown
-- as a podium, and the people who spoke that week are told once, through the "social events"
-- notification of chapter 12.
--
-- Three changes, all of them small:
--   1. a closed subject stays readable, because a podium without its subject means nothing;
--   2. the rotation says which week it closed, not only which one it opened;
--   3. the result notification is claimed before it is sent, so a retry never sends it twice.

-- ---------------------------------------------------------------------------
-- 1. A closed week stays readable
-- ---------------------------------------------------------------------------

alter table public.sujets_arene
  add column if not exists resultat_notifie_le timestamptz;
comment on column public.sujets_arene.resultat_notifie_le is
  'Quand le résultat de la semaine a été notifié. Posé avant l''envoi : une reprise ne renotifie pas.';

-- Was: only the subject currently active. A subject that has been activated once is public
-- information from that moment on (its takes were), and the podium of last week needs it.
drop policy if exists sujets_arene_select on public.sujets_arene;
create policy sujets_arene_select on public.sujets_arene for select to authenticated
  using (actif_le is not null or (select public.est_admin()));

/** The week that closed most recently, for the "voir le podium" entry of the Arena tab. */
create or replace function public.dernier_sujet_arene_clos()
returns setof public.sujets_arene
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.sujets_arene
   where ferme_le is not null
   order by ferme_le desc
   limit 1;
$$;
revoke execute on function public.dernier_sujet_arene_clos() from public, anon;
grant execute on function public.dernier_sujet_arene_clos() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The rotation says what it closed
-- ---------------------------------------------------------------------------

-- The return type changes from uuid to jsonb, which `create or replace` cannot do.
drop function if exists public.roter_sujet_arene();

/**
 * Closes the week that is over and activates the next subject. Answers both identifiers:
 * `ferme` is the week that just ended (null when none did), `actif` the one now running
 * (null when the bank is empty). The worker needs `ferme` to notify the podium.
 */
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

  select * into v_suivant from public.sujets_arene
   where actif and actif_le is null
   order by ordre
   limit 1;
  if v_suivant.id is null then
    return jsonb_build_object('ferme', v_ferme, 'actif', null);
  end if;
  update public.sujets_arene set actif_le = now() where id = v_suivant.id;
  return jsonb_build_object('ferme', v_ferme, 'actif', v_suivant.id);
end;
$$;
revoke execute on function public.roter_sujet_arene() from public, anon, authenticated;
grant execute on function public.roter_sujet_arene() to service_role;

-- ---------------------------------------------------------------------------
-- 3. The result notification, claimed before it is sent
-- ---------------------------------------------------------------------------

/**
 * Claims the right to notify the result of a week. Answers true exactly once per subject,
 * so a job retried after a crash mid-send never notifies the same week twice (the same rule
 * as `publier_annonce`, chapter 12).
 */
create or replace function public.reserver_resultat_arene(p_sujet uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_pris boolean;
begin
  update public.sujets_arene
     set resultat_notifie_le = now()
   where id = p_sujet and ferme_le is not null and resultat_notifie_le is null
  returning true into v_pris;
  return coalesce(v_pris, false);
end;
$$;
revoke execute on function public.reserver_resultat_arene(uuid) from public, anon, authenticated;
grant execute on function public.reserver_resultat_arene(uuid) to service_role;
