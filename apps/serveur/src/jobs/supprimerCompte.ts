// supprimer_compte: every storage object of the user in both buckets, then the
// auth user. Postgres cascades from auth.users to profils, tentatives, analyses,
// evaluations. Idempotent: an already deleted user is a success.
import { z } from 'zod'
import { listerObjetsStockage, type Executeur } from '../db.js'
import type { Logger } from '../log.js'
import { BUCKETS, type Comptes, type Stockage } from '../stockage.js'
import type { HandlerJob } from './types.js'

export interface DependancesSuppressionCompte {
  ex: Executeur
  stockage: Stockage
  comptes: Comptes
}

const SchemaCharge = z.object({ utilisateur_id: z.uuid() })

export function creerHandlerSupprimerCompte(deps: DependancesSuppressionCompte): HandlerJob {
  return async (job, contexte) => {
    const charge = SchemaCharge.safeParse(job.charge)
    if (!charge.success) {
      throw new Error(`Invalid charge for supprimer_compte: ${z.prettifyError(charge.error)}`)
    }
    await supprimerDonneesUtilisateur(deps, charge.data.utilisateur_id, contexte.log)
  }
}

/** Deletes the storage objects of one user in every bucket, then the auth user. */
export async function supprimerDonneesUtilisateur(
  deps: DependancesSuppressionCompte,
  utilisateurId: string,
  log: Logger,
): Promise<void> {
  const journal = log.child({ utilisateur_id: utilisateurId })
  for (const bucket of BUCKETS) {
    const objets = await listerObjetsStockage(deps.ex, bucket, { prefixe: `${utilisateurId}/` })
    if (objets.length === 0) continue
    await deps.stockage.supprimer(
      bucket,
      objets.map((o) => o.name),
    )
    journal.info({ bucket, objets: objets.length }, 'objets supprimes')
  }
  const resultat = await deps.comptes.supprimerUtilisateur(utilisateurId)
  journal.info({ resultat }, 'utilisateur supprime')
}
