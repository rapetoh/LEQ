-- Le face-à-face : combien de silence donne la parole à Rétor.
--
-- La transcription décidait seule, et elle décidait à 700 ms : une personne qui respire au
-- milieu de son argument se faisait répondre, et tout ce qu'elle disait ensuite tombait dans un
-- tour déjà fermé. Le serveur décide maintenant, et cette valeur est ce qu'il attend. Deux
-- 2,2 secondes : le temps de réfléchir, de reprendre son souffle et de chercher le mot juste,
-- sans que l'échange s'éteigne. L'écran dessine le même compte à rebours, et un mot l'annule.
--
-- Rebecca la déplace ici, comme les autres réglages.

insert into public.configuration (cle, type, valeur, description) values
  ('silence_fin_tour_debat_ms', 'nombre', '2200'::jsonb,
   'Silence qui donne la parole à Rétor dans un face-à-face, en millisecondes.')
on conflict (cle) do nothing;
