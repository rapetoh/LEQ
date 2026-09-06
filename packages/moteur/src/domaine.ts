/**
 * Single bridge to `@leq/domaine`.
 *
 * Every import from the domain package goes through this file so that a naming
 * mismatch with the contract (docs/DATA-MODEL.md) is fixed in one place at
 * integration time. Expected exports of `@leq/domaine`:
 * - type `Transcription`: `{ texte: string, mots: { mot, debut_s, fin_s, confiance }[] }`
 * - type `MesuresV1`: the `analyses.mesures` shape, version 1
 * - `MesuresV1Schema`: the Zod schema for `MesuresV1`
 */
export { MesuresV1Schema } from '@leq/domaine'
export type { MesuresV1, Transcription } from '@leq/domaine'

import type { Transcription } from '@leq/domaine'

/** One timed word of a transcript, derived from the domain type. */
export type MotTranscrit = Transcription['mots'][number]
