# Status

Last updated: 2026-09-06, end of the Phase 0 build session. Update this file in the same commit as any change of state.

How to read it: one line per phase, then the checklist of the phase in progress, then what has actually been verified on a machine versus what has only been written, then what is blocked and by whom, then the next actions in order.

## State by phase

| Phase | Name                                                        | State                                                                                          |
| ----- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0     | Foundations                                                 | Built and green locally; three items wait on Roch (Supabase project, Fly login, device checks) |
| 1     | Socle: flow A end to end with a stub transcriber            | Not started                                                                                    |
| 2     | STT bench, then debate cost spike                           | Harness written, corpus empty, keys awaited                                                    |
| 3     | Measurement engine, grid engine, feedback, calibration tool | Engine and grid rules exist and are tested; wording and calibration tool not started           |
| 4     | Path machinery, three formats, entitlements, RevenueCat     | Not started                                                                                    |
| 5     | Streak, points, shop, bridge to Rebecca                     | Not started                                                                                    |
| 6     | Admin space, complete                                       | Configuration and flags pages exist; the rest not started                                      |
| 7     | Arena and duels, shipped off, public web                    | Not started                                                                                    |
| 8     | Face-à-face                                                 | Not started                                                                                    |
| 9     | Release                                                     | Not started                                                                                    |

A phase ends when its acceptance list is green and this file says so.

## What exists today

| Workspace          | Content                                                                                                                                                                                                                                                                                  | Checks                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `packages/domaine` | Zod schemas and types for every Phase 0 table, the configuration seed definitions, the grid rule engine (`evaluerRegle`, `evaluerCriteres`), job charges                                                                                                                                 | typecheck, 27 tests                 |
| `packages/moteur`  | The measurement engine over PCM plus transcript (nine measure families of chapter 5), WAV codec, French WER, deterministic transcriber and prosody stubs, synthetic fixtures; the STT bench harness (`bench/`) with the four provider adapters declared and refusing to run without keys | typecheck, 33 tests                 |
| `apps/serveur`     | Hono service with `/sante`, the worker loop, the analysis pipeline in the order of the state diagram, the sweep, the anonymous purge and account deletion jobs, ffmpeg decoding, the Praat prosody CLI (Python) with its pytest, Dockerfile, Fly configuration with two process groups   | typecheck, 10 tests, 4 Python tests |
| `supabase/`        | The socle migration (tables, helpers, triggers, queue functions, RLS, access token hook, buckets, pg_cron), idempotent seed, 96 pgTAP assertions, CLI config                                                                                                                             | read only: never run, see Blocked   |
| `apps/mobile`      | Expo SDK 57 shell: tokens and Manrope, themes, Bulle placeholder, UI primitives, tab bar honouring the `arene` flag, A1 and A2 implemented, the four tabs as real shells with placeholder cards, X1, anonymous sign-in, configuration and flags cached for offline start                 | typecheck, lint, 6 tests            |
| `apps/admin`       | Vite + React space: login, role gate, layout, home, configuration editor (typed fields, contract validation, optimistic save), flags with confirmation                                                                                                                                   | typecheck, lint, 10 tests           |
| `apps/web`         | Placeholder README (Phase 7)                                                                                                                                                                                                                                                             | none                                |
| `docs/`            | This folder, eight ADRs                                                                                                                                                                                                                                                                  | prettier                            |
| CI                 | `.github/workflows/check.yml`: typecheck, lint, tests, prettier, Python tests                                                                                                                                                                                                            | not yet run on GitHub               |

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
   - [ ] Database tests run against a local stack (needs Docker) or the hosted project
   - [x] Project "LEQ" created on a dedicated account (join.leq@gmail.com, org "LEQ's Org"), ref `gnabuebxleogsuhvdgpk`, eu-west-1 (Ireland; Paris was the plan, kept as is)
   - [ ] Migrations pushed, seed applied, dashboard settings done (anonymous sign-ins, hook registered, pg_cron confirmed)
5. `apps/mobile`
   - [x] Package `@leq/mobile`, `app.json` with name LEQ, scheme `leq`, bundle identifier `com.leqapp.mobile` (awaiting confirmation), French microphone text
   - [x] Tokens, Manrope, themes, Bulle placeholder
   - [x] `fr.ts` with the Phase 0 strings
   - [x] Tab bar with Aujourd'hui, Défis, Progrès, Moi, and L'Arène only when the flag is on (tested)
   - [x] A1 and A2 implemented, tabs as shells, X1
   - [x] Supabase client with anonymous sign-in at first launch
   - [x] Audio spike (a) as desk research: ADR-007 proposes `react-native-audio-api` for both paths, with a 15-item device checklist for Phase 1
   - [ ] `npx expo run:ios` boots the shell with four tabs (not run: the shell needs a Supabase project to start)
6. `apps/admin`
   - [x] Login, role gate, configuration editor, flags, tests
   - [ ] A configuration edit round-trips through RLS as admin and is refused as a plain user (needs the project)
7. `apps/serveur`
   - [x] Hono, `/sante`, worker loop, the four job handlers, pipeline tests
   - [x] Dockerfile (ffmpeg, Python, Praat), `prosodie/extraire.py` with 4 passing tests on this Mac
   - [x] `fly.toml` with process groups `worker` and `temps-reel` in `cdg`
   - [ ] Deployed once (blocked on `fly auth login`)
   - [ ] `fly logs` shows a seeded job claimed and completed
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

- Everything in `supabase/`: the migration, the seed, the 96 pgTAP assertions. The first `db push` is the first real test.
- The Dockerfile and `fly.toml`: no Docker on this Mac, no Fly login.
- The mobile shell on a simulator: it blocks on the first configuration load, which needs a Supabase project. The tab bar logic and the strings are covered by jest-expo tests only.
- The admin against a real Supabase (login, RLS round trip): tests cover the role gate and the validation logic with fakes.
- The end-to-end pipeline against a real bucket and database: the order of writes and the failure paths are covered by tests with injected fakes.
- The ADR-007 audio decision: desk research with sources; every claim about device behaviour is in the Phase 1 checklist.

Decisions taken during integration (not in the plan):

- The server's transcriber stub delegates to the engine's deterministic fake transcript instead of returning an empty one, so the feedback screens can be exercised end to end before the STT bench.
- Word timestamps are rounded to the millisecond before every threshold comparison in the engine (a gap of exactly 0.3 s was reading as 0.30000000000000004).
- `expo-audio` stays in the mobile app for the microphone permission only, behind `src/services/micro.ts`; ADR-007 forbids using it for capture and it leaves the project when the Phase 1 recorder lands.
- Node 25 is accepted locally (Vitest warns), CI runs Node 22.

## Blocked

- Supabase: project created; `npx supabase link` and `db push` wait for the database password in the root `.env` (`SUPABASE_DB_PASSWORD`).
- Fly.io: CLI installed, not logged in. `fly auth login` once, then the first deploy and the job-claim verification.
- Device checks of ADR-007: run on Roch's iPhone and the simulator first (his testing setup); the Android half waits for an EAS development build on a borrowed or later device, before release.

## Next

1. Roch: paste the database password into the root `.env`, run `fly auth login`, provide the API keys listed in docs/OPEN-INPUTS.md when convenient.
2. `npx supabase link --project-ref gnabuebxleogsuhvdgpk`, `npx supabase db push --include-seed`, register the hook, enable anonymous sign-ins, confirm pg_cron. Fix whatever the first push reveals in the migration and note it here.
3. Fill `apps/mobile/.env`, `apps/admin/.env.local`, `apps/serveur/.env`; boot the shell on the simulator; create Rebecca's admin user and check the configuration round trip; deploy the server and watch a job complete. Tick the boxes above.
4. Start Phase 1: the recording screen with the capture stack of ADR-007 (checklist items 1 to 9 on devices), upload, the local queue, A3 to A7, X2 to X4, account conversion, deletion, push. Write the Phase 1 acceptance list here before starting.
5. In parallel, assemble the bench corpus and run the bench as soon as one key arrives.

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
