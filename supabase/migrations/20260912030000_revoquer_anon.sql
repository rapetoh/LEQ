-- LEQ, migration "revoquer_anon". Helper functions that answered to anyone.
--
-- `formule_de(uuid)` was executable by `anon`, which means anyone holding the publishable key,
-- and the publishable key ships inside every copy of the application. Given a user id it
-- answered "gratuit" or "complet": whether that person pays. Subscription status is personal
-- data and there is no screen that needs it before signing in.
--
-- The others in this list leak less but were never a decision either. No policy in `public`
-- applies to `anon`, so nothing evaluates these on an anonymous caller's behalf; revoking is
-- safe. `est_admin` and `est_anonyme` stay, because they answer about the caller alone.
-- `lire_duel_par_jeton` stays: a duel invitation must work without an account (chapter 11).

revoke execute on function public.formule_de(uuid) from anon;
revoke execute on function public.a_parle_sur(uuid) from anon;
revoke execute on function public.annonces_du_mois() from anon;
revoke execute on function public.est_suspendu() from anon;
revoke execute on function public.sujet_arene_actif() from anon;

-- Trigger functions. They run as their definer when the trigger fires, so an EXECUTE grant is
-- meaningless here; it only widened the surface for nothing.
revoke execute on function public.creer_profil() from anon;
revoke execute on function public.creer_job_analyse() from anon;
