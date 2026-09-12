-- LEQ, migration "revoquer_public". The revoke that actually revokes.
--
-- The previous migration revoked EXECUTE from `anon` and changed nothing, because these
-- functions were never granted to `anon`: Postgres grants EXECUTE on a new function to PUBLIC
-- by default, and PUBLIC includes every role. `revoke ... from anon` does not remove a PUBLIC
-- grant. The ACL shows it as a leading `=X/postgres`.
--
-- That default is why `formule_de(uuid)` answered anyone holding the publishable key, which
-- ships inside every copy of the application: given a user id it said whether that person pays.
-- The pattern used everywhere else in this schema is `revoke ... from public, anon` followed by
-- an explicit grant, and these five were the ones that had been missed.

revoke execute on function public.formule_de(uuid) from public;
grant execute on function public.formule_de(uuid) to authenticated, service_role;

revoke execute on function public.a_parle_sur(uuid) from public;
grant execute on function public.a_parle_sur(uuid) to authenticated, service_role;

revoke execute on function public.annonces_du_mois() from public;
grant execute on function public.annonces_du_mois() to authenticated, service_role;

revoke execute on function public.est_suspendu() from public;
grant execute on function public.est_suspendu() to authenticated, service_role;

revoke execute on function public.sujet_arene_actif() from public;
grant execute on function public.sujet_arene_actif() to authenticated, service_role;
