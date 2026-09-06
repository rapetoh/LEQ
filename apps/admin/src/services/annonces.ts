import { z } from 'zod'
import {
  AnnonceSchema,
  AtelierSchema,
  lireRefusAnnonce,
  type Annonce,
  type Atelier,
  type AtelierEditable,
  type NouvelleAnnonce,
} from '@leq/domaine'
import { supabase } from './supabase'

export const cleRequeteAteliers = ['ateliers'] as const
export const cleRequeteAnnonces = ['annonces'] as const
export const cleRequeteAnnoncesDuMois = ['annonces_du_mois'] as const

function exigerLigne(data: unknown, quoi: string): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Aucune ligne modifiée pour ${quoi}. Vérifie le rôle admin dans le jeton et les règles RLS.`,
    )
  }
}

export async function chargerAteliers(): Promise<Atelier[]> {
  const { data, error } = await supabase
    .from('ateliers')
    .select('*')
    .order('date_debut', { ascending: false })
  if (error) throw new Error(error.message)
  return z.array(AtelierSchema).parse(data)
}

export async function creerAtelier(valeur: AtelierEditable, creePar: string): Promise<Atelier> {
  const { data, error } = await supabase
    .from('ateliers')
    .insert({ ...valeur, cree_par: creePar })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return AtelierSchema.parse(data)
}

export async function modifierAtelier(id: string, valeur: Partial<AtelierEditable>): Promise<void> {
  const { data, error } = await supabase.from('ateliers').update(valeur).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  exigerLigne(data, 'cet atelier')
}

export async function chargerAnnonces(): Promise<Annonce[]> {
  const { data, error } = await supabase
    .from('annonces')
    .select('*')
    .order('envoyee_le', { ascending: false })
  if (error) throw new Error(error.message)
  return z.array(AnnonceSchema).parse(data)
}

export async function chargerAnnoncesDuMois(): Promise<number> {
  const { data, error } = await supabase.rpc('annonces_du_mois')
  if (error) throw new Error(error.message)
  return z.coerce.number().int().parse(data)
}

export class ErreurAnnonce extends Error {
  constructor(
    readonly refus: 'plafond_annonces_atteint' | null,
    message: string,
  ) {
    super(message)
  }
}

/** The cap and the filter are the database's: this only carries the message. */
export async function publierAnnonce(annonce: NouvelleAnnonce): Promise<string> {
  const { data, error } = await supabase.rpc('publier_annonce', {
    p_titre: annonce.titre,
    p_corps: annonce.corps,
    p_atelier: annonce.atelier_id,
    p_regions: annonce.regions,
  })
  if (error) throw new ErreurAnnonce(lireRefusAnnonce(error.message), error.message)
  return z.uuid().parse(data)
}
