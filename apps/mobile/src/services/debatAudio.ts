/**
 * The audio of a face-à-face (ADR-007, path b). One library owns the session, as everywhere
 * else on the phone.
 *
 * Uplink: raw 16 kHz mono frames from the microphone, turned into Int16 little-endian and sent
 * as base64 on the socket. Downlink: PCM chunks from the server played through a buffer queue,
 * so Rétor starts speaking before the whole answer has been synthesised. Most of the two-second
 * budget of chapter 10 is bought right there.
 *
 * Turn taking is half duplex in v1: while Rétor speaks, the microphone keeps running but its
 * frames are not sent. Stopping the recorder instead would flip the audio session on every
 * turn, and interrupting Rétor needs echo cancellation that is not dependable on both platforms.
 */
import {
  AudioContext,
  AudioManager,
  AudioRecorder,
  type AudioBufferQueueSourceNode,
  type AudioEventSubscription,
} from 'react-native-audio-api'

import {
  depuisBase64,
  depuisInt16,
  enBase64,
  FREQUENCE_DEBAT_HZ,
  FREQUENCE_VOIX_HZ,
  TRAME_DEBAT,
  versInt16,
} from './pcm'

export * from './pcm'

export class ErreurDebatAudio extends Error {
  override name = 'ErreurDebatAudio'
}

export type EcouteurTrame = (donneesBase64: string) => void
/** Why the microphone stopped feeding the debate, and whether it came back. */
export type EtatMicro = 'coupe' | 'revenu'
export type EcouteurInterruption = (etat: EtatMicro) => void

/**
 * The microphone and the speaker of one debate. `demarrer` opens both, `muet` decides whether
 * frames leave the phone, `arreter` gives the session back.
 */
export class AudioDebat {
  private recorder: AudioRecorder | null = null
  private contexte: AudioContext | null = null
  private fileVoix: AudioBufferQueueSourceNode | null = null
  private abonnementInterruption: AudioEventSubscription | undefined
  private envoiActif = false
  private ouvert = false
  /**
   * Set as soon as `arreter` is called, even while `demarrer` is still awaiting the native
   * layer. Leaving the screen during that window used to leave a running recorder on an object
   * nobody held any more: the microphone stayed claimed and iOS kept showing its indicator.
   */
  private abandonne = false
  private surInterruption: EcouteurInterruption | null = null

  async demarrer(surTrame: EcouteurTrame, surInterruption: EcouteurInterruption): Promise<void> {
    if (this.ouvert) return
    this.abandonne = false
    this.surInterruption = surInterruption
    try {
      // playAndRecord in voiceChat: Apple's voice processing is welcome here, because a debate
      // is scored on its transcript and never on the sound of the voice.
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'voiceChat',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
      })
      await AudioManager.setAudioSessionActivity(true)
    } catch (erreur) {
      throw new ErreurDebatAudio(`session audio : ${messageDe(erreur)}`)
    }

    const contexte = new AudioContext({ sampleRate: FREQUENCE_VOIX_HZ })
    const file = contexte.createBufferQueueSource({ pitchCorrection: false })
    file.connect(contexte.destination)
    file.start()
    this.contexte = contexte
    this.fileVoix = file

    const recorder = new AudioRecorder()
    recorder.onAudioReady(
      { sampleRate: FREQUENCE_DEBAT_HZ, bufferLength: TRAME_DEBAT, channelCount: 1 },
      (evenement) => {
        if (!this.envoiActif) return
        surTrame(enBase64(versInt16(evenement.buffer.getChannelData(0))))
      },
    )
    recorder.onError((erreur) => {
      console.warn('debat: erreur micro', erreur.message)
    })
    const demarrage = await recorder.start()
    this.recorder = recorder
    if (demarrage.status === 'error') {
      await this.arreter()
      throw new ErreurDebatAudio(demarrage.message)
    }
    // The screen may have gone while the native layer was starting. Hand everything back now,
    // rather than leaving a live microphone attached to nothing.
    if (this.abandonne) {
      await this.arreter()
      return
    }

    AudioManager.observeAudioInterruptions(true)
    this.abonnementInterruption = AudioManager.addSystemEventListener(
      'interruption',
      (evenement) => {
        if (evenement.type === 'began') {
          this.envoiActif = false
          this.surInterruption?.('coupe')
          return
        }
        // Observing interruptions means the native layer stops resuming the engine for us, so
        // a call or an alarm would kill the microphone for the rest of the debate with nothing
        // on screen to say so. Restarting it here is the whole reason to handle 'ended'.
        void this.reprendreApresInterruption()
      },
    )
    this.ouvert = true
  }

  /** Brings the microphone back after a call, an alarm, or anything else that took the session. */
  private async reprendreApresInterruption(): Promise<void> {
    if (!this.ouvert || this.abandonne || !this.recorder) return
    try {
      await AudioManager.setAudioSessionActivity(true)
      const reprise = await this.recorder.start()
      if (reprise.status === 'error') throw new ErreurDebatAudio(reprise.message)
      this.surInterruption?.('revenu')
    } catch (erreur) {
      console.warn('debat: micro non repris', messageDe(erreur))
      this.surInterruption?.('coupe')
    }
  }

  /** Frames leave the phone only while this is on: half duplex, one speaker at a time. */
  ecouter(actif: boolean): void {
    this.envoiActif = actif
  }

  /** Queues one chunk of Rétor's voice. Playing starts as soon as the first one lands. */
  jouer(donneesBase64: string): void {
    const contexte = this.contexte
    const file = this.fileVoix
    if (!contexte || !file || donneesBase64 === '') return
    const echantillons = depuisInt16(depuisBase64(donneesBase64))
    if (echantillons.length === 0) return
    const tampon = contexte.createBuffer(1, echantillons.length, FREQUENCE_VOIX_HZ)
    tampon.copyToChannel(echantillons, 0)
    file.enqueueBuffer(tampon)
  }

  /** Drops whatever is still queued, when a turn is cut short. */
  taire(): void {
    this.fileVoix?.clearBuffers()
  }

  async arreter(): Promise<void> {
    this.abandonne = true
    this.ouvert = false
    this.envoiActif = false
    this.surInterruption = null
    this.abonnementInterruption?.remove()
    this.abonnementInterruption = undefined
    try {
      this.recorder?.clearOnAudioReady()
      this.recorder?.clearOnError()
      await this.recorder?.stop()
    } catch (erreur) {
      console.warn('debat: arrêt du micro', messageDe(erreur))
    }
    this.recorder = null
    try {
      this.fileVoix?.stop()
      await this.contexte?.close()
    } catch (erreur) {
      console.warn('debat: fermeture du contexte', messageDe(erreur))
    }
    this.fileVoix = null
    this.contexte = null
    try {
      AudioManager.observeAudioInterruptions(false)
      await AudioManager.setAudioSessionActivity(false)
    } catch {
      // Giving the session back is best effort: nothing useful is left to do if it refuses.
    }
  }
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}
