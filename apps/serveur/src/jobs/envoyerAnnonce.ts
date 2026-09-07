// envoyer_annonce: one of Rebecca's announcements (cahier chapter 12), pushed once to the
// people who keep the switch on, in the regions it concerns, and not suspended. The cap and
// the filter were already enforced by publier_annonce(); this job only delivers and counts.
// Idempotent: the announcement is claimed (destinataires written) before the first push leaves,
// so a retry after a crash mid-way never sends it twice; the counts land at the end.
import { z } from 'zod'
import {
  ecrireResultatAnnonce,
  lireAnnonce,
  listerJetonsPourAnnonce,
  reserverAnnonce,
  type Executeur,
  type JetonDestinataire,
} from '../db.js'
import {
  marquerJeton,
  type EnvoyeurPush,
  type ReponseExpoTicket,
} from '../notifications/expoPush.js'
import type { HandlerJob } from './types.js'

export const TAILLE_LOT_PUSH = 100

export interface DependancesAnnonce {
  ex: Executeur
  envoyer: EnvoyeurPush
}

const SchemaCharge = z.object({ annonce_id: z.uuid() })

export function creerHandlerEnvoyerAnnonce(deps: DependancesAnnonce): HandlerJob {
  return async (job, contexte) => {
    const charge = SchemaCharge.safeParse(job.charge)
    if (!charge.success) {
      throw new Error(`Invalid charge for envoyer_annonce: ${z.prettifyError(charge.error)}`)
    }
    await envoyerAnnonce(deps, charge.data.annonce_id, contexte.log)
  }
}

export interface BilanAnnonce {
  destinataires: number
  envoyes: number
  echecs: number
}

export async function envoyerAnnonce(
  deps: DependancesAnnonce,
  annonceId: string,
  log: import('../log.js').Logger,
): Promise<BilanAnnonce> {
  const journal = log.child({ annonce_id: annonceId })
  const annonce = await lireAnnonce(deps.ex, annonceId)
  if (!annonce) {
    journal.warn('annonce introuvable, rien a envoyer')
    return { destinataires: 0, envoyes: 0, echecs: 0 }
  }
  if (annonce.destinataires !== null) {
    journal.info({ envoyes: annonce.envoyes }, 'annonce deja envoyee')
    return {
      destinataires: annonce.destinataires,
      envoyes: annonce.envoyes,
      echecs: annonce.echecs,
    }
  }

  const jetons = await listerJetonsPourAnnonce(deps.ex, annonce.regions)
  if (!(await reserverAnnonce(deps.ex, annonceId, jetons.length))) {
    journal.info('annonce reservee par un autre passage, rien a envoyer')
    return { destinataires: jetons.length, envoyes: 0, echecs: 0 }
  }
  let envoyes = 0
  let echecs = 0
  for (let debut = 0; debut < jetons.length; debut += TAILLE_LOT_PUSH) {
    const lot = jetons.slice(debut, debut + TAILLE_LOT_PUSH)
    const bilan = await envoyerLot(deps, lot, annonce, journal)
    envoyes += bilan.envoyes
    echecs += bilan.echecs
  }
  await ecrireResultatAnnonce(deps.ex, annonceId, jetons.length, envoyes, echecs)
  journal.info({ destinataires: jetons.length, envoyes, echecs }, 'annonce envoyee')
  return { destinataires: jetons.length, envoyes, echecs }
}

async function envoyerLot(
  deps: DependancesAnnonce,
  lot: JetonDestinataire[],
  annonce: { id: string; titre: string; corps: string },
  journal: import('../log.js').Logger,
): Promise<{ envoyes: number; echecs: number }> {
  let tickets: ReponseExpoTicket[]
  try {
    tickets = await deps.envoyer(
      lot.map((j) => ({
        to: j.jeton,
        title: annonce.titre,
        body: annonce.corps,
        data: { annonce_id: annonce.id },
      })),
    )
  } catch (erreur) {
    journal.error({ err: erreur, taille: lot.length }, 'push: envoi du lot impossible')
    return { envoyes: 0, echecs: lot.length }
  }
  let envoyes = 0
  let echecs = 0
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
  return { envoyes, echecs }
}
