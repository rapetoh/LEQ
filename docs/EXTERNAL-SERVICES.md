# External services

Every third party LEQ depends on or is evaluating: what it is for, who owns the account, whether it exists, where it processes data, what the data protection position is, and what it costs. "DPA" means a data processing agreement under the GDPR, which LEQ needs with every provider that processes users' personal data (voice, transcripts, measures, identifiers, push tokens, purchase records). The voice is the most sensitive item; it reaches only Supabase Storage (briefly), the worker on Fly and the chosen STT provider.

Prices and plan limits were read on 2026-09-06 and change; the note says where they were read. "Verify" marks a statement to confirm before relying on it.

## Summary

| Service                                                              | Purpose                                                      | Owner                                              | Status                                                                                               | Region                                           | DPA                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| Supabase                                                             | Postgres, Auth, Storage, Realtime, pg_cron, Edge Functions   | Roch (account join.leq@gmail.com, org "LEQ's Org") | Project "LEQ" created 2026-09-06, ref `gnabuebxleogsuhvdgpk`                                         | eu-west-1, Ireland                               | Needed, available in the dashboard     |
| Fly.io                                                               | The Node service (worker, temps-reel)                        | Roch                                               | Deployed on 2026-09-06: app `leq-serveur`, one worker and one temps-reel machine, job claim verified | cdg, Paris                                       | Needed, published by Fly (verify link) |
| Expo / EAS                                                           | Cloud builds, store submission, push relay                   | Roch (account rxpetoh)                             | Logged in; EAS project not created                                                                   | Builds on Expo's infrastructure (US); push relay | Needed for push tokens                 |
| Apple Developer Program                                              | TestFlight, App Store, Sign in with Apple                    | Roch                                               | Active membership (used for a previous app)                                                          | n/a                                              | Apple terms; privacy labels            |
| Google Play Console                                                  | Play internal testing, Play Store, Google sign-in            | Roch                                               | Unknown (question open)                                                                              | n/a                                              | Google terms; data safety form         |
| RevenueCat                                                           | Subscriptions on both stores, webhook to `abonnements`       | Roch                                               | Not created                                                                                          | US                                               | Needed                                 |
| OpenAI                                                               | Whisper, realtime transcription, Rétor, the judge, the voice | Roch                                               | Key in Fly secrets, all four roles live in production since 2026-09-13 (ADR-011)                     | US                                               | Needed; request zero data retention    |
| PostHog                                                              | Product usage: screens, events, funnels                      | Roch (project "LEQ", id 607856)                    | Wired in the app on 2026-09-13; first events awaited                                                 | US cloud (`us.i.posthog.com`)                    | Needed; no audio or transcript is sent |
| Google Cloud                                                         | OAuth clients for Google sign-in                             | Roch (join.leq@gmail.com)                          | Web and iOS clients created 2026-09-13; consent screen in production                                 | n/a                                              | Google terms                           |
| Gmail (SMTP)                                                         | The e-mails Supabase Auth sends (codes, confirmations)       | Roch (join.leq@gmail.com, app password)            | Configured 2026-09-13 in `supabase/config.toml`; a transactional provider replaces it before launch  | Google                                           | Google terms                           |
| Anthropic                                                            | Claude (the plan's language model)                           | Roch                                               | Superseded by OpenAI (ADR-011)                                                                       | US                                               | Not needed                             |
| STT candidates: Deepgram, Gladia, AssemblyAI                         | Transcription, batch and streaming                           | Roch                                               | Bench kept in `packages/moteur/bench`, not run; OpenAI chosen without it (ADR-011)                   | Varies, bench criterion                          | Only if one is ever chosen             |
| TTS candidates: ElevenLabs, Azure Speech, Google Cloud TTS, Cartesia | Rétor's voice (Phase 8)                                      | Roch                                               | Not created; OpenAI's voice is in use (ADR-011)                                                      | Varies                                           | Lower sensitivity (no user audio)      |
| GitHub                                                               | Repository and Actions CI                                    | Roch (rapetoh)                                     | Repo exists, CI file pushed, first run not checked                                                   | US                                               | Not needed for user data (code only)   |
| Mozilla Common Voice                                                 | French corpus for the STT bench                              | n/a                                                | Not downloaded                                                                                       | n/a                                              | CC0 dataset, licence check             |

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

## OpenAI

- Purpose: the four external roles behind a take and a debate (ADR-011): `whisper-1` transcribes a recorded take with word timings; the realtime transcription session (`gpt-4o-mini-transcribe`) hears the person during the face-à-face; `gpt-4.1-mini` writes Rétor's replies and the debrief and scores the two judged axes of the note; `gpt-4o-mini-tts` speaks Rétor. Always called from the server; the phone never holds the key.
- Status: live in production since 2026-09-13 (`TRANSCRIPTEUR`, `TRANSCRIPTEUR_FLUX`, `ADVERSAIRE`, `VOIX`, `JUGE` all `openai` on Fly, `OPENAI_API_KEY` in Fly secrets). `apps/serveur/scripts/verif-openai.mjs` calls the four against the real API. A spending cap is set on the OpenAI organisation (Roch, 2026-09-13).
- Region: US. No EU processing on the API.
- Data protection: audio of every take and of every debate turn, and transcripts, reach OpenAI. API data is not used for training under the API terms; default abuse-monitoring retention is 30 days; zero data retention is requested per organisation. Request it, and sign the DPA in the OpenAI platform settings, before real users. The privacy statement in `apps/web` must name the processor.
- Cost: to be measured on real calls, which is the debate cost spike the plan asked for. Whisper is billed per minute of audio, the realtime session per minute of input audio, the chat models per token, the voice per character.

## PostHog

- Purpose: what people do in the app, counted: the funnel from the first screen to the account, which challenge is opened, where the path stops, whether the Arena and the face-à-face are used. Wired in `apps/mobile/src/services/usage.ts` with a closed list of events; the person is identified by their Supabase id.
- Status: project "LEQ" (id 607856) on PostHog Cloud US, created 2026-09-13. The key is public by design and ships in the app (`EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`).
- Region: US cloud. An EU cloud exists; moving means a new project and a new key.
- Data protection: events carry a name, a few properties (a take's type and length, a step id, a sign-in method), the device model and the app version. No audio, no transcript, no measure, no e-mail. Session replay and autocapture are off. DPA: PostHog offers one in the settings; sign it before release.
- Cost: free up to one million events a month.

## Google Cloud (OAuth for Google sign-in)

- Purpose: the two OAuth clients Google sign-in needs: a web client (its id and secret go to Supabase, the id ships in the app for the id token audience) and an iOS client (bundle id `com.leqapp.mobile`, its reversed id is the app's URL scheme in `app.json`).
- Status: both created on 2026-09-13 under join.leq@gmail.com, project "LEQ App". The consent screen is in production since 2026-09-13: with only non-sensitive scopes (email, profile, openid), no logo and the two legal pages on Fly, Google required no verification. Adding a logo or a sensitive scope would send it back to the verification queue. Android will need a third client with the SHA-1 of the signing key.

## Gmail (SMTP for Supabase Auth)

- Purpose: the e-mails Supabase Auth sends: the six-digit code of the account screen, the confirmation of a changed address, the recovery link. Supabase's own sender is limited to a few messages an hour and is for development only.
- Status: `supabase/config.toml` declares `smtp.gmail.com:587` with join.leq@gmail.com and an app password (`SMTP_PASS`, in the root `.env`, never in git), pushed on 2026-09-13. Gmail allows about 500 messages a day from one account, which is enough for testing and not for launch: a transactional provider (Brevo, Resend, Postmark) with the domain's own address replaces it once the domain exists.

## Anthropic (Claude)

Superseded on 2026-09-13 by OpenAI (ADR-011). Kept for the record.

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

Status: the bench was not run. OpenAI was chosen on 2026-09-13 for both modes (ADR-011); the harness stays for the day the quality or the bill asks for a comparison.

## Text-to-speech candidates (Phase 8)

Only Rétor's text is sent; no user audio. Sensitivity is low; the criteria are French voice quality, streaming or sentence-chunked latency, EU hosting and price per character. Candidates: ElevenLabs (US, EU residency on enterprise plans, best French voices to verify), Azure Speech (EU regions including France Central), Google Cloud Text-to-Speech (EU regions), OpenAI TTS (US), Cartesia (US, low latency). Status: OpenAI's `gpt-4o-mini-tts` is in use (ADR-011); the others were not tried.

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
