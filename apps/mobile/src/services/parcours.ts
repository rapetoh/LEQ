// The path, seen from the phone: the step of the day with the rhythm, the map of acts,
// the folded act with past results, and the remediation acknowledgement.
import {
  ActeSchema,
  DefiSchema,
  EtapeDuJourSchema,
  EtapeSchema,
  ExerciceSchema,
  MesuresSchema,
  SousNotesSchema,
  type Acte,
  type Defi,
  type Etape,
  type EtapeDuJour,
  type Exercice,
  type Mesures,
  type PointRemarquable,
  type ResultatTentative,
  type SousNotes,
  type StatutTentative,
} from '@leq/domaine'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'

import { noteMax } from './rythme'
import { supabase, useSession } from './supabase'

export const CLE_ETAPE_DU_JOUR = ['etape_du_jour'] as const
export const CLE_CARTE = ['carte_parcours'] as const

export async function chargerEtapeDuJour(): Promise<EtapeDuJour> {
  const { data, error } = await supabase.rpc('etape_du_jour')
  if (error) throw new Error(error.message)
  return EtapeDuJourSchema.parse(data)
}

export function useEtapeDuJour(): UseQueryResult<EtapeDuJour> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_ETAPE_DU_JOUR,
    queryFn: chargerEtapeDuJour,
    enabled: pret && session !== null,
    staleTime: 30_000,
  })
}

export interface ResultatEtape {
  note_totale: number | null
  /** Sum of the criteria maxima, so a score reads "25 sur 30". Null without a grid. */
  note_max: number | null
  mots_par_minute: number | null
  bequilles: number | null
  enregistre_le: string
}

export interface EtapeCarte extends Etape {
  defi: Pick<Defi, 'id' | 'cle' | 'titre' | 'format' | 'points' | 'duree_max_s'>
  /** The result of the attempt that validated this step, for the folded act (H4). */
  resultat: ResultatEtape | null
}

export interface ActeCarte extends Acte {
  etapes: EtapeCarte[]
}

const DefiCarteSchema = DefiSchema.pick({
  id: true,
  cle: true,
  titre: true,
  format: true,
  points: true,
  duree_max_s: true,
})
const LigneEtapeSchema = EtapeSchema.extend({ defis: DefiCarteSchema })

type Evaluation = { note_totale: number | string | null; sous_notes?: unknown }
type Analyse = {
  mesures: { debit?: { mots_par_minute?: number | null }; mots_bequilles?: { total?: number } }
}
type LigneResultat = {
  id: string
  enregistre_le: string
  evaluations: Evaluation | Evaluation[] | null
  analyses: Analyse | Analyse[] | null
}

/** supabase-js types a one-to-one relation as an array; both shapes are accepted. */
function un<T>(valeur: T | T[] | null): T | null {
  return Array.isArray(valeur) ? (valeur[0] ?? null) : valeur
}

async function chargerResultats(tentativeIds: string[]): Promise<Map<string, ResultatEtape>> {
  const resultats = new Map<string, ResultatEtape>()
  if (tentativeIds.length === 0) return resultats
  const { data } = await supabase
    .from('tentatives')
    .select('id, enregistre_le, evaluations(note_totale, sous_notes), analyses(mesures)')
    .in('id', tentativeIds)
  for (const ligne of (data ?? []) as unknown as LigneResultat[]) {
    const evaluation = un(ligne.evaluations)
    const note = evaluation?.note_totale
    const mesures = un(ligne.analyses)?.mesures
    resultats.set(ligne.id, {
      note_totale: note === null || note === undefined ? null : Number(note),
      note_max: noteMax(evaluation?.sous_notes),
      mots_par_minute: mesures?.debit?.mots_par_minute ?? null,
      bequilles: mesures?.mots_bequilles?.total ?? null,
      enregistre_le: ligne.enregistre_le,
    })
  }
  return resultats
}

/** The whole path of the person: acts with their steps and défis. Builds the path if missing. */
export async function chargerCarte(): Promise<ActeCarte[]> {
  const parcours = await supabase.rpc('obtenir_parcours')
  if (parcours.error) throw new Error(parcours.error.message)
  const parcoursId = z.uuid().parse(parcours.data)

  const [actes, etapes] = await Promise.all([
    supabase.from('actes').select('*').eq('parcours_id', parcoursId).order('ordre'),
    supabase
      .from('etapes')
      .select('*, defis(id, cle, titre, format, points, duree_max_s)')
      .eq('parcours_id', parcoursId)
      .order('ordre_global'),
  ])
  if (actes.error) throw new Error(actes.error.message)
  if (etapes.error) throw new Error(etapes.error.message)

  const lignes = z.array(LigneEtapeSchema).parse(etapes.data)
  const resultats = await chargerResultats(
    lignes.flatMap((e) => (e.tentative_validante_id ? [e.tentative_validante_id] : [])),
  )

  return z
    .array(ActeSchema)
    .parse(actes.data)
    .map((acte) => ({
      ...acte,
      etapes: lignes
        .filter((e) => e.acte_id === acte.id)
        .map(({ defis, ...etape }) => ({
          ...etape,
          defi: defis,
          resultat: etape.tentative_validante_id
            ? (resultats.get(etape.tentative_validante_id) ?? null)
            : null,
        })),
    }))
}

export function useCarte(): UseQueryResult<ActeCarte[]> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: CLE_CARTE,
    queryFn: chargerCarte,
    enabled: pret && session !== null,
    staleTime: 30_000,
  })
}

export async function marquerRattrapageVu(etapeId: string): Promise<void> {
  const { error } = await supabase.rpc('marquer_rattrapage_vu', { p_etape_id: etapeId })
  if (error) throw new Error(error.message)
}

export async function chargerExerciceParId(exerciceId: string): Promise<Exercice | null> {
  const { data, error } = await supabase
    .from('exercices')
    .select('*')
    .eq('id', exerciceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? ExerciceSchema.parse(data) : null
}

/** The remediation exercise for a skill: the first active one, or null. */
export async function chargerExercice(competence: string): Promise<Exercice | null> {
  const { data, error } = await supabase
    .from('exercices')
    .select('*')
    .eq('competence', competence)
    .eq('actif', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? ExerciceSchema.parse(data) : null
}

// The brief (B3) and the recording (B4) of one step ------------------------------------

export interface Brief {
  etape: Etape
  defi: Defi
  acte: Acte
  /** Steps in the act, to say "défi 3 sur 5". */
  nb_etapes_acte: number
}

export const cleBrief = (etapeId: string) => ['brief', etapeId] as const

const LigneBriefSchema = EtapeSchema.extend({ defis: DefiSchema, actes: ActeSchema })

export async function chargerBrief(etapeId: string): Promise<Brief | null> {
  const { data, error } = await supabase
    .from('etapes')
    .select('*, defis(*), actes(*)')
    .eq('id', etapeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { defis, actes, ...etape } = LigneBriefSchema.parse(data)
  const total = await supabase
    .from('etapes')
    .select('id', { count: 'exact', head: true })
    .eq('acte_id', etape.acte_id)
  if (total.error) throw new Error(total.error.message)
  return { etape, defi: defis, acte: actes, nb_etapes_acte: total.count ?? 0 }
}

export function useBrief(etapeId: string | null): UseQueryResult<Brief | null> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: cleBrief(etapeId ?? ''),
    queryFn: () => chargerBrief(etapeId ?? ''),
    enabled: pret && session !== null && etapeId !== null,
    staleTime: 60_000,
  })
}

// The feedback of one take (B5, H2, H3) -----------------------------------------------

export interface Retour {
  id: string
  type: string
  statut: StatutTentative
  resultat: ResultatTentative | null
  enregistre_le: string
  mesures: Mesures | null
  evaluation: {
    note_totale: number | null
    note_max: number | null
    seuil_reussite: number | null
    sous_notes: SousNotes
    points_forts: PointRemarquable[]
    axes_travail: PointRemarquable[]
  } | null
  /** Names of the criteria of the grid used, by key, for the H2 list. */
  criteres: Record<string, string>
  etape: (Etape & { defi: Defi; acte: Acte; nb_etapes_acte: number }) | null
}

export const cleRetour = (tentativeId: string) => ['retour', tentativeId] as const

type LigneRetour = {
  id: string
  type: string
  statut: StatutTentative
  resultat: ResultatTentative | null
  enregistre_le: string
  analyses: { mesures: unknown } | { mesures: unknown }[] | null
  evaluations:
    | {
        grille_id: string | null
        note_totale: number | string | null
        seuil_reussite: number | string | null
        sous_notes: unknown
        points_forts: unknown
        axes_travail: unknown
      }
    | {
        grille_id: string | null
        note_totale: number | string | null
        seuil_reussite: number | string | null
        sous_notes: unknown
        points_forts: unknown
        axes_travail: unknown
      }[]
    | null
  etapes: unknown
}

function nombreOuNull(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined) return null
  const n = Number(valeur)
  return Number.isFinite(n) ? n : null
}

const PointsSchema = z.array(
  z.object({ critere: z.string(), mesure: z.string(), valeur: z.number() }),
)

export async function chargerRetour(tentativeId: string): Promise<Retour | null> {
  const { data, error } = await supabase
    .from('tentatives')
    .select(
      'id, type, statut, resultat, enregistre_le, analyses(mesures), evaluations(grille_id, note_totale, seuil_reussite, sous_notes, points_forts, axes_travail), etapes(*, defis(*), actes(*))',
    )
    .eq('id', tentativeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const ligne = data as unknown as LigneRetour

  const mesuresLues = MesuresSchema.safeParse(un(ligne.analyses)?.mesures)
  const evaluation = un(ligne.evaluations)
  const sousNotes = SousNotesSchema.safeParse(evaluation?.sous_notes)
  const etapeLue = LigneBriefSchema.safeParse(un(ligne.etapes as never))

  let etape: Retour['etape'] = null
  if (etapeLue.success) {
    const { defis, actes, ...reste } = etapeLue.data
    const total = await supabase
      .from('etapes')
      .select('id', { count: 'exact', head: true })
      .eq('acte_id', reste.acte_id)
    etape = { ...reste, defi: defis, acte: actes, nb_etapes_acte: total.count ?? 0 }
  }

  let criteres: Record<string, string> = {}
  if (evaluation?.grille_id) {
    const { data: lignes } = await supabase
      .from('criteres_grille')
      .select('cle, nom')
      .eq('grille_id', evaluation.grille_id)
      .order('ordre')
    criteres = Object.fromEntries(
      ((lignes ?? []) as { cle: string; nom: string }[]).map((c) => [c.cle, c.nom]),
    )
  }

  return {
    id: ligne.id,
    type: ligne.type,
    statut: ligne.statut,
    resultat: ligne.resultat,
    enregistre_le: ligne.enregistre_le,
    mesures: mesuresLues.success ? mesuresLues.data : null,
    evaluation: evaluation
      ? {
          note_totale: nombreOuNull(evaluation.note_totale),
          note_max: noteMax(evaluation.sous_notes),
          seuil_reussite: nombreOuNull(evaluation.seuil_reussite),
          sous_notes: sousNotes.success ? sousNotes.data : {},
          points_forts: PointsSchema.catch([]).parse(evaluation.points_forts),
          axes_travail: PointsSchema.catch([]).parse(evaluation.axes_travail),
        }
      : null,
    criteres,
    etape,
  }
}

export function useRetour(tentativeId: string | null): UseQueryResult<Retour | null> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: cleRetour(tentativeId ?? ''),
    queryFn: () => chargerRetour(tentativeId ?? ''),
    enabled: pret && session !== null && tentativeId !== null,
    staleTime: 0,
  })
}
