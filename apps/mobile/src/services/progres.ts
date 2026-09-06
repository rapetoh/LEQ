// The streak, the points, the shop and the progress page, seen from the phone. Everything is
// read through the database functions of migration 0006 (ADR-009): nothing is counted here.
import {
  BoutiqueSchema,
  PointsSchema,
  ResumeProgresSchema,
  SerieSchema,
  lireRefusEchange,
  lireRefusRecuperation,
  type RefusEchange,
  type RefusRecuperation,
} from '@leq/domaine'
import { useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'

import { supabase, useSession } from './supabase'

export const CLE_SERIE = ['serie'] as const
export const CLE_POINTS = ['points'] as const
export const CLE_BOUTIQUE = ['boutique'] as const
export const CLE_PROGRES = ['progres'] as const

async function appeler<T>(fonction: string, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await supabase.rpc(fonction)
  if (error) throw new Error(error.message)
  return schema.parse(data)
}

export const chargerSerie = () => appeler('ma_serie', SerieSchema)
export const chargerPoints = () => appeler('mes_points', PointsSchema)
export const chargerBoutique = () => appeler('mes_recompenses', BoutiqueSchema)
export const chargerResumeProgres = () => appeler('resume_progres', ResumeProgresSchema)

function useRequete<T>(cle: readonly string[], charger: () => Promise<T>): UseQueryResult<T> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: cle,
    queryFn: charger,
    enabled: pret && session !== null,
    staleTime: 30_000,
  })
}

export const useSerie = () => useRequete(CLE_SERIE, chargerSerie)
export const usePoints = () => useRequete(CLE_POINTS, chargerPoints)
export const useBoutique = () => useRequete(CLE_BOUTIQUE, chargerBoutique)
export const useResumeProgres = () => useRequete(CLE_PROGRES, chargerResumeProgres)

/** After a take, an exchange or a recovery: every derived number is read again. */
export function invaliderProgres(client: QueryClient): void {
  for (const cle of [CLE_SERIE, CLE_POINTS, CLE_BOUTIQUE, CLE_PROGRES]) {
    void client.invalidateQueries({ queryKey: cle })
  }
}

export class ErreurEchange extends Error {
  constructor(
    readonly refus: RefusEchange | null,
    message: string,
  ) {
    super(message)
  }
}

/** Exchanges points for a reward; the database refuses in one of the listed ways. */
export async function echangerRecompense(recompenseId: string): Promise<string> {
  const { data, error } = await supabase.rpc('echanger_recompense', { p_recompense: recompenseId })
  if (error) throw new ErreurEchange(lireRefusEchange(error.message), error.message)
  return z.uuid().parse(data)
}

export class ErreurRecuperation extends Error {
  constructor(
    readonly refus: RefusRecuperation | null,
    message: string,
  ) {
    super(message)
  }
}

/** Covers yesterday with this month's recovery; returns the covered day. */
export async function activerRecuperation(): Promise<string> {
  const { data, error } = await supabase.rpc('activer_recuperation_serie')
  if (error) throw new ErreurRecuperation(lireRefusRecuperation(error.message), error.message)
  return z.string().parse(data)
}
