-- The provisional content was reworded in supabase/seed.sql (docs/STRINGS.md, "How the text
-- must not sound"), but the seed never overwrites a row that exists, so the hosted database
-- kept the first wording and the phones showed it. This applies the current seed wording to
-- the rows Rebecca has not taken over. A row she edited has provisoire = false and is left alone.

update public.defis set
  consigne = 'Présente-toi en une minute. Prends ton temps, tu n''as pas besoin de tout dire.'
  where cle = 'se_presenter' and provisoire;

update public.defis set
  consigne = 'Défends une idée à laquelle tu crois, en trois phrases exactement. La contrainte oblige à aller à l''essentiel.'
  where cle = 'trois_phrases' and provisoire;

update public.defis set focus = 'ta structure, sans notes'
  where cle = 'sans_notes' and provisoire;

update public.defis set focus = 'ta position, tenue jusqu''au bout'
  where cle = 'reponds_au_texte' and provisoire;

update public.defis set
  plan = '[{"titre":"Prépare · 2 min","detail":"Trois appuis à noter à l''écran"},{"titre":"Parle · 5 min","detail":"L''anneau marque tes trois appuis"},{"titre":"Le retour, en deux temps","detail":"La structure d''abord, la voix ensuite"}]'::jsonb
  where cle = 'defends_ton_idee' and provisoire;

update public.exercices set consigne = 'Compte « un, deux » dans ta tête à chaque virgule.'
  where cle = 'silence_un_deux' and provisoire;

update public.exercices set consigne = 'Dis ton idée en une phrase, puis une preuve. Deux phrases en tout.'
  where cle = 'une_idee_une_preuve' and provisoire;

update public.sujets_arene set consigne = 'Appuie ta position sur un exemple concret.'
  where cle = 'talent_ou_travail' and provisoire;

-- The card already carries "Ne s'achète pas" as its status line, so the subtitle stops
-- repeating it.
update public.recompenses set sous_titre = 'Attribuée au n°1 du mois.'
  where cle = 'heure_rebecca' and provisoire;
