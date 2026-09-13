-- ---------------------------------------------------------------------------------------------
-- La note se fabrique de deux mains (chapitre 5, réécrit après la réunion du 12 septembre).
--
-- Une prestation est notée sur trente. Quatre axes se calculent sur ce que la machine entend :
-- le débit, les mots béquilles, les silences, l'énergie de la voix. Deux axes se jugent : la
-- structure du propos et la conviction. Ceux-là, le modèle les note contre le référentiel de
-- Rebecca, tenu en place par un exemple à cinq et un exemple à deux, et non contre son idée à lui
-- de ce qu'est un bon orateur.
--
-- The split is a setting and not an accident of how many axes sit in each group: adding a fifth
-- measured axis must not quietly move the balance. Two thirds measure, one third judgement, both
-- of them hers to change once the first real scores land.
--
-- And the model listens to the whole performance, not only to what the grid covers. What it
-- notices outside the criteria reaches the person's feedback without entering the score, and is
-- kept so that the gaps in the grid can be read. Nobody can write down in advance everything
-- people do at a microphone; the grid has to grow from what the application actually hears.
-- ---------------------------------------------------------------------------------------------

alter table public.criteres_grille
  add column if not exists source text not null default 'mesure'
    check (source in ('mesure', 'jugement'));
comment on column public.criteres_grille.source is 'mesure : calculé sur l''audio. jugement : noté par le modèle contre le référentiel de Rebecca.';

-- The two worked examples that hold a judged axis in place from one take to the next.
alter table public.criteres_grille add column if not exists exemple_cinq text;
alter table public.criteres_grille add column if not exists exemple_deux text;
comment on column public.criteres_grille.exemple_cinq is 'Ce qui vaut cinq sur cet axe, écrit par Rebecca. Sans lui, un axe jugé dérive d''une prise à l''autre.';

alter table public.evaluations add column if not exists note_mesure numeric(5, 4);
alter table public.evaluations add column if not exists note_jugement numeric(5, 4);
alter table public.evaluations add column if not exists hors_grille jsonb not null default '[]'::jsonb;
comment on column public.evaluations.note_mesure is 'La part mesurée, ramenée entre 0 et 1 avant pondération.';
comment on column public.evaluations.hors_grille is 'Ce que le modèle a remarqué et qu''aucun critère ne couvre. Jamais dans la note, toujours dans le retour.';

insert into public.configuration (cle, type, valeur, description) values
  ('poids_mesure', 'nombre', '0.65'::jsonb,
   'Part de la note qui vient des axes mesurés sur l''audio. Avec poids_jugement, la somme fait 1.'),
  ('poids_jugement', 'nombre', '0.35'::jsonb,
   'Part de la note qui vient des axes jugés par le modèle, contre le référentiel de Rebecca.'),
  ('note_max_prestation', 'nombre', '30'::jsonb,
   'La note sur laquelle une prestation est ramenée.'),
  ('seuil_reussite_defaut', 'nombre', '18'::jsonb,
   'Note à partir de laquelle une étape est validée, quand le défi n''en fixe pas une autre.')
on conflict (cle) do nothing;

/**
 * A grid cannot be published while a judged axis has no worked examples: without them the model
 * scores against its own idea of a good speaker, and the same take drifts from one week to the
 * next. The check belongs here rather than in a screen, because the grid is what the whole path
 * is measured against.
 */
create or replace function public.publier_grille(p_grille uuid)
returns public.grilles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_g public.grilles;
  v_sans_exemple text;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  select * into v_g from public.grilles where id = p_grille for update;
  if v_g.id is null then raise exception 'grille_introuvable' using errcode = 'P0002'; end if;
  if v_g.publiee_le is not null then return v_g; end if;
  if not exists (select 1 from public.criteres_grille where grille_id = p_grille) then
    raise exception 'grille_vide' using errcode = 'P0001';
  end if;

  select string_agg(cle, ', ' order by ordre) into v_sans_exemple
    from public.criteres_grille
   where grille_id = p_grille and source = 'jugement'
     and (nullif(btrim(coalesce(exemple_cinq, '')), '') is null
       or nullif(btrim(coalesce(exemple_deux, '')), '') is null);
  if v_sans_exemple is not null then
    raise exception 'exemples_manquants: %', v_sans_exemple using errcode = 'P0001';
  end if;

  update public.grilles set publiee_le = now() where id = p_grille returning * into v_g;
  return v_g;
end;
$$;
revoke execute on function public.publier_grille(uuid) from public;
revoke execute on function public.publier_grille(uuid) from anon;
grant execute on function public.publier_grille(uuid) to authenticated;
