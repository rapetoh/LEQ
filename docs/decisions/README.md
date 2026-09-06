# Decision records

Architecture decision records (ADRs) for LEQ. One file per decision, numbered in the order they were taken. An ADR is never rewritten: when a decision changes, a new ADR supersedes it and the old one's status line points to the new number.

Each record has three parts. Context: what was true and what forced a choice. Decision: what we do. Consequences: what it makes easy, what it costs, what it forbids.

Status values: Proposed, Accepted, Superseded by ADR-nnn.

| ADR                                                          | Title                                                       | Status                                               | Date       |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| [ADR-001](ADR-001-stack.md)                                  | Stack: Expo, Supabase in the EU, one Node service on Fly.io | Accepted                                             | 2026-09-05 |
| [ADR-002](ADR-002-monorepo.md)                               | Monorepo with npm workspaces                                | Accepted                                             | 2026-09-05 |
| [ADR-003](ADR-003-french-domain-vocabulary.md)               | French domain vocabulary, English plumbing                  | Accepted                                             | 2026-09-05 |
| [ADR-004](ADR-004-anonymous-diagnostic.md)                   | Diagnostic before account, via anonymous sign-in            | Accepted                                             | 2026-09-05 |
| [ADR-005](ADR-005-transient-audio.md)                        | Audio is transient by construction                          | Accepted                                             | 2026-09-05 |
| [ADR-006](ADR-006-structured-feedback-and-versioned-grid.md) | Structured feedback first, versioned grid                   | Accepted                                             | 2026-09-05 |
| ADR-007                                                      | Audio capture stack for attempts and for the debate         | Reserved: written by the Phase 0 audio capture spike |            |
| [ADR-008](ADR-008-praat-prosody.md)                          | Prosody extraction in Praat, everything else in TypeScript  | Accepted                                             | 2026-09-05 |

## Reserved numbers

ADR-007 is reserved for the result of the audio capture spike (plan, Phase 0, spike a). The spike answers three questions: can expo-audio record 16 kHz mono AAC with automatic gain control and noise suppression disabled (iOS `.measurement` mode, Android `UNPROCESSED`), does a recording survive an interruption on Android without a corrupt file, and can a library such as `react-native-audio-api` stream microphone PCM out and play PCM chunks in for the debate. The file `ADR-007-capture-audio.md` is written by that spike, not by the docs pass.

## Decisions recorded elsewhere, awaiting their own ADR

The approved plan takes more decisions than the eight above. They are summarised in [docs/ARCHITECTURE.md](../ARCHITECTURE.md) and get an ADR when the phase that implements them starts, numbered from ADR-009 in the order they are written:

- Ledgers, not counters (points, debate quota, streak replay): Phase 5.
- Scheduled work goes through the `jobs` table, pg_cron only inserts: implemented in Phase 0, ADR written with the first cron-driven feature (Phase 1 sweeps).
- No hard-coded tunables (`configuration` and `drapeaux`): Phase 0, ADR with the admin editor (Phase 6).
- Admin role via a custom access token hook: Phase 0, ADR with the admin space (Phase 6).
- Moderation is a state: Phase 7.
- STT behind a `Transcripteur` interface, provider chosen by the bench: Phase 2 (the bench report becomes the ADR).
- LLM: Anthropic Claude with structured outputs, keys never on the phone: Phase 3.
- Payments via RevenueCat, notifications local plus Expo push: Phase 4 and Phase 6.
- Testing strategy and CI: Phase 0, ADR when Maestro is added.
- Strings in one typed module per app: see [docs/STRINGS.md](../STRINGS.md).

## Writing a new ADR

Copy the structure of ADR-001. Keep it short, keep the reasoning, name the alternatives that were rejected and why. English, French domain terms kept as they are in the code. No em dashes.
