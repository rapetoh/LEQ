import { z } from 'zod'

import { supabase } from './supabase'

export const cleRequeteAbonnements = ['resume_abonnements'] as const

const Montants = z.record(z.string(), z.coerce.number())

/** What `resume_abonnements()` answers. Validated here, so a shape change fails loudly. */
export const ResumeAbonnementsSchema = z.object({
  actifs: z.object({
    total: z.number().int().min(0),
    par_formule: z.array(
      z.object({ cle: z.string(), nom: z.string(), actifs: z.number().int().min(0) }),
    ),
  }),
  mois: z.array(
    z.object({
      mois: z.string(),
      nouveaux: z.number().int().min(0),
      paiements: z.number().int().min(0),
      remboursements: z.number().int().min(0),
      montants: Montants,
      net: Montants,
    }),
  ),
  derniers: z.array(
    z.object({
      id: z.string(),
      paye_le: z.string(),
      type: z.enum(['achat', 'renouvellement', 'remboursement', 'essai']),
      montant: z.coerce.number(),
      devise: z.string(),
      formule: z.string().nullable(),
      magasin: z.enum(['apple', 'google', 'autre']),
      utilisateur_id: z.string().nullable(),
      prenom: z.string().nullable(),
    }),
  ),
})
export type ResumeAbonnements = z.output<typeof ResumeAbonnementsSchema>

export async function chargerResumeAbonnements(): Promise<ResumeAbonnements> {
  const { data, error } = await supabase.rpc('resume_abonnements')
  if (error) throw new Error(error.message)
  return ResumeAbonnementsSchema.parse(data)
}
