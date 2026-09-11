/**
 * Table `configuration`: typed key/value edited by Rebecca, read by the app at
 * startup. The keys, types, defaults and descriptions below are the seed of the
 * migration; the row in the database wins over the default once it exists.
 */
import { z } from 'zod'
import { MOTS_BEQUILLES_V1 } from './mesures.js'
import { IsoTimestampSchema, JsonSchema, UuidSchema } from './primitives.js'

export const CLES_CONFIGURATION = [
  'points_par_defi',
  'points_par_vote',
  'duree_diagnostic_min_s',
  'duree_diagnostic_max_s',
  'etapes_par_jour_gratuit',
  'etapes_par_jour_complet',
  'essais_max_etape_par_jour',
  'duree_etape_min_s',
  'heure_alerte_serie',
  'mots_bequilles',
  'quota_face_a_face_gratuit',
  'quota_face_a_face_complet',
  'plafond_annonces_par_mois',
  'purge_anonymes_heures',
  'expiration_file_locale_jours',
  'balayage_audio_heures',
  'recuperations_serie_par_mois',
  'duree_duel_heures',
  'duree_sujet_arene_jours',
  'plafond_duree_duel_gratuit_s',
  'plafond_duree_duel_complet_s',
  'duree_face_a_face_gratuit_s',
  'duree_face_a_face_complet_s',
  'reprise_debat_minutes',
] as const
export type CleConfiguration = (typeof CLES_CONFIGURATION)[number]
export const CleConfigurationSchema = z.enum(CLES_CONFIGURATION)

export function estCleConfiguration(cle: string): cle is CleConfiguration {
  return (CLES_CONFIGURATION as readonly string[]).includes(cle)
}

export const TYPES_CONFIGURATION = ['nombre', 'texte', 'booleen', 'json'] as const
export const TypeConfigurationSchema = z.enum(TYPES_CONFIGURATION)
export type TypeConfiguration = z.infer<typeof TypeConfigurationSchema>

/** One Zod schema per `configuration.type`, applied to the `valeur` column. */
export const SCHEMAS_VALEUR_CONFIGURATION = {
  nombre: z.number(),
  texte: z.string(),
  booleen: z.boolean(),
  json: JsonSchema,
} as const satisfies Record<TypeConfiguration, z.ZodType>

export type ValeurConfigurationParType = {
  [T in TypeConfiguration]: z.output<(typeof SCHEMAS_VALEUR_CONFIGURATION)[T]>
}
export type ValeurConfiguration = ValeurConfigurationParType[TypeConfiguration]

export interface DefinitionConfigurationTypee<T extends TypeConfiguration> {
  readonly type: T
  readonly valeur: ValeurConfigurationParType[T]
  /** French, shown in the admin UI. */
  readonly description: string
  /** Stricter than the type schema when the key needs it. */
  readonly schema: z.ZodType<ValeurConfigurationParType[T]>
}
export type DefinitionConfiguration = {
  [T in TypeConfiguration]: DefinitionConfigurationTypee<T>
}[TypeConfiguration]

function nombre(
  valeur: number,
  description: string,
  schema: z.ZodType<number> = z.number().min(0),
): DefinitionConfigurationTypee<'nombre'> {
  return { type: 'nombre', valeur, description, schema }
}

/** Seed values, in the order of the contract table. */
export const DEFINITIONS_CONFIGURATION = {
  points_par_defi: nombre(25, 'Points gagnés pour un défi réussi'),
  points_par_vote: nombre(5, "Points gagnés pour un vote dans l'Arène"),
  duree_diagnostic_min_s: nombre(60, 'Durée minimale de la prise de diagnostic'),
  duree_diagnostic_max_s: nombre(90, 'Durée maximale de la prise de diagnostic'),
  etapes_par_jour_gratuit: nombre(1, 'Étapes validables par jour en formule Gratuit'),
  etapes_par_jour_complet: nombre(
    0,
    'Étapes validables par jour en formule Complet (0 = sans limite)',
  ),
  essais_max_etape_par_jour: nombre(3, 'Essais sur une même étape par jour'),
  duree_etape_min_s: nombre(20, "Durée minimale d'une prise de défi"),
  heure_alerte_serie: nombre(
    20,
    "Heure locale de l'alerte quand la série est en danger",
    z.int().min(0).max(23),
  ),
  mots_bequilles: {
    type: 'json',
    valeur: [...MOTS_BEQUILLES_V1],
    description: "Mots béquilles repérés par l'analyse (liste, minuscules)",
    schema: z.array(z.string().trim().min(1)).min(1),
  },
  quota_face_a_face_gratuit: nombre(
    0,
    'Face-à-face par mois en formule Gratuit (0 = réservé à Complet)',
  ),
  quota_face_a_face_complet: nombre(8, 'Face-à-face par mois en formule Complet'),
  plafond_annonces_par_mois: nombre(2, 'Annonces de Rebecca envoyées par mois, maximum'),
  purge_anonymes_heures: nombre(72, 'Délai avant suppression des comptes anonymes sans compte'),
  expiration_file_locale_jours: nombre(7, "Délai avant suppression d'une prise jamais envoyée"),
  balayage_audio_heures: nombre(
    6,
    'Âge à partir duquel un audio non public est supprimé par sécurité',
  ),
  recuperations_serie_par_mois: nombre(1, 'Récupérations de série par mois'),
  duree_duel_heures: nombre(48, 'Délai pour répondre à un duel'),
  duree_sujet_arene_jours: nombre(7, "Durée d'un sujet dans l'Arène"),
  plafond_duree_duel_gratuit_s: nombre(90, "Durée maximale d'une prise de duel (Gratuit)"),
  plafond_duree_duel_complet_s: nombre(180, "Durée maximale d'une prise de duel (Complet)"),
  duree_face_a_face_gratuit_s: nombre(180, "Durée maximale d'un face-à-face (Gratuit)"),
  duree_face_a_face_complet_s: nombre(480, "Durée maximale d'un face-à-face (Complet)"),
  reprise_debat_minutes: nombre(30, "Fenêtre de reprise d'un débat interrompu"),
} as const satisfies Record<CleConfiguration, DefinitionConfiguration>

/** The typed object the app works with. */
export type Configuration = {
  readonly [
    K in CleConfiguration
  ]: ValeurConfigurationParType[(typeof DEFINITIONS_CONFIGURATION)[K]['type']]
}

function construireConfiguration(
  valeurs: Partial<Record<CleConfiguration, ValeurConfiguration>>,
): Configuration {
  const configuration: Record<string, ValeurConfiguration> = {}
  for (const cle of CLES_CONFIGURATION) {
    configuration[cle] = valeurs[cle] ?? DEFINITIONS_CONFIGURATION[cle].valeur
  }
  // Every key is present and each value passed the key's own schema (or is its default).
  return configuration as Configuration
}

export const CONFIGURATION_PAR_DEFAUT: Configuration = construireConfiguration({})

/** A row of `configuration` as read back from the database. */
export const LigneConfigurationSchema = z.object({
  cle: z.string().min(1),
  valeur: JsonSchema,
  type: TypeConfigurationSchema,
  description: z.string(),
  modifie_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type LigneConfiguration = z.output<typeof LigneConfigurationSchema>

/** What the admin sends when Rebecca changes a value. */
export const MiseAJourConfigurationSchema = z.object({
  cle: CleConfigurationSchema,
  valeur: JsonSchema,
})
export type MiseAJourConfiguration = z.infer<typeof MiseAJourConfigurationSchema>

/** The minimum a row must carry to be read: `select cle, valeur` is enough. */
const LigneLueSchema = z.object({
  cle: z.string(),
  valeur: z.unknown(),
  type: TypeConfigurationSchema.optional(),
})

export interface ProblemeConfiguration {
  cle: string
  raison: string
}

export interface RapportConfiguration {
  configuration: Configuration
  /** Contract keys with no row at all: the default was used. */
  manquantes: CleConfiguration[]
  /** Rows whose value or type does not match the key: the default was used. */
  invalides: ProblemeConfiguration[]
  /** Rows whose key is not in the contract: ignored. */
  inconnues: string[]
}

/**
 * Validates a value against a key's own schema. Used by the admin before
 * saving and by `analyserConfiguration` when reading.
 */
export function validerValeurConfiguration(
  cle: CleConfiguration,
  valeur: unknown,
): z.ZodSafeParseResult<ValeurConfiguration> {
  const definition: DefinitionConfiguration = DEFINITIONS_CONFIGURATION[cle]
  return (definition.schema as z.ZodType<ValeurConfiguration>).safeParse(valeur)
}

/**
 * Reads the rows of `configuration` into a typed object and reports what was
 * defaulted or ignored. Never throws: a malformed row falls back to the default
 * of its key so that a mistake in the admin cannot stop the app from starting.
 */
export function analyserConfiguration(rows: ReadonlyArray<unknown>): RapportConfiguration {
  const valeurs: Partial<Record<CleConfiguration, ValeurConfiguration>> = {}
  const vues = new Set<CleConfiguration>()
  const invalides: ProblemeConfiguration[] = []
  const inconnues: string[] = []

  for (const row of rows) {
    const ligne = LigneLueSchema.safeParse(row)
    if (!ligne.success) {
      invalides.push({ cle: '', raison: z.prettifyError(ligne.error) })
      continue
    }
    const { cle, valeur, type } = ligne.data
    if (!estCleConfiguration(cle)) {
      inconnues.push(cle)
      continue
    }
    vues.add(cle)
    const definition: DefinitionConfiguration = DEFINITIONS_CONFIGURATION[cle]
    if (type !== undefined && type !== definition.type) {
      invalides.push({ cle, raison: `type ${type} au lieu de ${definition.type}` })
      continue
    }
    const resultat = validerValeurConfiguration(cle, valeur)
    if (!resultat.success) {
      invalides.push({ cle, raison: z.prettifyError(resultat.error) })
      continue
    }
    valeurs[cle] = resultat.data
  }

  const manquantes = CLES_CONFIGURATION.filter((cle) => !vues.has(cle))
  return { configuration: construireConfiguration(valeurs), manquantes, invalides, inconnues }
}

/** Reads the rows of `configuration` into a typed object, defaults for missing keys. */
export function lireConfiguration(rows: ReadonlyArray<unknown>): Configuration {
  return analyserConfiguration(rows).configuration
}
