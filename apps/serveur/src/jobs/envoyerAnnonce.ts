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
} from '../db.js'
import { envoyerACesJetons, TAILLE_LOT_PUSH, type EnvoyeurPush } from '../notifications/expoPush.js'
import type { HandlerJob } from './types.js'

export { TAILLE_LOT_PUSH }

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
  const { envoyes, echecs } = await envoyerACesJetons(
    deps,
    jetons,
    { titre: annonce.titre, corps: annonce.corps },
    { annonce_id: annonce.id },
    journal,
  )
  await ecrireResultatAnnonce(deps.ex, annonceId, jetons.length, envoyes, echecs)
  journal.info({ destinataires: jetons.length, envoyes, echecs }, 'annonce envoyee')
  return { destinataires: jetons.length, envoyes, echecs }
}
