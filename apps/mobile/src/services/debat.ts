/**
 * The face-à-face, seen from the phone (E0 to E4). The rules live in the database functions of
 * migrations 0015 and 0016 and in the server's session machine; this file calls them and
 * carries the socket.
 */
import {
  DebatSchema,
  lireRefusDebat,
  QuotaDebatsSchema,
  TheseSchema,
  TranscriptionDebatSchema,
  type Debat,
  type MessageEntrant,
  type MessageSortant,
  type QuotaDebats,
  type RefusDebat,
  type These,
  type TourDebat,
} from '@leq/domaine'
import { useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'

import { t, type CleTexte } from '@/i18n/fr'

import { supabase, useSession } from './supabase'

export type { Debat, These, QuotaDebats, TourDebat, MessageSortant }

export const CLE_THESES = ['theses'] as const
export const CLE_QUOTA_DEBATS = ['quota_debats'] as const
export const CLE_DEBAT_REPRISE = ['debat_a_reprendre'] as const
export const CLE_DEBAT = ['debat'] as const

export class ErreurDebat extends Error {
  constructor(
    readonly refus: RefusDebat | null,
    message: string,
  ) {
    super(message)
  }
}

const MESSAGES_REFUS: Readonly<Record<RefusDebat, CleTexte>> = {
  compte_requis: 'debat.refusCompteRequis',
  compte_suspendu: 'debat.refusCompteSuspendu',
  face_a_face_eteint: 'debat.refusEteint',
  quota_epuise: 'debat.refusQuotaEpuise',
  these_introuvable: 'debat.refusTheseIntrouvable',
  these_requise: 'debat.refusTheseRequise',
  debat_en_cours: 'debat.refusEnCours',
}

export function messageRefus(erreur: unknown): string {
  const refus = erreur instanceof ErreurDebat ? erreur.refus : null
  return t(refus ? MESSAGES_REFUS[refus] : 'debat.refusInconnu')
}

function echouer(message: string): never {
  throw new ErreurDebat(lireRefusDebat(message), message)
}

export async function chargerTheses(nombre = 3): Promise<These[]> {
  const { data, error } = await supabase.rpc('theses_proposees', { p_nombre: nombre })
  if (error) echouer(error.message)
  return z.array(TheseSchema).parse(data ?? [])
}

export async function chargerQuota(): Promise<QuotaDebats> {
  const { data, error } = await supabase.rpc('quota_debats')
  if (error) echouer(error.message)
  return QuotaDebatsSchema.parse(data)
}

/** The session to come back to (E3b), or null. */
export async function chargerDebatAReprendre(): Promise<Debat | null> {
  const { data, error } = await supabase.rpc('debat_a_reprendre')
  if (error) echouer(error.message)
  const ligne = Array.isArray(data) ? (data[0] ?? null) : data
  return ligne ? DebatSchema.parse(ligne) : null
}

export async function ouvrirDebat(options: {
  theseId?: string | null
  theseTexte?: string | null
  ton?: string | null
}): Promise<Debat> {
  const { data, error } = await supabase.rpc('ouvrir_debat', {
    p_these_id: options.theseId ?? null,
    p_these_texte: options.theseTexte ?? null,
    p_ton: options.ton ?? null,
  })
  if (error) echouer(error.message)
  const ligne = Array.isArray(data) ? data[0] : data
  return DebatSchema.parse(ligne)
}

/** The person chose to start another one instead of coming back to the open session. */
export async function abandonnerDebat(): Promise<void> {
  const { error } = await supabase.rpc('abandonner_debat')
  if (error) echouer(error.message)
}

export async function chargerDebat(debatId: string): Promise<Debat | null> {
  const { data, error } = await supabase.from('debats').select('*').eq('id', debatId).maybeSingle()
  if (error) echouer(error.message)
  return data ? DebatSchema.parse(data) : null
}

export async function chargerTranscription(debatId: string): Promise<TourDebat[]> {
  const { data, error } = await supabase.rpc('transcription_debat', { p_debat: debatId })
  if (error) echouer(error.message)
  return TranscriptionDebatSchema.parse(data ?? [])
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

export const useTheses = () => useRequete(CLE_THESES, () => chargerTheses())
export const useQuotaDebats = () => useRequete(CLE_QUOTA_DEBATS, chargerQuota)
export const useDebatAReprendre = () => useRequete(CLE_DEBAT_REPRISE, chargerDebatAReprendre)
export function useDebat(debatId: string) {
  return useRequete([...CLE_DEBAT, debatId], () => chargerDebat(debatId), debatId !== '')
}

export function invaliderDebats(client: QueryClient): void {
  for (const cle of [CLE_THESES, CLE_QUOTA_DEBATS, CLE_DEBAT_REPRISE, CLE_DEBAT]) {
    void client.invalidateQueries({ queryKey: cle })
  }
}

// --------------------------------------------------------------------------------------------
// The socket
// --------------------------------------------------------------------------------------------

/** Where the real-time process lives. The debate is the only thing the phone opens there. */
export function urlDebat(): string {
  const base = process.env.EXPO_PUBLIC_SERVEUR_URL ?? 'https://leq-serveur.fly.dev'
  return `${base.replace(/^http/, 'ws').replace(/\/$/, '')}/debat`
}

export type EtatConnexion = 'connexion' | 'ouverte' | 'fermee'

/**
 * One debate on one socket. It does not interpret anything: it hands every message to the
 * screen, which owns what the person sees. Closing is always deliberate here; a socket that
 * drops by itself is a cut, and the server decides that it was ours.
 */
export class ClientDebat {
  private socket: WebSocket | null = null

  constructor(
    private readonly surMessage: (message: MessageSortant) => void,
    private readonly surEtat: (etat: EtatConnexion) => void,
  ) {}

  ouvrir(jeton: string, debatId: string, depuisTour = 0): void {
    this.surEtat('connexion')
    const socket = new WebSocket(urlDebat())
    this.socket = socket
    socket.onopen = () => {
      this.surEtat('ouverte')
      this.envoyer({ type: 'bonjour', jeton, debat_id: debatId, depuis_tour: depuisTour })
    }
    socket.onmessage = (evenement) => {
      if (typeof evenement.data !== 'string') return
      try {
        this.surMessage(JSON.parse(evenement.data) as MessageSortant)
      } catch {
        // A frame we cannot read is a frame we ignore; the screen keeps its state.
      }
    }
    socket.onclose = () => {
      this.socket = null
      this.surEtat('fermee')
    }
    socket.onerror = () => this.surEtat('fermee')
  }

  envoyer(message: MessageEntrant): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  fermer(): void {
    this.socket?.close()
    this.socket = null
  }
}
