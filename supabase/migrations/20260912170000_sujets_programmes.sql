-- ---------------------------------------------------------------------------------------------
-- Programmer les semaines de l'Arène, et voir ce qui s'y est passé.
--
-- Rebecca écrit ses sujets par paquets et veut leur donner une date : « comme ça, tu peux créer
-- dix ou vingt sujets et mettre des dates ». La rotation prenait simplement le suivant dans
-- l'ordre, le jour où la semaine était finie.
--
-- Un sujet daté passe devant, le jour venu. Les autres continuent à suivre l'ordre, pour qu'elle
-- n'ait pas à tout dater. Et une semaine fermée se lit : qui a parlé, qui a voté, qui a gagné.
-- ---------------------------------------------------------------------------------------------

alter table public.sujets_arene add column if not exists prevu_le date;
comment on column public.sujets_arene.prevu_le is 'Jour à partir duquel ce sujet passe en premier. Vide : il suit l''ordre.';
create index if not exists sujets_arene_prevu_le_idx on public.sujets_arene (prevu_le)
  where actif_le is null and prevu_le is not null;

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
   order by (prevu_le is null or prevu_le > current_date), prevu_le nulls last, ordre
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

/**
 * Une semaine de l'Arène, vue de l'administration : qui a parlé, combien de voix, qui a voté.
 *
 * The Arena is public speech, so the admin sees who took part: it is the only way to moderate a
 * week, to answer someone who writes in, and to know whether a subject worked at all.
 */
create or replace function public.resume_sujet_arene(p_sujet uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.sujets_arene;
  v_prises jsonb;
  v_votants integer;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  select * into v_s from public.sujets_arene where id = p_sujet;
  if v_s.id is null then raise exception 'sujet_introuvable' using errcode = 'P0002'; end if;

  select count(distinct votant_id) into v_votants from public.votes where sujet_id = p_sujet;

  select coalesce(jsonb_agg(ligne order by (ligne ->> 'voix')::int desc, ligne ->> 'prenom'), '[]'::jsonb)
    into v_prises
    from (
      select jsonb_build_object(
               'prise_id', pp.id,
               'utilisateur_id', pp.utilisateur_id,
               'prenom', coalesce(pr.prenom, ''),
               'publie_sous_prenom', coalesce(pr.publier_sous_prenom, false),
               'statut', pp.statut,
               'voix', (select count(*) from public.votes v where v.gagnante_id = pp.id),
               'cree_le', pp.cree_le
             ) as ligne
        from public.prises_publiques pp
        left join public.profils pr on pr.id = pp.utilisateur_id
       where pp.sujet_id = p_sujet
    ) t;

  return jsonb_build_object(
    'sujet', jsonb_build_object('id', v_s.id, 'texte', v_s.texte, 'actif_le', v_s.actif_le,
                                'ferme_le', v_s.ferme_le, 'prevu_le', v_s.prevu_le),
    'votants', v_votants,
    'prises', v_prises);
end;
$$;
revoke execute on function public.resume_sujet_arene(uuid) from public;
revoke execute on function public.resume_sujet_arene(uuid) from anon;
grant execute on function public.resume_sujet_arene(uuid) to authenticated;
