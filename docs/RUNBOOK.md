# Runbook

How to install, run, migrate, deploy and build LEQ. Written so that someone else can repeat all of it on a fresh Mac. Commands are run from the repository root unless stated otherwise. Script names beyond `typecheck`, `lint` and `test` follow the conventions below; each workspace README is the final word for its own scripts.

## Prerequisites

| Tool                               | Why                                                                                                                                                                                  | Install                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 22 or 24                      | `.nvmrc` pins 22 and CI runs 22. The Mac has Node 25 installed directly: everything runs on it, Vitest only prints an unsupported-engine warning. Use nvm to match CI when in doubt. | `brew install nvm`, follow the shell setup it prints, then `nvm install` in the repo (reads `.nvmrc`) and `nvm use`                                                                                                             |
| Xcode 27.0 with iOS simulators     | Simulator builds of the mobile app; the device window is Device Hub, see « Looking at a screen »                                                                                     | App Store, then `sudo xcode-select -s /Applications/Xcode.app`, `sudo xcodebuild -license accept`, install an iOS runtime in Xcode > Settings > Components                                                                      |
| CocoaPods                          | Native iOS dependencies during `expo run:ios`                                                                                                                                        | `brew install cocoapods`                                                                                                                                                                                                        |
| Homebrew                           | Everything below                                                                                                                                                                     | https://brew.sh                                                                                                                                                                                                                 |
| ffmpeg                             | Decoding m4a to 16 kHz mono PCM in the worker and in engine tests                                                                                                                    | `brew install ffmpeg`                                                                                                                                                                                                           |
| Python 3 with parselmouth          | The Praat prosody CLI (`apps/serveur/prosodie`)                                                                                                                                      | `python3 -m venv apps/serveur/prosodie/.venv && apps/serveur/prosodie/.venv/bin/pip install -r apps/serveur/prosodie/requirements.txt` (the venv is git-ignored; the package is `praat-parselmouth`, imported as `parselmouth`) |
| Supabase CLI via npx               | Migrations, local stack, types                                                                                                                                                       | Nothing to install: `npx supabase --version`                                                                                                                                                                                    |
| Fly CLI                            | Deploying `apps/serveur`                                                                                                                                                             | `brew install flyctl`, then `fly auth login` once                                                                                                                                                                               |
| EAS CLI via npx                    | Cloud builds and store submission                                                                                                                                                    | Nothing to install: `npx eas-cli --version`; Expo account `rxpetoh` is already logged in on this Mac                                                                                                                            |
| Docker (optional)                  | `npx supabase start` (local Postgres for database tests) and building the server image locally                                                                                       | OrbStack or Docker Desktop. Fly builds remotely, so deploys do not need it                                                                                                                                                      |
| Java and Android Studio (optional) | Local Android builds and Maestro flows                                                                                                                                               | Not installed on this Mac. Until then, Android is verified through EAS cloud builds only                                                                                                                                        |

## Install

```bash
nvm use
npm install
npm run check
```

Rules:

- `npm install` runs at the root only. Never inside a workspace (it creates a nested `node_modules` and breaks Metro).
- To add a dependency to a workspace: `npm install <package> --workspace @leq/serveur`. For Expo packages, run `npx expo install <package>` inside `apps/mobile` so the SDK 57 compatible version is chosen; `npx expo install --fix` realigns them.
- `npm run check` runs `typecheck`, `lint` and `test` in every workspace that declares them. `npm run format` rewrites with Prettier, `npm run format:check` is what CI runs.
- Pinned versions: Expo packages ~57.0.x, React 19.2.x, TypeScript ~6.0.3, Zod 4, Vitest 5, Hono 4.13, supabase-js 2.115, TanStack Query 5, Vite 8.

## Run each workspace

| Workspace               | Command                                                                                    | Notes                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domaine`      | `npm run test --workspace @leq/domaine`, `npm run typecheck --workspace @leq/domaine`      | Pure schemas, no runtime                                                                                                                                                                                                                      |
| `packages/moteur`       | `npm run test --workspace @leq/moteur`                                                     | Fixtures are synthesised in code (`src/fixtures/synthese.ts`); no audio file, no ffmpeg                                                                                                                                                       |
| `apps/mobile`           | `cd apps/mobile && npx expo run:ios`                                                       | First run does `prebuild` (generates `ios/`, git-ignored) and `pod install`, several minutes. Then `npx expo start` reuses the installed development build. `--device "iPhone 17"` picks a simulator, `--device` alone lists physical devices |
| `apps/admin`            | `npm run dev --workspace @leq/admin`                                                       | Vite dev server, http://localhost:5174. `npm run build --workspace @leq/admin` produces `dist/`                                                                                                                                               |
| `apps/serveur`          | `npm run dev --workspace @leq/serveur`                                                     | Worker loop in watch mode with `PROCESS=worker` from `apps/serveur/.env`. `npm run build` then `npm start` for the compiled service. `/sante` answers on `PORT` (8080)                                                                        |
| `apps/serveur/prosodie` | `apps/serveur/prosodie/.venv/bin/pytest apps/serveur/prosodie`                             | Also `apps/serveur/prosodie/.venv/bin/python apps/serveur/prosodie/extraire.py <fichier.wav>` prints the JSON tracks                                                                                                                          |
| `supabase/` (local)     | `npx supabase start`, `npx supabase db reset`, `npx supabase test db`, `npx supabase stop` | Needs Docker. Studio at http://127.0.0.1:54323, API at 54321, Postgres at 54322                                                                                                                                                               |
| `apps/web`              | `npm run dev --workspace @leq/web`                                                         | Vite dev server, http://localhost:5175. Open `/duel/<jeton>` with a token from `duels.jeton`. Recording needs a secure context: `localhost` works, a plain-http address on the network does not. `npm run build` produces `dist/`             |

Expo Go cannot run this app once native audio modules are in (Phase 0 spike onwards); always use a development build (`expo run:ios` or an EAS `development` build).

## Environment files and secrets

Every workspace reads a `.env` next to its `package.json`, copied from its `.env.example`. `.env` files are git-ignored; only `.env.example` is committed, with placeholders and comments, never values.

| File                  | Read by                                                                                                                                                                                              | Variables                                                                                                                                                                                                                                                                                                                                                                                                                                   | Where the value comes from                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/.env`    | Expo at bundle time (`EXPO_PUBLIC_*` are embedded in the app and are public by nature)                                                                                                               | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SERVEUR_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (Google sign-in; without the web id the button is not shown), `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` (without the key, no event leaves the phone)                                                                                                | Supabase dashboard > Project Settings > API (publishable key `sb_publishable_...`), Fly app URL. Never put a secret in an `EXPO_PUBLIC_` variable |
| `apps/admin/.env`     | Vite at build time (`VITE_*`, public)                                                                                                                                                                | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                                                                                                                                                                                                                                                                                                                                        | Same as above                                                                                                                                     |
| `apps/web/.env.local` | Vite at build time (`VITE_*`, public)                                                                                                                                                                | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_LIEN_APPLICATION` (store link; leave empty and the page shows no install button rather than a dead link)                                                                                                                                                                                                                                                                        | Same as above. In the image these three arrive as Docker build arguments, not as a file                                                           |
| `apps/serveur/.env`   | `src/config.ts` at startup                                                                                                                                                                           | `DATABASE_URL` (direct connection, not the pooler), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`sb_secret_...`, bypasses RLS), `PROCESS`, `WORKER_ID`, `LOG_LEVEL`, `PORT`, `TRANSCRIPTEUR`, `TRANSCRIPTEUR_FLUX`, `ADVERSAIRE`, `VOIX` (`stub` or `openai`), `JUGE` (`aucun` or `openai`), `OPENAI_API_KEY`, `FFMPEG_PATH`, `PYTHON_PATH`, `PROSODIE_SCRIPT`, `INTERVALLE_INACTIF_MS`. Later: `EXPO_ACCESS_TOKEN`, `REVENUECAT_WEBHOOK_SECRET` | Supabase dashboard > Connect (direct connection string) and > API (secret key); provider consoles                                                 |
| `.env` (repo root)    | The scripts under `supabase/tests` and `apps/serveur/scripts`, and the shell before `supabase config push` (the CLI substitutes `env(...)` references in `config.toml` from the process environment) | `SUPABASE_DB_PASSWORD`, `LEQ_ADMIN_EMAIL`, `LEQ_ADMIN_PASSWORD`, `OPENAI_API_KEY`, `POSTHOG_KEY`, `POSTHOG_HOST`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`, `GOOGLE_IOS_CLIENT_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_SENDER`, `SMTP_PASS`                                                                                                                                                                             | Supabase dashboard, OpenAI platform, PostHog project settings, Google Cloud console (OAuth clients), a Gmail app password for join.leq@gmail.com  |

Where secrets live:

- Production server secrets: Fly, `fly secrets set NAME=value -a leq-serveur`. They never appear in `fly.toml`.
- Supabase: the database password and the secret key are shown once in the dashboard; store them in a password manager (1Password or the macOS keychain), not in a file in the repo.
- Store signing: EAS manages iOS certificates and the Android keystore in the Expo account; `eas credentials` to inspect. Local copies (`*.p8`, `*.p12`, `*.jks`, `*.mobileprovision`) are git-ignored.
- GitHub Actions: the check workflow needs no secret. If a workflow ever needs one, it goes in the repository's Actions secrets.
- The phone never holds a provider key (Anthropic, STT, TTS, RevenueCat webhook). Those exist only in Fly secrets. The RevenueCat public SDK key is the one exception and is public by design.

## Migrations and seed

The schema is the contract in docs/DATA-MODEL.md. Migrations live in `supabase/migrations`, named with the CLI's timestamp convention (`20260906000000_socle.sql` first). Configuration defaults and the three flags live in `supabase/seed.sql`, idempotent (values are never overwritten, only descriptions and types refreshed), applied locally by `db reset` and on the hosted project by `db push --include-seed`. No dev grid is ever seeded; the dev grid exists only in tests.

Hosted project, first time:

```bash
npx supabase login
npx supabase link --project-ref <ref>        # asks for the database password
npx supabase db push --dry-run               # lists what will be applied
npx supabase db push
```

Then the auth settings, which migrations cannot set, are pushed from `supabase/config.toml` with `npx supabase config push --yes` (anonymous sign-ins, manual linking, the access token hook on `public.hook_jeton_acces`, redirect URLs). Read the diff in an interactive shell first: without a terminal the command applies without asking. Check in the dashboard that `pg_cron` is enabled and the three `leq_*` schedules exist.

The same file declares, since 2026-09-13, the SMTP server for the auth e-mails (`[auth.email.smtp]`, Gmail with an app password), Sign in with Apple (`client_id` is the bundle id; the native flow needs no secret) and Google sign-in (`client_id` lists the web client id and the iOS client id, the secret is the web client's, `skip_nonce_check = true` because the Google SDK's id tokens carry no nonce). The secrets are `env(...)` references, so export the root `.env` first:

```bash
set -a; source .env; set +a
npx supabase config push          # from the repo root; reads supabase/config.toml
```

Two things bit on the first push. `supabase config push` writes the whole `[db.pooler]` section, so `default_pool_size` and `max_client_conn` in the file must equal the hosted values (15 and 200 on 2026-09-13) or the push shrinks the pooler. And `site_url` had stayed at `127.0.0.1` since the project was created, which is where a recovery link would have sent people; it is the server's URL now.

Database tests against the hosted project: `node supabase/tests/executer-distant.mjs <fichier.sql>` runs a pgTAP file as one transaction that the file itself rolls back. When a file fails, the whole-file runner cannot say where: `node supabase/tests/pas-a-pas.mjs <fichier.sql>` runs it statement by statement inside a transaction that is always rolled back and prints the first failing statement. To try a new migration with its tests before pushing, concatenate `begin;`, the migration, the test body and `rollback;` into a scratch file and run that. Rule learned the hard way on 2026-09-06: never send statements to the hosted database outside a transaction (a first version of the step runner did, and committed test users, attempts and a changed reward cap that had to be removed by hand).

Later migrations: `npx supabase migration new <nom>` creates the timestamped file; write SQL; `npx supabase db reset` locally (needs Docker) to replay everything; `npx supabase db push` to the linked project. `npx supabase migration list` compares local and remote history.

Seeding the hosted project: **`npx supabase db push --include-seed` does not run the seed once the project has been seeded before**. It recomputes the file's hash, records it, prints "Updating seed hash" and runs nothing, so a line added to `seed.sql` never reaches the database and nothing says so. Found on 2026-09-12, after two pushes that appeared to succeed and changed nothing. Use `node supabase/tests/appliquer-seed.mjs` instead: it runs the file in one transaction and prints the row counts it ends with. The seed is idempotent (values are never overwritten, only descriptions and types refreshed), so applying it again is safe.

Types: `npx supabase gen types --lang typescript --linked > packages/domaine/src/database.types.ts` (check the path in the domaine README). Commit the generated file with the migration that changed it.

Making the first admin: as `postgres` in the SQL editor, `update public.profils set role = 'admin' where id = '<uid>'`. A trigger refuses that change from any signed-in client. The role reaches the token at the next sign-in.

The admin's pages today: Configuration, Drapeaux, Défis (the bank act by act; a défi's title and consigne change for everyone at once, its order and threshold only for paths created afterwards; "Marquer comme validé" turns `provisoire` off so the phone stops saying the consigne awaits Rebecca), Exercices (the remediation bank, matched to défis by `competence`).

## Removing an account

`node supabase/tests/supprimer-compte.mjs <email>` prints what is attached to it and deletes
nothing. Add `--confirmer` to actually delete. Deleting an auth user cascades to their takes,
their evaluations and their whole history, so the two steps are deliberate.

Used once, on 2026-09-12, to remove a duplicate created from a mistyped address. The address that
was actually right already had an account with three recordings on it, so that one was promoted
and the empty duplicate removed. Always read the counts before confirming: the newer account is
not always the one to keep.

## Checking the things a type-checker cannot

Three scripts run against the project, because a feature that writes to storage, reads a
dashboard or locks a function down is not finished until something has actually tried it.

```bash
SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp> node supabase/tests/verif-securite.mjs
URL=<supabase url> CLE=<publishable key> EMAIL=<admin> MDP=<mot de passe> \
  node supabase/tests/verif-medias.mjs
URL=... CLE=... node supabase/tests/verif-anon.mjs
```

`verif-securite.mjs` walks every table and every `security definer` function: RLS on everywhere,
a policy on everything except the work queue, no function open to the whole world, and only
`medias` public among the buckets.

`verif-medias.mjs` uploads, reads back over the public URL, deletes, and checks a wrong format is
refused. It exists because the image picker shipped once with `upsert: true` on a bucket granting
insert only; Storage refuses that and every upload failed.

`verif-anon.mjs` asks, holding nothing but the publishable key, what still answers. That key ships
inside every copy of the application, so anything it can reach is public.

## Walking the whole pipeline against the hosted project

```
URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
  SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
  node supabase/tests/verif-bout-en-bout.mjs [chemin audio]
```

Everything else checks a piece: pgTAP the rules, the server tests the handlers, `verif-medias`
Storage. This one records, sends and waits exactly as the phone does, then asks the two questions
that matter: is the feedback there, and is the audio gone? Upload into the private bucket, the
row, the job queued by the trigger, the worker on Fly, the measures, the evaluation, the private
object deleted and the column nulled. About twenty seconds end to end.

Without an audio file it speaks one, in French, with the Mac's own voice (`say` then `ffmpeg`).
The take it creates is deleted at the end, whatever happened. Run it after anything that touches
the pipeline, and after any deploy of the worker.

## Walking a whole face-à-face against the deployed server

```
URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
  SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
  SERVEUR=wss://leq-serveur.fly.dev node supabase/tests/verif-face-a-face.mjs
```

Phase 8 is the only part of the product that lives on a socket, and a socket is what unit tests
cannot reach: the conductor is tested against an array, not against Fly. This opens a session
over `ouvrir_debat`, connects, speaks two turns, ends it, and checks what the database kept: the
four turns in order, the outcome, the connection released, the month moved by one, the debriefing
queued and written. It costs one session of the account's month and gives it back by deleting the
row at the end.

## Measuring what a face-à-face costs and how long each turn waits

```
node apps/serveur/scripts/mesurer-debat.mjs                       # the admin account of .env
MESURE_EMAIL=... MESURE_MDP=... node apps/serveur/scripts/mesurer-debat.mjs
```

Reads the root `.env` and `apps/mobile/.env`, opens a session as that account, speaks nine turns of about a hundred words each with the Mac's French voice, in real time, until the session's cap, then reads `debats.consommation`, the count the server wrote at the close (seconds of speech in, tokens through Rétor, characters and seconds of voice out, the debrief's tokens once the worker has written it). It prints, per turn, the wait from the end of speech to the final transcript, to Rétor's text, to his first sound and to his last, then the totals and their price at the OpenAI rates written in the script with the date they were read. The voice's audio tokens are the one figure OpenAI does not return and does not publish a ratio for, so that line is a range between two of their own figures, and the higher bound is the one to price on. The session is deleted at the end, so the month is given back. Takes about eight minutes and one session of the account's month.

## Running the app on this Mac, without EAS

EAS is for store binaries and nothing else. Building, installing and driving the app needs only
Xcode, which is here: Xcode 26.6 with the iOS 26.5 SDK, both released, so the earlier note in the
plan about a beta host OS forcing cloud builds was wrong. Apple rejects builds made with a beta
**SDK**, not builds made on a beta macOS.

```
cd apps/mobile && npx expo run:ios --device "iPhone 17"
```

To drive it from a script once it is installed:

```
SIM=$(xcrun simctl list devices available | grep "iPhone 17 (" | grep -o "[0-9A-F-]\{36\}")
xcrun simctl boot $SIM; xcrun simctl launch $SIM com.leqapp.mobile
xcrun simctl io $SIM screenshot ecran.png
xcrun simctl openurl $SIM "leq://reglages"      # any Expo Router route
```

A deep link raises an « Open in "LEQ"? » confirmation, which has to be tapped. There is no tap in
`simctl`, so taps go through `cliclick` against the window that shows the device. The mapping, for
a window at `(wx, wy)` reported by System Events: a point `(x, y)` in device logical points (the
screenshot is 3x) is at `wx + 4.5 + x * 1.112`, `wy + y * 1.112`. Dragging near the bottom of the
screen opens the React Native inspector; relaunching the app clears it.

**Since Xcode 27 there is no `Simulator.app`.** The window that shows a booted device is
`/Applications/Xcode.app/Contents/Applications/DeviceHub.app` (« Device Hub », bundle
`com.apple.dt.Devices`): `open -a /Applications/Xcode.app/Contents/Applications/DeviceHub.app
--args -CurrentDeviceUDID $SIM`. `open -a Simulator` fails on this machine. A booted device keeps
running with no window at all, so `simctl io screenshot` proves nothing about what a person sees on
the Mac: check with `screencapture -x` of the whole screen. When Xcode was swapped on 2026-09-14 the
old Simulator window died with the deleted bundle while the device and Metro kept running, and the
app was invisible for two days. Device Hub's zoom buttons put the view in pan mode (« hold ⌥⌘ and
drag »); the fit button next to them puts it back.

This is how the floating tab bar covering the Progrès button was found, and it is the cheapest way
to look at a screen before asking anyone else to.

## Walking the daily loop and the browser duel against production

```
URL=... CLE=... EMAIL=... MDP=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
  node supabase/tests/verif-parcours.mjs
URL=... CLE=... EMAIL=... MDP=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
  node supabase/tests/verif-duel-web.mjs
```

`verif-parcours.mjs` is the product: the challenge of the day, the take, the verdict, the step
validated, the next one opened, the points, the day counted. It puts the step back where it found
it. `verif-duel-web.mjs` is the only path where someone with no account writes audio: the
invitation link, an anonymous session, the slot claimed before recording, both takes, the verdict.

Both need `validation_sans_grille` and the flags as `activer-essai.mjs` leaves them, which is the
state a testing build wants anyway.

## Checking that a published take can be heard, and that deletion leaves nothing

```
URL=... CLE=... EMAIL=... MDP=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
  node supabase/tests/verif-arene-audible.mjs
URL=... CLE=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
  node supabase/tests/verif-suppression-compte.mjs
```

pgTAP can say a column is not null; it cannot open a file. `verif-arene-audible.mjs` records a
take, publishes it in the Arena, signs a playback URL, downloads it and compares the bytes with
what was sent. Then it marks the copy for deletion and waits for the sweeper, because the public
bucket is the worker's to empty and not a signed-in person's: deleting from the script answered
nothing and left the object behind, which is how the first run leaked one.

`verif-suppression-compte.mjs` is the other promise. It creates a throwaway account, records a
take, publishes it, presses G3's button (`demander_suppression_compte`, nothing privileged), and
then looks everywhere: profile, takes, analyses, published takes, points, path, and both storage
buckets. Eighteen checks. It removes what it made whatever happens.

## Backups: what is where, and what to do about it

Three kinds of thing live in this project, and only one of them needs a procedure of ours.

**The schema** is `supabase/migrations/`, in git. An empty project becomes this one with
`supabase db push --linked`, and every suite runs against it afterwards. Nothing to back up.

**What Rebecca wrote** lives only in the database: the grid and its criteria, the challenges, the
exercises, the rewards, the Arena subjects, the theses, the workshops, the announcements, the
configuration and the flags. Losing it means asking her to write it all again. That is what this
saves:

```
SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp> \
  node supabase/tests/sauvegarde-contenu.mjs [fichier.sql]
```

A plain SQL file of inserts, in the order the foreign keys need, replayable on any project whose
migrations are applied. A backup nobody has replayed is a file and not a backup, so the script
replays it before handing it over: into empty tables shaped like the real ones, inside a
transaction it rolls back, checking every row lands. Run it after a session of authoring, and keep
the file somewhere that is not this database.

**People's takes, results, points and history** are what the hosting provider's own backups are
for. Supabase's retention depends on the plan and the dashboard is the only place that states it:
on the free plan there is no automated backup at all. **Roch: confirm which plan this project is
on.** The schema survives either way; that data does not.

## Answering a request for a copy of someone's data

G3 says out loud « Tu recevras une copie de tes données par e-mail », and the request lands in
`demandes_export`, which the admin space lists. This produces the copy:

```
SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp> \
  node supabase/tests/exporter-donnees.mjs <adresse e-mail ou uuid> [dossier]
```

It writes one JSON file and prints where, and it changes nothing: in particular it does not mark
the request handled, because that happens once the copy has actually been sent. Sixteen sections,
from the profile to the debates, each one every row of that table belonging to that person.

What it deliberately leaves out: no audio, because there is none to give back; the other person's
identifier and the invitation token of a duel, because the first is theirs and the second would
let whoever holds the file answer an open duel; and which voice someone preferred in the Arena,
because anonymity there holds for the people they compared. The file says all of this at the top,
in French, so the person reading it knows what they have.

Deleting an account is the other side of the same obligation and has its own script,
`supprimer-compte.mjs`.

## Making an administrator

`node supabase/tests/creer-admin.mjs <email> <mot-de-passe> [prenom]` creates the auth user
(e-mail already confirmed), sets the password, writes the first name and puts `admin` on the
profile in one go. It needs `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF` and
`SUPABASE_DB_PASSWORD`. Run again with the same address to reset a password.

To correct a mistyped address, add `--nouvel-email=<adresse>`: the account keeps its id, its role
and everything attached to it, which is what makes this better than deleting and starting again.

The role reaches the token at the next sign-in, so sign out and back in if the space says the
access is reserved.

Administrators so far: Roch (`rapetohsenyo@gmail.com`) and Rebecca (`beccalieben@gmail.com`).
created 2026-09-12 with the address exactly as given; `gmmail.com` looks like a typo for
`gmail.com` and is waiting on Roch to confirm).

## Turning the Arena, duels and face-à-face on for a testing build

They ship off (cahier chapter 11): Rebecca switches them on from `/drapeaux` when there are
enough people for a contest to be one. For a TestFlight build that Roch alone walks through,
`node supabase/tests/activer-essai.mjs` does it in one transaction: the three flags on, the
first Arena subject activated so the tab does not open on an empty room, and
`quota_face_a_face_gratuit` set to 1 so the free plan can try one debate. `--eteindre` puts all
three back. Every value it touches is one Rebecca owns and can change back in the admin.

The banks of Arena subjects and debate theses are seeded provisional (`provisoire = true`, shown
with a badge in the admin), the same way the path and the shop are. They exist so the flows can
be walked through before Rebecca's own content arrives, and they are meant to be replaced.

## Deploy the server

`apps/serveur` is one Docker image with two process groups (`worker`, `temps-reel`) declared in `apps/serveur/fly.toml`, region `cdg`. The build context is the repository root because the image needs `packages/domaine`, `packages/moteur` and `apps/web`.

The image also carries the public pages of `apps/web` (ADR-010): `temps-reel` is the only process reachable from the internet, so it serves the duel invitation, the privacy page and the terms. `DOSSIER_WEB=apps/web/dist` is set in the image; unset it and the process serves no pages, which is what a local worker wants.

First time:

```bash
fly auth login
fly apps create leq-serveur                     # name as in fly.toml
fly secrets set -a leq-serveur \
  DATABASE_URL='postgresql://...' \
  SUPABASE_URL='https://<ref>.supabase.co' \
  SUPABASE_SECRET_KEY='sb_secret_...' \
  TRANSCRIPTEUR=stub
```

Every deploy:

```bash
fly deploy --config apps/serveur/fly.toml --dockerfile apps/serveur/Dockerfile --remote-only --ha=false \
  --build-arg VITE_SUPABASE_URL='https://<ref>.supabase.co' \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_...' .
fly status -a leq-serveur
fly logs -a leq-serveur
```

The two build arguments are what the browser needs to reach Supabase from the public pages. Both are public by design and are the same values as `apps/mobile/.env`; forget them and the pages load but refuse to work, saying the configuration is missing. Add `--build-arg VITE_LIEN_APPLICATION='https://apps.apple.com/app/id6809261668'` once the app is published, and the end of a duel offers an install button.

`--remote-only` builds on Fly's builders, so Docker is not needed locally. Add `--ha=false`: without it Fly creates two `temps-reel` machines and a standby `worker`, and `fly scale count worker=1` may keep the standby (which stays stopped) instead of the running one; that happened on the first deploy and was fixed with `fly machine destroy <standby> --force` then `fly scale count worker=1`. First deploy done on 2026-09-06 (Roch's Fly account, org personal). `fly scale count worker=1 temps-reel=1 -a leq-serveur` sets one machine per group; `min_machines_running = 1` in `fly.toml` keeps them up. `fly ssh console -a leq-serveur` opens a shell in a machine (useful to run `ffmpeg -version` and `python3 -c "import parselmouth"`).

Both browser surfaces live on the same host as the real-time process (ADR-010): the public pages
at the root (`/duel/:jeton`, `/confidentialite`, `/conditions`) and Rebecca's space under
`/admin`. Everything the space shows is behind a sign-in and the admin role in row-level
security, so serving its bundle publicly gives nothing away. `apps/admin` builds with
`base: '/admin/'` and its router strips the trailing slash: with it kept, the bare `/admin`
matches no route and the page renders empty, which is exactly what happened on the first deploy.

Verify after a deploy: every one of `/sante`, `/confidentialite`, `/conditions`, `/duel/test`, `/admin` and `/admin/theses` answers `200`, and both `/admin` and `/admin/` actually render the sign-in form rather than an empty page. A 200 on the bundle proves nothing: the router can still match no route. A duel link made by the app reads `https://leq-serveur.fly.dev/duel/<jeton>`; `EXPO_PUBLIC_LIEN_DUEL` in `apps/mobile/.env` overrides the base when a domain exists.

Verify a deploy: `curl https://leq-serveur.fly.dev/sante` answers, then insert a job in the dashboard SQL editor (`insert into public.jobs (type, charge, cle_idempotence) values ('balayer_audio', '{}', 'test:' || now())`) and watch `fly logs` show it claimed and finished.

Database connection from Fly: use the direct connection string (port 5432, not the pooler on 6543). Supabase direct connections are IPv6; Fly machines have IPv6 egress. If a connection error mentions the address family, either add the IPv4 add-on on the Supabase project or use the pooler in session mode, then note it in docs/STATUS.md.

## Build the mobile app

Checking one screen on the simulator without tapping through the onboarding: start Metro with `EXPO_PUBLIC_ECRAN_INITIAL="/(onglets)/defis" npx expo start --port 8082 --dev-client --clear` from `apps/mobile`, then `xcrun simctl launch booted com.leqapp.mobile` and `xcrun simctl io booted screenshot <file>`. The variable is read in development builds only (`src/app/index.tsx`). Deep links through `simctl openurl` do not work for this: iOS asks "Open in LEQ?" and the alert cannot be answered from the command line.

TestFlight (first done on 2026-09-06): the App Store build runs on Expo's servers from `apps/mobile` with `npx eas-cli build --platform ios --profile production --auto-submit`. Three things make it work in this monorepo: `eas.json` has a `production` profile with `distribution: store`; `apps/mobile/package.json` has an `eas-build-post-install` hook that compiles `packages/domaine` (its `dist/` is git-ignored, so the cloud build must produce it); the two public variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` live as EAS environment variables (`npx eas-cli env:list --environment production`), because the local `.env` is not uploaded and Metro inlines them at bundle time. The first build needs one interactive run by Roch (Apple login and two-factor code) so EAS can create the distribution certificate; after that the command runs non-interactively. Before a cloud build, `npx expo export --platform ios --output-dir /tmp/leq-export` from `apps/mobile` checks the bundle in a minute.

Simulator (local, free):

```bash
cd apps/mobile
npx expo run:ios --device "iPhone 17" --port 8082   # first time: prebuild + pod install, then the app opens against the bundler
npx expo prebuild --clean --platform ios             # regenerate ios/ from app.json when native config changed
```

Port 8082 because the Money App's bundler often holds 8081 on this Mac; Expo refuses to reuse a port held by another project. If a prebuild fails halfway, run `prebuild --clean` before the next build, otherwise the half-generated project (template bundle identifier `org.name.LEQ`) is reused. To open a screen by deep link on the simulator, use the app itself: a `leq://` link sent with `simctl openurl` raises an iOS confirmation that cannot be answered from the command line.

`ios/` and `android/` are generated (Continuous Native Generation) and git-ignored. Native configuration lives in `app.json` and Expo config plugins, never by hand in the generated folders.

Physical iPhone: `npx expo run:ios --device` with the phone plugged in; needs a free Apple ID for development signing, and the Apple Developer Program for TestFlight.

Store builds, two ways. EAS cloud, which holds the signing credentials and also builds Android:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform ios
```

The free EAS plan includes 15 iOS and 15 Android builds a month; they were used up on 2026-09-12 and come back on 1 October 2026 (`eas billing:subscribe starter` lifts the limit sooner). Builds are started by hand, never from CI. Profiles live in `apps/mobile/eas.json`; `appVersionSource: remote` means EAS numbers the builds itself (15 was the last), so a local build sets `ios.buildNumber` in `app.json` above that.

Or this Mac, which is how build 16 reached TestFlight on 2026-09-13. Two facts about this machine: macOS 27 beta refuses to open the window of the released Xcode 26.6 ("isn't supported in this version of macOS") but runs its build tools, and Xcode keeps Apple accounts in the user's keychain, shared by every Xcode installed. So the account is signed in once through the window of the Xcode 27 beta that sits next to it (Settings > Apple Accounts > Sign In), and the 26.6 tools use it. Then, from `apps/mobile`:

```bash
npx expo prebuild --platform ios                      # after any change to app.json or a config plugin
xcodebuild -workspace ios/LEQ.xcworkspace -scheme LEQ -configuration Release \
  -destination 'generic/platform=iOS' -archivePath ios/build/LEQ.xcarchive archive \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=47WU47J52M CODE_SIGN_STYLE=Automatic
xcodebuild -exportArchive -archivePath ios/build/LEQ.xcarchive -exportPath ios/build/export \
  -exportOptionsPlist exportOptions.plist -allowProvisioningUpdates
```

`exportOptions.plist` (committed) says `app-store-connect`, destination `upload`, automatic signing. `-allowProvisioningUpdates` let Xcode create the distribution certificate and the App Store profile on the first run. That certificate is cloud-managed: its private key lives behind the signed-in account, and two hours after build 16 the account had gone from the build tools' view (`DVTDeveloperAccountManagerAppleIDLists` empty) and build 17's export failed with "Failed to Use Accounts". An App Store Connect API key (App Store Connect > Users and Access > Integrations > Team Keys, role Admin, the `.p8` downloaded once and kept at the repo root, git-ignored) does not evaporate: pass `-authenticationKeyPath <.p8> -authenticationKeyID <id> -authenticationKeyIssuerID <issuer>` to both commands and no Xcode window is involved at all. Build 19 (2026-09-16) exported and uploaded from the command line again, the day after the account was signed into the released Xcode 27.0, so the failure is the account dropping out of the keychain view, not the tooling. Until the key exists, the way that worked for build 17 and 18 when the command line refused: `open -a /Applications/Xcode-27-beta6.app ios/build/LEQ.xcarchive` opens the archive in the beta's Organizer, which does see the account; « Distribute App », « App Store Connect », « Distribute » uploads it with the recommended settings. The clicks can be driven with `cliclick` from the window's geometry read through System Events, the way the simulator is driven. The archive takes about ten minutes, the upload one; the build number comes from `ios.buildNumber` in `app.json` and must exceed the last one on App Store Connect. The export prints "Upload Symbols Failed" warnings for the prebuilt React, Hermes and ffmpeg frameworks, which ship without dSYMs; that only affects crash symbolication inside those frameworks. Metro inlines `apps/mobile/.env` at archive time, so a local build carries the Google client ids and the PostHog key without any EAS environment variable. With an App Store Connect API key instead of a signed-in account, add `-authenticationKeyPath`, `-authenticationKeyID` and `-authenticationKeyIssuerID` to both commands.

Development builds for a device without Xcode on the tester's side: `npx eas-cli build --platform ios --profile development`, install through the link EAS prints.

## Read the screens as a person sees them

Every string fault Roch has caught was invisible in `fr.ts` and obvious on a screen: a footer
repeating the body two lines up, a sentence explaining the Gratuit plan to someone who only wanted
to know when they can speak again, a card truncating mid-word. A file review cannot see any of
them, so a string change is reviewed on the rendered screen.

It works on a locked Mac, which matters because the machine is often locked. `simctl` drives a
simulator without the GUI session:

```bash
xcrun simctl boot <UDID>                                   # locked screen is fine
xcrun simctl install booted <path>/LEQ.app                 # the Debug-iphonesimulator build
xcrun simctl launch <UDID> com.leqapp.mobile
xcrun simctl io <UDID> screenshot /tmp/ecran.png
```

Two limits, both real. There is no tap: `idb` is not installed and a `leq://` deep link raises an
iOS confirmation the command line cannot answer, so only the screen the app opens on can be read.
And an empty account hides most of the faults, because the strings that go wrong are the ones that
render only when there is data. Keep a simulator whose user has an analysed take, and note its
UDID here when one exists.

To read a screen other than the opening one, Metro has to be started with
`EXPO_PUBLIC_ECRAN_INITIAL="/(onglets)/moi"` (read in `src/app/index.tsx`, development only). It is
inlined at bundle time, so it needs its own bundler on a free port rather than a restart of one
another session is using.

## Continuous integration

`.github/workflows/check.yml` runs on every push to `main` and on pull requests: Node from `.nvmrc`, `npm ci`, build of `@leq/domaine` and `@leq/moteur` if they declare a build script, `npm run check`, `npm run format:check`, and a separate job on Python 3.12 running `pytest apps/serveur/prosodie`. Nothing deploys from CI; deploys and EAS builds are manual.

## Everyday checks

```bash
npm run check
npm run format
grep -rn --include='*.ts' --include='*.tsx' --include='*.md' --include='*.sql' --include='*.py' -e '—' -e '–' . | grep -v node_modules   # must print nothing
```

## Troubleshooting

- Metro cannot resolve a package installed at the root: the mobile workspace's `metro.config.js` must list the root `node_modules` in `watchFolders` and `nodeModulesPaths`. Run `npx expo-doctor` in `apps/mobile`.
- `pod install` fails after an SDK change: `cd apps/mobile && npx expo prebuild --clean`.
- `npx supabase link` refuses the password: reset it in Project Settings > Database; it is not the account password.
- `db push` says a migration is already applied but the tables are missing: `npx supabase migration list`, then `npx supabase migration repair` as the CLI suggests.
- `fly deploy` cannot find `packages/`: the build context is wrong; run the command from the repository root with the `--config` and `--dockerfile` flags above.
- The worker claims nothing: check `PROCESS=worker`, check `DATABASE_URL` is the direct connection, check that `reclamer_job` exists and is executable by the service role (`select proname from pg_proc where proname = 'reclamer_job'`).
