# External services

Every third party LEQ depends on or is evaluating: what it is for, who owns the account, whether it exists, where it processes data, what the data protection position is, and what it costs. "DPA" means a data processing agreement under the GDPR, which LEQ needs with every provider that processes users' personal data (voice, transcripts, measures, identifiers, push tokens, purchase records). The voice is the most sensitive item; it reaches only Supabase Storage (briefly), the worker on Fly and the chosen STT provider.

Prices and plan limits were read on 2026-09-06 and change; the note says where they were read. "Verify" marks a statement to confirm before relying on it.

## Summary

| Service                                                                      | Purpose                                                       | Owner                                              | Status                                                                                               | Region                                            | DPA                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Supabase                                                                     | Postgres, Auth, Storage, Realtime, pg_cron, Edge Functions    | Roch (account join.leq@gmail.com, org "LEQ's Org") | Project "LEQ" created 2026-09-06, ref `gnabuebxleogsuhvdgpk`                                         | eu-west-1, Ireland                                | Needed, available in the dashboard     |
| Fly.io                                                                       | The Node service (worker, temps-reel)                         | Roch                                               | Deployed on 2026-09-06: app `leq-serveur`, one worker and one temps-reel machine, job claim verified | cdg, Paris                                        | Needed, published by Fly (verify link) |
| Expo / EAS                                                                   | Cloud builds, store submission, push relay                    | Roch (account rxpetoh)                             | Logged in; EAS project not created                                                                   | Builds on Expo's infrastructure (US); push relay  | Needed for push tokens                 |
| Apple Developer Program                                                      | TestFlight, App Store, Sign in with Apple                     | Roch                                               | Active membership (used for a previous app)                                                          | n/a                                               | Apple terms; privacy labels            |
| Google Play Console                                                          | Play internal testing, Play Store, Google sign-in             | Roch                                               | Unknown (question open)                                                                              | n/a                                               | Google terms; data safety form         |
| RevenueCat                                                                   | Subscriptions on both stores, webhook to `abonnements`        | Roch                                               | Not created                                                                                          | US                                                | Needed                                 |
| Anthropic                                                                    | Claude: wording, path generation, Rétor, debriefs, moderation | Roch                                               | Not created (API key awaited)                                                                        | US by default; `inference_geo` for data residency | Needed (commercial terms)              |
| STT candidates: Deepgram, Gladia, OpenAI, AssemblyAI                         | Transcription, batch and streaming                            | Roch                                               | Not created (trial keys awaited, Phase 2)                                                            | Varies, bench criterion                           | Needed for the chosen one(s)           |
| TTS candidates: ElevenLabs, Azure Speech, Google Cloud TTS, OpenAI, Cartesia | Rétor's voice (Phase 8)                                       | Roch                                               | Not created                                                                                          | Varies                                            | Lower sensitivity (no user audio)      |
| GitHub                                                                       | Repository and Actions CI                                     | Roch (rapetoh)                                     | Repo exists, CI file pushed, first run not checked                                                   | US                                                | Not needed for user data (code only)   |
| Mozilla Common Voice                                                         | French corpus for the STT bench                               | n/a                                                | Not downloaded                                                                                       | n/a                                               | CC0 dataset, licence check             |

## Supabase

- Purpose: system of record. Postgres 17 with RLS, Auth (anonymous, Apple, Google, e-mail), Storage (`audio-tentatives`, `audio-public`), Realtime, pg_cron, thin Edge Functions for the RevenueCat webhook.
- Account: a dedicated Supabase account for LEQ (join.leq@gmail.com), organisation "LEQ's Org", separate from Roch's other products. Decided 2026-09-06 because the previous account was at the free-project limit.
- Status: project "LEQ" created on 2026-09-06 (ref `gnabuebxleogsuhvdgpk`, Postgres 17). Socle migration and seed pushed the same day; auth settings pushed from `supabase/config.toml` (anonymous sign-in, manual linking, access token hook, `leq://auth` redirect, email confirmations on); 133 database assertions green against it. First admin account join.leq@gmail.com.
- Region: eu-west-1 (Ireland, AWS). The plan said Paris; the project was created in Ireland on 2026-09-06 and kept: still the EU, a few milliseconds from the Fly machines in Paris, and a region cannot change afterwards.
- Data protection: processor for all user data. Audio is stored only between upload and evaluation (ADR-005). DPA: Supabase provides one for download in the dashboard (organization settings, legal documents); sign it before release. Backups: daily on Pro; on Free, no automatic backups, which is another argument for Pro before real users. Logs may contain request metadata; audio content never appears in logs.
- Cost: free while within two active projects and the free quotas (500 MB database, 1 GB storage, 5 GB egress, 50,000 MAU). Free projects pause after a week of inactivity and stay paused until resumed. Pro: $25 a month per organization with $10 of compute credit; each project's default compute is about $10 a month. Estimate for LEQ before launch: $0 on Free, about $25 a month on Pro. Storage of audio is negligible because objects live minutes.

## Fly.io

- Purpose: runs `apps/serveur` as two process groups from one image.
- Account: Roch. CLI installed at `/opt/homebrew/bin/fly`, not logged in.
- Status: app not created, nothing deployed.
- Region: `cdg` (Paris). Same city as the database, so the worker's chatty queries stay low latency.
- Data protection: the worker holds audio in memory and on the machine's ephemeral disk during analysis, then discards it. Fly publishes a DPA on its legal pages (the page refused an automated read on 2026-09-06; open https://fly.io/legal/ in a browser and verify). Secrets stay in Fly secrets. No persistent volume is planned.
- Cost: pay as you go, billed per second of machine time plus a small monthly minimum on some plans. Two `shared-cpu-1x` machines always on (one per process group) are in the order of $5 to $10 a month together; `performance` machines for the worker would add more when Praat and ffmpeg need it (verify on https://fly.io/docs/about/pricing/ at first deploy). Remote builders are free within reason.

## Expo and EAS

- Purpose: EAS Build (store binaries, development builds), EAS Submit (TestFlight and Play), Expo push service (relays notifications to APNs and FCM).
- Account: `rxpetoh`, logged in on this Mac.
- Status: EAS project `@rxpetoh/leq` created on 2026-09-06 (id `705674fb-72ee-426c-ae36-9dabc28601f1` in `app.json`), needed for push tokens. No build has been run on EAS yet.
- Region: builds run on Expo's infrastructure, US. Push tokens and notification payloads transit through Expo's push service.
- Data protection: the push relay sees device push tokens and the notification text ("Ton retour est prêt", workshop announcements); it never sees audio or transcripts. Keep payloads free of measures. DPA: Expo has a privacy policy and offers a DPA on request for production plans (verify at https://expo.dev/privacy). Build artifacts contain the app bundle, no user data.
- Cost (pricing page read on 2026-09-06): Free plan, 15 iOS and 15 Android builds a month; Starter $19 a month with $45 of build credit; Production $199 a month with $225 of credit. Builds are manual and counted, which is why CI never triggers them. Push notifications are not priced on the page; treat them as included and verify when volumes grow.

## Apple Developer Program and Google Play Console

- Purpose: distribution, Sign in with Apple (mandatory when Google sign-in is offered on iOS), Google sign-in, store trials and prices (RevenueCat reads them).
- Account: Roch. The Apple Developer Program membership ($99 a year) is active. Whether a Google Play developer account ($25 once) and an Android test device exist is an open question in docs/OPEN-INPUTS.md.
- Data protection: App Store privacy labels and the Play data safety form must state audio recording (not stored), user content, identifiers, purchase history. Both stores require a public privacy policy URL (apps/web, Phase 7 or a temporary page before).
- Cost: as above, plus the 15 percent or 30 percent store commission on subscriptions.

## RevenueCat

- Purpose: subscriptions on both stores with one SDK; app user id = Supabase uid; webhook to a Supabase Edge Function that writes `abonnements`; offer content stays in `configuration`, prices in the stores.
- Status: not created. Needed in Phase 4.
- Region: US.
- Data protection: processes the app user id (the Supabase uid, a pseudonymous identifier), purchase receipts and subscription state. No audio, no transcript. RevenueCat states GDPR compliance and SOC 2 (pricing page read on 2026-09-06); the DPA is on their legal pages (verify and sign before release).
- Cost: free up to $2,500 of monthly tracked revenue, then 1 percent of tracked revenue (pricing page read on 2026-09-06).

## Anthropic (Claude)

- Purpose: French wording generated from evaluation fields under a strict JSON schema (Phase 3), path generation once the rules exist (Phase 4), Rétor's replies (Phase 8), debriefs (Phase 8), text moderation of custom theses and subjects (Phase 7). Always called from the server; the phone never holds the key.
- Status: no API key yet (docs/OPEN-INPUTS.md). Needed for the Phase 2 debate cost spike and Phase 3.
- Region: the Claude API processes in the US by default. The API accepts an `inference_geo` request parameter for data residency (skill reference read on 2026-09-06; confirm the available geographies and whether EU is offered on the account before relying on it). Alternative for strict EU processing: Claude on Amazon Bedrock in an EU region, at partner pricing.
- Data protection: inputs are evaluation fields, transcripts (debate, moderation) and prompts; never audio. API inputs and outputs are not used for training under the commercial terms; default retention is 30 days for trust and safety; zero data retention can be requested for eligible organizations. DPA: part of Anthropic's commercial terms; confirm on the console before release. Keep transcripts out of prompts where fields suffice.
- Cost (first-party rates read on 2026-09-06, per million tokens, input then output): Opus 5 $5 and $25; Sonnet 5 $2 and $10; Haiku 4.5 $1 and $5. A wording call is a few hundred input tokens and a few hundred output tokens, so well under one cent per attempt on Sonnet, a few cents on Opus. Rétor's turns and debriefs are measured in the Phase 2 cost spike before the Complet price is set. Prompt caching cuts repeated system prompts by about 90 percent.

## Speech-to-text candidates (Phase 2 bench)

The bench compares them on French audio with Belgian, Swiss, Québec and African accents, fast speech and background noise, in two modes: batch (attempts, word timings and confidence required) and streaming (debate, endpointing and low latency required). Scores: accuracy (WER on the corpus), latency per mode, cost per minute, EU processing, zero-retention terms. One provider may not win both modes. Trial credits suffice for the bench.

| Provider                                   | Company base   | EU processing                                                       | Retention terms                                                       | Cost notes                                                      |
| ------------------------------------------ | -------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Deepgram                                   | US             | Self-hosted option; hosted API regions to verify                    | Zero-retention options exist for enterprise, verify for pay-as-you-go | Per minute, among the cheapest for batch; streaming supported   |
| Gladia                                     | France (Paris) | EU hosting stated by the vendor, verify contractually               | Verify                                                                | Per hour of audio; French focus is the reason it is in the list |
| OpenAI (Whisper, gpt-4o transcribe family) | US             | Data residency offered on some enterprise plans, verify for the API | Abuse monitoring retention by default, ZDR on request, verify         | Per minute; streaming transcription exists, latency to measure  |
| AssemblyAI                                 | US             | EU endpoint offered, verify coverage of streaming                   | Verify                                                                | Per hour of audio; streaming supported                          |

Status: none created. Keys are awaited (docs/OPEN-INPUTS.md). The winner(s) get a full entry here and a DPA before Phase 3 ships to users.

## Text-to-speech candidates (Phase 8)

Only Rétor's text is sent; no user audio. Sensitivity is low; the criteria are French voice quality, streaming or sentence-chunked latency, EU hosting and price per character. Candidates: ElevenLabs (US, EU residency on enterprise plans, best French voices to verify), Azure Speech (EU regions including France Central), Google Cloud Text-to-Speech (EU regions), OpenAI TTS (US), Cartesia (US, low latency). Chosen in the Phase 2 cost spike together with the STT streaming mode. Status: none created.

## Expo push, local notifications

- Daily reminder and streak alert are local scheduled notifications on the phone, timezone-correct, no server involved.
- Social events and Rebecca's announcements are server push through Expo's push service (see Expo above), with the four independent toggles of chapter 12 stored on the profile, the geo filter and the monthly cap enforced in the server write path.

## GitHub and GitHub Actions

- Purpose: repository `rapetoh/LEQ`, CI on push and pull request (typecheck, lint, tests, formatting, Praat CLI tests).
- Account: `rapetoh`, `gh` logged in on this Mac.
- Status: repository exists with three commits; the workflow file is pushed; the first run has not been checked.
- Data protection: code and fixtures only. Fixture audio must be consented recordings or Common Voice clips; never a user's take.
- Cost: free minutes for the plan in use; the check runs in under 10 minutes. Verify the repository visibility (private repositories have a monthly minutes quota on the free plan).

## Mozilla Common Voice (corpus)

- Purpose: French subsets with accent metadata for the STT bench and for engine fixtures, together with consented recordings from Roch, Rebecca and her trainees.
- Status: not downloaded (Phase 0 corpus spike).
- Licence: CC0 for the clips; the download requires accepting Mozilla's terms; keep clips out of the repository (large) and reference them by id in the bench.
