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

| cle                          | type   | valeur | description                                                       |
| ---------------------------- | ------ | ------ | ----------------------------------------------------------------- |
| points_par_defi              | nombre | 25     | Points gagnés pour un défi réussi                                 |
| points_par_vote              | nombre | 5      | Points gagnés pour un vote dans l'Arène                           |
| duree_diagnostic_min_s       | nombre | 60     | Durée minimale de la prise de diagnostic                          |
| duree_diagnostic_max_s       | nombre | 90     | Durée maximale de la prise de diagnostic                          |
| etapes_par_jour_gratuit      | nombre | 1      | Étapes validables par jour en formule Gratuit                     |
| etapes_par_jour_complet      | nombre | 0      | Étapes validables par jour en formule Complet (0 = sans limite)   |
| essais_max_etape_par_jour    | nombre | 3      | Essais sur une même étape par jour                                |
| quota_face_a_face_complet    | nombre | 8      | Face-à-face par mois en formule Complet                           |
| plafond_annonces_par_mois    | nombre | 2      | Annonces de Rebecca envoyées par mois, maximum                    |
| purge_anonymes_heures        | nombre | 72     | Délai avant suppression des comptes anonymes sans compte          |
| expiration_file_locale_jours | nombre | 7      | Délai avant suppression d'une prise jamais envoyée                |
| balayage_audio_heures        | nombre | 6      | Âge à partir duquel un audio non public est supprimé par sécurité |
| recuperations_serie_par_mois | nombre | 1      | Récupérations de série par mois                                   |
| duree_duel_heures            | nombre | 48     | Délai pour répondre à un duel                                     |
| duree_sujet_arene_jours      | nombre | 7      | Durée d'un sujet dans l'Arène                                     |
| plafond_duree_duel_gratuit_s | nombre | 90     | Durée maximale d'une prise de duel (Gratuit)                      |
| plafond_duree_duel_complet_s | nombre | 180    | Durée maximale d'une prise de duel (Complet)                      |
| duree_face_a_face_gratuit_s  | nombre | 180    | Durée maximale d'un face-à-face (Gratuit)                         |
| duree_face_a_face_complet_s  | nombre | 480    | Durée maximale d'un face-à-face (Complet)                         |
| reprise_debat_minutes        | nombre | 30     | Fenêtre de reprise d'un débat interrompu                          |

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

## Later phases (names reserved)

`parcours`, `actes`, `etapes`, `exercices`, `series`, `mouvements_points`, `recompenses`, `echanges_recompenses`, `abonnements`, `sujets_arene`, `prises_publiques` (Arena or duel, checked), `impressions`, `votes`, `duels`, `debats`, `tours_debat`, `sessions_debat`, `theses`, `ateliers`, `annonces`, `demandes_export`, `moderations`.
