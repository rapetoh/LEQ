-- LEQ, migration "purge_sur_inactivite" (2026-09-17).
--
-- The purge of anonymous accounts ran 72 hours after creation, whatever the person had done
-- since. That was written when an account-less person could only do the diagnostic; the path
-- has been open to them since Phase 4, so someone who played for three days without creating
-- an account lost their progress on the fourth. The worker now counts from the last take
-- (apps/serveur/src/db.ts), and the window becomes thirty days.

update public.configuration
   set valeur = '720'::jsonb,
       description = 'Heures sans aucune prise ni connexion avant suppression d''un compte anonyme (trente jours). Un compte créé n''est jamais concerné.'
 where cle = 'purge_anonymes_heures';
