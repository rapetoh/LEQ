# ADR-004: Diagnostic before account, via anonymous sign-in

Status: Accepted
Date: 2026-09-05

## Context

The cahier (chapter 3) orders the arrival deliberately: the person records first, sees a speaker profile, and only then is asked to create an account. It also states that what is kept from a person without an account is "un petit résultat texte qui tient en local et qu'on jette si la personne s'en va". The mockup (A1 to A7) shows the diagnostic take being uploaded and analysed, and A7 says "Ton profil reste sur ce téléphone en attendant". The server pipeline needs an authenticated principal to accept an upload, apply RLS and route a job; the phone must not become an unauthenticated upload endpoint.

## Decision

- The app signs the phone in as a Supabase anonymous user on first launch. The diagnostic take is uploaded under that user, analysed by the normal pipeline, and the audio is deleted like any attempt.
- The result is delivered to the phone and kept there. Server rows of anonymous users (`profils`, `tentatives`, `analyses`, `evaluations`) are purged by the `purger_anonymes` job after a configurable window, `configuration.purge_anonymes_heures`, default 72 hours.
- One diagnostic per anonymous user. Anonymous users may only touch `profils` (own), `configuration` and `drapeaux` (read), `tentatives` of type `diagnostic` (own insert), `analyses` and `evaluations` (own read). Arena, duels, shop and debate are denied in RLS through `public.est_anonyme()`.
- Account creation links Apple, Google or email to the same user (Supabase identity linking, `enable_manual_linking`). When the identity already belongs to an existing account (reinstall), the app signs into the existing account, keeps the local profile only if that account has none, and deletes the orphan anonymous user.
- RevenueCat is initialised only after conversion, with the Supabase uid as app user id.

## Consequences

- The pipeline has one code path: a diagnostic attempt is a `tentatives` row of type `diagnostic`, nothing special downstream.
- "Plus tard, je veux d'abord essayer" (A7) works: the person keeps a local profile and a still-anonymous session; if they come back within the window and create an account, the diagnostic follows them; after the window it is server-side gone and only the local text remains, which is exactly the cahier's promise.
- Anonymous sign-in must be enabled on the hosted project (Auth settings) and rate limited per IP (config.toml sets 30 per hour for local; the hosted value is set in the dashboard).
- The purge job must delete storage objects as well as rows, which is why it runs in the worker and not in SQL (see the jobs decision in docs/ARCHITECTURE.md).
- Rejected: uploading without authentication (open endpoint, no RLS); asking for the account first (the cahier says this is where most people are lost); analysing on the phone (the engine would have to ship in the app and could never be updated without a release).
