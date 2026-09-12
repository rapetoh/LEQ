-- ---------------------------------------------------------------------------------------------
-- Une prise que la grille ne peut pas noter laissait la personne sans rien.
--
-- `appliquer_resultat` returned null when the evaluation carried no total, wrote nothing, and
-- left the step available. No grid is published yet, so every step take does exactly that: four
-- challenges recorded on the hosted project, four analyses delivered, and not one step validated
-- or failed. The person records their challenge of the day and nothing at all happens.
--
-- A take nobody could score is not a failure, so it is not counted as one. It is written down as
-- `non_evaluee`, which the application can say out loud. What it does to the step is Rebecca's
-- call, so it is a setting, off by default: nothing about her grid is guessed here.
-- ---------------------------------------------------------------------------------------------

alter table public.tentatives drop constraint if exists tentatives_resultat_check;
alter table public.tentatives add constraint tentatives_resultat_check
  check (resultat in ('etape_validee', 'etape_echouee', 'non_evaluee'));

insert into public.configuration (cle, type, valeur, description)
values ('validation_sans_grille', 'booleen', 'false'::jsonb,
        'Quand aucune grille ne peut noter une prise, valider quand même l''étape. À utiliser tant que la grille de Rebecca n''existe pas.')
on conflict (cle) do nothing;

create or replace function public.appliquer_resultat(p_tentative_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_e record;
  v_note numeric;
  v_res text;
  v_suivante record;
  v_sans_grille boolean;
  v_valide boolean;
begin
  select * into v_t from public.tentatives where id = p_tentative_id;
  if v_t.id is null or v_t.type <> 'etape' or v_t.etape_id is null then
    return null;
  end if;
  -- Already applied by a previous run of the pipeline: same answer, no second count.
  if v_t.resultat is not null then
    return v_t.resultat;
  end if;
  select * into v_e from public.etapes where id = v_t.etape_id for update;
  if v_e.id is null or v_e.statut = 'validee' then
    return null;
  end if;
  select note_totale into v_note from public.evaluations where tentative_id = p_tentative_id;

  -- A take the grid could not score is not a failure: nothing was measured against anything.
  -- It used to return null and write nothing, so the step stayed available for ever, in silence,
  -- and the person who had just recorded their challenge had no way to know where they stood.
  --
  -- What such a take does to the step is Rebecca's call (chapter 4), so it is a setting and not a
  -- guess. Off, which is the default, the step waits for the grid and the application says so.
  -- On, recording the challenge validates it, which is what lets the path be walked before the
  -- grid exists.
  select coalesce((valeur #>> '{}')::boolean, false) into v_sans_grille
    from public.configuration where cle = 'validation_sans_grille';
  v_sans_grille := coalesce(v_sans_grille, false);

  if v_note is null and not v_sans_grille then
    update public.tentatives set resultat = 'non_evaluee' where id = p_tentative_id;
    return 'non_evaluee';
  end if;

  v_valide := case when v_note is null then v_sans_grille else v_note >= v_e.seuil_reussite end;

  if v_valide then
    update public.etapes
       set statut = 'validee', validee_le = now(), tentative_validante_id = p_tentative_id
     where id = v_e.id;
    select * into v_suivante
      from public.etapes
     where parcours_id = v_e.parcours_id and ordre_global > v_e.ordre_global
     order by ordre_global limit 1;
    if v_suivante.id is not null then
      update public.etapes set statut = 'disponible' where id = v_suivante.id and statut = 'verrouillee';
      if v_suivante.acte_id <> v_e.acte_id then
        update public.actes set statut = 'traverse', traverse_le = now() where id = v_e.acte_id;
        update public.actes set statut = 'en_cours' where id = v_suivante.acte_id;
      end if;
    else
      update public.actes set statut = 'traverse', traverse_le = now() where id = v_e.acte_id;
    end if;
    insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
    select v_t.utilisateur_id, d.points, 'defi_valide', p_tentative_id::text
      from public.defis d where d.id = v_e.defi_id and d.points > 0
    on conflict (motif, reference) do nothing;
    v_res := 'etape_validee';
  else
    update public.etapes
       set nombre_echecs = nombre_echecs + 1,
           rattrapage_propose = (nombre_echecs + 1 >= 2)
     where id = v_e.id;
    v_res := 'etape_echouee';
  end if;

  update public.tentatives set resultat = v_res where id = p_tentative_id;
  return v_res;
end;
$$;
revoke execute on function public.appliquer_resultat(uuid) from public, anon, authenticated;
grant execute on function public.appliquer_resultat(uuid) to service_role;
