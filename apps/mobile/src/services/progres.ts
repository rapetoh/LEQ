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
  SousNotesSchema,
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

// ------------------------------------------------------------------------------------------
// The voices: each axis of Rebecca's grid, this month against last month (D1).
// ------------------------------------------------------------------------------------------

export const CLE_VOIX = ['voix'] as const

export interface Voix {
  cle: string
  nom: string
  /** Mean score of the month's takes on this axis, as a share of the maximum, 0 to 100. */
  mois: number
  /** The same for the previous month, when it had takes. */
  precedent: number | null
}

function debutDuMois(decalage: number): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + decalage, 1)
}

/**
 * Reads the person's evaluated takes since the first of last month and averages, per axis of
 * the grid, the share of the maximum they scored; the axes take the names of the latest grid.
 * Null before the first evaluated take: nothing to draw means no bars at zero.
 */
export function useVoix(): UseQueryResult<Voix[] | null> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_VOIX,
    enabled: pret && session !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<Voix[] | null> => {
      const { data, error } = await supabase
        .from('tentatives')
        .select('enregistre_le, evaluations(grille_id, sous_notes)')
        .eq('utilisateur_id', session?.user.id)
        .eq('statut', 'retour_disponible')
        .gte('enregistre_le', debutDuMois(-1).toISOString())
        .order('enregistre_le', { ascending: false })
      if (error) throw new Error(error.message)
      const debutMois = debutDuMois(0).getTime()
      type Cumul = { total: number; nombre: number }
      const mois = new Map<string, Cumul>()
      const precedent = new Map<string, Cumul>()
      let grilleId: string | null = null
      for (const ligne of (data ?? []) as {
        enregistre_le: string
        evaluations: unknown
      }[]) {
        const brut = Array.isArray(ligne.evaluations) ? ligne.evaluations[0] : ligne.evaluations
        const evaluation = brut as { grille_id?: string | null; sous_notes?: unknown } | null
        const notes = SousNotesSchema.safeParse(evaluation?.sous_notes)
        if (!evaluation || !notes.success) continue
        if (!grilleId && evaluation.grille_id) grilleId = evaluation.grille_id
        const cible = Date.parse(ligne.enregistre_le) >= debutMois ? mois : precedent
        for (const [cle, note] of Object.entries(notes.data)) {
          if (note.max <= 0) continue
          const c = cible.get(cle) ?? { total: 0, nombre: 0 }
          c.total += note.score / note.max
          c.nombre += 1
          cible.set(cle, c)
        }
      }
      if (mois.size === 0 && precedent.size === 0) return null
      let noms: { cle: string; nom: string; ordre: number }[] = []
      if (grilleId) {
        const { data: criteres } = await supabase
          .from('criteres_grille')
          .select('cle, nom, ordre')
          .eq('grille_id', grilleId)
          .order('ordre')
        noms = (criteres ?? []) as { cle: string; nom: string; ordre: number }[]
      }
      const cles =
        noms.length > 0
          ? noms.map((n) => n.cle)
          : [...new Set([...mois.keys(), ...precedent.keys()])]
      const pct = (c: Cumul | undefined) =>
        c && c.nombre > 0 ? Math.round((c.total / c.nombre) * 100) : null
      return cles
        .map((cle) => ({
          cle,
          nom: noms.find((n) => n.cle === cle)?.nom ?? cle,
          mois: pct(mois.get(cle)) ?? pct(precedent.get(cle)) ?? 0,
          precedent: pct(precedent.get(cle)),
        }))
        .filter((v) => mois.has(v.cle) || precedent.has(v.cle))
    },
  })
}
