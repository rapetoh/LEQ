# ADR-003: French domain vocabulary, English plumbing

Status: Accepted
Date: 2026-09-05

## Context

The product is defined in French. The cahier des charges and the diagrams name the domain objects (tentative, analyse, évaluation, parcours, acte, étape, série, prise publique, duel, débat, grille, critère, exercice), Rebecca reads and edits the admin in French, and every string shown to a user is French. Translating the domain into English for the code would create a second vocabulary that drifts from the documents and that Rebecca cannot read in the admin or in an error message. On the other hand, infrastructure concepts (job queue, worker, retry, lock, webhook) have no French usage among developers and their libraries speak English.

## Decision

- Tables, columns, domain types, Zod schemas, configuration keys, feature flags and job types use the French nouns of the diagrams, in snake_case without accents: `tentatives`, `analyses`, `evaluations`, `grilles`, `criteres_grille`, `configuration`, `drapeaux`, `parcours`, `actes`, `etapes`, `series`, `prises_publiques`, `duels`, `debats`, `exercices`, `jobs` (kept English, it is plumbing). Status values are French too (`envoyee`, `en_transcription`, `retour_disponible`, `echec_technique`).
- Infrastructure keeps English: job, worker, queue, claim, lock, retry, webhook, health, logger, config loader. Technical file and folder names are English (`src/jobs`, `src/audio`, `src/transcription` is the French-named domain folder that holds an English-named interface `Transcripteur`, accepted mix).
- Engineering documentation (docs/, READMEs, ADRs, code comments) is in English, with the French domain terms kept as they are in the code.
- Every user-facing string is French, tutoiement, in one typed module per application (`fr.ts`), reviewed against docs/STRINGS.md.
- Timestamps follow the contract: `cree_le`, `modifie_le`, `enregistre_le`.

## Consequences

- A reader of the cahier, the diagrams, the SQL and the admin sees the same words everywhere.
- The code is bilingual by design. That is accepted; the rule that decides which language applies is "is it a thing of the product or a thing of the machinery".
- Accents are dropped in identifiers (`evaluations`, `criteres`), and never dropped in strings shown to people.
- Contributors who do not read French need docs/DATA-MODEL.md, which explains each table in English.
- Rejected: an English domain with a translation table (two vocabularies, one of them invisible to Rebecca); accented identifiers (fragile in SQL and URLs).
