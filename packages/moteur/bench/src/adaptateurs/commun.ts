import type { Transcripteur } from '../../../src/transcripteur.js'

/** What the report needs to know about a provider beyond its transcripts. */
export interface FicheFournisseur {
  nom: string
  /** Public list price, in euros per minute of audio, at the time of the bench. */
  cout_euros_par_minute: number | null
  /** Whether processing can be pinned to the European Union. */
  traitement_ue: 'oui' | 'non' | 'inconnu'
  /** Retention terms for audio and transcripts. */
  retention: string
  variableCle: string | null
}

export class ErreurCleManquante extends Error {
  override name = 'ErreurCleManquante'
  constructor(fournisseur: string, variable: string) {
    super(`Clé API manquante pour ${fournisseur} : définis ${variable}.`)
  }
}

export interface AdaptateurBench {
  fiche: FicheFournisseur
  /** Builds the transcriber, or throws ErreurCleManquante. */
  creer(env: NodeJS.ProcessEnv): Transcripteur
}

export function lireCle(env: NodeJS.ProcessEnv, fournisseur: string, variable: string): string {
  const cle = env[variable]
  if (!cle || cle.trim() === '') throw new ErreurCleManquante(fournisseur, variable)
  return cle
}
