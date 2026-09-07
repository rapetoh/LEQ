-- pgTAP tests for migration 0006 (streak, points, rewards, progress). One rolled-back transaction.
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
-- A take recorded at noon Paris time on a given day, already analysed.
create function tests_leq.prise(p_uid uuid, p_jour date, p_debit numeric, p_bequilles jsonb, p_tenus integer)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  -- Noon in Paris on that day, or now when noon has not come yet (the table refuses the future).
  insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
  values (v_id, p_uid, 'diagnostic', least(now(), (p_jour::text || ' 12:00')::timestamp at time zone 'Europe/Paris'), 'Europe/Paris', 120, 'retour_disponible');
  insert into public.analyses (tentative_id, mesures, transcription, fournisseur_transcription)
  values (v_id, jsonb_build_object('version', 1, 'duree_parole_s', 60,
            'debit', jsonb_build_object('mots_par_minute', p_debit),
            'mots_bequilles', jsonb_build_object('total', 3, 'par_minute', 3, 'par_type', p_bequilles),
            'silences', jsonb_build_object('total', 5, 'tenus', p_tenus)),
          '{}'::jsonb, 'stub');
  return v_id;
end; $$;
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
select tests_leq.creer_utilisateur('22222222-2222-4222-8222-222222222222', 'b@test.leq', false);
select tests_leq.creer_utilisateur('33333333-3333-4333-8333-333333333333', 'c@test.leq', true);
select tests_leq.creer_utilisateur('44444444-4444-4444-8444-444444444444', 'admin@test.leq', false);
select tests_leq.creer_utilisateur('55555555-5555-4555-8555-555555555555', 'e@test.leq', false);
select tests_leq.creer_utilisateur('66666666-6666-4666-8666-666666666666', 'f@test.leq', false);
update public.profils set fuseau_horaire = 'Europe/Paris' where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-555555555555');

-- "Today" is the real Paris day: the table refuses recordings in the future or older than 8 days.
create temp table ctx as select (now() at time zone 'Europe/Paris')::date as aujourdhui, '11111111-1111-4111-8111-111111111111'::uuid as a, '22222222-2222-4222-8222-222222222222'::uuid as b;
grant select on ctx to authenticated;

-- RLS is on ---------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.mouvements_points'::regclass), 'RLS on mouvements_points');
select ok((select relrowsecurity from pg_class where oid = 'public.recompenses'::regclass), 'RLS on recompenses');
select ok((select relrowsecurity from pg_class where oid = 'public.echanges_recompenses'::regclass), 'RLS on echanges_recompenses');
select ok((select relrowsecurity from pg_class where oid = 'public.recuperations_serie'::regclass), 'RLS on recuperations_serie');
select cmp_ok((select count(*) from public.recompenses where actif), '>=', 4::bigint, 'the shop is seeded');

-- the streak is replayed from the days with a take -----------------------------------------------
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'courante' from ctx)::int, 0, 'no take, no streak');
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'record' from ctx)::int, 0, 'no record either');
select tests_leq.prise((select a from ctx), (select aujourdhui - 7 from ctx), 121, '{"euh": 4}'::jsonb, 0);
select tests_leq.prise((select a from ctx), (select aujourdhui - 6 from ctx), 125, '{"euh": 3, "du coup": 1}'::jsonb, 1);
select tests_leq.prise((select a from ctx), (select aujourdhui - 5 from ctx), 130, '{"euh": 2}'::jsonb, 1);
select tests_leq.prise((select a from ctx), (select aujourdhui - 2 from ctx), 140, '{"euh": 1}'::jsonb, 3);
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'record' from ctx)::int, 3, 'the record is the longest run (three days in a row a week ago)');
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'courante' from ctx)::int, 0, 'the streak is broken: last take two days ago');
select is((select (public.calculer_serie(a, aujourdhui)) #>> '{recuperation,jour_a_couvrir}' from ctx), (select to_char(aujourdhui - 1, 'YYYY-MM-DD') from ctx), 'one recovery would cover yesterday');
select is((select (public.calculer_serie(a, aujourdhui)) #>> '{recuperation,restantes}' from ctx)::int, 1, 'one recovery available this month');
select is((select jsonb_array_length((public.calculer_serie(a, aujourdhui)) -> 'semaine') from ctx), 7, 'seven days in the week strip');
select is((select ((public.calculer_serie(a, aujourdhui)) -> 'semaine' -> 6 ->> 'jour') from ctx), (select to_char(aujourdhui, 'YYYY-MM-DD') from ctx), 'the strip ends today');
select is((select ((public.calculer_serie(a, aujourdhui)) -> 'semaine' -> 4 ->> 'actif') from ctx)::boolean, true, 'the day before yesterday is marked active');

-- the recovery covers yesterday and revives the streak -------------------------------------------
select is((select public.activer_recuperation(a, aujourdhui) from ctx), (select aujourdhui - 1 from ctx), 'the recovery covers yesterday');
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'courante' from ctx)::int, 2, 'the streak is alive again: two days');
select is((select (public.calculer_serie(a, aujourdhui)) #>> '{recuperation,restantes}' from ctx)::int, 0, 'no recovery left this month');
select is((select (public.calculer_serie(a, aujourdhui)) #>> '{recuperation,jour_reparable}' from ctx), null, 'nothing is repairable any more');
select throws_ok($$ select public.activer_recuperation(a, aujourdhui) from ctx $$, 'P0001', 'rien_a_couvrir', 'nothing left to cover today');
select tests_leq.prise((select a from ctx), (select aujourdhui from ctx), 148, '{"euh": 1}'::jsonb, 4);
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'courante' from ctx)::int, 3, 'a take today extends the streak to 3');
select is((select (public.calculer_serie(a, aujourdhui)) ->> 'validee_aujourdhui' from ctx)::boolean, true, 'today is validated');
-- B misses two days: one recovery cannot repair that
select tests_leq.prise((select b from ctx), (select aujourdhui - 4 from ctx), 120, '{}'::jsonb, 0);
select is((select (public.calculer_serie(b, aujourdhui)) #>> '{recuperation,jour_a_couvrir}' from ctx), null, 'a gap of three days is not repairable');
select throws_ok($$ select public.activer_recuperation(b, aujourdhui) from ctx $$, 'P0001', 'rien_a_couvrir', 'B cannot activate a recovery');
-- recording today after a missed yesterday: the recovery still closes the gap -----------------
select tests_leq.prise('55555555-5555-4555-8555-555555555555', (select aujourdhui - 3 from ctx), 120, '{}'::jsonb, 0);
select tests_leq.prise('55555555-5555-4555-8555-555555555555', (select aujourdhui - 2 from ctx), 120, '{}'::jsonb, 0);
select tests_leq.prise('55555555-5555-4555-8555-555555555555', (select aujourdhui from ctx), 120, '{}'::jsonb, 0);
select is((select (public.calculer_serie('55555555-5555-4555-8555-555555555555', aujourdhui)) ->> 'courante' from ctx)::int, 1, 'E recorded today after a gap: the run restarted at 1');
select is((select (public.calculer_serie('55555555-5555-4555-8555-555555555555', aujourdhui)) #>> '{recuperation,jour_a_couvrir}' from ctx), (select to_char(aujourdhui - 1, 'YYYY-MM-DD') from ctx), 'yesterday is still repairable');
select is((select public.activer_recuperation('55555555-5555-4555-8555-555555555555', aujourdhui) from ctx), (select aujourdhui - 1 from ctx), 'E covers yesterday');
select is((select (public.calculer_serie('55555555-5555-4555-8555-555555555555', aujourdhui)) ->> 'courante' from ctx)::int, 4, 'one continuous run of four days');

-- "today" follows the zone of the last take when the profile has none ----------------------------
insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
values (gen_random_uuid(), '66666666-6666-4666-8666-666666666666', 'diagnostic', now(), 'America/Montreal', -240, 'retour_disponible');
select is(public.fuseau_de('66666666-6666-4666-8666-666666666666'), 'America/Montreal', 'F''s zone is the zone of the last take');
select tests_leq.connecter('66666666-6666-4666-8666-666666666666', false, 'utilisateur');
select is((select (public.ma_serie()) ->> 'validee_aujourdhui')::boolean, true, 'F''s take counts for F''s today, whatever the hour in Paris');
select is((select (public.ma_serie()) ->> 'aujourdhui'), to_char(now() at time zone 'America/Montreal', 'YYYY-MM-DD'), 'today is the Montreal day');
reset role; select tests_leq.deconnecter();

-- the caller-facing functions run as the person
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok($$ select public.ma_serie() $$, 'ma_serie() answers the signed-in person');
select is((select (public.ma_serie()) ->> 'record')::int, 3, 'the same record through ma_serie()');
select throws_ok($$ select public.calculer_serie('11111111-1111-4111-8111-111111111111', current_date) $$, '42501', null, 'the internal function is not callable directly');
reset role; select tests_leq.deconnecter();

-- points: the ledger is credited when a step is validated -------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok($$ select public.obtenir_parcours() $$, 'A gets a path');
select is((select (public.mes_points()) ->> 'solde')::int, 0, 'no points yet');
reset role; select tests_leq.deconnecter();
create temp table etape1 as
  select e.id, d.points from public.etapes e join public.defis d on d.id = e.defi_id
   where e.parcours_id = (select id from public.parcours where utilisateur_id = (select a from ctx)) and e.ordre_global = 1;
grant select on etape1 to authenticated;
select is(public.appliquer_resultat(tests_leq.tentative_evaluee((select a from ctx), (select id from etape1), 30)), 'etape_validee', 'the first step is validated');
select is((select public.solde_points(a) from ctx), (select points from etape1), 'the défi''s points are credited');
select is((select count(*) from public.mouvements_points where utilisateur_id = (select a from ctx) and motif = 'defi_valide'), 1::bigint, 'one movement');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select (public.mes_points()) ->> 'cette_semaine')::int, (select points from etape1), 'the points count for this week');
reset role; select tests_leq.deconnecter();
create temp table etape2 as select e.id from public.etapes e where e.parcours_id = (select id from public.parcours where utilisateur_id = (select a from ctx)) and e.ordre_global = 2;
create temp table echec as select tests_leq.tentative_evaluee((select a from ctx), (select id from etape2), 1) as id;
select is(public.appliquer_resultat((select id from echec)), 'etape_echouee', 'a low note fails the second step');
select is(public.appliquer_resultat((select id from echec)), 'etape_echouee', 'a replay answers the same result');
select is((select nombre_echecs from public.etapes where id = (select id from etape2)), 1, 'the failure is counted once');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ insert into public.mouvements_points (utilisateur_id, montant, motif) values ('11111111-1111-4111-8111-111111111111', 1000, 'ajustement') $$, '42501', null, 'a person cannot write the ledger');
reset role; select tests_leq.deconnecter();

-- rewards: exchange, insufficient points, cap, anonymous refused ----------------------------------
insert into public.mouvements_points (utilisateur_id, montant, motif, reference) values ((select a from ctx), 1500, 'ajustement', 'test:a');
insert into public.mouvements_points (utilisateur_id, montant, motif, reference) values ((select b from ctx), 5000, 'ajustement', 'test:b');
update public.recompenses set plafond_par_mois = 1 where cle = 'place_atelier';
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select jsonb_array_length((public.mes_recompenses()) -> 'recompenses')), (select count(*)::int from public.recompenses where actif), 'the shop lists every active reward');
select is((select r ->> 'restantes_ce_mois' from jsonb_array_elements((public.mes_recompenses()) -> 'recompenses') r where r ->> 'cle' = 'place_atelier')::int, 1, 'one place left this month');
select lives_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'place_atelier')) $$, 'A exchanges the workshop place');
select is((select (public.mes_points()) ->> 'solde')::int, 1500 + (select points from etape1) - 1200, 'the cost left the balance');
select is((select r ->> 'restantes_ce_mois' from jsonb_array_elements((public.mes_recompenses()) -> 'recompenses') r where r ->> 'cle' = 'place_atelier')::int, 0, 'no place left this month');
select throws_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'reduction_pack')) $$, 'P0001', 'points_insuffisants', 'not enough points for the pack');
select throws_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'heure_rebecca')) $$, 'P0001', 'recompense_non_echangeable', 'the hour with Rebecca does not buy');
select is((select jsonb_array_length((public.mes_recompenses()) -> 'echanges')), 1, 'A sees the exchange');
select is((select count(*) from public.echanges_recompenses), 1::bigint, 'A sees only own exchanges');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select throws_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'place_atelier')) $$, 'P0001', 'plafond_atteint', 'the monthly cap stops B');
select lives_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'masterclass')) $$, 'B gets the masterclass');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select throws_ok($$ select public.echanger_recompense((select id from public.recompenses where cle = 'masterclass')) $$, '42501', 'compte_requis', 'an anonymous person cannot exchange');
reset role; select tests_leq.deconnecter();

-- the admin honours or cancels; cancelling refunds ----------------------------------------------
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select is((select count(*) from public.echanges_recompenses), 2::bigint, 'the admin sees every exchange');
select lives_ok($$ select public.traiter_echange((select id from public.echanges_recompenses where utilisateur_id = (select a from ctx)), 'honore', 'place envoyée') $$, 'the admin honours A''s exchange');
select is((select statut from public.echanges_recompenses where utilisateur_id = (select a from ctx)), 'honore', 'statut honore');
select lives_ok($$ select public.traiter_echange((select id from public.echanges_recompenses where utilisateur_id = (select b from ctx)), 'annule') $$, 'the admin cancels B''s exchange');
select is((select r ->> 'restantes_ce_mois' from jsonb_array_elements((public.mes_recompenses()) -> 'recompenses') r where r ->> 'cle' = 'masterclass'), null, 'no cap on the masterclass');
reset role; select tests_leq.deconnecter();
select is((select public.solde_points(b) from ctx), 5000, 'B gets the points back');
select is((select statut from public.echanges_recompenses where utilisateur_id = (select b from ctx)), 'annule', 'statut annule');
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok($$ select public.traiter_echange((select id from public.echanges_recompenses where utilisateur_id = (select b from ctx)), 'a_traiter') $$, 'the admin re-opens B''s exchange');
reset role; select tests_leq.deconnecter();
select is((select public.solde_points(b) from ctx), 5000 - 300, 'the points are taken again');
select is((select count(*) from public.mouvements_points where utilisateur_id = (select b from ctx)), 4::bigint, 'four movements, none deleted: the ledger is append-only');
select is((select statut from public.echanges_recompenses where utilisateur_id = (select b from ctx)), 'a_traiter', 'statut a_traiter again');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ select public.traiter_echange((select id from public.echanges_recompenses limit 1), 'honore') $$, '42501', null, 'a person cannot treat exchanges');
reset role; select tests_leq.deconnecter();

-- progress ---------------------------------------------------------------------------------------
select is((select (public.resume_progres_de(a, aujourdhui)) #>> '{mois,prises}' from ctx)::int,
  (select count(*)::int from public.tentatives t, ctx where t.utilisateur_id = ctx.a and public.jour_local(t.enregistre_le, t.fuseau_horaire) >= date_trunc('month', ctx.aujourdhui)::date),
  'the month counts the takes recorded since the first of the month');
select is((select (public.resume_progres_de(a, aujourdhui)) #>> '{mois,defis_releves}' from ctx)::int, 1, 'one défi relevé this month');
select is((select (public.resume_progres_de(a, aujourdhui)) #>> '{premiere,debit}' from ctx)::numeric, 121::numeric, 'the first take''s pace');
select is((select (public.resume_progres_de(a, aujourdhui)) #>> '{derniere,debit}' from ctx)::numeric, 148::numeric, 'the last take''s pace');
select is((select (public.resume_progres_de(a, aujourdhui)) #>> '{derniere,silences_tenus}' from ctx)::int, 4, 'the last take''s held silences');
select cmp_ok((select jsonb_array_length((public.resume_progres_de(a, aujourdhui)) -> 'bequilles_semaines') from ctx), '>=', 1, 'crutch words are grouped by week');
select is((select sum((s -> 'par_type' ->> 'euh')::int)::int from ctx, jsonb_array_elements((public.resume_progres_de(a, aujourdhui)) -> 'bequilles_semaines') s), 11, 'the weeks sum every "euh" of the six weeks (4+3+2+1+1)');
select is((select sum((s ->> 'prises')::int)::int from ctx, jsonb_array_elements((public.resume_progres_de(a, aujourdhui)) -> 'bequilles_semaines') s), 5, 'five analysed takes across the weeks');
select is((select (public.resume_progres_de(a, aujourdhui)) #>> '{serie,record}' from ctx)::int, 3, 'the streak rides along');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok($$ select public.resume_progres() $$, 'resume_progres() answers the signed-in person');
reset role; select tests_leq.deconnecter();

select * from finish();
rollback;
