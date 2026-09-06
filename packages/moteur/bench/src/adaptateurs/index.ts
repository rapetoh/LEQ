import type { AdaptateurBench } from './commun.js'
import { adaptateur as assemblyai } from './assemblyai.js'
import { adaptateur as deepgram } from './deepgram.js'
import { adaptateur as gladia } from './gladia.js'
import { adaptateur as openai } from './openai.js'
import { adaptateur as stub } from './stub.js'

export const ADAPTATEURS: Record<string, AdaptateurBench> = {
  stub,
  deepgram,
  gladia,
  openai,
  assemblyai,
}
export { ErreurCleManquante, type AdaptateurBench, type FicheFournisseur } from './commun.js'
