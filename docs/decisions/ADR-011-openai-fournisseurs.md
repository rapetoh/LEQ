# ADR-011: OpenAI for transcription, Rétor, the judge and the voice

Date: 2026-09-13. Status: accepted. Supersedes the provider parts of the plan's decisions 13
(STT chosen by a bench) and 14 (Anthropic Claude for the language model).

## Context

Four external roles stand behind a take and a debate: transcribing a recorded take with a time
for every word, transcribing live speech during the face-à-face, writing Rétor's replies, the
debrief and the judged axes of the note, and speaking Rétor's replies. The plan put a bench in
front of the transcription choice and named Anthropic for the language model, then waited for
keys. On 2026-09-13 Roch chose to run everything on the OpenAI key he already held, and asked to
be told if that was a bad decision.

## Decision

One provider, OpenAI, behind the four existing interfaces (`Transcripteur`,
`TranscripteurFlux`, `Adversaire` with its debrief, `Juge`, `Voix`), each selected by an
environment variable that still accepts `stub`:

- `whisper-1` for a recorded take, the only OpenAI model that returns word timestamps, which the
  measures of chapter 5 need.
- The realtime transcription session (`gpt-4o-mini-transcribe`, server VAD, 24 kHz PCM) for the
  face-à-face; the phone's 16 kHz is resampled on the server.
- `gpt-4.1-mini` for Rétor, the debrief and the judge, with `docs/STRINGS.md` in the system
  prompt and a code guard that straightens apostrophes and sends a contrastive pair back once.
- `gpt-4o-mini-tts` streamed as 24 kHz PCM for the voice.

The bench in `packages/moteur/bench` stays. It runs if the quality of French transcription or
the bill ever asks for it; nothing in the code assumes the provider.

## Consequences

- One key, one bill, one data processing agreement, and the four roles were live in production
  the same day, verified by `apps/serveur/scripts/verif-openai.mjs` and by a real face-à-face
  against the deployed server.
- Audio and transcripts go to a US company. Zero data retention has to be requested on the
  OpenAI organisation before real users, and the privacy statement names the processor.
- The measured cost of a debate, one of the four inputs the plan refused to invent, can now be
  measured on real calls instead of guessed. It has not been measured yet.
- The language model was not compared against Claude on the writing rules. The guard in code
  exists because the model writes the contrastive pair about one turn in three; if the guard is
  not enough, the comparison is the next step, not a rewrite of the prompt.
