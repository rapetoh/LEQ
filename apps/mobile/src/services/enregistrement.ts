// Recording a take (ADR-007, path a): react-native-audio-api owns the audio session.
// iOS category "record" in "measurement" mode (no dynamics processing), 16 kHz mono
// M4A in the cache directory (never backed up), a level meter from the raw buffers,
// and an interruption (call, alarm) ends the take instead of pausing it: a take with
// a hole would corrupt the rate windows and the silences.
import {
  AudioManager,
  AudioRecorder,
  BitDepth,
  FileDirectory,
  FileFormat,
  FlacCompressionLevel,
  IOSAudioQuality,
  type AudioEventSubscription,
} from 'react-native-audio-api'

export const FREQUENCE_HZ = 16000
export const DEBIT_BPS = 64000
export const SOUS_DOSSIER = 'leq-prises'
/** 100 ms of audio per level update. */
const TRAME_NIVEAU = 1600

export interface PriseTerminee {
  chemin: string
  duree_s: number
}

export type EcouteurNiveau = (dbfs: number) => void
export type EcouteurInterruption = () => void

export class ErreurEnregistrement extends Error {
  override name = 'ErreurEnregistrement'
}

function dbfs(echantillons: Float32Array): number {
  let somme = 0
  for (let i = 0; i < echantillons.length; i += 1) {
    const v = echantillons[i] ?? 0
    somme += v * v
  }
  if (echantillons.length === 0) return -100
  const rms = Math.sqrt(somme / echantillons.length)
  return rms <= 0 ? -100 : Math.max(-100, 20 * Math.log10(rms))
}

/**
 * One recorder for the whole app. `demarrer` then `arreter` for a take; `annuler`
 * throws the file away. The session is activated for the take and released after.
 */
export class ServiceEnregistrement {
  private recorder: AudioRecorder | null = null
  private abonnementInterruption: AudioEventSubscription | undefined
  private surInterruption: EcouteurInterruption | null = null
  private enCours = false

  private obtenirRecorder(): AudioRecorder {
    if (!this.recorder) {
      this.recorder = new AudioRecorder()
    }
    return this.recorder
  }

  estEnCours(): boolean {
    return this.enCours
  }

  /** Seconds recorded so far, for the on-screen timer. */
  duree(): number {
    return this.recorder?.getCurrentDuration() ?? 0
  }

  async demarrer(
    id: string,
    surNiveau: EcouteurNiveau,
    surInterruption: EcouteurInterruption,
  ): Promise<void> {
    if (this.enCours) throw new ErreurEnregistrement('Un enregistrement est déjà en cours.')
    const recorder = this.obtenirRecorder()

    AudioManager.setAudioSessionOptions({
      iosCategory: 'record',
      iosMode: 'measurement',
      iosOptions: [],
    })
    await AudioManager.setAudioSessionActivity(true)

    const sortie = recorder.enableFileOutput({
      format: FileFormat.M4A,
      channelCount: 1,
      preset: {
        sampleRate: FREQUENCE_HZ,
        bitRate: DEBIT_BPS,
        bitDepth: BitDepth.Bit16,
        iosQuality: IOSAudioQuality.High,
        flacCompressionLevel: FlacCompressionLevel.L5,
      },
      directory: FileDirectory.Cache,
      subDirectory: SOUS_DOSSIER,
      fileNamePrefix: id,
    })
    if (sortie.status === 'error') throw new ErreurEnregistrement(sortie.message)

    recorder.onAudioReady(
      { sampleRate: FREQUENCE_HZ, bufferLength: TRAME_NIVEAU, channelCount: 1 },
      (evenement) => {
        surNiveau(dbfs(evenement.buffer.getChannelData(0)))
      },
    )
    recorder.onError((erreur) => {
      console.warn('enregistrement: erreur native', erreur.message)
    })

    this.surInterruption = surInterruption
    AudioManager.observeAudioInterruptions(true)
    this.abonnementInterruption = AudioManager.addSystemEventListener(
      'interruption',
      (evenement) => {
        if (evenement.type === 'began') this.surInterruption?.()
      },
    )

    const demarrage = await recorder.start({ fileNameOverride: id })
    if (demarrage.status === 'error') {
      await this.liberer()
      throw new ErreurEnregistrement(demarrage.message)
    }
    this.enCours = true
  }

  /** Stops and returns the file. Throws when nothing was recorded. */
  async arreter(): Promise<PriseTerminee> {
    const recorder = this.obtenirRecorder()
    if (!this.enCours) throw new ErreurEnregistrement('Aucun enregistrement en cours.')
    this.enCours = false
    const resultat = await recorder.stop()
    await this.liberer()
    if (resultat.status === 'error') throw new ErreurEnregistrement(resultat.message)
    const chemin = resultat.paths[0]
    if (!chemin || !(resultat.duration > 0)) {
      throw new ErreurEnregistrement('Le fichier de la prise est vide.')
    }
    return { chemin, duree_s: resultat.duration }
  }

  /** Stops without keeping anything usable; the caller deletes the file if one exists. */
  async annuler(): Promise<string | null> {
    if (!this.enCours) return null
    this.enCours = false
    const resultat = await this.obtenirRecorder().stop()
    await this.liberer()
    return resultat.status === 'success' ? (resultat.paths[0] ?? null) : null
  }

  private async liberer(): Promise<void> {
    this.recorder?.clearOnAudioReady()
    this.recorder?.clearOnError()
    this.abonnementInterruption?.remove()
    this.abonnementInterruption = undefined
    this.surInterruption = null
    try {
      await AudioManager.setAudioSessionActivity(false)
    } catch (erreur) {
      console.warn('enregistrement: session non libérée', erreur)
    }
  }
}

export const enregistrement = new ServiceEnregistrement()
