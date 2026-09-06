# ADR-001: Stack: Expo, Supabase in the EU, one Node service on Fly.io

Status: Accepted
Date: 2026-09-05

## Context

LEQ is a French mobile application for iOS and Android, built by one developer (Roch) who already knows React Native and Supabase, with Rebecca as the pedagogical authority who needs her own administration interface. The product (cahier des charges, August 2026) requires:

- recording 60 to 90 s attempts, and later 5 minute takes, on the phone, offline capable;
- a server-side analysis pipeline over the audio (transcription, acoustic measures, grid scoring, wording), then deletion of the audio;
- a live debate against an AI opponent with a target of under 2 s per turn, which means a long-lived bidirectional connection for 3 to 8 minutes;
- privileged operations that a phone must never perform: deleting storage objects, suspending accounts, sending push, applying quotas;
- an admin space for Rebecca;
- a small public web surface (duel invitation with browser recording, privacy and terms pages).

Supabase Edge Functions have CPU time limits that cannot run signal processing over 90 s of audio and cannot hold a 5 minute WebSocket. The voice is personal data under the GDPR; EU processing is the default expectation.

## Decision

- Mobile: Expo SDK 57, React Native, TypeScript, Expo Router. One codebase for iOS and Android. Store binaries are built on EAS cloud.
- System of record: Supabase, region eu-west-1 (Ireland; the plan said Paris, the project was created in Ireland on 2026-09-06 and kept, the difference being a few milliseconds from Fly's Paris machines): Postgres 17, Auth (including anonymous sign-in), Storage, Realtime, pg_cron. Edge Functions stay thin: webhooks only (RevenueCat).
- Compute: one Node 22 TypeScript service, `apps/serveur`, built on Hono, deployed on Fly.io in Paris (`cdg`) as two process groups from one image: `worker` (analysis pipeline, scheduled jobs, privileged operations) and `temps-reel` (debate WebSocket). `min_machines_running = 1` on both. The image ships ffmpeg and Python 3 with parselmouth (see ADR-008).
- Admin: `apps/admin`, a Vite plus React SPA, TanStack Query, served as static files, talking to Supabase directly under RLS and to the server for privileged writes.
- Public web: `apps/web`, Phase 7.
- The phone never holds a provider key: STT, LLM and TTS are proxied by the server.

## Consequences

- Two providers to operate (Supabase and Fly.io) instead of one, but each does what it is good at: Postgres, auth and storage on one side, long-running CPU work and sockets on the other.
- CPU-bound audio processing and the debate loop run in separate machines, so a batch of analyses never adds latency to a live debate.
- The worker needs a direct (non-pooled) Postgres connection for `FOR UPDATE SKIP LOCKED` and transactions; the pooler is not used by the server.
- A machine is always running on Fly (`min_machines_running = 1`), which has a small fixed monthly cost but removes cold starts on the debate path.
- Everything sensitive (service role key, provider keys) lives only in Fly secrets and the Supabase dashboard, never in the repo or the app bundle.
- Store builds cannot be made on this Mac while it runs a macOS beta (Apple rejects binaries built against a seed SDK), so EAS cloud builds are the only path to TestFlight and Play; simulator builds stay local.
- Rejected: Edge Functions for the pipeline (CPU limits, no long sockets); a Python service for everything (splits the domain code across two languages; TypeScript keeps the domain in one place and Python is confined to the Praat boundary, ADR-008); Firebase (no Postgres, no row-level security model that matches a French domain schema, weaker EU story).
