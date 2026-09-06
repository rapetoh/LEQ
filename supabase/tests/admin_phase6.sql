-- pgTAP tests for migration 0008 (workshops, announcements, suspension). One rolled-back transaction.
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

select tests_leq.creer_utilisateur('11111111-1111-4111-8111-111111111111', 'a@test.leq', false);
select tests_leq.creer_utilisateur('44444444-4444-4444-8444-444444444444', 'admin@test.leq', false);
update public.profils set role = 'admin' where id = '44444444-4444-4444-8444-444444444444';
insert into public.configuration (cle, type, valeur, description)
values ('plafond_annonces_par_mois', 'nombre', '2', 'x') on conflict (cle) do nothing;
create temp table ctx as select '11111111-1111-4111-8111-111111111111'::uuid as a, '44444444-4444-4444-8444-444444444444'::uuid as admin;
grant select on ctx to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.ateliers'::regclass), 'RLS on ateliers');
select ok((select relrowsecurity from pg_class where oid = 'public.annonces'::regclass), 'RLS on annonces');
select ok((select relrowsecurity from pg_class where oid = 'public.suspensions'::regclass), 'RLS on suspensions');

-- workshops: the admin writes, people read the published ones ------------------------------------
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok($$ insert into public.ateliers (titre, lieu, region, date_debut, places, publie) values ('Tenir une salle', 'Lyon', 'auvergne_rhone_alpes', now() + interval '10 days', 6, true) $$, 'the admin creates a published workshop');
select lives_ok($$ insert into public.ateliers (titre, lieu, en_ligne, date_debut, publie) values ('Brouillon', 'En ligne', true, now() + interval '20 days', false) $$, 'the admin creates a draft workshop');
select is((select count(*) from public.ateliers), 2::bigint, 'the admin sees both');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.ateliers), 1::bigint, 'a person sees only the published workshop');
select throws_ok($$ insert into public.ateliers (titre, lieu, date_debut) values ('x', 'y', now()) $$, '42501', null, 'a person cannot create a workshop');
reset role; select tests_leq.deconnecter();

-- announcements: cap of two a month, enforced in the database -----------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ select public.publier_annonce('x', 'y') $$, '42501', null, 'a person cannot publish an announcement');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select is(public.annonces_du_mois(), 0, 'nothing sent this month yet');
select lives_ok($$ select public.publier_annonce('Rebecca ouvre un atelier', 'Le 12 septembre, en direct.', (select id from public.ateliers where titre = 'Tenir une salle'), array['auvergne_rhone_alpes']) $$, 'the admin sends a first announcement');
select lives_ok($$ select public.publier_annonce('Un cours en ligne', 'Pour tout le monde.', null, array[]::text[]) $$, 'the admin sends a second one, to everyone');
select is(public.annonces_du_mois(), 2, 'two this month');
select throws_ok($$ select public.publier_annonce('Trois', 'de trop') $$, 'P0001', 'plafond_annonces_atteint', 'the third is refused by the cap');
select throws_ok($$ select public.publier_annonce('', 'corps') $$, '23514', null, 'an empty title is refused');
select is((select regions from public.annonces where titre = 'Un cours en ligne'), null, 'an empty region list means everyone');
select throws_ok($$ insert into public.annonces (titre, corps) values ('direct', 'non') $$, '42501', null, 'even the admin does not insert an announcement directly');
reset role; select tests_leq.deconnecter();
select is((select count(*) from public.jobs where type = 'envoyer_annonce' and charge ->> 'annonce_id' in (select id::text from public.annonces)), 2::bigint, 'one job per announcement');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.annonces), 2::bigint, 'people read the announcements (B1b)');
reset role; select tests_leq.deconnecter();

-- suspension ---------------------------------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(public.est_suspendu(), false, 'A is not suspended');
select throws_ok($$ select public.suspendre_compte((select admin from ctx), 'x') $$, '42501', null, 'a person cannot suspend anyone');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok($$ select public.suspendre_compte((select a from ctx), 'Harcèlement dans une prise publique') $$, 'the admin suspends A with a reason');
select throws_ok($$ select public.suspendre_compte((select a from ctx), '  ') $$, '23514', null, 'a reason is required');
select throws_ok($$ select public.suspendre_compte((select admin from ctx), 'x') $$, '42501', null, 'an admin account is not suspended here');
select is((select count(*) from public.suspensions where utilisateur_id = (select a from ctx) and levee_le is null), 1::bigint, 'one open suspension logged');
reset role; select tests_leq.deconnecter();
select isnt((select suspendu_le from public.profils where id = (select a from ctx)), null, 'suspendu_le is set');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(public.est_suspendu(), true, 'A is suspended');
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'diagnostic', now(), 'Europe/Paris', 120, 'envoyee') $$,
  '42501', null, 'a suspended person records nothing');
select throws_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'masterclass')) $$, '42501', 'compte_suspendu', 'a suspended person spends nothing');
select is((select count(*) from public.suspensions), 1::bigint, 'A reads the suspension that concerns them');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok($$ select public.reactiver_compte((select a from ctx)) $$, 'the admin reactivates A');
select is((select count(*) from public.suspensions where utilisateur_id = (select a from ctx) and levee_le is not null), 1::bigint, 'the suspension is closed in the log');
reset role; select tests_leq.deconnecter();
select is((select suspendu_le from public.profils where id = (select a from ctx)), null, 'suspendu_le is cleared');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'diagnostic', now(), 'Europe/Paris', 120, 'envoyee') $$,
  'A records again');
reset role; select tests_leq.deconnecter();

select * from finish();
rollback;
