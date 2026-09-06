/**
 * Phase 4: the path. Banks (`modeles_actes`, `defis`, `exercices`), the path of one
 * person (`parcours`, `actes`, `etapes`), `abonnements`, and the JSON answered by
 * `etape_du_jour()`.
 */
import { z } from 'zod'
import { IsoTimestampSchema, PgNumericSchema, UuidSchema } from './primitives.js'

export const FORMATS_DEFI = ['standard', 'texte', 'long'] as const
export const FormatDefiSchema = z.enum(FORMATS_DEFI)
export type FormatDefi = z.infer<typeof FormatDefiSchema>

export const STATUTS_ACTE = ['a_venir', 'en_cours', 'traverse'] as const
export const StatutActeSchema = z.enum(STATUTS_ACTE)
export type StatutActe = z.infer<typeof StatutActeSchema>

export const STATUTS_ETAPE = ['verrouillee', 'disponible', 'validee'] as const
export const StatutEtapeSchema = z.enum(STATUTS_ETAPE)
export type StatutEtape = z.infer<typeof StatutEtapeSchema>

export const FORMULES = ['gratuit', 'complet'] as const
export const FormuleSchema = z.enum(FORMULES)
export type Formule = z.infer<typeof FormuleSchema>

export const RAISONS_RYTHME = [
  'ok',
  'limite_jour',
  'limite_essais',
  'aucune_etape',
  'parcours_termine',
] as const
export const RaisonRythmeSchema = z.enum(RAISONS_RYTHME)
export type RaisonRythme = z.infer<typeof RaisonRythmeSchema>

export const AppuiPlanSchema = z.object({ titre: z.string(), detail: z.string().default('') })
export type AppuiPlan = z.infer<typeof AppuiPlanSchema>

export const ModeleActeSchema = z.object({
  ordre: z.int().positive(),
  titre: z.string().min(1),
  sous_titre: z.string().nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type ModeleActe = z.output<typeof ModeleActeSchema>

export const DefiSchema = z.object({
  id: UuidSchema,
  cle: z.string().min(1),
  ordre_acte: z.int().positive(),
  ordre: z.int().positive(),
  format: FormatDefiSchema,
  titre: z.string().min(1),
  consigne: z.string().min(1),
  focus: z.string().nullable(),
  plan: z.array(AppuiPlanSchema),
  texte_a_lire: z.string().nullable(),
  duree_lecture_s: z.int().positive().nullable(),
  duree_preparation_s: z.int().positive().nullable(),
  duree_max_s: z.int().positive(),
  points: z.int().min(0),
  competence: z.string().min(1),
  seuil_reussite: PgNumericSchema,
  provisoire: z.boolean(),
  actif: z.boolean(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Defi = z.output<typeof DefiSchema>

/** What the admin writes for a défi (id and timestamps are the database's). */
export const DefiEditableSchema = DefiSchema.omit({ id: true, cree_le: true, modifie_le: true })
export type DefiEditable = z.output<typeof DefiEditableSchema>

export const ExerciceSchema = z.object({
  id: UuidSchema,
  cle: z.string().min(1),
  titre: z.string().min(1),
  consigne: z.string().min(1),
  duree_s: z.int().positive(),
  competence: z.string().min(1),
  provisoire: z.boolean(),
  actif: z.boolean(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Exercice = z.output<typeof ExerciceSchema>
export const ExerciceEditableSchema = ExerciceSchema.omit({
  id: true,
  cree_le: true,
  modifie_le: true,
})
export type ExerciceEditable = z.output<typeof ExerciceEditableSchema>

export const ParcoursSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  source: z.enum(['statique', 'genere']),
  version_regles: z.string().nullable(),
  genere_le: IsoTimestampSchema,
})
export type Parcours = z.output<typeof ParcoursSchema>

export const ActeSchema = z.object({
  id: UuidSchema,
  parcours_id: UuidSchema,
  ordre: z.int().positive(),
  titre: z.string(),
  sous_titre: z.string().nullable(),
  statut: StatutActeSchema,
  traverse_le: IsoTimestampSchema.nullable(),
})
export type Acte = z.output<typeof ActeSchema>

export const EtapeSchema = z.object({
  id: UuidSchema,
  parcours_id: UuidSchema,
  acte_id: UuidSchema,
  ordre_global: z.int().positive(),
  ordre: z.int().positive(),
  defi_id: UuidSchema,
  seuil_reussite: PgNumericSchema,
  statut: StatutEtapeSchema,
  nombre_echecs: z.int().min(0),
  rattrapage_propose: z.boolean(),
  validee_le: IsoTimestampSchema.nullable(),
  tentative_validante_id: UuidSchema.nullable(),
})
export type Etape = z.output<typeof EtapeSchema>

export const AbonnementSchema = z.object({
  utilisateur_id: UuidSchema,
  formule: FormuleSchema,
  source: z.enum(['manuel', 'revenuecat']),
  actif_jusqu_a: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Abonnement = z.output<typeof AbonnementSchema>

/** The JSON answered by `etape_du_jour()`. */
export const RythmeSchema = z.object({
  jour: z.string(),
  fuseau_horaire: z.string(),
  etapes_validees_aujourdhui: z.int().min(0),
  essais_aujourdhui: z.int().min(0),
  limite_etapes: z.int().min(0),
  limite_essais: z.int().min(0),
  peut_enregistrer: z.boolean(),
  raison: RaisonRythmeSchema,
})
export type Rythme = z.infer<typeof RythmeSchema>

export const EtapeDuJourSchema = z.object({
  formule: FormuleSchema,
  rythme: RythmeSchema,
  etape: z
    .object({
      id: UuidSchema,
      ordre_global: z.int().positive(),
      ordre: z.int().positive(),
      statut: StatutEtapeSchema,
      nombre_echecs: z.int().min(0),
      rattrapage_propose: z.boolean(),
      seuil_reussite: PgNumericSchema,
      nb_etapes_acte: z.int().min(0),
    })
    .nullable(),
  acte: z
    .object({
      id: UuidSchema,
      ordre: z.int().positive(),
      titre: z.string(),
      sous_titre: z.string().nullable(),
    })
    .nullable(),
  defi: DefiSchema.omit({
    ordre_acte: true,
    ordre: true,
    actif: true,
    seuil_reussite: true,
    cree_le: true,
    modifie_le: true,
  }).nullable(),
})
export type EtapeDuJour = z.output<typeof EtapeDuJourSchema>

/** French labels of the formats, for the brief and the admin. */
export const NOMS_FORMAT: Readonly<Record<FormatDefi, string>> = {
  standard: 'Défi',
  texte: 'Défi texte',
  long: 'Grand format',
}
