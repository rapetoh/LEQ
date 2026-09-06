# Status

Last updated: 2026-09-06, Phase 4 review fixes and Phase 5 slices 1 to 3 (ledgers, streak, shop, progress, admin rewards). Update this file in the same commit as any change of state.

How to read it: one line per phase, then the checklist of the phase in progress, then what has actually been verified on a machine versus what has only been written, then what is blocked and by whom, then the next actions in order.

## State by phase

| Phase | Name                                                        | State                                                                                                     |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 0     | Foundations                                                 | Built, green locally, schema live on the hosted project and verified; Fly deploy and device checks remain |
| 1     | Socle: flow A end to end with a stub transcriber            | Built (slices 1 to 6), server loop verified; the device walkthrough (slice 7) waits for Roch              |
| 2     | STT bench, then debate cost spike                           | Harness written, corpus empty, keys awaited                                                               |
| 3     | Measurement engine, grid engine, feedback, calibration tool | Engine and grid rules exist and are tested; wording and calibration tool not started                      |
| 4     | Path machinery, three formats, entitlements, RevenueCat     | Built and reviewed (seven fixes applied, migrations 0005 and 0007); RevenueCat waits for the account      |
| 5     | Streak, points, shop, bridge to Rebecca                     | Slices 1 to 3 built (database, mobile, admin); simulator boot and Roch's tap-through remain               |
| 6     | Admin space, complete                                       | In progress since 2026-09-06 (checklist below); offers content and moderation queue wait                  |
| 7     | Arena and duels, shipped off, public web                    | Not started                                                                                               |
| 8     | Face-à-face                                                 | Not started                                                                                               |
| 9     | Release                                                     | Not started                                                                                               |

A phase ends when its acceptance list is green and this file says so.

## What exists today

| Workspace          | Content                                                                                                                                                                                                                                                                                                                                                                            | Checks                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/domaine` | Zod schemas and types for every Phase 0 table, the configuration seed definitions, the grid rule engine (`evaluerRegle`, `evaluerCriteres`), job charges                                                                                                                                                                                                                           | typecheck, 27 tests                                                      |
| `packages/moteur`  | The measurement engine over PCM plus transcript (nine measure families of chapter 5), WAV codec, French WER, deterministic transcriber and prosody stubs, synthetic fixtures; the STT bench harness (`bench/`) with the four provider adapters declared and refusing to run without keys                                                                                           | typecheck, 33 tests                                                      |
| `apps/serveur`     | Hono service with `/sante`, the worker loop, the analysis pipeline in the order of the state diagram, the sweep, the anonymous purge and account deletion jobs, ffmpeg decoding, the Praat prosody CLI (Python) with its pytest, Dockerfile, Fly configuration with two process groups                                                                                             | typecheck, 10 tests, 4 Python tests                                      |
| `supabase/`        | Seven migrations (socle, socle_phase1, demandes_export, parcours, correctifs_parcours, serie_points, grilles_anonymes), idempotent seed with the mockup's static path and shop, pgTAP suites (socle 133, socle_phase1 22, demandes_export 7, parcours 59, serie_points 63), CLI config, French auth e-mail templates, two remote runners and a seed applier                        | pushed to the hosted project on 2026-09-06; every suite green against it |
| `apps/mobile`      | Expo SDK 57 app: tokens and Manrope, themes, Bulle placeholder, UI primitives, tab bar honouring the `arene` flag, flow A (A1 to A7) with the recorder, the local queue and the waiting states, G3 with the streak protection, the path (B1, B3, B4, B5 with H2, H1, H3, H4, H5, X5), the streak and points on G1 and B1, D1 and D1b progress, D2 shop, F1 bridge, local reminders | typecheck, lint, 46 tests                                                |
| `apps/admin`       | Vite + React space: login, role gate, layout, home, configuration editor, flags, the banks (défis act by act, exercices), the shop (récompenses with cost and monthly cap) and the exchanges to honour or cancel                                                                                                                                                                   | typecheck, lint, 27 tests                                                |
| `apps/web`         | Placeholder README (Phase 7)                                                                                                                                                                                                                                                                                                                                                       | none                                                                     |
| `docs/`            | This folder, eight ADRs                                                                                                                                                                                                                                                                                                                                                            | prettier                                                                 |
| CI                 | `.github/workflows/check.yml`: typecheck, lint, tests, prettier, Python tests                                                                                                                                                                                                                                                                                                      | not yet run on GitHub                                                    |

`npm run check` and `npm run format:check` are green at the root on Node 25 (Vitest warns about the engine, nothing more).

## Phase 0 checklist

Ticked only when verified on a machine.

1. Repository
   - [x] `git init`, remote `rapetoh/LEQ`, README commit pulled, `Brainstorming/` committed untouched
2. Root tooling
   - [x] Workspaces, scripts `typecheck`, `lint`, `test`, `check`, `format`, `format:check`
   - [x] `tsconfig.base.json` (strict), Prettier, EditorConfig, `.gitignore`, `.nvmrc`
   - [x] `npm install` at the root succeeds (1,143 packages)
   - [x] `npm run check` green locally
3. `packages/domaine`
   - [x] Schemas for every Phase 0 table, rule v1 engine, configuration keys and defaults, flags, jobs
   - [x] Names match docs/DATA-MODEL.md (reviewed file by file)
   - [x] `typecheck` and `test` pass
4. `supabase/`
   - [x] `config.toml` (Postgres 17, anonymous sign-in, manual linking, hook)
   - [x] Migration `20260906000000_socle.sql` written and reviewed by reading; one fix applied (the column-protection trigger now lets a direct database connection change `role`, which the worker and the operator need)
   - [x] Seed written, idempotent
   - [x] Database tests run against the hosted project inside a rolled-back transaction: 133 assertions green (`node supabase/tests/executer-distant.mjs supabase/tests/socle.sql`)
   - [x] Project "LEQ" created on a dedicated account (join.leq@gmail.com, org "LEQ's Org"), ref `gnabuebxleogsuhvdgpk`, eu-west-1 (Ireland; Paris was the plan, kept as is)
   - [x] Migration and seed pushed (`db push --include-seed`, first try clean); auth settings applied with `config push` (anonymous sign-ins, manual linking, access token hook, `leq://auth` redirect); pg_cron confirmed (three `leq_*` schedules active)
5. `apps/mobile`
   - [x] Package `@leq/mobile`, `app.json` with name LEQ, scheme `leq`, bundle identifier `com.leqapp.mobile` (awaiting confirmation), French microphone text
   - [x] Tokens, Manrope, themes, Bulle placeholder
   - [x] `fr.ts` with the Phase 0 strings
   - [x] Tab bar with Aujourd'hui, Défis, Progrès, Moi, and L'Arène only when the flag is on (tested)
   - [x] A1 and A2 implemented, tabs as shells, X1
   - [x] Supabase client with anonymous sign-in at first launch
   - [x] Audio spike (a) as desk research: ADR-007 proposes `react-native-audio-api` for both paths, with a 15-item device checklist for Phase 1
   - [x] `npx expo run:ios --device "iPhone 17" --port 8082` builds, installs and boots the shell on the simulator: A1 renders as in the mockup (screenshot checked 2026-09-06). The tab bar could not be screenshotted: a deep link sent from outside the app triggers an iOS "Open in LEQ?" confirmation the simulator tool cannot answer; the tab logic is covered by the jest test and the manual tap-through is Roch's
   - [x] Native project regenerated with `prebuild --clean`: bundle identifier `com.leqapp.mobile`, French microphone text in the Info.plist
6. `apps/admin`
   - [x] Login, role gate, configuration editor, flags, tests
   - [x] Verified through the API against the hosted project: the admin token carries `app_metadata.role = admin`, the admin update returns one row, an anonymous user reads configuration but its update touches zero rows, may insert a `diagnostic` attempt (201) and not a step (403), and the trigger queues the analysis job. First admin account: join.leq@gmail.com (password in the root `.env`)
7. `apps/serveur`
   - [x] Hono, `/sante`, worker loop, the four job handlers, pipeline tests
   - [x] Dockerfile (ffmpeg, Python, Praat), `prosodie/extraire.py` with 4 passing tests on this Mac
   - [x] `fly.toml` with process groups `worker` and `temps-reel` in `cdg`
   - [ ] Deployed once (blocked on `fly auth login`)
   - [x] A seeded `balayer_audio` job claimed and completed by the worker running on this Mac against the hosted database (413 ms). The same check on Fly follows the deploy
8. CI
   - [x] Workflow file present
   - [ ] First green run on GitHub (checked after the push that carries this file)
9. Docs
   - [x] STATUS, RUNBOOK, ARCHITECTURE, DATA-MODEL, SCREENS, EXTERNAL-SERVICES, OPEN-INPUTS, STRINGS, decisions/README, ADR-001 to ADR-008, a README in every workspace
   - [ ] Corpus spike (b): Common Voice FR subsets listed, consent text written, first recordings collected (bench layout and metadata format are written; no audio yet)
10. Commits

- [x] Pushed after the foundations and the CI file
- [x] Pushed after the Phase 0 build (this commit)

## Verified versus unverified

Verified on Roch's Mac on 2026-09-06 by running them:

- `npm install`, `npm run check` (typecheck, lint, tests in the five workspaces), `npm run format:check`.
- `apps/serveur/prosodie`: `pytest` in a virtualenv with `praat-parselmouth` on Python 3.9 (4 tests: a 220 Hz tone reads back within 5 Hz, silence is unvoiced, a too-short sound gives null tracks, the CLI writes JSON).
- ffmpeg 9 installed through Homebrew.

Written and reviewed by reading, never run:

- The Dockerfile image itself: the worker ran from this Mac, not from the container.
- `fly.toml`: no Fly login yet.
- The mobile shell beyond A1 on the simulator (tabs, A2, X1): covered by jest-expo tests only; Roch taps through on his phone or the simulator.
- The admin interface itself in a browser against the project: the RLS round trip was verified through the API, not by clicking through the pages.
- The end-to-end pipeline against a real bucket and database: the order of writes and the failure paths are covered by tests with injected fakes.
- The ADR-007 audio decision: desk research with sources; every claim about device behaviour is in the Phase 1 checklist.

Decisions taken during integration (not in the plan):

- The server's transcriber stub delegates to the engine's deterministic fake transcript instead of returning an empty one, so the feedback screens can be exercised end to end before the STT bench.
- Word timestamps are rounded to the millisecond before every threshold comparison in the engine (a gap of exactly 0.3 s was reading as 0.30000000000000004).
- `expo-audio` stays in the mobile app for the microphone permission only, behind `src/services/micro.ts`; ADR-007 forbids using it for capture and it leaves the project when the Phase 1 recorder lands.
- Node 25 is accepted locally (Vitest warns), CI runs Node 22.
- Expo's experimental typed routes are off (`app.json`, `experiments.typedRoutes: false`): npm keeps `expo-router` nested under `apps/mobile/node_modules` (a fresh install and a dedupe both leave it there, without a stated conflict), and the typed-routes generator inside `@expo/cli` requires `expo-router/_ctx-shared` from the root, where it is not found. Route strings stay plain strings; nothing else changes. Revisit when Expo fixes the resolution or when npm hoists the package.
- Native font embedding through the expo-font plugin was dropped: it resolved font files relative to the app folder, which fails in a workspace; the root layout loads Manrope at runtime.
- The Money App's bundler often occupies port 8081 on this Mac; LEQ runs its bundler on 8082 (`--port 8082`), documented in the runbook.

## Blocked

- Fly.io: CLI installed, not logged in. `fly auth login` once, then the first deploy and the job-claim verification.
- Device checks of ADR-007: run on Roch's iPhone and the simulator first (his testing setup); the Android half waits for an EAS development build on a borrowed or later device, before release.

## Phase 1 checklist (socle)

Written before the work started, as the rule says. Slices are built in this order; each ends with its checks green, `npm run check` green, docs updated, a commit pushed. Boxes are ticked when verified on a machine.

1. Contract and database (migration `0002_socle_phase1`)
   - [ ] `reponses_accueil` (the three onboarding answers, fixed option codes), `jetons_push` (Expo push tokens per device), `profils.prenom` set at A7, `demander_suppression_compte()` RPC that queues the `supprimer_compte` job for the caller, `tentatives` added to the Realtime publication
   - [ ] `@leq/domaine` schemas and option lists; pgTAP additions green against the hosted project
2. Recording stack on the phone (ADR-007)
   - [x] `react-native-audio-api` 0.13.3 installed with its config plugin (microphone text, background mode, Android foreground service of type microphone); the development build compiles and installs on the iPhone 17 simulator with React Native 0.86.3 (ADR-007 item 1)
   - [x] Recording service written (`src/services/enregistrement.ts`): session `record` in `measurement` mode, `.m4a` 16 kHz mono 64 kbps in the cache directory, level meter from the raw buffers, an interruption ends the take. Not yet exercised on a device: the simulator flow needs taps (slice 7)
   - [ ] Fallback documented and exercised only if the build fails (ADR-007, expo-audio recorder plus a session module)
3. Local queue and upload
   - [x] Queue written: pure state machine (`fileMachine.ts`), orchestrator with injected dependencies (`file.ts`), real wiring (`prises.ts`: AsyncStorage index, cache files, expo-network, triggers on foreground and network return), upload and insert idempotent by attempt id (`tentatives.ts`), Android backup disabled in `app.json`, expiry from `expiration_file_locale_jours`
   - [x] 11 unit tests: transitions, backoff, expiry, cleanup, interrupted take dropped, offline wait, failure and retry
4. Screens of flow A and the X states
   - [x] Screens written: A3 (`accueil/questions`), A4 with the X4 banner (`accueil/prise`), A5, X2 and X3 as states of one screen (`accueil/analyse`), A6 (`accueil/profil`), A7 (`accueil/compte`, e-mail code path live, Apple and Google buttons present but disabled until credentials). Typecheck, lint and tests green; not yet walked through on a device
   - [x] `useSuiviPrise` follows a take from the queue to the server statuses (Realtime on `tentatives`, polling every 15 s)
5. Server side of the loop
   - [x] `duree_s` written from the decoded audio
   - [x] Push "Ton retour est prêt" sent by the worker through Expo's push API after `retour_disponible`, one attempt, `DeviceNotRegistered` switches the token off (3 tests). Phone side: permission asked at "Quitter, on te préviendra", token registered in `jetons_push` (EAS project `@rxpetoh/leq`, id in `app.json`), a tap opens the take's screen. Not verified on a device (push needs a physical phone)
   - [x] Account deletion written end to end: G3 confirms, calls `demander_suppression_compte()`, cancels the queued takes, signs out, wipes the phone's storage and gets a fresh anonymous session; the worker's `supprimer_compte` job removes objects then the auth user (RPC and job verified by pgTAP; the phone path not yet tapped through)
6. Settings G3, minimal
   - [x] G3 written (`src/app/reglages.tsx`): the voice statement, "Publier sous mon prénom", the export request (table `demandes_export`, migration 0003, 7 pgTAP assertions, anonymous accounts refused), "Supprimer mon compte" with confirmation, the four notification switches and the reminder time (display only until Phase 5), night mode and reduced motion. Reached from the Moi tab
7. End to end on the simulator, then on Roch's iPhone
   - [x] Server side, on a synthetic 66 s M4A pushed exactly as the phone does (`apps/serveur/scripts/simuler-prise.mjs`): anonymous upload 200, insert 201, job claimed, transcription (stub), ffmpeg, Praat (pitch read at the synthesised 160 Hz), measures, analysis and evaluation written, audio object deleted, `retour_disponible` in 3.9 s, `duree_s` 66.00
   - [x] The Phase 1 build (audio, notifications, network, crypto modules) boots on the simulator and renders A1 with no runtime warning
   - [ ] Same loop driven from the app on the simulator (A1 to A6): needs taps, Roch or a later automation
   - [ ] Offline: airplane mode during A4, the take waits, sends when the network returns, the streak day is the recording day (checked in the row)
   - [ ] Failure injection in the worker: X3 shows, no `resultat`, nothing consumed
   - [ ] Deletion leaves no row and no object for the test user
   - [ ] ADR-007 checklist items 1 to 9 on Roch's iPhone (needs him)

Phase 1 acceptance: every box above, plus the privacy text sent for lawyer review (docs/OPEN-INPUTS.md).

## Phase 4 checklist (path machinery)

Built while the device walkthrough of Phase 1 waits for Roch. The generator itself is not written: its rules do not exist yet (cahier chapter 4). A static path, seeded from the validated mockup and marked provisional, exercises everything.

1. Contract and database (migration `0004_parcours`)
   - [x] Banks, per-person path, `abonnements`, the four functions (`obtenir_parcours`, `etape_du_jour`, `marquer_rattrapage_vu`, `appliquer_resultat`): migration 0004 applied on the hosted project
   - [x] Seed from the mockup applied (3 acts, 13 défis, 5 exercices, all `provisoire`); acte III empty until Rebecca's content. Note: `db push --include-seed` reported the seed applied without inserting it; `supabase/scripts/appliquer-seed.mjs` applies it directly
   - [x] pgTAP `tests/parcours.sql`: 43 assertions green on the hosted project (path creation for a user and an anonymous user, RLS, failure and remediation, validation and unlock, daily limit in gratuit lifted by complet, tries limit, abandoned attempt not counted, act closing); socle suite made robust to real jobs on the database
2. Server
   - [x] The pipeline calls `appliquer_resultat()` inside the transaction that writes the evaluation and logs the result; without a published grid the step stays open (13 server tests green)
3. Mobile
   - [x] B1 shows the real step of the day (title, act, position, points, formula and rhythm) in its five states (`etatAujourdhui`, tested); "Je me lance" opens B3, or X5 first when the remediation is proposed (5 render tests)
   - [x] B3 brief for the three formats (standard; texte with the reading time and the text; long with the three steps and the plan), locked and validated steps refused with a sentence, the daily limit redirects to H5; B4 is the diagnostic recorder made shared (`components/EcranPrise.tsx`, type `etape`, `duree_etape_min_s` new configuration key, text shown before the timer, preparation countdown with the plan); the waiting screen is shared too (`components/EcranAnalyse.tsx`, `suite` = profile or feedback); B5 shows the measures, the grid list and the result (H2 on the same screen); H3 opens when the take closed the act (`fermeLActe`, tested)
   - [x] H1 map of acts (mist, open act with its nodes, folded acts), H4 folded act with past results (score "Grille de Rebecca · n sur max", measures, relative date through Intl), H5 and H5b daily limit, X5 remediation with the exercise screen (timed practice, not recorded, not analysed: question for Rebecca in docs/OPEN-INPUTS.md). A tapped push opens the right waiting screen by attempt type
   - [ ] Walked through on the simulator (needs taps: Roch, or a later automation)
4. Admin
   - [x] Défis page (`/defis`): the bank act by act, create (`/defis/nouveau`) and edit (`/defis/:id`) in the three formats with the pure validation of `modele/defis.ts` (tested), reorder with arrows through `echanger_ordre_defis()` (migration 0005, atomic, admin only, 7 pgTAP assertions), mark validated (provisoire off) and deactivate with confirmation, rename or add an act. Exercices page (`/exercices`): list, create, edit, validate, deactivate. Home cards and navigation updated (12 admin tests added, 22 in all)
5. Verification
   - [x] pgTAP green on the hosted project (parcours 50), server tests (13), mobile tests for the rhythm, the result and the B1 card (37), admin tests (22), `npm run check` and `npm run format:check` green
   - [x] Simulator boot with the Phase 4 app: `npx expo run:ios --device "iPhone 17" --port 8082` builds (0 errors), installs, bundles 2,266 modules with no runtime warning, A1 renders (screenshot checked 2026-09-06). The path screens themselves need taps: Roch's walkthrough, or a later automation
6. Review (two independent readers, 2026-09-06)
   - [x] Fixed: the feedback query embedded `etapes` through two foreign keys and PostgREST refused it (every B5 failed); anonymous people could not insert a step attempt (RLS, migration 0005); a deactivated défi vanished from existing paths (RLS, 0005); `etapes.ordre` was the bank position, not a rank (0005); the recorder left the partial file on the phone on cancel; a double tap on "Commencer" could start two recordings; formula names were hardcoded; curly apostrophes; the admin's format switch left stale fields that blocked the save without a visible error; the reorder arrows re-enabled before the list refreshed; the header actions remounted the form and dropped edits; the pgTAP reorder test depended on the live bank order; `defis.ordre` had no positivity check; anonymous people could not read a published grid (0007)

## Phase 5 checklist (streak, points, shop, bridge to Rebecca)

Written before the work started. Cahier chapters 6 and 7, ADR-009. Slices in order; each ends with its checks green, docs updated, a commit pushed.

1. Contract and database (migration `0006_serie_points`)
   - [x] `mouvements_points`, `recuperations_serie`, `recompenses`, `echanges_recompenses`; `calculer_serie` / `ma_serie`, `activer_recuperation_serie`, `mes_points`, `mes_recompenses`, `echanger_recompense`, `traiter_echange`, `resume_progres`; `appliquer_resultat` credits the défi's points; seed of the mockup's four rewards (provisoire); configuration key `heure_alerte_serie`; ADR-009 written
   - [x] pgTAP `tests/serie_points.sql`: 63 assertions green on the hosted project (replay, record, recovery and its two refusals, ledger idempotence, exchange, insufficient points, monthly cap, anonymous refused, admin honours and cancels with refund, progress aggregates); `@leq/domaine` schemas (`progres.ts`)
2. Mobile
   - [x] G1 shows the real streak, points and weeks won; B1 shows the streak chip and the points tile; "Mes récompenses" opens D2
   - [x] D1 and D1b from `resume_progres()`: week strip, the month in three numbers, crutch words per week (pure helpers tested), pace bar with the zone that carries, before and now; the five voices and the month's heading wait for the grid; X1 stays until the first analysed take
   - [x] D2 shop from `mes_recompenses()`: balance, rewards with cost and remaining quantity, exchange with confirmation, the five refusals in plain French, history; the hour with Rebecca shown as a distinction
   - [x] G3 "Protéger ma série": state and activation through `activer_recuperation_serie()`, refusals in plain French
   - [x] F1 bridge to Rebecca (`/rebecca`): the pitch, the one-to-one line, the workshop card as a placeholder until Phase 6 (testimonial and points claims of the mockup not shown: docs/STRINGS.md)
   - [x] Local notifications (`services/rappels.ts`, pure plan tested): the daily reminder at `heure_rappel` and the streak alert at `heure_alerte_serie` when nothing was recorded today, both honouring the G3 switches, recomputed on foreground and after a take
3. Admin
   - [x] Récompenses page: list, create, edit, type, cost, monthly cap, validate, deactivate (validation tested); Échanges: filter by status, honour, cancel with confirmation and refund
4. Verification
   - [x] pgTAP (all suites), server (13), mobile (46) and admin (27) tests green; `npm run check` and `npm run format:check` green
   - [x] Simulator boot with the Phase 5 app: builds (0 errors), installs, bundles 2,274 modules with no runtime warning, A1 renders (screenshot checked 2026-09-06)
   - [ ] Roch: tap through D1, D2, G3 protection and a reminder on his phone

## Phase 6 checklist (admin space, complete)

Written before the work started. Cahier chapters 8, 11 (suspension), 12 (announcements). Offers content waits for Rebecca and RevenueCat; the moderation queue waits for the public takes of Phase 7.

1. Contract and database (migration `0008_admin_phase6`)
   - [x] `ateliers` (Rebecca's workshops: title, place or online, region, date, places, link, optional reward for the place, published flag), `annonces` (an announcement sent once, optional workshop, optional region list, `envoyee_le`, sent and failed counts), `suspensions` (append-only log); `publier_annonce()` enforces the monthly cap (`plafond_annonces_par_mois`) in the database, not in the SPA, and queues the `envoyer_annonce` job; `suspendre_compte()` and `reactiver_compte()` (admin only); `est_suspendu()`; a suspended person can no longer insert attempts or exchange points; configuration key `mots_bequilles` (json list) so Rebecca edits the filler words
   - [x] pgTAP `tests/admin_phase6.sql`: 34 assertions green on the hosted project (workshops visible only when published, cap of two announcements a month, empty region list means everyone, one job per announcement, suspension with a reason and its log, a suspended person records and spends nothing, reactivation); every earlier suite green again after the policy change; `@leq/domaine` schemas (`annonces.ts`, job `envoyer_annonce`, key `mots_bequilles`)
2. Server
   - [x] Job `envoyer_annonce` (`jobs/envoyerAnnonce.ts`): one push per active token of the people who keep `notif_annonces` on, whose region is in the list (everyone when the list is null), not suspended; batches of 100; tokens marked as for the feedback push; counts written back; idempotent; 4 tests with a fake sender (17 server tests)
   - [x] The pipeline reads the filler word list from `configuration.mots_bequilles` at each analysis, falling back to the contract's v1 list
3. Admin
   - [ ] Grille: versions list, a draft edited criterion by criterion (key, name, definition, score max, elements with a measure path from the contract, bands, weights), publish with confirmation, a new version copied from the published one; the pgTAP and the engine already exist
   - [ ] Annonces et ateliers: create and edit a workshop, compose an announcement (title, body, workshop, regions), the month's counter against the cap, send; history of what was sent
   - [ ] Utilisateurs: list and search profiles, suspend with a reason, reactivate; the log of suspensions
   - [ ] Demandes d'export: the inbox, mark as treated
4. Mobile
   - [ ] B1 "Avec Rebecca, ce mois-ci": the next published workshop, "Tout voir" opens B1b (`/aujourdhui/rebecca`) with workshops and announcements; F1 shows the workshop card; a tapped announcement (X6) opens B1b
   - [ ] G3: the region picker (chapter 3, asked in settings now that announcements exist)
   - [ ] A suspended account sees one screen saying so, with the two gestures that stay open (copy of data, deletion)
5. Verification
   - [ ] pgTAP, server, mobile and admin tests green; `npm run check`; simulator boot

## Next

1. Roch: tap through flow A on the simulator or his iPhone (`cd apps/mobile && npx expo run:ios --device "iPhone 17" --port 8082`, or `--device` for the phone) with the worker running on this Mac (`PYTHON_PATH=apps/serveur/prosodie/.venv/bin/python3 npm run dev --workspace @leq/serveur`): A1 to A6, then the e-mail code on A7, then G3 deletion. Report what breaks; the slice 7 boxes are ticked from that.
2. Roch, any time: `fly auth login` (server on Fly instead of this Mac), Apple and Google credentials (docs/OPEN-INPUTS.md), the API keys for the bench.
3. Me, without waiting: Phase 6 (admin space complete: grid editor, offers content, workshops and announcements, moderation, suspension, export inbox) or Phase 7 (Arena and duels, shipped off). RevenueCat (`abonnements` writer) waits for the account; the offers screen E1 waits for RevenueCat and Rebecca's offer content. The bench corpus layout is ready and the harness runs on the stub; Phase 3 wording and the calibration tool need the Anthropic key and real transcripts.

## Acceptance lists of later phases (from the plan, expanded before each phase starts)

- Phase 1: scripted walkthrough A1 to A7 online, then offline with airplane mode and reconnection; storage listing empty after analysis; the deletion job leaves no row or object; failure injection produces X3 with challenge and streak intact; reinstall conversion case tested; privacy text sent for lawyer review; ADR-007 checklist items 1 to 9 green on both devices.
- Phase 2: bench report on both modes (batch and streaming) with accuracy, latency, cost per minute, EU processing and retention terms per provider; ADR naming the provider(s); one scripted 5-minute debate measured for cost and per-turn latency.
- Phase 3: every measure of chapter 5 over fixtures with expected ranges (done), Praat CLI tests (done), real transcriber adapter, grid engine over declarative rules (done), wording validated against a JSON schema, B5 and B5b, calibration tool in the admin.
- Phase 4: acts, steps, three formats, per-step thresholds, two-failure remediation (X5), daily rhythm per offer (H5, H5b), H1 to H4, challenge authoring in the admin, RevenueCat and `abonnements` with a sandbox purchase.
- Phase 5: ledgers for points and streak, one recovery a month, quantity caps, D1, D1b, D2, G3 recovery, F1.
- Phase 6: grid editor, banks, configuration (done), offers content, workshops and announcements with geo filter and monthly cap, moderation queue, suspension, flags (done), export request inbox.
- Phase 7: weekly rotation by job, hidden takes until spoken, pair voting, `prises_publiques`, anonymity during votes, closing deletion, moderation state, `apps/web` invitation flow, duel closure rules, automatic verdict clearly labelled.
- Phase 8: streaming loop under 2 s per turn, per-turn persistence, resume (E3b), session ledger, debrief (E4).
- Phase 9: store listings, privacy labels, provider DPAs, TestFlight and Play internal testing, crash reporting, backups, the sentence that defines "version one is done".
