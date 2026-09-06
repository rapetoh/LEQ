import { z } from 'zod'
import { ProfilSchema, SuspensionSchema, type Profil, type Suspension } from '@leq/domaine'
import { supabase } from './supabase'

export const cleRequeteProfils = ['profils'] as const
export const cleRequeteSuspensions = ['suspensions'] as const

export async function chargerProfils(): Promise<Profil[]> {
  const { data, error } = await supabase
    .from('profils')
    .select('*')
    .order('cree_le', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return z.array(ProfilSchema).parse(data)
}

export async function chargerSuspensions(): Promise<Suspension[]> {
  const { data, error } = await supabase
    .from('suspensions')
    .select('*')
    .order('cree_le', { ascending: false })
  if (error) throw new Error(error.message)
  return z.array(SuspensionSchema).parse(data)
}

export async function suspendreCompte(utilisateurId: string, motif: string): Promise<void> {
  const { error } = await supabase.rpc('suspendre_compte', { p_uid: utilisateurId, p_motif: motif })
  if (error) throw new Error(error.message)
}

export async function reactiverCompte(utilisateurId: string): Promise<void> {
  const { error } = await supabase.rpc('reactiver_compte', { p_uid: utilisateurId })
  if (error) throw new Error(error.message)
}
