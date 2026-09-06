/**
 * Prosody boundary: pitch (F0) and intensity tracks out of PCM.
 * The real extractor is the Praat CLI (parselmouth) in `apps/serveur/prosodie`, out of
 * scope here. The stub below makes silence-aware fake tracks so measures can run end to end.
 */
import { dbfs } from './stats.js'
import type { Pcm, PistesProsodie } from './types.js'

export interface ExtracteurProsodie {
  extraire(pcm: Pcm): Promise<PistesProsodie>
}

export interface OptionsProsodieStub {
  /** Frame step of the tracks. Praat's default is 10 ms. */
  pas_s?: number
  /** Frames below this level (dBFS) are unvoiced: `f0_hz` is null there. */
  seuil_silence_db?: number
  /** Base pitch of the fake voice. */
  f0_base_hz?: number
  /** Amplitude of the slow fake intonation, in semitones. */
  variation_demi_tons?: number
}

/**
 * Fake tracks: intensity is the real RMS of each frame; F0 is a slow, smooth modulation
 * around a base pitch on frames that carry signal, null on silent frames. Pitch is NOT
 * measured from the signal (a 200 Hz sine will not read as 200 Hz): only the voiced/unvoiced
 * pattern and the intensity are meaningful.
 */
export class ProsodieStub implements ExtracteurProsodie {
  private readonly options: Required<OptionsProsodieStub>

  constructor(options: OptionsProsodieStub = {}) {
    this.options = {
      pas_s: options.pas_s ?? 0.01,
      seuil_silence_db: options.seuil_silence_db ?? -50,
      f0_base_hz: options.f0_base_hz ?? 120,
      variation_demi_tons: options.variation_demi_tons ?? 3,
    }
  }

  async extraire(pcm: Pcm): Promise<PistesProsodie> {
    return extraireProsodieStub(pcm, this.options)
  }
}

export function extraireProsodieStub(
  pcm: Pcm,
  options: Required<OptionsProsodieStub>,
): PistesProsodie {
  const { pas_s, seuil_silence_db, f0_base_hz, variation_demi_tons } = options
  const parPas = Math.max(1, Math.round(pas_s * pcm.frequence_hz))
  const nbTrames = Math.floor(pcm.echantillons.length / parPas)
  const f0_hz: (number | null)[] = new Array<number | null>(nbTrames)
  const intensite_db: (number | null)[] = new Array<number | null>(nbTrames)
  for (let i = 0; i < nbTrames; i++) {
    const niveau = dbfs(pcm.echantillons, i * parPas, (i + 1) * parPas)
    intensite_db[i] = Math.round(niveau * 100) / 100
    if (niveau < seuil_silence_db) {
      f0_hz[i] = null
    } else {
      // one slow cycle every 3 s, like a declarative intonation contour
      const t = i * pas_s
      const demiTons = variation_demi_tons * Math.sin((2 * Math.PI * t) / 3)
      f0_hz[i] = Math.round(f0_base_hz * 2 ** (demiTons / 12) * 100) / 100
    }
  }
  return { pas_s, f0_hz, intensite_db }
}
