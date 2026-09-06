# ADR-005: Audio is transient by construction

Status: Accepted
Date: 2026-09-05

## Context

Chapter 2 of the cahier is a written commitment: the voice is analysed, then deleted; only text and numbers are kept; the single exception is an Arena or duel take, which stays online for the vote and is deleted at closing; no numeric deletion delay is ever promised; account deletion must really work, Arena included; an offline take that never left the phone is deleted after seven days. The voice is personal data under the GDPR. A promise like this cannot depend on someone remembering to call delete at the end of a happy path: outages, retries and crashes must all end with the audio gone.

## Decision

- One private bucket, `audio-tentatives`. The phone uploads under a client-generated attempt id at `{utilisateur_id}/{id}.m4a`, so a retry overwrites instead of duplicating. Clients can insert at their own path and nothing else; the service role does everything else.
- `tentatives.statut` holds only server-side states of the lifecycle diagram (`envoyee`, `en_transcription`, `en_mesure`, `en_evaluation`, `audio_supprime`, `retour_disponible`, `echec_technique`, `abandon_technique`). Phone-only states (enregistrement, en attente réseau, annulée, expirée) live in the phone's local queue, which expires files after `expiration_file_locale_jours` (7) and is excluded from iCloud and Android backups.
- The worker commits `analyses` and `evaluations`, then deletes the object and sets `audio_supprime`, then `retour_disponible`. The audio never outlives a successful evaluation.
- A sweeper job, `balayer_audio`, deletes any non-public object older than `balayage_audio_heures` (6 hours), a window longer than the maximum retry window of the pipeline (5 attempts with exponential backoff starting at 30 s). An STT outage therefore cannot turn retries into silent retention: retries fail into `abandon_technique` and the sweeper removes the file.
- Arena and duel audio live in a second private bucket, `audio-public`, served by signed URL, with an explicit `date_suppression` on the owning row set at closing (Phase 7). A take deleted mid-contest is tombstoned so votes and podium stay consistent.
- Account deletion and suspension run as privileged jobs on the server (`supprimer_compte`): rows plus storage objects, verified by a test that lists the bucket afterwards.
- Progress is shown from measures, never from re-listening. No feature may depend on stored audio, except the Arena and duel listening window.

## Consequences

- The client never deletes anything: it cannot, by policy. Every deletion is a server responsibility with a test.
- The lifecycle has no state in which audio can be kept indefinitely: every path ends in deletion (success, technical abandonment, sweep, purge of anonymous users, account deletion).
- The user-facing text never states a delay ("analysée puis supprimée"), matching the cahier's rule, while the system enforces a bounded one internally.
- Debugging a failed analysis cannot rely on replaying the audio; logs and the transcript must carry enough. A dev-only fixture corpus (consented recordings) serves for reproduction.
- Rejected: keeping audio for N days "for support" (contradicts the commitment); deleting on the phone only (the server copy is the one that matters); lifecycle rules in the bucket alone (cannot express "after evaluation committed").
