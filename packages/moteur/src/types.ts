/**
 * Core signal types of the measurement engine.
 * Everything here is plain data: no I/O, no provider, no side effects.
 */

/** Mono PCM audio, samples in [-1, 1]. */
export interface Pcm {
  echantillons: Float32Array
  frequence_hz: number
}

/**
 * Prosody tracks sampled on a fixed grid of `pas_s` seconds.
 * `f0_hz[i]` is null on unvoiced or silent frames; `intensite_db[i]` is null when
 * the extractor could not measure the frame (never for the stub).
 * Frame i covers [i * pas_s, (i + 1) * pas_s).
 */
export interface PistesProsodie {
  pas_s: number
  f0_hz: (number | null)[]
  intensite_db: (number | null)[]
}

/** A closed time interval in seconds. */
export interface Intervalle {
  debut_s: number
  fin_s: number
}
