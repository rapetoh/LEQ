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
