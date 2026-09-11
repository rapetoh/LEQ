// debriefer_debat: the note at the end of a face-à-face (cahier chapter 10, screen E4).
//
// It reads the written transcript and nothing else. There is no debate audio anywhere to read,
// which is the whole point of chapter 2: the voice is never kept. Idempotent: a debate that
// already has its note is left alone, so a retry after a crash never rewrites it.
import { z } from 'zod'

import {
  debriefDejaEcrit,
  enregistrerDebrief,
  lireTranscriptionDebat,
  type Executeur,
} from '../db.js'
import type { Adversaire } from '../debat/fournisseurs.js'
import type { HandlerJob } from './types.js'

export interface DependancesDebrief {
  ex: Executeur
  adversaire: Adversaire
}

const SchemaCharge = z.object({ debat_id: z.uuid() })

export function creerHandlerDebrieferDebat(deps: DependancesDebrief): HandlerJob {
  return async (job, contexte) => {
    const charge = SchemaCharge.safeParse(job.charge)
    if (!charge.success) {
      throw new Error(`Invalid charge for debriefer_debat: ${z.prettifyError(charge.error)}`)
    }
    const debatId = charge.data.debat_id
    const journal = contexte.log.child({ debat_id: debatId })

    if (await debriefDejaEcrit(deps.ex, debatId)) {
      journal.info('debriefing deja ecrit')
      return
    }

    const debat = await lireTranscriptionDebat(deps.ex, debatId)
    if (!debat) {
      journal.warn('debat introuvable, rien a debriefer')
      return
    }
    if (debat.tours.length === 0) {
      journal.info('debat sans aucun tour, rien a debriefer')
      return
    }

    const debrief = await deps.adversaire.debriefer({
      these: debat.these,
      ton: debat.ton,
      tours: debat.tours.map((tour) => ({ locuteur: tour.locuteur, texte: tour.texte })),
    })
    await enregistrerDebrief(deps.ex, debatId, debrief.moments, debrief.axe)
    journal.info({ moments: debrief.moments.length }, 'debriefing ecrit')
  }
}
