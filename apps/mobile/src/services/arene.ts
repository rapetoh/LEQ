// The Arena and duels, seen from the phone (C1 to C8). Everything goes through the database
// functions of migration 0010: the rules are there, not here. The tab only exists when the
// `arene` flag is on, and "Mes duels" only when `duels` is on.
import {
  ClassementAreneSchema,
  DuelParJetonSchema,
  DuelSchema,
  lireRefusArene,
  PaireAVoterSchema,
  PrisePubliqueSchema,
  SujetAreneSchema,
  type ClassementArene,
  type Duel,
  type PaireAVoter,
  type PrisePublique,
  type RefusArene,
  type SujetArene,
} from '@leq/domaine'

export type { PaireAVoter, RefusArene, SujetArene, Duel, ClassementArene, PrisePublique }
import { useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'

import { t, type CleTexte } from '@/i18n/fr'

import { supabase, useSession } from './supabase'

export const CLE_SUJET = ['sujet_arene'] as const
export const CLE_MA_PRISE = ['ma_prise_arene'] as const
export const CLE_CLASSEMENT = ['classement_arene'] as const
export const CLE_PAIRE = ['paire_a_voter'] as const
export const CLE_DUELS = ['duels'] as const

export class ErreurArene extends Error {
  constructor(
    readonly refus: RefusArene | null,
    message: string,
  ) {
    super(message)
  }
}

const MESSAGES_REFUS: Readonly<Record<RefusArene, CleTexte>> = {
  compte_requis: 'arene.refusCompteRequis',
  compte_suspendu: 'arene.refusCompteSuspendu',
  tentative_introuvable: 'arene.refusInconnu',
  type_incompatible: 'arene.refusInconnu',
  analyse_incomplete: 'arene.refusAnalyseIncomplete',
  aucun_sujet: 'arene.refusAucunSujet',
  duel_introuvable: 'arene.refusInconnu',
  deja_vote: 'arene.refusDejaVote',
  vote_sur_soi: 'arene.refusVoteSurSoi',
  parle_d_abord: 'arene.refusParleDAbord',
  paire_invalide: 'arene.refusInconnu',
  prise_introuvable: 'arene.refusInconnu',
  duel_clos: 'arene.refusDuelClos',
  duel_expire: 'arene.refusDuelExpire',
  duel_sur_soi: 'arene.refusDuelSurSoi',
  duel_complet: 'arene.refusDuelComplet',
  sujet_requis: 'arene.duelErreur',
}

/** The sentence to show for a refusal of the database, in the person's words. */
export function messageRefus(erreur: unknown): string {
  const refus = erreur instanceof ErreurArene ? erreur.refus : null
  return t(refus ? MESSAGES_REFUS[refus] : 'arene.refusInconnu')
}

function echouer(message: string): never {
  throw new ErreurArene(lireRefusArene(message), message)
}

/** The subject of the week, or null when the bank is empty. */
export async function chargerSujet(): Promise<SujetArene | null> {
  const { data, error } = await supabase.rpc('sujet_arene_actif')
  if (error) echouer(error.message)
  const ligne = Array.isArray(data) ? (data[0] ?? null) : data
  return ligne ? SujetAreneSchema.parse(ligne) : null
}

/** The caller's own take on the active subject, if they have spoken. */
export async function chargerMaPrise(sujetId: string | null): Promise<PrisePublique | null> {
  if (!sujetId) return null
  const { data: session } = await supabase.auth.getSession()
  const uid = session.session?.user.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('prises_publiques')
    .select('*')
    .eq('sujet_id', sujetId)
    .eq('utilisateur_id', uid)
    .maybeSingle()
  if (error) echouer(error.message)
  return data ? PrisePubliqueSchema.parse(data) : null
}

export async function chargerClassement(): Promise<ClassementArene> {
  const { data, error } = await supabase.rpc('classement_arene')
  if (error) echouer(error.message)
  return ClassementAreneSchema.parse(data)
}

export async function chargerPaire(): Promise<PaireAVoter> {
  const { data, error } = await supabase.rpc('paire_a_voter')
  if (error) echouer(error.message)
  return PaireAVoterSchema.parse(data)
}

export async function voter(gagnante: string, perdante: string): Promise<void> {
  const { error } = await supabase.rpc('voter', { p_gagnante: gagnante, p_perdante: perdante })
  if (error) echouer(error.message)
}

/** Makes an analysed take public: the deliberate gesture of chapter 11. */
export async function publierPrise(tentativeId: string): Promise<string> {
  const { data, error } = await supabase.rpc('publier_prise', { p_tentative_id: tentativeId })
  if (error) echouer(error.message)
  return z.uuid().parse(data)
}

export async function chargerDuels(): Promise<Duel[]> {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .order('cree_le', { ascending: false })
  if (error) echouer(error.message)
  return z.array(DuelSchema).parse(data)
}

export async function creerDuel(sujet: string): Promise<Duel> {
  const { data, error } = await supabase.rpc('creer_duel', { p_sujet: sujet })
  if (error) echouer(error.message)
  const ligne = Array.isArray(data) ? data[0] : data
  return DuelSchema.parse(ligne)
}

export async function lireDuelParJeton(jeton: string) {
  const { data, error } = await supabase.rpc('lire_duel_par_jeton', { p_jeton: jeton })
  if (error) echouer(error.message)
  return DuelParJetonSchema.parse(data)
}

export async function rejoindreDuel(jeton: string): Promise<string> {
  const { data, error } = await supabase.rpc('rejoindre_duel', { p_jeton: jeton })
  if (error) echouer(error.message)
  return z.uuid().parse(data)
}

function useRequete<T>(
  cle: readonly string[],
  charger: () => Promise<T>,
  actif = true,
): UseQueryResult<T> {
  const { pret, session } = useSession()
  return useQuery({
    queryKey: cle,
    queryFn: charger,
    enabled: pret && session !== null && actif,
    staleTime: 60_000,
  })
}

export const useSujet = () => useRequete(CLE_SUJET, chargerSujet)
export const useClassement = () => useRequete(CLE_CLASSEMENT, chargerClassement)
export const useDuels = (actif = true) => useRequete(CLE_DUELS, chargerDuels, actif)
export function useMaPrise(sujetId: string | null) {
  return useRequete(
    [...CLE_MA_PRISE, sujetId ?? ''],
    () => chargerMaPrise(sujetId),
    sujetId !== null,
  )
}

export function invaliderArene(client: QueryClient): void {
  for (const cle of [CLE_SUJET, CLE_MA_PRISE, CLE_CLASSEMENT, CLE_PAIRE, CLE_DUELS]) {
    void client.invalidateQueries({ queryKey: cle })
  }
}

/** "Jour 3 sur 7" of the mockup: which day of the subject's week we are on. */
export function jourDuSujet(
  sujet: Pick<SujetArene, 'actif_le'>,
  jours = 7,
  maintenant = new Date(),
): number {
  if (!sujet.actif_le) return 1
  const debut = Date.parse(sujet.actif_le)
  if (!Number.isFinite(debut)) return 1
  const passes = Math.floor((maintenant.getTime() - debut) / 86_400_000)
  return Math.min(Math.max(passes + 1, 1), jours)
}
