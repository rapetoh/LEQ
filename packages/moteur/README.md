# @leq/moteur

The measurement engine: PCM and a timed transcript in, `MesuresV1` (docs/DATA-MODEL.md) out. Pure functions, no network, no filesystem in `src/`, deterministic on the same input. The server (`apps/serveur`) feeds it; the bench (`bench/`) reuses its transcriber interface.

## What it computes (cahier, chapter 5)

| Family                                                            | Module                     | From                    |
| ----------------------------------------------------------------- | -------------------------- | ----------------------- |
| Speaking rate, 10 s windows, stability                            | `mesures/debit.ts`         | transcript              |
| Filler words per type, per minute, occurrences                    | `mesures/motsBequilles.ts` | transcript, filler list |
| Silences above 0.3 s, held pauses at 1.0 s, place in the sentence | `mesures/silences.ts`      | transcript              |
| Breath groups (runs without a 0.25 s gap)                         | `mesures/souffle.ts`       | transcript              |
| Volume level, spread, end-of-sentence drops (400 ms, 6 dB)        | `mesures/volume.ts`        | PCM, transcript         |
| Pitch median, spread and range in semitones, voiced ratio         | `mesures/hauteur.ts`       | F0 track                |
| Immediate repetitions and restarts                                | `mesures/repetitions.ts`   | transcript              |
| Sentence count and lengths                                        | `mesures/phrases.ts`       | transcript              |
| Time before the first word                                        | `mesures/silences.ts`      | transcript              |

`mesurer()` assembles them and validates the result against the domain schema, so a drift between engine and contract fails here rather than in the database. Word timestamps are treated at millisecond precision: gaps are rounded before every threshold comparison.

## Boundaries

- `Transcripteur` (batch) and `TranscripteurFlux` (streaming, interface only): the speech-to-text provider is not chosen yet (Phase 2 bench). `TranscripteurStub` produces a deterministic French transcript proportional to the audio duration so the whole pipeline runs today. Its words are unrelated to the audio.
- `ExtracteurProsodie`: pitch and intensity tracks. `ProsodieStub` fakes them from the signal level; the real extractor is Praat, in `apps/serveur/prosodie`.
- `wav.ts`: a small WAV codec for fixtures and the bench corpus.

## Run

```bash
npm run build --workspace @leq/moteur      # dist/, consumed by the server
npm test --workspace @leq/moteur           # 33 unit tests on synthetic fixtures
```

Fixtures are generated in code (`src/fixtures/synthese.ts`): tones, silences, handcrafted timed transcripts with known ground truth. No recorded voice is committed.

## Stubbed and why

The transcriber and the prosody extractor are stubs here by design; both real implementations live outside this package (provider adapter after the bench, Praat CLI in the server). The filler-word list is the v1 list of the contract until Rebecca edits it in the admin (Phase 6).
