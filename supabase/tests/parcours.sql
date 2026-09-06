-- pgTAP tests for migration 0004 (the path). One rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create schema tests_leq;
create function tests_leq.creer_utilisateur(p_id uuid, p_email text, p_anonyme boolean)
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, is_anonymous, raw_app_meta_data, raw_user_meta_data)
  values (p_id, p_email, p_anonyme, '{}'::jsonb, '{}'::jsonb);
end; $$;
create function tests_leq.connecter(p_id uuid, p_anonyme boolean, p_role_app text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_id, 'role', 'authenticated', 'aud', 'authenticated', 'email', '',
    'is_anonymous', p_anonyme, 'app_metadata', jsonb_build_object('role', p_role_app))::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create function tests_leq.deconnecter() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '', true); end; $$;

-- Simulates the worker: an evaluated step attempt for user A on the given step.
create function tests_leq.tentative_evaluee(p_uid uuid, p_etape uuid, p_note numeric)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.tentatives (id, utilisateur_id, type, etape_id, enregistre_le, fuseau_horaire, decalage_minutes, statut)
  values (v_id, p_uid, 'etape', p_etape, now(), 'Europe/Paris', 120, 'retour_disponible');
  insert into public.evaluations (tentative_id, note_totale) values (v_id, p_note);
  return v_id;
end; $$;

select tests_leq.creer_utilisateur('11111111-1111-4111-8111-111111111111', 'a@test.leq', false);
select tests_leq.creer_utilisateur('33333333-3333-4333-8333-333333333333', 'c@test.leq', true);
update public.profils set fuseau_horaire = 'Europe/Paris' where id = '11111111-1111-4111-8111-111111111111';

-- banks are seeded ----------------------------------------------------------
select is((select count(*) from public.modeles_actes), 3::bigint, 'three acts');
select cmp_ok((select count(*) from public.defis where actif), '>=', 13::bigint, 'at least 13 défis');
select cmp_ok((select count(*) from public.exercices where actif), '>=', 5::bigint, 'at least 5 exercices');
select is((select count(*) from public.defis where ordre_acte = 3), 0::bigint, 'acte III has no défi yet (sous la brume)');

-- A builds the path ------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok($$ select public.obtenir_parcours() $$, 'A gets a path');
select is((select count(*) from public.actes), 3::bigint, 'A sees three acts');
select is((select count(*) from public.etapes), 13::bigint, 'A sees thirteen steps');
select is((select count(*) from public.etapes where statut = 'disponible'), 1::bigint, 'exactly one step is available');
select is((select ordre_global from public.etapes where statut = 'disponible'), 1, 'the first one');
select is((select statut from public.actes where ordre = 1), 'en_cours', 'acte I en cours');
select is((select statut from public.actes where ordre = 3), 'a_venir', 'acte III à venir');
select is((select public.obtenir_parcours()), (select id from public.parcours), 'a second call returns the same path');
select is((select (public.etape_du_jour()) #>> '{rythme,raison}'), 'ok', 'the day is open');
select is((select (public.etape_du_jour()) #>> '{defi,cle}'), 'premier_bonjour', 'the step of the day is the first défi');
select is((select (public.etape_du_jour()) #>> '{formule}'), 'gratuit', 'no subscription row means gratuit');
select is((select ((public.etape_du_jour()) #>> '{rythme,limite_etapes}')::int), 1, 'one step a day in gratuit');
select throws_ok(
  $$ insert into public.etapes (parcours_id, acte_id, ordre_global, ordre, defi_id, seuil_reussite, statut)
     select p.id, a.id, 99, 99, d.id, 1, 'disponible' from public.parcours p, public.actes a, public.defis d limit 1 $$,
  '42501', null, 'A cannot write steps');
select throws_ok($$ select public.appliquer_resultat(gen_random_uuid()) $$, '42501', null, 'A cannot apply results');
reset role; select tests_leq.deconnecter();

-- anonymous C gets a path too ---------------------------------------------------
select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select lives_ok($$ select public.obtenir_parcours() $$, 'anonymous C gets a path');
select is((select count(*) from public.etapes), 13::bigint, 'C sees only own thirteen steps');
reset role; select tests_leq.deconnecter();

-- results, as the worker (postgres) -------------------------------------------------
create temp table ctx as
  select p.id as parcours_id, (select id from public.etapes e where e.parcours_id = p.id and e.ordre_global = 1) as etape1
  from public.parcours p where p.utilisateur_id = '11111111-1111-4111-8111-111111111111';
grant select on ctx to authenticated;

select is(public.appliquer_resultat(tests_leq.tentative_evaluee('11111111-1111-4111-8111-111111111111', (select etape1 from ctx), 10)), 'etape_echouee', 'a low score fails the step');
select is((select nombre_echecs from public.etapes where id = (select etape1 from ctx)), 1, 'one failure counted');
select is((select rattrapage_propose from public.etapes where id = (select etape1 from ctx)), false, 'no remediation after one failure');
select is(public.appliquer_resultat(tests_leq.tentative_evaluee('11111111-1111-4111-8111-111111111111', (select etape1 from ctx), 12)), 'etape_echouee', 'a second low score fails again');
select is((select rattrapage_propose from public.etapes where id = (select etape1 from ctx)), true, 'remediation proposed after two failures');

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select ((public.etape_du_jour()) #>> '{rythme,essais_aujourdhui}')::int), 2, 'two tries today on this step');
select lives_ok($$ select public.marquer_rattrapage_vu((select etape1 from ctx)) $$, 'A acknowledges the remediation');
reset role; select tests_leq.deconnecter();
select is((select rattrapage_propose from public.etapes where id = (select etape1 from ctx)), false, 'the flag is cleared');

select is(public.appliquer_resultat(tests_leq.tentative_evaluee('11111111-1111-4111-8111-111111111111', (select etape1 from ctx), 25)), 'etape_validee', 'a score at the threshold validates');
select is((select statut from public.etapes where id = (select etape1 from ctx)), 'validee', 'step 1 validée');
select is((select statut from public.etapes where parcours_id = (select parcours_id from ctx) and ordre_global = 2), 'disponible', 'step 2 unlocked');
select is((select resultat from public.tentatives where id = (select tentative_validante_id from public.etapes where id = (select etape1 from ctx))), 'etape_validee', 'the attempt carries the result');
select is(public.appliquer_resultat((select tentative_validante_id from public.etapes where id = (select etape1 from ctx))), null, 'applying twice does nothing');

-- rhythm: one validated today closes the day in gratuit, complet reopens it ----------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select (public.etape_du_jour()) #>> '{rythme,raison}'), 'limite_jour', 'the day is done in gratuit');
reset role; select tests_leq.deconnecter();
insert into public.abonnements (utilisateur_id, formule, source) values ('11111111-1111-4111-8111-111111111111', 'complet', 'manuel');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select (public.etape_du_jour()) #>> '{formule}'), 'complet', 'complet is read');
select is((select (public.etape_du_jour()) #>> '{rythme,raison}'), 'ok', 'no daily limit in complet');
reset role; select tests_leq.deconnecter();

-- three tries today on the current step exhaust the tries -----------------------------------
insert into public.tentatives (id, utilisateur_id, type, etape_id, enregistre_le, fuseau_horaire, decalage_minutes, statut)
select gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'etape', e.id, now(), 'Europe/Paris', 120, 'envoyee'
  from public.etapes e, generate_series(1, 3)
 where e.parcours_id = (select parcours_id from ctx) and e.ordre_global = 2;
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select (public.etape_du_jour()) #>> '{rythme,raison}'), 'limite_essais', 'three tries today block the step');
reset role; select tests_leq.deconnecter();

-- an abandoned attempt does not count as a try -------------------------------------------------
update public.tentatives set statut = 'abandon_technique'
 where etape_id = (select id from public.etapes where parcours_id = (select parcours_id from ctx) and ordre_global = 2)
   and id = (select id from public.tentatives where etape_id = (select id from public.etapes where parcours_id = (select parcours_id from ctx) and ordre_global = 2) limit 1);
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select ((public.etape_du_jour()) #>> '{rythme,essais_aujourdhui}')::int), 2, 'an abandoned attempt is not a try');
reset role; select tests_leq.deconnecter();

-- closing acte I unlocks acte II ------------------------------------------------------------------
do $$
declare v_etape uuid;
begin
  for v_etape in select e.id from public.etapes e where e.parcours_id = (select parcours_id from ctx) and e.ordre_global between 2 and 7 order by e.ordre_global loop
    perform public.appliquer_resultat(tests_leq.tentative_evaluee('11111111-1111-4111-8111-111111111111', v_etape, 30));
  end loop;
end $$;
select is((select statut from public.actes where parcours_id = (select parcours_id from ctx) and ordre = 1), 'traverse', 'acte I traversé');
select is((select statut from public.actes where parcours_id = (select parcours_id from ctx) and ordre = 2), 'en_cours', 'acte II en cours');
select is((select statut from public.etapes where parcours_id = (select parcours_id from ctx) and ordre_global = 8), 'disponible', 'first step of acte II available');
select is((select count(*) from public.etapes where parcours_id = (select parcours_id from ctx) and statut = 'validee'), 7::bigint, 'seven steps validated');

-- nothing applies without a note or for a diagnostic ----------------------------------------------
select is(public.appliquer_resultat((select id from public.tentatives where statut = 'envoyee' limit 1)), null, 'no evaluation, nothing applies');

select * from finish();
rollback;
