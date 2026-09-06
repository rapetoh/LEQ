/**
 * Synthetic fixtures generated in code: sine bursts, silences, handcrafted timed
 * transcripts and prosody tracks. Used by the unit tests and by the server's own tests.
 */
import type { MotTranscrit, Transcription } from '../domaine.js'
import type { Pcm, PistesProsodie } from '../types.js'

export const FREQUENCE_FIXTURE_HZ = 16000

export type SegmentAudio =
  | { type: 'ton'; duree_s: number; amplitude: number; frequence_hz?: number }
  | { type: 'silence'; duree_s: number }

/** Concatenates tones and silences into one mono PCM buffer. */
export function construirePcm(
  segments: readonly SegmentAudio[],
  frequence_hz = FREQUENCE_FIXTURE_HZ,
): Pcm {
  const total = segments.reduce((a, s) => a + Math.round(s.duree_s * frequence_hz), 0)
  const echantillons = new Float32Array(total)
  let position = 0
  for (const segment of segments) {
    const n = Math.round(segment.duree_s * frequence_hz)
    if (segment.type === 'ton') {
      const f = segment.frequence_hz ?? 220
      for (let i = 0; i < n; i++) {
        echantillons[position + i] =
          segment.amplitude * Math.sin((2 * Math.PI * f * i) / frequence_hz)
      }
    }
    position += n
  }
  return { echantillons, frequence_hz }
}

/** Pure silence of the given length. */
export function silence(duree_s: number, frequence_hz = FREQUENCE_FIXTURE_HZ): Pcm {
  return construirePcm([{ type: 'silence', duree_s }], frequence_hz)
}

/** A sine burst; amplitude 0.5 is about -9 dBFS RMS, 0.1 about -23 dBFS. */
export function sinus(duree_s: number, amplitude = 0.5, frequence_hz = 220): Pcm {
  return construirePcm([{ type: 'ton', duree_s, amplitude, frequence_hz }])
}

/** Builds timed words from `[texte, debut_s, fin_s]` triples. */
export function construireMots(
  triplets: readonly (readonly [string, number, number])[],
  confiance = 0.95,
): MotTranscrit[] {
  return triplets.map(([mot, debut_s, fin_s]) => ({ mot, debut_s, fin_s, confiance }))
}

export function construireTranscription(
  triplets: readonly (readonly [string, number, number])[],
): Transcription {
  const mots = construireMots(triplets)
  return { texte: mots.map((m) => m.mot).join(' '), mots }
}

/**
 * Lays out words at a regular pace: each word lasts `duree_mot_s`, words inside a group are
 * `ecart_s` apart, groups are separated by the given pauses. Returns the words and the time
 * where the layout ends. Useful to build a transcript with known gap structure.
 */
export function disposerMots(
  groupes: readonly { mots: readonly string[]; pause_apres_s: number }[],
  options: { debut_s?: number; duree_mot_s?: number; ecart_s?: number } = {},
): { mots: MotTranscrit[]; fin_s: number } {
  const duree_mot_s = options.duree_mot_s ?? 0.3
  const ecart_s = options.ecart_s ?? 0.1
  let t = options.debut_s ?? 0
  const mots: MotTranscrit[] = []
  for (const groupe of groupes) {
    for (let i = 0; i < groupe.mots.length; i++) {
      const debut_s = r(t)
      const fin_s = r(t + duree_mot_s)
      mots.push({ mot: groupe.mots[i] as string, debut_s, fin_s, confiance: 0.95 })
      t = fin_s + (i + 1 < groupe.mots.length ? ecart_s : 0)
    }
    t += groupe.pause_apres_s
  }
  return { mots, fin_s: r(t) }
}

/** Prosody tracks from a list of F0 spans, null elsewhere. Intensity is constant. */
export function construireProsodie(
  duree_s: number,
  spans: readonly { debut_s: number; fin_s: number; f0_hz: number }[],
  pas_s = 0.01,
): PistesProsodie {
  const n = Math.round(duree_s / pas_s)
  const f0_hz: (number | null)[] = new Array<number | null>(n).fill(null)
  const intensite_db: (number | null)[] = new Array<number | null>(n).fill(-60)
  for (const span of spans) {
    for (
      let i = Math.round(span.debut_s / pas_s);
      i < Math.round(span.fin_s / pas_s) && i < n;
      i++
    ) {
      f0_hz[i] = span.f0_hz
      intensite_db[i] = -20
    }
  }
  return { pas_s, f0_hz, intensite_db }
}

/**
 * A complete handcrafted take of 30 s, with known ground truth, used by `mesurer` tests:
 * - 1.5 s of leading silence, then four sentences;
 * - fillers: "euh" x2, "du coup" x1;
 * - one restart "on va on va" and one repetition "je je";
 * - one held pause of 1.2 s between sentences 2 and 3, one 0.5 s pause mid sentence 3;
 * - audio: tone bursts under each word, the last word of sentence 4 is 12 dB quieter.
 */
export function priseSynthetique(): {
  pcm: Pcm
  transcription: Transcription
  prosodie: PistesProsodie
  verite: {
    duree_totale_s: number
    temps_avant_demarrage_s: number
    nb_mots: number
    silences: number
    tenus: number
    bequilles: number
    reprises: number
    repetitions_total: number
    phrases: number
    chutes_attendues: number
  }
} {
  const groupes = [
    { mots: ['Bonjour', 'à', 'tous,'], pause_apres_s: 0.4 },
    { mots: ['euh', 'merci', "d'être", 'là.'], pause_apres_s: 0.6 },
    {
      mots: ['Je', 'je', 'vais', 'vous', 'parler', 'du', 'coup', "d'un", 'projet.'],
      pause_apres_s: 1.2,
    },
    { mots: ['On', 'va,', 'on', 'va', 'commencer', 'par'], pause_apres_s: 0.5 },
    { mots: ['le', 'début', 'euh', 'de', "l'histoire."], pause_apres_s: 0.7 },
    { mots: ['Merci', 'pour', 'votre', 'attention.'], pause_apres_s: 0 },
  ]
  const { mots, fin_s } = disposerMots(groupes, { debut_s: 1.5, duree_mot_s: 0.3, ecart_s: 0.1 })
  const duree_totale_s = 30
  if (fin_s > duree_totale_s) throw new Error('fixture trop longue')

  // Audio: a tone under every word, silence elsewhere; the final word is 12 dB quieter.
  const segments: SegmentAudio[] = []
  let t = 0
  const dernier = mots[mots.length - 1] as MotTranscrit
  for (const mot of mots) {
    if (mot.debut_s > t) segments.push({ type: 'silence', duree_s: mot.debut_s - t })
    const amplitude = mot === dernier ? 0.5 / 4 : 0.5
    segments.push({ type: 'ton', duree_s: mot.fin_s - mot.debut_s, amplitude })
    t = mot.fin_s
  }
  segments.push({ type: 'silence', duree_s: duree_totale_s - t })
  const pcm = construirePcm(segments)

  const prosodie = construireProsodie(
    duree_totale_s,
    mots.map((m, i) => ({ debut_s: m.debut_s, fin_s: m.fin_s, f0_hz: 110 * 2 ** ((i % 5) / 12) })),
  )

  return {
    pcm,
    transcription: { texte: mots.map((m) => m.mot).join(' '), mots },
    prosodie,
    verite: {
      duree_totale_s,
      temps_avant_demarrage_s: 1.5,
      nb_mots: mots.length,
      silences: 5,
      tenus: 1,
      bequilles: 3,
      reprises: 1,
      repetitions_total: 2,
      phrases: 4,
      chutes_attendues: 1,
    },
  }
}

function r(v: number): number {
  return Math.round(v * 1000) / 1000
}
