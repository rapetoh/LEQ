/**
 * Recording in the browser, for a duel invitee who has no application.
 *
 * Two things matter here. The microphone is opened with the phone's own processing off, the
 * same way apps/mobile does it, because automatic gain and noise suppression change the very
 * measures the grid reads. And the container is whatever the browser knows how to write:
 * Safari answers mp4/AAC, Chrome and Firefox answer webm/Opus. The worker decodes with ffmpeg,
 * which probes the content and not the file name, so both go through the same pipeline
 * (see apps/serveur/src/audio/decoder.ts).
 */

/** Containers we ask for, best first. The empty string lets the browser choose its default. */
export const TYPES_CANDIDATS = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const

/** First container the browser admits, or null when it admits none of them. */
export function choisirTypeMime(
  supporte: (type: string) => boolean,
  candidats: readonly string[] = TYPES_CANDIDATS,
): string | null {
  return candidats.find((type) => supporte(type)) ?? null
}

export type RaisonMicro = 'refuse' | 'absent' | 'occupe' | 'inconnu'

export class ErreurMicro extends Error {
  constructor(readonly raison: RaisonMicro) {
    super(raison)
  }
}

/** What getUserMedia refused, in terms the page can turn into a sentence. */
export function raisonDe(erreur: unknown): RaisonMicro {
  const nom = (erreur as { name?: string } | null)?.name ?? ''
  if (nom === 'NotAllowedError' || nom === 'SecurityError') return 'refuse'
  if (nom === 'NotFoundError' || nom === 'OverconstrainedError') return 'absent'
  if (nom === 'NotReadableError' || nom === 'AbortError') return 'occupe'
  return 'inconnu'
}

export function navigateurSaitEnregistrer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

export type PriseEnregistree = {
  blob: Blob
  typeMime: string
  dureeS: number
}

export class Enregistreur {
  private flux: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private morceaux: Blob[] = []
  private debutMs = 0

  /** Opens the microphone and starts. Throws ErreurMicro when the browser or the person says no. */
  async demarrer(): Promise<void> {
    if (!navigateurSaitEnregistrer()) throw new ErreurMicro('absent')
    let flux: MediaStream
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      })
    } catch (erreur) {
      throw new ErreurMicro(raisonDe(erreur))
    }

    const typeMime = choisirTypeMime((type) => MediaRecorder.isTypeSupported(type))
    const recorder = new MediaRecorder(flux, typeMime ? { mimeType: typeMime } : undefined)
    this.morceaux = []
    recorder.ondataavailable = (evenement) => {
      if (evenement.data.size > 0) this.morceaux.push(evenement.data)
    }
    this.flux = flux
    this.recorder = recorder
    this.debutMs = performance.now()
    recorder.start(1000)
  }

  get enCours(): boolean {
    return this.recorder?.state === 'recording'
  }

  /** Seconds since the microphone opened. The timer reads this, nothing else. */
  secondes(): number {
    if (!this.recorder) return 0
    return (performance.now() - this.debutMs) / 1000
  }

  /** Stops, closes the microphone and answers the take. */
  async arreter(): Promise<PriseEnregistree> {
    const recorder = this.recorder
    if (!recorder) throw new Error('Aucun enregistrement en cours')
    const dureeS = this.secondes()
    await new Promise<void>((resoudre) => {
      recorder.onstop = () => resoudre()
      if (recorder.state === 'inactive') resoudre()
      else recorder.stop()
    })
    this.fermerFlux()
    const typeMime = recorder.mimeType || this.morceaux[0]?.type || 'audio/webm'
    const blob = new Blob(this.morceaux, { type: typeMime })
    this.recorder = null
    return { blob, typeMime, dureeS }
  }

  /** Gives the microphone back without keeping anything (leaving the page, starting over). */
  annuler(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.recorder = null
    this.morceaux = []
    this.fermerFlux()
  }

  private fermerFlux(): void {
    this.flux?.getTracks().forEach((piste) => piste.stop())
    this.flux = null
  }
}
