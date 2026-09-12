-- ---------------------------------------------------------------------------------------------
-- Un débat, une connexion à la fois.
--
-- Two sockets could hold the same debate: a phone that reconnects before the old socket is
-- collected, or the app open on two devices. Both wrote turn n+1, and `enregistrer_tour` upserts
-- on (debat_id, numero), so the second silently replaced the first. Worse, the loser's close
-- wrote `interrompue` over a session someone was still speaking into.
--
-- The debate now names its holder. Opening a socket claims it; the previous holder's writes are
-- refused (55006, object_in_use) and its close is ignored. The newest connection wins, because
-- it is the one with a person in front of it.
-- ---------------------------------------------------------------------------------------------

alter table public.debats add column if not exists session_id uuid;
comment on column public.debats.session_id is 'La connexion qui tient ce débat. Une seule à la fois : les écritures des autres sont refusées.';

/** Claims an open debate for a new connection, and answers the identifier it must write with. */
create or replace function public.prendre_session_debat(p_debat uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_session uuid;
begin
  update public.debats
     set session_id = gen_random_uuid(), derniere_activite_le = now()
   where id = p_debat and statut = 'ouverte'
  returning session_id into v_session;
  return v_session;
end;
$$;
revoke execute on function public.prendre_session_debat(uuid) from public, anon, authenticated;
grant execute on function public.prendre_session_debat(uuid) to service_role;

-- The signature gains the session, so it is dropped rather than replaced: keeping both would
-- make every five-argument call ambiguous.
drop function if exists public.enregistrer_tour(uuid, integer, text, text, numeric);

/**
 * Writes one turn of a debate, for the connection that holds it.
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
  p_duree_s numeric default null,
  p_session uuid default null
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
  v_session uuid;
begin
  select session_id into v_session from public.debats where id = p_debat;
  if v_session is not null and p_session is distinct from v_session then
    raise exception 'session_perdue' using errcode = '55006';
  end if;

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
revoke execute on function public.enregistrer_tour(uuid, integer, text, text, numeric, uuid) from public;
revoke execute on function public.enregistrer_tour(uuid, integer, text, text, numeric, uuid) from anon, authenticated;
grant execute on function public.enregistrer_tour(uuid, integer, text, text, numeric, uuid) to service_role;

drop function if exists public.cloturer_debat(uuid, text);

/**
 * Closes a session with its outcome. `interrompue_par_nous` is the one that costs the person
 * nothing: the row stays, the quota ignores it.
 *
 * A connection that no longer holds the debate closes nothing. Its socket died while someone
 * kept speaking on another one, and that debate is not its to end.
 */
create or replace function public.cloturer_debat(
  p_debat uuid,
  p_issue text,
  p_session uuid default null
)
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
         termine_le = now(),
         session_id = null
   where id = p_debat and statut = 'ouverte'
     and (p_session is null or session_id is null or session_id = p_session);
end;
$$;
revoke execute on function public.cloturer_debat(uuid, text, uuid) from public;
revoke execute on function public.cloturer_debat(uuid, text, uuid) from anon, authenticated;
grant execute on function public.cloturer_debat(uuid, text, uuid) to service_role;
