import { z } from 'zod'
import { IsoTimestampSchema, UuidSchema } from '@leq/domaine'
import { supabase } from './supabase'

export const cleRequeteDemandesExport = ['demandes_export'] as const

export const DemandeExportSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  email: z.string().nullable(),
  traitee_le: IsoTimestampSchema.nullable(),
  traitee_par: UuidSchema.nullable(),
  cree_le: IsoTimestampSchema,
  profils: z.object({ prenom: z.string().nullable() }).nullable(),
})
export type DemandeExport = z.output<typeof DemandeExportSchema>

export async function chargerDemandesExport(): Promise<DemandeExport[]> {
  const { data, error } = await supabase
    .from('demandes_export')
    // Two foreign keys point to profils (the person, the admin who treated it): name the one meant.
    .select(
      'id, utilisateur_id, email, traitee_le, traitee_par, cree_le, profils!demandes_export_utilisateur_id_fkey(prenom)',
    )
    .order('cree_le', { ascending: false })
  if (error) throw new Error(error.message)
  return z.array(DemandeExportSchema).parse(data)
}

export async function marquerDemandeTraitee(
  id: string,
  traiteePar: string,
  traitee: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from('demandes_export')
    .update(
      traitee
        ? { traitee_le: new Date().toISOString(), traitee_par: traiteePar }
        : { traitee_le: null, traitee_par: null },
    )
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('Aucune ligne modifiée pour cette demande.')
}
