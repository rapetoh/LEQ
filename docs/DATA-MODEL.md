# Data model (contract for all workspaces)

This file is the contract. `packages/domaine` (Zod schemas), `supabase/migrations` (SQL), `apps/serveur` (worker) and `apps/admin` all implement exactly these names. Change the name here first, then everywhere.

Conventions: schema `public`, snake_case, French domain nouns, English plumbing. Every table has `cree_le timestamptz not null default now()`; mutable tables also have `modifie_le timestamptz not null default now()` maintained by a trigger. Primary keys are `uuid` (`gen_random_uuid()`) unless stated. Times are `timestamptz`. Row Level Security is enabled on every table; the service role bypasses it.

## Roles and helpers

- `profils.role text not null default 'utilisateur' check (role in ('utilisateur','admin'))`. Only the service role can change it.
- Custom access token hook `public.hook_jeton_acces(event jsonb) returns jsonb` copies `profils.role` into `claims.app_metadata.role`. Registered in Auth settings.
- `public.est_admin() returns boolean`: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`.
- `public.est_anonyme() returns boolean`: `coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)`.
- Anonymous users (Supabase anonymous sign-in) may only use: `profils` (own), `configuration` (read), `drapeaux` (read), `tentatives` of type `diagnostic` (own), `analyses`/`evaluations` (own, read). Everything else requires `not est_anonyme()`.

## Phase 0 tables

### profils

One row per `auth.users` row, created by trigger `on auth.users insert`.

- `id uuid pk references auth.users(id) on delete cascade`
- `prenom text`
- `region text` (code from a fixed list, nullable)
- `fuseau_horaire text` (IANA, e.g. `Europe/Paris`, nullable until the app reports it)
- `publier_sous_prenom boolean not null default false`
- `role text` (see above)
- `suspendu_le timestamptz` (null = active)
- RLS: user selects and updates own row (never `role`, never `suspendu_le`; enforce with a trigger that rejects changes to those columns unless `auth.role() = 'service_role'`); admin selects all.

### configuration

Typed key/value edited by Rebecca, read by the app at startup.

- `cle text pk`
- `valeur jsonb not null`
- `type text not null check (type in ('nombre','texte','booleen','json'))`
- `description text not null` (French, for the admin UI)
- `modifie_par uuid references profils(id)`
- RLS: any authenticated user (including anonymous) selects; only admin updates; no client insert/delete (seeded by migration).
- Seed keys and defaults (all decided by me, all changeable by Rebecca):

| cle                          | type   | valeur   | description                                                       |
| ---------------------------- | ------ | -------- | ----------------------------------------------------------------- |
| points_par_defi              | nombre | 25       | Points gagnés pour un défi réussi                                 |
| points_par_vote              | nombre | 5        | Points gagnés pour un vote dans l'Arène                           |
| duree_diagnostic_min_s       | nombre | 60       | Durée minimale de la prise de diagnostic                          |
| duree_diagnostic_max_s       | nombre | 90       | Durée maximale de la prise de diagnostic                          |
| etapes_par_jour_gratuit      | nombre | 1        | Étapes validables par jour en formule Gratuit                     |
| etapes_par_jour_complet      | nombre | 0        | Étapes validables par jour en formule Complet (0 = sans limite)   |
| essais_max_etape_par_jour    | nombre | 3        | Essais sur une même étape par jour                                |
| duree_etape_min_s            | nombre | 20       | Durée minimale d'une prise de défi                                |
| heure_alerte_serie           | nombre | 20       | Heure locale de l'alerte quand la série est en danger             |
| mots_bequilles               | json   | liste v1 | Mots béquilles repérés par l'analyse (liste, minuscules)          |
| quota_face_a_face_complet    | nombre | 8        | Face-à-face par mois en formule Complet                           |
| plafond_annonces_par_mois    | nombre | 2        | Annonces de Rebecca envoyées par mois, maximum                    |
| purge_anonymes_heures        | nombre | 72       | Délai avant suppression des comptes anonymes sans compte          |
| expiration_file_locale_jours | nombre | 7        | Délai avant suppression d'une prise jamais envoyée                |
| balayage_audio_heures        | nombre | 6        | Âge à partir duquel un audio non public est supprimé par sécurité |
| recuperations_serie_par_mois | nombre | 1        | Récupérations de série par mois                                   |
| duree_duel_heures            | nombre | 48       | Délai pour répondre à un duel                                     |
| duree_sujet_arene_jours      | nombre | 7        | Durée d'un sujet dans l'Arène                                     |
| plafond_duree_duel_gratuit_s | nombre | 90       | Durée maximale d'une prise de duel (Gratuit)                      |
| plafond_duree_duel_complet_s | nombre | 180      | Durée maximale d'une prise de duel (Complet)                      |
| duree_face_a_face_gratuit_s  | nombre | 180      | Durée maximale d'un face-à-face (Gratuit)                         |
| duree_face_a_face_complet_s  | nombre | 480      | Durée maximale d'un face-à-face (Complet)                         |
| reprise_debat_minutes        | nombre | 30       | Fenêtre de reprise d'un débat interrompu                          |

### drapeaux

Feature flags. Shipped off.

- `cle text pk check (cle in ('arene','duels','face_a_face'))`
- `actif boolean not null default false`
- `modifie_par uuid references profils(id)`
- RLS: any authenticated user selects; only admin updates.

### tentatives

One recording sent for analysis. The id is generated on the phone before upload so retries are idempotent. Only server-side states exist here; phone-only states (enregistrement, en attente réseau, annulée, expirée) live in the phone's local queue.

- `id uuid pk` (client-generated)
- `utilisateur_id uuid not null references profils(id) on delete cascade`
- `type text not null check (type in ('diagnostic','etape','arene','duel'))`
- `etape_id uuid` (Phase 4, nullable now)
- `enregistre_le timestamptz not null` (when the person spoke)
- `fuseau_horaire text not null` (IANA)
- `decalage_minutes integer not null` (UTC offset at recording time)
- `duree_s numeric(6,2)`
- `chemin_audio text` (object path in bucket `audio-tentatives`: `{utilisateur_id}/{id}.m4a`; null once deleted)
- `statut text not null check (statut in ('envoyee','en_transcription','en_mesure','en_evaluation','audio_supprime','retour_disponible','echec_technique','abandon_technique'))`
- `resultat text check (resultat in ('etape_validee','etape_echouee'))` (set with `retour_disponible` for type `etape`)
- `essais_techniques integer not null default 0`
- `derniere_erreur text`
- `audio_supprime_le timestamptz`
- Constraints: `enregistre_le <= now() + interval '5 minutes'` and `enregistre_le >= now() - interval '8 days'` checked on insert.
- RLS: user selects own; user inserts own with `statut = 'envoyee'` only, `utilisateur_id = auth.uid()`; anonymous users may only insert `type = 'diagnostic'`; no client update or delete.
- Trigger `after insert`: insert a job `analyser_tentative` with `charge = {"tentative_id": id}` and `cle_idempotence = 'analyser:' || id`.

### analyses

Measures and transcript, the only thing kept from the voice.

- `tentative_id uuid pk references tentatives(id) on delete cascade`
- `version_schema integer not null default 1`
- `mesures jsonb not null` (shape below)
- `transcription jsonb not null` (`{ "texte": string, "mots": [{ "mot": string, "debut_s": number, "fin_s": number, "confiance": number }] }`)
- `fournisseur_transcription text not null` (`'stub'` until the bench decides)
- RLS: user selects own (join on tentatives); service role writes.

### grilles and criteres_grille

Rebecca's grid, versioned. Empty until she provides it. A dev fixture exists only in tests.

- `grilles`: `id uuid pk`, `version integer not null unique`, `publiee_le timestamptz` (null = draft), `notes text`, `cree_par uuid references profils(id)`.
- `criteres_grille`: `id uuid pk`, `grille_id uuid not null references grilles(id) on delete cascade`, `cle text not null`, `nom text not null`, `definition text not null` (what it means, in French), `regle jsonb not null` (declarative rule, see below), `ordre integer not null`, `unique (grille_id, cle)`.
- **La note se fabrique de deux mains** (chapter 5, rewritten after the meeting of 12 September 2026). `criteres_grille.source` is `mesure` or `jugement`: four axes are computed from what the machine hears (débit, mots béquilles, silences, énergie de la voix), two are judged by the model against Rebecca's reference (structure du propos, conviction). A judged axis carries no bands and cannot be published without `exemple_cinq` and `exemple_deux`: `publier_grille()` refuses the grid and names the axes that are missing them, because without those two worked examples the model scores against its own idea of a good speaker and the same take drifts from one week to the next.
- The balance between the halves is `poids_mesure` (0,65) and `poids_jugement` (0,35) in `configuration`, out of `note_max_prestation` (30), with `seuil_reussite_defaut` (18). It is a setting and not an accident of how many axes sit in each group: adding a fifth measured axis must not quietly move it. When one half has no axis at all the other carries the whole note, so a note out of thirty never silently becomes a note out of twenty and fails every threshold for a reason nobody can see.
- `evaluations.note_mesure` and `note_jugement` keep the two halves, between 0 and 1, so a note can be read rather than taken on faith. `evaluations.hors_grille` keeps what the model noticed and no criterion covers: it never enters the note, it always reaches the person, and it is how the grid grows from what the application actually hears rather than staying frozen on its first version.
- RLS: any non-anonymous authenticated user selects published grids; admin selects and writes all.
- `regle` shape v1: `{ "version": 1, "score_max": 10, "elements": [ { "mesure": "<dotted path into mesures>", "bandes": [ { "min": number|null, "max": number|null, "score": number } ], "poids": number } ] }`. Score = weighted sum of band scores, normalised to `score_max`. Rebecca may express pure bands (one element, weight 1) or weighted sums.

### evaluations

Sub-scores and feedback fields, computed from `analyses` with the grid version active at that time. Never rescored.

- `tentative_id uuid pk references tentatives(id) on delete cascade`
- `grille_id uuid references grilles(id)` (null while no grid exists)
- `version_grille integer`
- `sous_notes jsonb not null default '{}'` (`{ "<cle critere>": { "score": number, "max": number } }`)
- `note_totale numeric(5,2)` (sum of sous_notes; null while no grid)
- `seuil_reussite numeric(5,2)` (copied from the step at evaluation time)
- `points_forts jsonb not null default '[]'` (`[{ "critere": string, "mesure": string, "valeur": number }]`, may be empty)
- `axes_travail jsonb not null default '[]'` (same shape)
- `exercice_court jsonb` (`{ "duree_s": number, "consigne": string }`)
- `redaction jsonb` (French wording generated from the fields: `{ "accroche": string, "levier": { "titre": string, "explication": string }, "note_mesures": string, "modele": string, "genere_le": timestamptz }`; regenerable, never read by logic)
- RLS: user selects own; service role writes.

### jobs

The work queue. pg_cron only inserts jobs; the worker executes them.

- `id bigint generated always as identity pk`
- `type text not null` (Phase 0 types: `analyser_tentative`, `supprimer_compte`, `balayer_audio`, `purger_anonymes`)
- `charge jsonb not null default '{}'`
- `statut text not null default 'en_attente' check (statut in ('en_attente','en_cours','termine','echoue'))`
- `essais integer not null default 0`
- `essais_max integer not null default 5`
- `disponible_a timestamptz not null default now()`
- `verrouille_a timestamptz`, `verrouille_par text`
- `erreur text`
- `cle_idempotence text unique`
- `termine_le timestamptz`
- Functions (security definer, executable by service role only, revoked from anon/authenticated):
  - `reclamer_job(p_worker text, p_types text[]) returns setof jobs`: one row, `FOR UPDATE SKIP LOCKED`, `statut = 'en_attente' and disponible_a <= now()`, sets `en_cours`, `verrouille_a = now()`, `verrouille_par`, `essais = essais + 1`.
  - `terminer_job(p_id bigint)`: `statut = 'termine'`, `termine_le = now()`.
  - `echouer_job(p_id bigint, p_erreur text)`: if `essais >= essais_max` then `statut = 'echoue'` else `statut = 'en_attente'`, `disponible_a = now() + (interval '30 seconds' * power(2, essais))`.
  - `liberer_jobs_bloques(p_timeout interval)`: any `en_cours` older than the timeout goes back to `en_attente`.
- RLS: no client access at all (admin reads through a view `jobs_admin` later).

### Storage

- Bucket `audio-tentatives` (private). Policy: authenticated users insert only at `{auth.uid()}/{uuid}.m4a`; no client select, update or delete; service role does everything. The worker deletes the object after `evaluations` is committed and sets `tentatives.statut = 'audio_supprime'` then `retour_disponible`.
- Bucket `audio-public` (private, served by signed URL). Phase 7 (Arena and duels), with `date_suppression` on the owning row.

### Scheduled jobs (pg_cron, Phase 0 definitions)

- every 30 min: insert job `balayer_audio` (idempotence key `balayer:` || date_trunc('hour', now())).
- every hour: insert job `purger_anonymes`.
- every 5 min: `select liberer_jobs_bloques(interval '15 minutes')`.

## Measures shape (`analyses.mesures`, version 1)

All numbers are computed deterministically by `packages/moteur` from PCM plus the timed transcript. Nulls are allowed when a measure cannot be computed (for example pitch on a silent take).

```json
{
  "version": 1,
  "duree_totale_s": 82.4,
  "duree_parole_s": 71.9,
  "temps_avant_demarrage_s": 1.8,
  "debit": {
    "mots_par_minute": 142,
    "stabilite": 0.12,
    "fenetres": [{ "debut_s": 0, "fin_s": 10, "mots_par_minute": 138 }]
  },
  "mots_bequilles": {
    "total": 4,
    "par_minute": 3.3,
    "par_type": { "du coup": 3, "euh": 1 },
    "occurrences": [{ "mot": "du coup", "debut_s": 12.4 }]
  },
  "silences": {
    "total": 6,
    "tenus": 2,
    "duree_moyenne_s": 0.9,
    "duree_max_s": 1.6,
    "positions": [{ "debut_s": 20.1, "duree_s": 1.2, "place": "fin_de_phrase" }]
  },
  "souffle": {
    "segments_sans_pause": [{ "debut_s": 0, "fin_s": 14.2, "mots": 31 }],
    "longueur_max_s": 14.2
  },
  "volume": {
    "moyen_db": -22.1,
    "ecart_type_db": 4.3,
    "chutes_fin_phrase": 3,
    "ratio_chutes": 0.4
  },
  "hauteur": {
    "f0_median_hz": 118,
    "f0_ecart_type_demi_tons": 2.1,
    "plage_demi_tons": 9.5,
    "ratio_voise": 0.71
  },
  "repetitions": {
    "total": 2,
    "reprises": 1,
    "occurrences": [{ "texte": "je je", "debut_s": 33.0 }]
  },
  "phrases": {
    "nombre": 11,
    "longueur_moyenne_mots": 15.2,
    "longueur_max_mots": 31
  }
}
```

`stabilite` is the coefficient of variation of `mots_par_minute` across 10 s windows. `silences.tenus` counts pauses of at least 1.0 s. `place` is `debut`, `fin_de_phrase` or `milieu_de_phrase`, decided from transcript punctuation and pause length. `volume.chutes_fin_phrase` counts sentence endings where the last 400 ms are at least 6 dB below the sentence mean. Filler word list v1 (French): `euh`, `du coup`, `en fait`, `genre`, `voilà`, `donc`, `bah`, `ben`, `hein`, `tu vois`, `en gros`, `enfin`; Rebecca edits it in Phase 6.

## Phase 1 additions (migration `0002_socle_phase1`)

### reponses_accueil

The three onboarding answers (cahier chapter 3: context, what to improve first, what blocks the most; answered by touch, never typed). One row per user, anonymous users included since the diagnostic needs it. Codes are fixed here; the French labels live in `@leq/domaine` and in the app's `fr.ts` (Rebecca may reword labels in Phase 6, never codes).

- `utilisateur_id uuid pk references profils(id) on delete cascade`
- `contexte text not null check (contexte in ('travail','etudes','public','quotidien'))`
- `blocage text not null check (blocage in ('trac','mots','regard','notes'))`
- `objectif text not null check (objectif in ('stress','clarte','rythme','presence'))`
- RLS: user selects, inserts and updates own row; admin selects all; no client delete (cascade only).

Question order in the app follows the mockup: contexte (1 of 3), blocage (2 of 3), objectif (3 of 3). The optional region question of chapter 3 is asked later, in settings, when announcements exist (Phase 6).

### jetons_push

Expo push tokens, one row per device. Used for the transactional "Ton retour est prêt" notification (always on: it answers the person's own action) and, from Phase 5, for the four categories of chapter 12.

- `id uuid pk`
- `utilisateur_id uuid not null references profils(id) on delete cascade`
- `jeton text not null unique` (an `ExponentPushToken[...]`)
- `plateforme text not null check (plateforme in ('ios','android'))`
- `derniere_erreur text`
- `desactive_le timestamptz` (set by the worker when Expo answers `DeviceNotRegistered`; the row is kept so a re-registration reactivates it)
- Index on `utilisateur_id`.
- RLS: user selects, inserts, updates and deletes own rows (upsert on `jeton`); service role writes `desactive_le`.

### profils, added columns

- `notif_rappel boolean not null default true`, `notif_serie boolean not null default true`, `notif_social boolean not null default true`, `notif_annonces boolean not null default true`: the four independent switches of chapter 12, stored now, used from Phase 5.
- `heure_rappel time not null default '21:30'`: the daily reminder time the person chooses (local notification, timezone from the phone).
- `suppression_demandee_le timestamptz`: set by the RPC below; protected like `role` (only a privileged connection may change it).

### demander_suppression_compte()

`security definer`, executable by `authenticated` (anonymous included). For `auth.uid()`: sets `profils.suppression_demandee_le = now()` and inserts a `supprimer_compte` job with `cle_idempotence = 'supprimer:' || uid` (`on conflict do nothing`). The worker then removes the storage objects and the auth user (cascade removes every row). The phone signs out and wipes its queue and caches right after the call.

### Realtime

`tentatives` is added to the `supabase_realtime` publication so the phone can follow its own rows (RLS applies): the feedback screen refreshes itself when `statut` reaches `retour_disponible`. Polling every 15 s is the fallback.

### Push message

Sent by the worker right after `retour_disponible`, to every active token of the user: title "Ton retour est prêt", body "Ta prise a été analysée. Ouvre LEQ pour lire ce que Bulle a entendu.", data `{ "tentative_id": "<uuid>" }`. One attempt, errors logged on the token row, never retried in a loop.

### demandes_export (migration `0003_demandes_export`)

Screen G3 "Recevoir une copie de mes données" files a request; Rebecca answers by hand while volume is low (chapter 2). The Phase 6 admin inbox lists open requests.

- `id uuid pk`, `utilisateur_id uuid not null references profils(id) on delete cascade`, `email text` (the address at the time of the request), `traitee_le timestamptz`, `traitee_par uuid references profils(id)`.
- RLS: a non-anonymous user inserts for themselves and reads their own; admin reads and updates all.

## Phase 4 additions (migration `0004_parcours`)

The path (cahier chapter 4): acts and steps, three challenge formats, per-step thresholds, the daily rhythm by offer, remediation after two failures. The generator is not part of this migration; a static path built from the banks stands in until its rules exist.

### modeles_actes

The acts of the path, in order. Seeded from the mockup, editable by Rebecca.

- `ordre integer pk`, `titre text not null`, `sous_titre text` (the "contrée" name shown on the map), `cree_le`, `modifie_le`.
- RLS: authenticated read; admin write.

### defis

The challenge bank. Every step of a path points at one défi.

- `id uuid pk`, `cle text not null unique` (slug), `ordre_acte integer not null references modeles_actes(ordre)`, `ordre integer not null` (position in the act; `unique (ordre_acte, ordre)`)
- `format text not null check (format in ('standard','texte','long'))`
- `titre text not null` (short, on the card), `consigne text not null` (Rebecca's words, quoted as such), `focus text` ("tes silences": what the feedback looks at), `plan jsonb not null default '[]'` (the three supports of a brief, `[{ "titre": string, "detail": string }]`)
- `texte_a_lire text`, `duree_lecture_s integer` (format texte), `duree_preparation_s integer` (format long)
- `duree_max_s integer not null`, `points integer not null`, `competence text not null` (the skill code the step introduces), `seuil_reussite numeric(5,2) not null` (the score of the grid that validates the step; rises along the path)
- `provisoire boolean not null default true` (content from the mockup, awaiting Rebecca; the admin turns it off), `actif boolean not null default true`
- RLS: authenticated read where `actif`; admin read and write everything.

### exercices

Remediation bank (screen X5): a shorter exercise proposed after two failures on a step, matched by `competence`.

- `id uuid pk`, `cle text not null unique`, `titre text not null`, `consigne text not null`, `duree_s integer not null`, `competence text not null`, `provisoire boolean not null default true`, `actif boolean not null default true`.
- RLS: authenticated read where `actif`; admin write.

### parcours, actes, etapes

One path per person, built once (`obtenir_parcours()`), never rewritten behind the person's back.

- `parcours`: `id uuid pk`, `utilisateur_id uuid not null unique references profils(id) on delete cascade`, `source text not null check (source in ('statique','genere'))`, `version_regles text`, `genere_le timestamptz not null default now()`.
- `actes`: `id uuid pk`, `parcours_id uuid not null references parcours(id) on delete cascade`, `ordre integer not null`, `titre text not null`, `sous_titre text`, `statut text not null check (statut in ('a_venir','en_cours','traverse'))`, `traverse_le timestamptz`, `unique (parcours_id, ordre)`.
- `etapes`: `id uuid pk`, `parcours_id uuid not null references parcours(id) on delete cascade`, `acte_id uuid not null references actes(id) on delete cascade`, `ordre_global integer not null`, `ordre integer not null`, `defi_id uuid not null references defis(id)`, `seuil_reussite numeric(5,2) not null` (copied from the défi at creation, so a later edit of the bank does not move a person's threshold), `statut text not null check (statut in ('verrouillee','disponible','validee'))`, `nombre_echecs integer not null default 0`, `rattrapage_propose boolean not null default false`, `validee_le timestamptz`, `tentative_validante_id uuid references tentatives(id)`, `unique (parcours_id, ordre_global)`.
- `tentatives.etape_id` now references `etapes(id)`; a step attempt is `type = 'etape'` with its `etape_id`. Anonymous users may create a path and step attempts too (the mockup's "Plus tard" leads to the daily challenge); the purge removes everything.
- RLS: the person reads own rows; no client write on any of the three (functions only).

### abonnements

The offer a person is on. Absence of a row means Gratuit. RevenueCat writes it in a later slice.

- `utilisateur_id uuid pk references profils(id) on delete cascade`, `formule text not null check (formule in ('gratuit','complet'))`, `source text not null check (source in ('manuel','revenuecat'))`, `actif_jusqu_a timestamptz`, `cree_le`, `modifie_le`.
- `formule_de(uid) returns text`: `complet` when a row says so and `actif_jusqu_a` is null or in the future, else `gratuit`.
- RLS: the person reads own row; service role writes.

### Functions

- `obtenir_parcours() returns uuid` (security definer, authenticated): returns the caller's path id, building it on first call from `modeles_actes` and the active `defis` in order: the first act `en_cours`, its first step `disponible`, everything else locked or `a_venir`. An act with no défi is `a_venir` with no step.
- `etape_du_jour() returns table(...)` (security definer, authenticated): the caller's first `disponible` step joined with its défi and act, plus the rhythm: `etapes_validees_aujourdhui`, `essais_aujourdhui` (step attempts recorded today in the person's timezone, `profils.fuseau_horaire`, default `Europe/Paris`), `limite_etapes` and `limite_essais` (configuration `etapes_par_jour_gratuit` or `etapes_par_jour_complet`, `essais_max_etape_par_jour`; 0 means no limit), `peut_enregistrer`, `raison` in (`ok`, `limite_jour`, `limite_essais`, `aucune_etape`, `parcours_termine`).
- `appliquer_resultat(p_tentative_id uuid) returns text` (security definer, service role only): for a `type = 'etape'` attempt with an evaluation whose `note_totale` is not null: at or above the step's `seuil_reussite` the step becomes `validee` (with `validee_le`, `tentative_validante_id`), the next step `disponible`, the act `traverse` when it was its last step and the next act `en_cours`; below, `nombre_echecs + 1` and `rattrapage_propose = true` from the second failure. Writes `tentatives.resultat`. Returns `null` only when nothing applies (not a step, already validated).

  **A take nothing could score is `non_evaluee`, never silence.** It used to return `null` and write nothing when the evaluation had no total, so the step stayed available for ever: on a project where no grid is published, which is every project until Rebecca's exists, a person recorded their challenge of the day and the path did not move. It is not counted as a failure either, since nothing was measured against anything. What such a take does to the step is her call (chapter 4), so it is the setting `validation_sans_grille`, **off by default**: on, recording the challenge validates the step, which is what lets the path be walked before the grid exists. `activer-essai.mjs` turns it on with the other walkthrough values and `--eteindre` puts it back. History is never rescored, so a take already written `non_evaluee` stays that way once a grid arrives; the next take is scored.
- `echanger_ordre_defis(p_a uuid, p_b uuid)` (security definer, admin only, migration `0005_echanger_ordre_defis`): swaps the `ordre` of two défis of the same act atomically. `defis (ordre_acte, ordre)` is unique and PostgreSQL checks uniqueness row by row, so a single UPDATE cannot swap; the function parks one row on a negative order first. Used by the admin's arrows.

## Phase 4 corrections (migrations `0005_correctifs_parcours`, `0007_grilles_anonymes`)

Found by the review of the Phase 4 code against the schema, on 2026-09-06.

- `tentatives_insert_propre` accepts `type in ('diagnostic', 'etape')` from an anonymous person: the path is open before the account (ADR-004 only closes the Arena, duels, shop and debate).
- `defis_select` also returns a défi referenced by one of the caller's own steps, so a défi Rebecca deactivates keeps its title on the map of the people whose path already holds it.
- `grilles_select` and `criteres_grille_select` no longer exclude anonymous people from a published grid: its criteria are Rebecca's public wording, shown on the feedback of a step.
- `etapes.ordre` is a dense rank inside the act (1..n) assigned by `obtenir_parcours`, not the bank position; `defis.ordre` has `check (ordre > 0)`; `echanger_ordre_defis` parks a row on the first free order of the act instead of a negative one.

## Phase 5 additions (migration `0006_serie_points`)

The streak, the points and the shop (cahier chapters 6 and 7), as ledgers, never as counters (ADR-009). Nothing here stores a total: the balance is a sum, the streak is a replay.

### mouvements_points

- `id uuid pk`, `utilisateur_id uuid fk profils on delete cascade`, `montant integer not null <> 0`, `motif text in (defi_valide, vote, echange, remboursement, ajustement)`, `reference text`, `cree_le`; `unique (motif, reference)` makes every credit idempotent (the attempt id for a défi, the exchange id for a spend or a refund).
- Written only by security definer functions (`appliquer_resultat` credits `defis.points` on validation; `echanger_recompense` debits; `traiter_echange` refunds). RLS: own rows or admin, read only.

### recuperations_serie

- `id`, `utilisateur_id`, `jour_couvert date`, `cree_le`; `unique (utilisateur_id, jour_couvert)`.
- One row per recovery the person activated (G3 "Protéger ma série"). RLS: own rows or admin, read only.

### recompenses

- `id`, `cle unique`, `ordre`, `type in (contenu, reduction, atelier, distinction)`, `titre`, `sous_titre`, `description`, `cout_points integer > 0 nullable`, `plafond_par_mois integer > 0 nullable` (the quantity cap of chapter 7 for what costs Rebecca real money), `echangeable boolean` (false for a distinction such as the hour with Rebecca), `provisoire`, `actif`, timestamps. Check: an exchangeable reward has a cost.
- Seeded from the mockup (D2), all `provisoire`. RLS: authenticated read active rows, admin everything.

### echanges_recompenses

- `id`, `utilisateur_id`, `recompense_id`, `cout_points` (snapshot), `statut in (a_traiter, honore, annule)`, `note`, `cree_le`, `traite_le`.
- Created only by `echanger_recompense()`; Rebecca honours or cancels in the admin. RLS: own rows or admin, read only.

### Functions

- `jour_local(timestamptz, text) returns date`: the calendar day in the given IANA zone, Europe/Paris when the zone is missing or invalid. `fuseau_de(uuid)`: the person's zone, Europe/Paris by default.
- `calculer_serie(uid, aujourdhui) returns jsonb` (internal) and `ma_serie()` (authenticated): replays the distinct local days with a `tentatives` row (any state: recording is what counts, chapter 6) plus the covered days. Answers `courante` (the run ending on the last active day, alive while that day is today or yesterday), `record` (longest run ever), `semaines_gagnees` (`courante / 7`), `derniere_journee`, `validee_aujourdhui`, `semaine` (seven `{jour, actif}` ending today), `recuperation {par_mois, utilisees_ce_mois, restantes, jour_reparable, jour_a_couvrir}`. `jour_reparable` is yesterday when yesterday has no take and the day before has one, whether or not the person already recorded today (one recovery repairs exactly one missed day; after it the replay yields one continuous run); `jour_a_couvrir` is the same day when a recovery is left this month, else null. `fuseau_de()` falls back to the zone of the person's most recent take, then Europe/Paris (migration `0009_correctifs_phase5`); `appliquer_resultat` returns the stored result when the attempt already has one, so a replayed pipeline never counts a second failure; re-opening a cancelled exchange writes a compensating `ajustement` movement under the person's points lock instead of deleting the refund.
- `activer_recuperation(uid, aujourdhui)` (internal) and `activer_recuperation_serie()` (authenticated): inserts the covered day, or raises `P0001` with message `quota_epuise` or `rien_a_couvrir`.
- `solde_points(uid)`, `points_de(uid)` (internal) and `mes_points()` (authenticated): `{solde, cumul, cette_semaine, formule}`.
- `mes_recompenses()` (authenticated): `{points, recompenses[...] with restantes_ce_mois and mes_echanges, echanges[...]}`. The shop's month is Europe/Paris (Rebecca's).
- `echanger_recompense(recompense uuid) returns uuid` (authenticated, not anonymous): under an advisory lock per person and per capped reward, checks active, exchangeable, balance, cap; inserts the exchange and the debit in one transaction. Raises `P0001` with `points_insuffisants`, `plafond_atteint`, `recompense_indisponible`, `recompense_non_echangeable`; `42501` with `compte_requis` for an anonymous person.
- `traiter_echange(echange uuid, statut text, note text)` (admin): `honore` or `annule`; cancelling refunds through a `remboursement` movement keyed by the exchange id.
- `resume_progres_de(uid, aujourdhui)` (internal) and `resume_progres()` (authenticated): `{serie, points, mois {prises, duree_parole_s, defis_releves}, premiere, derniere, bequilles_semaines[]}` for D1 and D1b. `premiere` and `derniere` are the first and last analysed takes (`debit`, `bequilles_par_minute`, `silences_tenus`); `bequilles_semaines` sums `mots_bequilles.par_type` per ISO week over the last six weeks.

## Phase 6 additions (migration `0008_admin_phase6`)

Rebecca's space, completed (cahier chapters 8 and 12): workshops and announcements, suspension. The cap and the region filter of announcements live in the database, not in the admin's interface (plan, decision 11).

### ateliers

- `id`, `titre`, `sous_titre`, `description`, `lieu text not null` (the city, or "En ligne"), `en_ligne boolean` (concerns everyone, whatever the region), `region text` (a code of the fixed list, null when online), `date_debut timestamptz`, `places integer > 0 nullable`, `lien text` (booking outside the app), `recompense_id fk recompenses on delete set null` (the reward that gives a place), `publie boolean`, `cree_par`, timestamps.
- RLS: authenticated read published rows, admin everything.

### annonces

- `id`, `titre`, `corps`, `atelier_id fk ateliers nullable`, `regions text[]` (null = everyone), `envoyee_le`, `destinataires`, `envoyes`, `echecs` (written back by the worker), `cree_par`, `cree_le`.
- Created only by `publier_annonce()`; RLS: authenticated read (B1b lists them), nobody inserts directly.

### suspensions

- `id`, `utilisateur_id`, `motif text not null`, `cree_par`, `cree_le`, `levee_le`, `levee_par`. Append-only log; RLS: own rows or admin.

### Functions

- `est_suspendu()` (authenticated): whether the caller's profile carries `suspendu_le`.
- `suspendre_compte(uid, motif)` and `reactiver_compte(uid)` (admin): set or clear `profils.suspendu_le` (the protection trigger lets the security definer through) and write the log. An admin account is never suspended here; a reason is required.
- A suspended person can no longer insert attempts (`tentatives_insert_propre`) nor exchange points (`echanger_recompense` raises `42501 compte_suspendu`). Reading stays open so the phone can show one screen saying so.
- `annonces_du_mois()` (authenticated): announcements sent this month (Europe/Paris).
- `publier_annonce(titre, corps, atelier uuid, regions text[]) returns uuid` (admin): under an advisory lock, refuses with `P0001 plafond_annonces_atteint` when the month's count reaches `plafond_annonces_par_mois`; an empty region list means everyone; inserts the announcement and queues one `envoyer_annonce` job (`cle_idempotence 'annonce:' || id`).
- Job `envoyer_annonce` `{annonce_id}` (worker): one push per active token of the people who keep `notif_annonces` on, whose `profils.region` is in the list (every region when the list is null), not suspended; tokens marked as for the feedback push; `destinataires`, `envoyes` and `echecs` written back. The notification's title and body are Rebecca's words; its data carries `annonce_id`, which opens B1b.

### configuration, added key

- `mots_bequilles` (json, the v1 list): the filler words the analysis looks for. The worker reads it at each analysis and falls back to the contract's list when the value is missing or invalid.

### Scheduled jobs added in Phase 7

- `leq_roter_sujet_arene` (`5 * * * *`): inserts `roter_sujet_arene`; the function itself does nothing before the week is over.
- `leq_fermer_duels` (`*/15 * * * *`): inserts `fermer_duels`; the worker closes a duel once both have spoken and expires it at the deadline.
- `leq_supprimer_audio_public` (`*/30 * * * *`): inserts `supprimer_audio_public`; the worker deletes the objects of `prises_publiques` whose `date_suppression` has passed and stamps `audio_supprime_le`.
- Job `envoyer_resultat_arene` `{sujet_id}` (worker): queued by the rotation handler when a week closes, never by pg_cron. One push per active token of the people who published a take on that week, keep `notif_social` on and are not suspended. Claimed with `reserver_resultat_arene()` before the first push leaves. Its data carries `sujet_id`, which opens that week's podium (C8).

## Phase 8 additions (migrations `0015_face_a_face`, `0016_correctifs_face_a_face`)

The debate against Rétor, cahier chapter 10, shipped off behind the `face_a_face` flag. Four rules of that chapter live here and not in the interface.

### theses

- `id`, `cle unique`, `texte`, `ton_suggere` (ferme, provocateur, academique, bienveillant), `ordre unique`, `actif`, `provisoire`, timestamps.
- The bank prepared in advance and fed from Rebecca's space. Offered first, because most people asked to invent a debate subject freeze or pick something they cannot defend, and the session is lost before it starts. RLS: authenticated read the active ones, admin writes.
- `theses_proposees(n)` answers the first `n` active theses, in order.

### debats

- `id`, `utilisateur_id`, `these_id` (nullable), `these_texte`, `origine_these` (banque, personnelle), `ton_adversaire`, `duree_max_s`, `statut` (ouverte, terminee, interrompue, abandonnee), `issue` (terminee, interrompue_par_nous, abandonnee), `secondes_parlees numeric`, `session_id` (the connection holding it), `commence_le`, `derniere_activite_le`, `termine_le`, timestamps.
- **This table is the quota ledger** (ADR-009): one row per session carrying its own outcome, and the month is counted by replaying them. `quota_debats()` counts the sessions of the current month, in the person's own zone, whose `issue` is set and is not `interrompue_par_nous`. A session we cut ourselves keeps its row and costs nothing, because charging a quota for our own outage is the shortest road to refund requests.
- `these_texte` is copied into the session, so editing the bank never rewrites a past debate.
- RLS: the owner reads their own sessions and nothing else. **The admin does not read a debate either**: it is practice, not public speech. No client policy writes a session or a turn at all; everything goes through the functions.
- `ouvrir_debat(these_id, these_texte, ton)`: checks the flag, an account, no suspension, the thesis, then refuses with `debat_en_cours` when a session is open and still fresh, then the quota. It never silently answers a session nobody asked for.
- `debat_a_reprendre()` answers the open session inside the `reprise_debat_minutes` window (E3b). `abandonner_debat()` closes it when the person chooses to start another.
- `cloturer_debat(debat, issue, session)` is service role only: the server decides whether a cut was ours. A connection that no longer holds the debate closes nothing.
- **One debate, one connection.** `prendre_session_debat(debat)` claims an open session and answers the identifier its writes must carry; the newest connection wins. Two sockets could hold the same debate (a phone reconnecting before the old socket was collected, or the app open twice), both wrote turn n+1, and the upsert let the loser replace the live turn while its close ended a session someone was still speaking into.
- **A cut is free only while it can still be resumed.** `fermer_debats_interrompus()` runs every ten minutes on pg_cron: past the `reprise_debat_minutes` window, a session nobody came back to becomes `abandonnee` and counts, unless nothing was ever said in it. Without it, killing the app instead of pressing « Terminer » gave a whole face-à-face for free.

### tours_debat

- `id`, `debat_id`, `numero`, `locuteur` (utilisateur, retor), `texte`, `duree_s`, `cree_le`, unique `(debat_id, numero)`.
- Written turn by turn as the debate happens, which is what makes a resume possible: a machine that dies mid-debate loses the connection, not the debate. **Text only, never audio**, so chapter 2 holds whole: the debrief reads the written transcript and nothing of the voice is ever stored.
- `enregistrer_tour(debat, numero, locuteur, texte, duree_s, session)` is service role only and idempotent by `(debat, numero)`: a turn rewritten by a retry replaces itself and adds only the difference in duration to `secondes_parlees`. Adding it twice would charge the person for our own retry. It raises `session_perdue` (55006) when the caller no longer holds the debate.
- `transcription_debat(debat)` answers the turns in order, to the owner or to the server.

### Configuration keys used

`quota_face_a_face_gratuit` (0: the face-à-face is a Complet entitlement, and the zero is a setting rather than a locked door), `quota_face_a_face_complet` (8), `duree_face_a_face_gratuit_s` (180), `duree_face_a_face_complet_s` (480), `reprise_debat_minutes` (30, which is also the delay after which an unresumed cut is counted).

## Phase 7 additions (migration `0010_arene`)

The Arena and duels of cahier chapter 11, shipped off: nothing is visible in the app until the `arene` and `duels` flags are on. The rules live here, not in the interface.

### sujets_arene

- `id`, `cle unique`, `texte`, `consigne`, `ordre unique`, `duree_max_s`, `actif_le`, `ferme_le`, `provisoire`, `actif`, `resultat_notifie_le`, timestamps.
- One subject at a time for seven days, derived from the dates: `sujet_arene_actif()` returns the row whose `actif_le` has passed and whose `ferme_le` has not. RLS: authenticated read every subject that has been activated once (a closed week included, because its podium needs its wording), admin everything.
- `roter_sujet_arene()` answers `{ferme, actif}`: the week it just closed and the one now running, each null when there is none. The worker needs `ferme` to queue the podium notification.
- `resultat_notifie_le` is stamped by `reserver_resultat_arene(sujet)`, which answers true exactly once: a job retried after a crash mid-send never notifies the same week twice.
- `dernier_sujet_arene_clos()` answers the week that closed most recently, for the "voir le podium" entry of the Arena tab.

### prises_publiques

- `id`, `utilisateur_id`, `tentative_id unique`, `contexte` (arena or duel, checked against `sujet_id` and `duel_id`), `chemin_audio`, `statut` (en_moderation, publiee, retiree), `motif_retrait`, `votes_recus`, `date_suppression`, `audio_supprime_le`, timestamps. One take per person per duel.
- Created only by `publier_prise()`: the deliberate gesture of chapter 11, on an attempt of type `arene` or `duel` that is already analysed, never by an anonymous or suspended account.
- `chemin_audio` here is `tentatives.chemin_audio_public`, the copy the worker keeps for the length of the contest: the private object is deleted as soon as the evaluation is committed (chapter 2), so it is null by the time anyone publishes. A take whose copy never arrived is refused with `analyse_incomplete` rather than published mute, because a silent card costs its owner the week: nobody votes for a voice they cannot hear.
- RLS: own takes always; a published take of the active subject only once the caller has spoken on it (`a_parle_sur()`); a duel take only to the two participants and only once the duel is closed; the admin sees everything, including what waits for moderation.

### impressions, votes

- `impressions (votant_id, prise_id)` records what a voter has been shown, so `paire_a_voter()` can balance the sampling.
- `votes (votant_id, sujet_id, gagnante_id, perdante_id, paire)` with `unique (votant_id, paire)`: a pair is voted once. `paire` is the two identifiers sorted (`cle_paire()`).
- `paire_a_voter()` answers `parle_d_abord` until the caller has spoken, never their own takes, the least shown first, and records the two impressions. `voter()` refuses a vote on one's own take, a pair already voted and a pair from two subjects; it credits `points_par_vote` through the ledger, keyed by the vote id.
- **Six est une limite d'écoute, pas une limite de parole** (meeting of 12 September 2026). Anyone records on the week's subject: Rebecca's own words were « il ne faut pas qu'il y ait de la hiérarchie, liberté pour tous ». What she was solving was the listening, after imagining herself sitting through twelve takes on one question. So `paire_a_voter()` answers `assez_ecoute` once `prises_ecoutees_par_jour` (6) distinct takes have been offered to that person today, in their own zone. The ranking keeps counting votes and the pairs are still drawn from the whole pool, so a late take is heard as much as an early one.
- RLS: a person reads their own votes and impressions, nobody reads who voted for whom.

### duels

- `id`, `inviteur_id`, `invite_id`, `sujet`, `jeton unique` (32 hexadecimal characters, the invitation link of `apps/web`), `duree_max_s` (the cap of the caller's formula), `statut` (ouvert, clos, expire), `verdict` (inviteur, invite, egalite), `echeance`, `clos_le`, timestamps. `tentatives.duel_id` links an attempt to its duel.
- `invite_prenom`, `invite_email`: who answered by the link. `rejoindre_duel(jeton, prenom, email)` requires both from an anonymous caller and writes the first name to their profile, so the duel names them. Without it the inviter was told they had been answered by an account with no name, and nobody could reach whoever had spoken. A signed-in invitee passes neither: they already have a profile.
- `creer_duel(sujet)`, `lire_duel_par_jeton(jeton)` (readable by an anonymous principal: the invitee may not have the app, and never hears the inviter before recording), `rejoindre_duel(jeton)`.
- `cloturer_duel()` (service role): **who answered is a question about their take, never about its score.** With two published takes the higher grid total wins; when both are there and the analysis cannot separate them (no grid published, or an evaluation that never landed) the verdict is `sans_verdict`; with one take only, and past the deadline, the duel expires. Either way both takes are marked for deletion. The verdict is rendered by the analysis and the app says so.
- Reading the grid total to decide presence meant that two people who had each spoken and each spent a take were told at the deadline that nobody had answered, which is what happens on a project where no grid is published yet. `sans_verdict` exists so that the app can say what really happened instead of inventing a winner or blaming a silence that was not there.

### moderations

- `id`, `prise_id`, `decision` (publiee, retiree), `motif`, `decide_par`, `cree_le`. Written by `moderer_prise()` (admin), which also marks a withdrawn take for deletion.

### roter_sujet_arene()

- Service role, called by the weekly job: closes the current subject once its `duree_sujet_arene_jours` are past, marks every take of that week for deletion (the ranking rows stay, chapter 2), and activates the next subject of the bank by `ordre`. An empty bank is a handled state: nothing is activated.

## Later phases (names reserved)

`debats`, `tours_debat`, `sessions_debat`, `theses`.
