# ADR-006: Structured feedback first, versioned grid

Status: Accepted
Date: 2026-09-05

## Context

Chapter 5 of the cahier calls this the heaviest consequence of the whole document: feedback must exist as fields (measures and sub-scores) before it exists as French sentences, otherwise nothing downstream (personalised path, cumulative scoring, progress curves, regression detection) can work. Rebecca's grid defines what a good take is; the application applies it constantly and does not reinvent it per analysis. Her grid does not exist yet (chapter 14), and it will change. Progression is driven by the total score on all criteria (chapter 4), with requirements that rise along the path. The user never receives a global note on their voice (chapter 3), and never hears two contradictory judgements.

## Decision

- `analyses.mesures` holds the deterministic measures, schema-versioned (`version_schema`, shape v1 in docs/DATA-MODEL.md), computed by `packages/moteur` from PCM plus the timed transcript. The transcript is stored with word timings. This is the only thing kept from the voice.
- `grilles` are versioned rows; `criteres_grille` are declarative rules: `regle` v1 is a weighted sum of banded measures (`{ version, score_max, elements: [{ mesure, bandes: [{min, max, score}], poids }] }`). Rebecca may express pure bands (one element, weight 1) or weighted sums; the engine evaluates them deterministically. A grid is a draft until `publiee_le` is set.
- `evaluations` snapshot `grille_id` and `version_grille`, hold `sous_notes` per criterion, `note_totale`, and the step's `seuil_reussite` copied at evaluation time. History is never rescored. Progress curves read raw measures, so they survive grid changes.
- `points_forts`, `axes_travail` and `exercice_court` are fields chosen from the evaluation, of variable count (one strength and two levers is a valid output).
- `redaction` is French wording generated from those fields by Claude under a strict JSON schema, stored as derivative text with the model name and generation time, regenerable at any time from the fields alone, and never read by any logic.
- While no grid exists, `evaluations.grille_id` is null and the app shows measures and a placeholder text clearly marked as such in development. A dev grid fixture exists only in tests and is never seeded in production.
- Rebecca writes rules against numbers she has looked at: the admin gets a calibration tool (Phase 3) that shows every measure on sample takes.

## Consequences

- The engine, the grid and the wording are three separable layers with tests at each boundary: fixtures with expected measure ranges, rule evaluation with known inputs, JSON-schema validation of the wording.
- A grid change affects future evaluations only; a person who passed a step under v2 keeps that result under v3.
- Because wording is derivative, a bad sentence can be regenerated for every past evaluation without any audio, and a model change never changes a score.
- The cahier's "second opinion" by the model stays internal: it can be logged for divergence detection but never shown.
- The translation from sound to criteria (presence, structure, assurance) is written down in `regle` rows Rebecca can read in the admin, which is what chapter 5 demands.
- Rejected: a free-text feedback paragraph (nothing downstream can use it); rescoring history when the grid changes (destroys the meaning of past validations); rules in code (Rebecca could not change them; they would need a release).
