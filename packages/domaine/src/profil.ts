/**
 * Table `profils`: one row per auth user, created by trigger.
 */
import { z } from 'zod'
import { IanaTimezoneSchema, IsoTimestampSchema, UuidSchema } from './primitives.js'

export const ROLES_PROFIL = ['utilisateur', 'admin'] as const
export const RoleProfilSchema = z.enum(ROLES_PROFIL)
export type RoleProfil = z.infer<typeof RoleProfilSchema>

/**
 * Region codes for the announcement geo filter (French regions, Belgium,
 * Switzerland, Québec, other). The list is fixed here so every app shows the
 * same choices; the column stores the code.
 */
export const CODES_REGION = [
  'auvergne_rhone_alpes',
  'bourgogne_franche_comte',
  'bretagne',
  'centre_val_de_loire',
  'corse',
  'grand_est',
  'hauts_de_france',
  'ile_de_france',
  'normandie',
  'nouvelle_aquitaine',
  'occitanie',
  'pays_de_la_loire',
  'provence_alpes_cote_d_azur',
  'outre_mer',
  'belgique',
  'suisse',
  'quebec',
  'autre',
] as const
export const CodeRegionSchema = z.enum(CODES_REGION)
export type CodeRegion = z.infer<typeof CodeRegionSchema>

/** French labels for the region picker. */
export const NOMS_REGION: Readonly<Record<CodeRegion, string>> = {
  auvergne_rhone_alpes: 'Auvergne-Rhône-Alpes',
  bourgogne_franche_comte: 'Bourgogne-Franche-Comté',
  bretagne: 'Bretagne',
  centre_val_de_loire: 'Centre-Val de Loire',
  corse: 'Corse',
  grand_est: 'Grand Est',
  hauts_de_france: 'Hauts-de-France',
  ile_de_france: 'Île-de-France',
  normandie: 'Normandie',
  nouvelle_aquitaine: 'Nouvelle-Aquitaine',
  occitanie: 'Occitanie',
  pays_de_la_loire: 'Pays de la Loire',
  provence_alpes_cote_d_azur: "Provence-Alpes-Côte d'Azur",
  outre_mer: 'Outre-mer',
  belgique: 'Belgique',
  suisse: 'Suisse',
  quebec: 'Québec',
  autre: 'Autre',
}

export const PrenomSchema = z.string().trim().min(1).max(40)

/** A row of `profils` as read back from the database. */
export const ProfilSchema = z.object({
  id: UuidSchema,
  prenom: z.string().nullable(),
  region: CodeRegionSchema.nullable(),
  fuseau_horaire: IanaTimezoneSchema.nullable(),
  publier_sous_prenom: z.boolean(),
  role: RoleProfilSchema,
  suspendu_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type Profil = z.output<typeof ProfilSchema>

/** What a person may change on their own row: never `role`, never `suspendu_le`. */
export const MiseAJourProfilSchema = z.object({
  prenom: PrenomSchema.nullable().optional(),
  region: CodeRegionSchema.nullable().optional(),
  fuseau_horaire: IanaTimezoneSchema.nullable().optional(),
  publier_sous_prenom: z.boolean().optional(),
})
export type MiseAJourProfil = z.infer<typeof MiseAJourProfilSchema>

export function estSuspendu(profil: Pick<Profil, 'suspendu_le'>): boolean {
  return profil.suspendu_le !== null
}

/**
 * Reads the role the access token hook copied into `app_metadata.role`.
 * Anything missing or unexpected is a plain user.
 */
export function lireRoleDepuisAppMetadata(appMetadata: unknown): RoleProfil {
  if (appMetadata === null || typeof appMetadata !== 'object') return 'utilisateur'
  const role = (appMetadata as Record<string, unknown>)['role']
  const resultat = RoleProfilSchema.safeParse(role)
  return resultat.success ? resultat.data : 'utilisateur'
}
