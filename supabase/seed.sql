-- LEQ seed. Idempotent: descriptions and types are refreshed, values are never
-- overwritten (Rebecca edits them in the admin). Flags ship off and are never
-- touched again by this file.

-- configuration -------------------------------------------------------------

insert into public.configuration (cle, type, valeur, description) values
  ('points_par_defi', 'nombre', '25', 'Points gagnés pour un défi réussi'),
  ('points_par_vote', 'nombre', '5', 'Points gagnés pour un vote dans l''Arène'),
  ('duree_diagnostic_min_s', 'nombre', '60', 'Durée minimale de la prise de diagnostic'),
  ('duree_diagnostic_max_s', 'nombre', '90', 'Durée maximale de la prise de diagnostic'),
  ('etapes_par_jour_gratuit', 'nombre', '1', 'Étapes validables par jour en formule Gratuit'),
  ('etapes_par_jour_complet', 'nombre', '0', 'Étapes validables par jour en formule Complet (0 = sans limite)'),
  ('essais_max_etape_par_jour', 'nombre', '3', 'Essais sur une même étape par jour'),
  ('quota_face_a_face_complet', 'nombre', '8', 'Face-à-face par mois en formule Complet'),
  ('plafond_annonces_par_mois', 'nombre', '2', 'Annonces de Rebecca envoyées par mois, maximum'),
  ('purge_anonymes_heures', 'nombre', '72', 'Délai avant suppression des comptes anonymes sans compte'),
  ('expiration_file_locale_jours', 'nombre', '7', 'Délai avant suppression d''une prise jamais envoyée'),
  ('balayage_audio_heures', 'nombre', '6', 'Âge à partir duquel un audio non public est supprimé par sécurité'),
  ('recuperations_serie_par_mois', 'nombre', '1', 'Récupérations de série par mois'),
  ('duree_duel_heures', 'nombre', '48', 'Délai pour répondre à un duel'),
  ('duree_sujet_arene_jours', 'nombre', '7', 'Durée d''un sujet dans l''Arène'),
  ('plafond_duree_duel_gratuit_s', 'nombre', '90', 'Durée maximale d''une prise de duel (Gratuit)'),
  ('plafond_duree_duel_complet_s', 'nombre', '180', 'Durée maximale d''une prise de duel (Complet)'),
  ('duree_face_a_face_gratuit_s', 'nombre', '180', 'Durée maximale d''un face-à-face (Gratuit)'),
  ('duree_face_a_face_complet_s', 'nombre', '480', 'Durée maximale d''un face-à-face (Complet)'),
  ('reprise_debat_minutes', 'nombre', '30', 'Fenêtre de reprise d''un débat interrompu')
on conflict (cle) do update
  set description = excluded.description,
      type = excluded.type
  where configuration.description is distinct from excluded.description
     or configuration.type is distinct from excluded.type;

-- drapeaux ------------------------------------------------------------------

insert into public.drapeaux (cle, actif) values
  ('arene', false),
  ('duels', false),
  ('face_a_face', false)
on conflict (cle) do nothing;

-- parcours: the static path from the validated mockup ------------------------
-- Everything below is provisoire: Rebecca validates or replaces it in the admin.
-- Values are never overwritten once a row exists (Rebecca's edits win).

insert into public.modeles_actes (ordre, titre, sous_titre) values
  (1, 'Poser sa voix', null),
  (2, 'Tenir sa ligne', 'Les crêtes du rythme'),
  (3, 'Emporter la salle', 'Sous la brume')
on conflict (ordre) do nothing;

insert into public.defis (cle, ordre_acte, ordre, format, titre, consigne, focus, plan, texte_a_lire, duree_lecture_s, duree_preparation_s, duree_max_s, points, competence, seuil_reussite) values
  ('premier_bonjour', 1, 1, 'standard', 'Le premier bonjour',
   'Dis bonjour, ton prénom, et ce qui t''amène ici. Trente secondes, pas plus, comme si on venait d''entrer dans la pièce.',
   'ton temps avant de démarrer', '[]'::jsonb, null, null, null, 60, 25, 'demarrage', 18),
  ('se_presenter', 1, 2, 'standard', 'Se présenter sans se presser',
   'Présente-toi en une minute. Le but n''est pas de tout dire : c''est de ne pas courir.',
   'ton débit', '[]'::jsonb, null, null, null, 90, 25, 'debit', 18),
  ('voix_posee', 1, 3, 'standard', 'La voix posée',
   'Raconte ta journée d''hier, du réveil au coucher, d''une voix qui ne monte pas quand tu hésites.',
   'ta voix, régulière', '[]'::jsonb, null, null, null, 90, 25, 'voix', 19),
  ('lire_a_voix_haute', 1, 4, 'standard', 'Lire à voix haute',
   'Prends un texte que tu as sous la main et lis-en un passage à voix haute, une minute. Articule, sans jouer.',
   'ta clarté', '[]'::jsonb, null, null, null, 90, 25, 'articulation', 19),
  ('respiration_basse', 1, 5, 'standard', 'La respiration basse',
   'Explique une chose que tu sais bien faire. Respire par le ventre entre deux idées, jamais au milieu d''une phrase.',
   'ta respiration', '[]'::jsonb, null, null, null, 90, 25, 'souffle', 20),
  ('regard_droit', 1, 6, 'standard', 'Le regard droit',
   'Défends un avis que tu as sur un sujet du quotidien, en regardant un point fixe devant toi, comme si c''était quelqu''un.',
   'ta présence', '[]'::jsonb, null, null, null, 90, 25, 'presence', 20),
  ('tenir_trente_secondes', 1, 7, 'standard', 'Tenir trente secondes',
   'Choisis un objet devant toi et parle-en trente secondes sans t''arrêter. Si tu n''as plus rien à dire, décris-le.',
   'ta tenue sans pause', '[]'::jsonb, null, null, null, 60, 25, 'tenue', 21),
  ('trois_phrases', 2, 1, 'standard', 'Convaincs-moi en trois phrases',
   'Défends une idée à laquelle tu crois. Trois phrases, pas une de plus. C''est la contrainte qui rend la parole nette.',
   'tes silences',
   '[{"titre":"L''affirmation, sans précaution","detail":""},{"titre":"La preuve, vécue","detail":""},{"titre":"Ce qui change si on te suit","detail":""}]'::jsonb,
   null, null, null, 120, 25, 'structure', 21),
  ('voix_qui_baisse', 2, 2, 'standard', 'La voix qui baisse',
   'Raconte une décision difficile que tu as prise. Baisse la voix sur la fin de chaque phrase, au lieu de la laisser monter.',
   'tes fins de phrase', '[]'::jsonb, null, null, null, 120, 25, 'presence', 22),
  ('silence_une_seconde', 2, 3, 'standard', 'Le silence d''une seconde',
   'Explique ton métier ou tes études à quelqu''un qui n''y connaît rien. Avant chaque idée forte, tais-toi une seconde entière.',
   'tes silences tenus', '[]'::jsonb, null, null, null, 120, 25, 'silences', 22),
  ('sans_notes', 2, 4, 'standard', 'Sans notes',
   'Présente un projet qui te tient à cœur, deux minutes, sans rien lire et sans rien regarder.',
   'ta structure, tenue de tête', '[]'::jsonb, null, null, null, 120, 25, 'structure', 23),
  ('reponds_au_texte', 2, 5, 'texte', 'Réponds à ce texte',
   'Lis-le une fois à voix haute. Puis dis-nous s''il a raison.',
   'ta position, tenue ou pas', '[]'::jsonb,
   'On ne convainc personne avec des arguments. On convainc avec la certitude tranquille de celui qui les porte.',
   40, null, 180, 30, 'position', 23),
  ('defends_ton_idee', 2, 6, 'long', 'Défends ton idée pendant cinq minutes',
   'Choisis une idée que tu défends depuis longtemps. Deux minutes pour poser trois appuis, puis cinq minutes de parole.',
   'ta structure, puis ta voix',
   '[{"titre":"Prépare · 2 min","detail":"Trois appuis notés à l''écran, pas une rédaction"},{"titre":"Parle · 5 min","detail":"L''anneau marque tes trois appuis en chemin"},{"titre":"Le retour, en deux temps","detail":"La structure d''abord, la voix ensuite"}]'::jsonb,
   null, null, 120, 300, 50, 'structure', 24)
on conflict (cle) do nothing;

insert into public.exercices (cle, titre, consigne, duree_s, competence) values
  ('silence_un_deux', 'Compter le silence', 'Compte « un, deux » dans ta tête à chaque virgule. Juste ça.', 30, 'silences'),
  ('une_idee_une_preuve', 'Une idée, une preuve', 'Dis ton idée en une phrase, puis une preuve. Deux phrases, pas plus.', 30, 'structure'),
  ('trois_phrases_lentes', 'Trois phrases lentes', 'Lis trois phrases de ton choix en marquant chaque virgule d''un souffle.', 30, 'debit'),
  ('fin_de_phrase_basse', 'La fin qui descend', 'Dis cinq phrases courtes sur ta journée. Chaque dernière syllabe descend, comme un point.', 30, 'presence'),
  ('un_souffle_une_idee', 'Un souffle, une idée', 'Respire par le ventre, puis dis une idée. Recommence cinq fois, sans presser.', 30, 'souffle')
on conflict (cle) do nothing;
