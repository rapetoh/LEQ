-- What one face-à-face consumed at the providers, kept on its row.
--
-- The plan refused to invent the cost of a debate, and a bill at the end of the month says
-- nothing about one session. The server counts what every provider call used (seconds of
-- speech in, tokens through the model, characters and seconds of voice out) and hands the total
-- to the close; the debrief job adds its own share afterwards. Units are the providers' own, no
-- price is stored: prices change, the reading is done at query time.
alter table public.debats add column if not exists consommation jsonb;
comment on column public.debats.consommation is
  'Provider usage of the session (version, transcription, retor, voix, debrief). Written by the server at close, never by a client.';

drop function if exists public.cloturer_debat(uuid, text, uuid);

create or replace function public.cloturer_debat(
  p_debat uuid,
  p_issue text,
  p_session uuid default null,
  p_consommation jsonb default null
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
         session_id = null,
         -- A resumed session closes more than once; the last close carries the whole count.
         consommation = coalesce(p_consommation, consommation)
   where id = p_debat and statut = 'ouverte'
     and (p_session is null or session_id is null or session_id = p_session);
end;
$$;
revoke execute on function public.cloturer_debat(uuid, text, uuid, jsonb) from public;
revoke execute on function public.cloturer_debat(uuid, text, uuid, jsonb) from anon, authenticated;
grant execute on function public.cloturer_debat(uuid, text, uuid, jsonb) to service_role;
