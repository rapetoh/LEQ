# @leq/serveur

The LEQ server: one Node 22 image, two Fly.io process groups.

- `worker`: claims jobs from `public.jobs` (`reclamer_job`, `FOR UPDATE SKIP LOCKED`), runs the analysis pipeline and the privileged operations (audio sweep, anonymous purge, account deletion), answers `GET /sante`.
- `temps-reel`: the debate WebSocket (`/debat`), a placeholder until Phase 8 that tells the client the feature is not there yet.

## The analysis pipeline (`src/jobs/analyserTentative.ts`)

In the exact order of the state diagram: `en_transcription` (download, transcribe) then `en_mesure` (ffmpeg decode to 16 kHz mono PCM, Praat prosody, `@leq/moteur`) then `en_evaluation` (score every criterion of the published grid, none today) then one transaction writing `analyses` and `evaluations`, then the audio object is deleted, `audio_supprime`, `retour_disponible`. Any failure records `echec_technique` and lets `echouer_job` retry with backoff; on the last try the audio is deleted anyway and `abandon_technique` is recorded. Every dependency is injected, so the order of writes is covered by unit tests without a database.

## Stubs

- Speech-to-text: `TRANSCRIPTEUR=stub` delegates to the engine's deterministic fake (a French transcript proportional to the duration). The real adapter comes after the Phase 2 bench; `analyses.fournisseur_transcription = 'stub'` records the difference.
- The published grid: none exists until Rebecca provides it, so `evaluations.sous_notes` is empty and `note_totale` null. The code path with a grid is tested.
- Wording (Claude) and push notifications: Phase 3 and Phase 1 respectively, not in this package yet.

## Run locally

```bash
cp apps/serveur/.env.example apps/serveur/.env      # fill DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY
brew install ffmpeg                                  # once
python3 -m venv apps/serveur/prosodie/.venv && apps/serveur/prosodie/.venv/bin/pip install -r apps/serveur/prosodie/requirements.txt pytest
npm run build --workspace @leq/domaine --workspace @leq/moteur
PYTHON_PATH=apps/serveur/prosodie/.venv/bin/python3 npm run dev --workspace @leq/serveur
```

Checks: `npm run typecheck`, `npm test` (pipeline order, failure paths, worker loop), `apps/serveur/prosodie/.venv/bin/python -m pytest apps/serveur/prosodie` (Praat CLI on synthetic tones).

`DATABASE_URL` must be the direct connection (or the session pooler), never the transaction pooler: the queue relies on row locks and multi-statement transactions.

## Deploy (Fly.io, region cdg)

From the repository root, once `fly auth login` is done:

```bash
fly apps create leq-serveur                                # first time
fly secrets set -c apps/serveur/fly.toml DATABASE_URL=... SUPABASE_URL=... SUPABASE_SECRET_KEY=...
fly deploy -c apps/serveur/fly.toml --dockerfile apps/serveur/Dockerfile .
fly logs -c apps/serveur/fly.toml
```

`PROCESS` is taken from `FLY_PROCESS_GROUP`, set by Fly on every machine. The Dockerfile builds the three TypeScript workspaces and installs ffmpeg, Python and Praat (parselmouth) in the runtime stage.

## Environment

See `.env.example`: every variable, its default and what it does.
