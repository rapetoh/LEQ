// Direct Postgres access (node-postgres). The worker connects with the direct
// connection string, never the pooler: it needs FOR UPDATE SKIP LOCKED and
// multi-statement transactions.
import pg from 'pg'
import type { Mesures, RegleCritere, Transcription } from './contrat.js'

const { Pool } = pg
export type { Pool, PoolClient } from 'pg'

/** Anything that can run a parameterised query: a Pool or a PoolClient inside a transaction. */
export interface Executeur {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>
}

export function creerPool(databaseUrl: string): pg.Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'leq-serveur',
  })
}

// ---------------------------------------------------------------------------
// Domain rows (names from docs/DATA-MODEL.md)
// ---------------------------------------------------------------------------

export const STATUTS_TENTATIVE = [
  'envoyee',
  'en_transcription',
  'en_mesure',
  'en_evaluation',
  'audio_supprime',
  'retour_disponible',
  'echec_technique',
  'abandon_technique',
] as const
export type StatutTentative = (typeof STATUTS_TENTATIVE)[number]

/** States in which the audio object is still needed by the pipeline. */
export const STATUTS_AVANT_SUPPRESSION: readonly StatutTentative[] = [
  'envoyee',
  'en_transcription',
  'en_mesure',
  'en_evaluation',
  'echec_technique',
]

export type TypeTentative = 'diagnostic' | 'etape' | 'arene' | 'duel'
export type ResultatTentative = 'etape_validee' | 'etape_echouee'

export interface Tentative {
  id: string
  utilisateur_id: string
  type: TypeTentative
  etape_id: string | null
  enregistre_le: Date
  fuseau_horaire: string
  decalage_minutes: number
  duree_s: number | null
  chemin_audio: string | null
  statut: StatutTentative
  resultat: ResultatTentative | null
  essais_techniques: number
  derniere_erreur: string | null
  audio_supprime_le: Date | null
  cree_le: Date
  modifie_le: Date
}

export const TYPES_JOB = [
  'analyser_tentative',
  'supprimer_compte',
  'balayer_audio',
  'purger_anonymes',
  'envoyer_annonce',
] as const
export type TypeJob = (typeof TYPES_JOB)[number]

export type StatutJob = 'en_attente' | 'en_cours' | 'termine' | 'echoue'

export interface Job {
  id: number
  type: string
  charge: Record<string, unknown>
  statut: StatutJob
  essais: number
  essais_max: number
  disponible_a: Date
  verrouille_a: Date | null
  verrouille_par: string | null
  erreur: string | null
  cle_idempotence: string | null
  termine_le: Date | null
  cree_le: Date
}

export interface CritereGrille {
  id: string
  grille_id: string
  cle: string
  nom: string
  definition: string
  regle: RegleCritere
  ordre: number
}

export interface GrillePubliee {
  id: string
  version: number
  publiee_le: Date
  criteres: CritereGrille[]
}

export interface NouvelleAnalyse {
  tentative_id: string
  version_schema: number
  mesures: Mesures
  transcription: Transcription
  fournisseur_transcription: string
}

export interface NouvelleEvaluation {
  tentative_id: string
  grille_id: string | null
  version_grille: number | null
  sous_notes: Record<string, { score: number; max: number }>
  note_totale: number | null
  seuil_reussite: number | null
}

// ---------------------------------------------------------------------------
// Row mappers. pg returns bigint and numeric as strings, timestamptz as Date.
// ---------------------------------------------------------------------------

function nombreOuNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function nombre(v: unknown, champ: string): number {
  const n = nombreOuNull(v)
  if (n === null) throw new Error(`Column ${champ} is not a number: ${String(v)}`)
  return n
}

function date(v: unknown, champ: string): Date {
  if (v instanceof Date) return v
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new Error(`Column ${champ} is not a date: ${String(v)}`)
  return d
}

function dateOuNull(v: unknown, champ: string): Date | null {
  return v === null || v === undefined ? null : date(v, champ)
}

function jsonObjet(v: unknown): Record<string, unknown> {
  const valeur = typeof v === 'string' ? (JSON.parse(v) as unknown) : v
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : {}
}

export function versJob(row: pg.QueryResultRow): Job {
  return {
    id: nombre(row['id'], 'jobs.id'),
    type: String(row['type']),
    charge: jsonObjet(row['charge']),
    statut: row['statut'] as StatutJob,
    essais: nombre(row['essais'], 'jobs.essais'),
    essais_max: nombre(row['essais_max'], 'jobs.essais_max'),
    disponible_a: date(row['disponible_a'], 'jobs.disponible_a'),
    verrouille_a: dateOuNull(row['verrouille_a'], 'jobs.verrouille_a'),
    verrouille_par: (row['verrouille_par'] as string | null) ?? null,
    erreur: (row['erreur'] as string | null) ?? null,
    cle_idempotence: (row['cle_idempotence'] as string | null) ?? null,
    termine_le: dateOuNull(row['termine_le'], 'jobs.termine_le'),
    cree_le: date(row['cree_le'], 'jobs.cree_le'),
  }
}

export function versTentative(row: pg.QueryResultRow): Tentative {
  return {
    id: String(row['id']),
    utilisateur_id: String(row['utilisateur_id']),
    type: row['type'] as TypeTentative,
    etape_id: (row['etape_id'] as string | null) ?? null,
    enregistre_le: date(row['enregistre_le'], 'tentatives.enregistre_le'),
    fuseau_horaire: String(row['fuseau_horaire']),
    decalage_minutes: nombre(row['decalage_minutes'], 'tentatives.decalage_minutes'),
    duree_s: nombreOuNull(row['duree_s']),
    chemin_audio: (row['chemin_audio'] as string | null) ?? null,
    statut: row['statut'] as StatutTentative,
    resultat: (row['resultat'] as ResultatTentative | null) ?? null,
    essais_techniques: nombre(row['essais_techniques'], 'tentatives.essais_techniques'),
    derniere_erreur: (row['derniere_erreur'] as string | null) ?? null,
    audio_supprime_le: dateOuNull(row['audio_supprime_le'], 'tentatives.audio_supprime_le'),
    cree_le: date(row['cree_le'], 'tentatives.cree_le'),
    modifie_le: date(row['modifie_le'], 'tentatives.modifie_le'),
  }
}

export function versCritereGrille(row: pg.QueryResultRow): CritereGrille {
  return {
    id: String(row['id']),
    grille_id: String(row['grille_id']),
    cle: String(row['cle']),
    nom: String(row['nom']),
    definition: String(row['definition']),
    regle: (typeof row['regle'] === 'string'
      ? JSON.parse(row['regle'])
      : row['regle']) as RegleCritere,
    ordre: nombre(row['ordre'], 'criteres_grille.ordre'),
  }
}

// ---------------------------------------------------------------------------
// Queue: the SQL functions of the contract.
// ---------------------------------------------------------------------------

/** Claim one job of the given types; null when the queue is empty. */
export async function reclamerJob(
  ex: Executeur,
  workerId: string,
  types: readonly string[],
): Promise<Job | null> {
  const { rows } = await ex.query('select * from public.reclamer_job($1, $2)', [
    workerId,
    [...types],
  ])
  const row = rows[0]
  return row ? versJob(row) : null
}

export async function terminerJob(ex: Executeur, id: number): Promise<void> {
  await ex.query('select public.terminer_job($1)', [id])
}

/** Marks the job failed; the SQL function reschedules it with backoff or sets `echoue` after the last try. */
export async function echouerJob(ex: Executeur, id: number, erreur: string): Promise<void> {
  await ex.query('select public.echouer_job($1, $2)', [id, erreur])
}

/** True when a job with this idempotence key is still waiting or running. */
export async function existeJobActif(ex: Executeur, cleIdempotence: string): Promise<boolean> {
  const { rows } = await ex.query(
    `select 1 from public.jobs where cle_idempotence = $1 and statut in ('en_attente', 'en_cours') limit 1`,
    [cleIdempotence],
  )
  return rows.length > 0
}

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

export async function lireConfigurationNombre(
  ex: Executeur,
  cle: string,
  defaut: number,
): Promise<number> {
  const { rows } = await ex.query('select valeur from public.configuration where cle = $1', [cle])
  const valeur = rows[0]?.['valeur']
  const n = nombreOuNull(typeof valeur === 'string' ? JSON.parse(valeur) : valeur)
  return n ?? defaut
}

/**
 * The filler-word list Rebecca edits (`configuration.mots_bequilles`, Phase 6). Anything
 * missing or malformed falls back to the list given by the caller (the contract's v1 list).
 */
export async function lireListeMotsBequilles(
  ex: Executeur,
  defaut: readonly string[],
): Promise<readonly string[]> {
  const { rows } = await ex.query(
    "select valeur from public.configuration where cle = 'mots_bequilles'",
  )
  const brut = rows[0]?.['valeur']
  const valeur: unknown = typeof brut === 'string' ? JSON.parse(brut) : brut
  if (!Array.isArray(valeur)) return defaut
  const mots = valeur
    .filter((m): m is string => typeof m === 'string')
    .map((m) => m.trim().toLowerCase())
    .filter((m) => m.length > 0)
  return mots.length > 0 ? mots : defaut
}

// ---------------------------------------------------------------------------
// annonces (Phase 6)
// ---------------------------------------------------------------------------

export interface Annonce {
  id: string
  titre: string
  corps: string
  regions: string[] | null
  destinataires: number | null
  envoyes: number
  echecs: number
}

export async function lireAnnonce(ex: Executeur, id: string): Promise<Annonce | null> {
  const { rows } = await ex.query(
    'select id, titre, corps, regions, destinataires, envoyes, echecs from public.annonces where id = $1',
    [id],
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row['id']),
    titre: String(row['titre']),
    corps: String(row['corps']),
    regions: Array.isArray(row['regions']) ? (row['regions'] as string[]) : null,
    destinataires: nombreOuNull(row['destinataires']),
    envoyes: nombre(row['envoyes'], 'envoyes'),
    echecs: nombre(row['echecs'], 'echecs'),
  }
}

export interface JetonDestinataire {
  id: string
  jeton: string
}

/**
 * Active tokens of the people an announcement concerns: switch `notif_annonces` on, region
 * in the list (every region when the list is null), account not suspended.
 */
export async function listerJetonsPourAnnonce(
  ex: Executeur,
  regions: string[] | null,
): Promise<JetonDestinataire[]> {
  const { rows } = await ex.query(
    `select j.id, j.jeton
       from public.jetons_push j
       join public.profils p on p.id = j.utilisateur_id
      where j.desactive_le is null
        and p.notif_annonces
        and p.suspendu_le is null
        and ($1::text[] is null or p.region = any ($1::text[]))
      order by j.cree_le`,
    [regions],
  )
  return rows.map((r) => ({ id: String(r['id']), jeton: String(r['jeton']) }))
}

export async function ecrireResultatAnnonce(
  ex: Executeur,
  id: string,
  destinataires: number,
  envoyes: number,
  echecs: number,
): Promise<void> {
  await ex.query(
    'update public.annonces set destinataires = $2, envoyes = $3, echecs = $4 where id = $1',
    [id, destinataires, envoyes, echecs],
  )
}

// ---------------------------------------------------------------------------
// tentatives
// ---------------------------------------------------------------------------

export async function lireTentative(ex: Executeur, id: string): Promise<Tentative | null> {
  const { rows } = await ex.query('select * from public.tentatives where id = $1', [id])
  const row = rows[0]
  return row ? versTentative(row) : null
}

export async function listerTentativesParIds(
  ex: Executeur,
  ids: readonly string[],
): Promise<Tentative[]> {
  if (ids.length === 0) return []
  const { rows } = await ex.query('select * from public.tentatives where id = any($1::uuid[])', [
    [...ids],
  ])
  return rows.map(versTentative)
}

export async function mettreAJourStatut(
  ex: Executeur,
  id: string,
  statut: StatutTentative,
): Promise<void> {
  await ex.query('update public.tentatives set statut = $2 where id = $1', [id, statut])
}

/** The decoded length of the audio, written once the file is decoded (the phone's value is an estimate). */
export async function mettreAJourDuree(ex: Executeur, id: string, dureeS: number): Promise<void> {
  await ex.query('update public.tentatives set duree_s = $2 where id = $1', [
    id,
    Math.round(dureeS * 100) / 100,
  ])
}

export async function marquerEchecTechnique(
  ex: Executeur,
  id: string,
  erreur: string,
): Promise<void> {
  await ex.query(
    `update public.tentatives
        set statut = 'echec_technique',
            derniere_erreur = $2,
            essais_techniques = essais_techniques + 1
      where id = $1`,
    [id, erreur],
  )
}

/** Final failure. When the audio was removed (or never existed), clears the path and stamps the deletion. */
export async function marquerAbandonTechnique(
  ex: Executeur,
  id: string,
  audioSupprime: boolean,
  erreur?: string,
): Promise<void> {
  await ex.query(
    `update public.tentatives
        set statut = 'abandon_technique',
            derniere_erreur = coalesce($3, derniere_erreur),
            chemin_audio = case when $2 then null else chemin_audio end,
            audio_supprime_le = case when $2 then coalesce(audio_supprime_le, now()) else audio_supprime_le end
      where id = $1`,
    [id, audioSupprime, erreur ?? null],
  )
}

export async function marquerAudioSupprime(ex: Executeur, id: string): Promise<void> {
  await ex.query(
    `update public.tentatives
        set statut = 'audio_supprime',
            audio_supprime_le = now(),
            chemin_audio = null
      where id = $1`,
    [id],
  )
}

/** Used by the sweeper: the object is gone, the row keeps its state but loses the path. */
export async function marquerCheminAudioSupprime(ex: Executeur, id: string): Promise<void> {
  await ex.query(
    `update public.tentatives
        set chemin_audio = null,
            audio_supprime_le = coalesce(audio_supprime_le, now())
      where id = $1`,
    [id],
  )
}

// ---------------------------------------------------------------------------
// grilles
// ---------------------------------------------------------------------------

/** The latest published grid with its criteria in order, or null while Rebecca has not provided one. */
export async function lireGrillePubliee(ex: Executeur): Promise<GrillePubliee | null> {
  const grilles = await ex.query(
    `select id, version, publiee_le from public.grilles
      where publiee_le is not null
      order by version desc
      limit 1`,
  )
  const grille = grilles.rows[0]
  if (!grille) return null
  const id = String(grille['id'])
  const criteres = await ex.query(
    'select * from public.criteres_grille where grille_id = $1 order by ordre asc, cle asc',
    [id],
  )
  return {
    id,
    version: nombre(grille['version'], 'grilles.version'),
    publiee_le: date(grille['publiee_le'], 'grilles.publiee_le'),
    criteres: criteres.rows.map(versCritereGrille),
  }
}

// ---------------------------------------------------------------------------
// analyses + evaluations, one transaction
// ---------------------------------------------------------------------------

/**
 * Writes the analysis and the evaluation atomically, then applies the result to the
 * path (`appliquer_resultat`: validates or fails a step, unlocks the next one). Upserts,
 * so a retry of a job that crashed after the commit (for example on storage deletion)
 * rewrites the same content instead of failing on the primary key. Returns the step
 * result, or null when nothing applied (no grid yet, not a step attempt).
 */
export async function enregistrerAnalyseEtEvaluation(
  pool: pg.Pool,
  analyse: NouvelleAnalyse,
  evaluation: NouvelleEvaluation,
): Promise<ResultatTentative | null> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into public.analyses (tentative_id, version_schema, mesures, transcription, fournisseur_transcription)
       values ($1, $2, $3::jsonb, $4::jsonb, $5)
       on conflict (tentative_id) do update
         set version_schema = excluded.version_schema,
             mesures = excluded.mesures,
             transcription = excluded.transcription,
             fournisseur_transcription = excluded.fournisseur_transcription`,
      [
        analyse.tentative_id,
        analyse.version_schema,
        JSON.stringify(analyse.mesures),
        JSON.stringify(analyse.transcription),
        analyse.fournisseur_transcription,
      ],
    )
    await client.query(
      `insert into public.evaluations (tentative_id, grille_id, version_grille, sous_notes, note_totale, seuil_reussite)
       values ($1, $2, $3, $4::jsonb, $5, $6)
       on conflict (tentative_id) do update
         set grille_id = excluded.grille_id,
             version_grille = excluded.version_grille,
             sous_notes = excluded.sous_notes,
             note_totale = excluded.note_totale,
             seuil_reussite = excluded.seuil_reussite`,
      [
        evaluation.tentative_id,
        evaluation.grille_id,
        evaluation.version_grille,
        JSON.stringify(evaluation.sous_notes),
        evaluation.note_totale,
        evaluation.seuil_reussite,
      ],
    )
    const resultat = await client.query('select public.appliquer_resultat($1) as resultat', [
      analyse.tentative_id,
    ])
    await client.query('commit')
    return (resultat.rows[0]?.['resultat'] as ResultatTentative | null) ?? null
  } catch (erreur) {
    await client.query('rollback').catch(() => undefined)
    throw erreur
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// storage.objects and auth.users (read through the direct connection)
// ---------------------------------------------------------------------------

export interface ObjetStockage {
  name: string
  created_at: Date
}

/** Objects of a bucket, optionally older than `plusVieuxQueHeures` and/or under a prefix. */
export async function listerObjetsStockage(
  ex: Executeur,
  bucket: string,
  options: { plusVieuxQueHeures?: number; prefixe?: string } = {},
): Promise<ObjetStockage[]> {
  const conditions = ['bucket_id = $1']
  const valeurs: unknown[] = [bucket]
  if (options.plusVieuxQueHeures !== undefined) {
    valeurs.push(options.plusVieuxQueHeures)
    conditions.push(`created_at < now() - make_interval(hours => $${valeurs.length})`)
  }
  if (options.prefixe !== undefined) {
    valeurs.push(`${options.prefixe}%`)
    conditions.push(`name like $${valeurs.length}`)
  }
  const { rows } = await ex.query(
    `select name, created_at from storage.objects where ${conditions.join(' and ')} order by created_at asc`,
    valeurs,
  )
  return rows.map((row) => ({
    name: String(row['name']),
    created_at: date(row['created_at'], 'storage.objects.created_at'),
  }))
}

/** Anonymous auth users created more than `heures` hours ago. */
export async function listerUtilisateursAnonymesExpires(
  ex: Executeur,
  heures: number,
): Promise<string[]> {
  const { rows } = await ex.query(
    `select id from auth.users
      where is_anonymous = true
        and created_at < now() - make_interval(hours => $1)
      order by created_at asc`,
    [heures],
  )
  return rows.map((row) => String(row['id']))
}
