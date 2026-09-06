# ADR-008: Prosody extraction in Praat, everything else in TypeScript

Status: Accepted
Date: 2026-09-05

## Context

The measures shape (docs/DATA-MODEL.md, `hauteur` and `volume`) needs a fundamental frequency track (median F0, spread in semitones, range, voiced ratio) and an intensity track (mean dB, spread, end-of-sentence drops). Pure JavaScript pitch trackers (autocorrelation or YIN ports) make octave errors on breathy, low or noisy voices, and none of them is validated the way Praat is in phonetics research. The rest of the engine (rate, fillers, silences, breath groups, repetitions, sentence length, start delay) works from the timed transcript and simple energy, and belongs with the domain code in TypeScript. The worker already ships a Docker image, so adding a Python runtime costs nothing architecturally.

## Decision

- A small Python 3 command line program, `apps/serveur/prosodie/extraire.py`, built on parselmouth (the Praat library, package `praat-parselmouth`), reads 16 kHz mono PCM and prints JSON with the F0 track and the intensity track (time, value, voiced flag), using Praat's standard pitch (autocorrelation) and intensity algorithms with parameters fixed in the script and reported in the output.
- The worker invokes it once per attempt as a subprocess with a timeout, parses the JSON, and hands the tracks to `packages/moteur`, which computes every number in `mesures` in TypeScript.
- The boundary is exactly "PCM in, F0 and intensity tracks out". No domain logic in Python. No transcript in Python.
- The CLI has its own tests (pytest, synthetic tones and fixture audio with expected ranges), run in CI in a separate job with Python 3.12, and its dependencies are pinned in `apps/serveur/prosodie/requirements.txt`.
- The Docker image for `apps/serveur` installs ffmpeg (decode m4a to PCM) and python3 with the pinned requirements.

## Consequences

- Pitch and loudness numbers are reproducible and defensible: the same algorithms Rebecca's field uses.
- One more runtime in the image (a few hundred MB) and a subprocess per attempt (well under a second for 90 s of audio). Acceptable for a worker; it is why the pipeline does not run in Edge Functions (ADR-001).
- Local development needs Python 3 with parselmouth installed (docs/RUNBOOK.md); the TypeScript engine can still be tested on recorded track fixtures without Python.
- Nulls are allowed in `hauteur` when there is no voiced speech (silent take); the engine must handle them and the grid rules must tolerate them.
- If parselmouth ever lags Python versions, the CLI is small enough to port to a direct Praat binary call.
- Rejected: JavaScript pitch trackers (octave errors, no validation); a Python service for the whole engine (splits the domain across two languages, ADR-001); on-device extraction (ties the numbers to phone hardware and OS audio processing).
