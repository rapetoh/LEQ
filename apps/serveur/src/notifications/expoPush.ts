// "Ton retour est prêt": one push through Expo's push API to every active token of the
// person, right after retour_disponible. One attempt, errors recorded on the token row,
// never retried in a loop (docs/DATA-MODEL.md, "Push message").
import { MESSAGE_RETOUR_PRET } from '@leq/domaine'
import type { Executeur, JetonDestinataire } from '../db.js'
import type { Logger } from '../log.js'

/** Expo accepts at most a hundred messages per call. */
export const TAILLE_LOT_PUSH = 100

export const URL_EXPO_PUSH = 'https://exp.host/--/api/v2/push/send'

export interface JetonActif {
  id: string
  jeton: string
}

export interface ReponseExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

/** Active tokens of a user (never switched off by a previous DeviceNotRegistered). */
export async function listerJetonsActifs(
  ex: Executeur,
  utilisateurId: string,
): Promise<JetonActif[]> {
  const { rows } = await ex.query(
    'select id, jeton from public.jetons_push where utilisateur_id = $1 and desactive_le is null order by cree_le',
    [utilisateurId],
  )
  return rows.map((r) => ({ id: String(r['id']), jeton: String(r['jeton']) }))
}

export async function marquerJeton(
  ex: Executeur,
  id: string,
  erreur: string | null,
  desactiver: boolean,
): Promise<void> {
  await ex.query(
    `update public.jetons_push
        set derniere_erreur = $2,
            desactive_le = case when $3 then coalesce(desactive_le, now()) else desactive_le end
      where id = $1`,
    [id, erreur, desactiver],
  )
}

export type EnvoyeurPush = (
  messages: Array<{ to: string; title: string; body: string; data: unknown }>,
) => Promise<ReponseExpoTicket[]>

/** Sends through Expo's HTTP API. Exported so tests can inject a fake. */
export const envoyerViaExpo: EnvoyeurPush = async (messages) => {
  const reponse = await fetch(URL_EXPO_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })
  if (!reponse.ok) throw new Error(`Expo push HTTP ${reponse.status}`)
  const corps = (await reponse.json()) as { data?: ReponseExpoTicket[] }
  return corps.data ?? []
}

export interface DependancesPush {
  ex: Executeur
  envoyer: EnvoyeurPush
  log: Logger
}

/**
 * Notifies the person that their feedback is ready. Never throws: a push that fails must
 * not fail the analysis job that already succeeded.
 */
export async function notifierRetourPret(
  deps: DependancesPush,
  utilisateurId: string,
  tentativeId: string,
): Promise<{ envoyes: number; echecs: number }> {
  let jetons: JetonActif[]
  try {
    jetons = await listerJetonsActifs(deps.ex, utilisateurId)
  } catch (erreur) {
    deps.log.error({ err: erreur }, 'push: jetons illisibles')
    return { envoyes: 0, echecs: 0 }
  }
  if (jetons.length === 0) return { envoyes: 0, echecs: 0 }

  let tickets: ReponseExpoTicket[]
  try {
    tickets = await deps.envoyer(
      jetons.map((j) => ({
        to: j.jeton,
        title: MESSAGE_RETOUR_PRET.titre,
        body: MESSAGE_RETOUR_PRET.corps,
        data: { tentative_id: tentativeId },
      })),
    )
  } catch (erreur) {
    deps.log.error({ err: erreur, utilisateur_id: utilisateurId }, 'push: envoi impossible')
    return { envoyes: 0, echecs: jetons.length }
  }

  let envoyes = 0
  let echecs = 0
  for (let i = 0; i < jetons.length; i += 1) {
    const jeton = jetons[i]
    const ticket = tickets[i]
    if (!jeton) continue
    if (ticket?.status === 'ok') {
      envoyes += 1
      await marquerJeton(deps.ex, jeton.id, null, false).catch(() => undefined)
      continue
    }
    echecs += 1
    const detail = ticket?.details?.error ?? ticket?.message ?? 'reponse absente'
    const perime = ticket?.details?.error === 'DeviceNotRegistered'
    await marquerJeton(deps.ex, jeton.id, detail, perime).catch(() => undefined)
    deps.log.warn({ jeton_id: jeton.id, detail, perime }, 'push: jeton en erreur')
  }
  return { envoyes, echecs }
}

/**
 * Sends one message to a list of tokens, a hundred at a time, and records on every token row
 * what came back. Never throws: a campaign that fails must not fail the job that produced it,
 * and a token that Expo no longer knows is switched off rather than retried forever.
 */
export async function envoyerACesJetons(
  deps: { ex: Executeur; envoyer: EnvoyeurPush },
  jetons: JetonDestinataire[],
  message: { titre: string; corps: string },
  data: unknown,
  journal: Logger,
): Promise<{ envoyes: number; echecs: number }> {
  let envoyes = 0
  let echecs = 0
  for (let debut = 0; debut < jetons.length; debut += TAILLE_LOT_PUSH) {
    const lot = jetons.slice(debut, debut + TAILLE_LOT_PUSH)
    let tickets: ReponseExpoTicket[]
    try {
      tickets = await deps.envoyer(
        lot.map((j) => ({ to: j.jeton, title: message.titre, body: message.corps, data })),
      )
    } catch (erreur) {
      journal.error({ err: erreur, taille: lot.length }, 'push: envoi du lot impossible')
      echecs += lot.length
      continue
    }
    for (let i = 0; i < lot.length; i += 1) {
      const jeton = lot[i]
      const ticket = tickets[i]
      if (!jeton) continue
      if (ticket?.status === 'ok') {
        envoyes += 1
        await marquerJeton(deps.ex, jeton.id, null, false).catch(() => undefined)
        continue
      }
      echecs += 1
      const detail = ticket?.details?.error ?? ticket?.message ?? 'reponse absente'
      const perime = ticket?.details?.error === 'DeviceNotRegistered'
      await marquerJeton(deps.ex, jeton.id, detail, perime).catch(() => undefined)
    }
  }
  return { envoyes, echecs }
}
