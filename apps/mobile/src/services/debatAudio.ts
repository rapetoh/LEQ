/**
 * The audio of a face-à-face (ADR-007, path b). One library owns the session, as everywhere
 * else on the phone.
 *
 * Uplink: raw 16 kHz mono frames from the microphone, turned into Int16 little-endian and sent
 * as base64 on the socket. Downlink: PCM chunks from the server played through a buffer queue,
 * so Rétor starts speaking before the whole answer has been synthesised. Most of the two-second
 * budget of chapter 10 is bought right there.
 *
 * Turn taking is half duplex: while Rétor speaks, the microphone keeps running but its frames
 * are not sent. Stopping the recorder instead would flip the audio session on every turn, and
 * hearing the person over Rétor's own voice needs echo cancellation that is not dependable on
 * both platforms. Cutting him off is a button rather than a word for the same reason: it is
 * certain, on every phone, with any speaker volume.
 */
import { lecteur } from './lecture'
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
  niveauDbfs,
  FREQUENCE_DEBAT_HZ,
  FREQUENCE_VOIX_HZ,
  TRAME_DEBAT,
  versInt16,
} from './pcm'
import {
  prendreSessionAudio,
  rendreSessionAudio,
  type OptionsSessionAudio,
  type ReclamationAudio,
} from './sessionAudio'

// playAndRecord in voiceChat: Apple's voice processing is welcome here, because a debate is
// scored on its transcript and never on the sound of the voice.
const OPTIONS_SESSION_DEBAT: OptionsSessionAudio = {
  iosCategory: 'playAndRecord',
  iosMode: 'voiceChat',
  iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
}

export * from './pcm'

export class ErreurDebatAudio extends Error {
  override name = 'ErreurDebatAudio'
}

export type EcouteurTrame = (donneesBase64: string) => void
/** How loud the microphone is, in dBFS, once per captured frame. */
export type EcouteurNiveau = (dbfs: number) => void
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
  private reclamation: ReclamationAudio | null = null

  async demarrer(
    surTrame: EcouteurTrame,
    surInterruption: EcouteurInterruption,
    surNiveau?: EcouteurNiveau,
  ): Promise<void> {
    if (this.ouvert) return
    // Whatever the take player still holds goes first: one audio session, one owner at a time.
    lecteur.arreter()
    this.abandonne = false
    this.surInterruption = surInterruption
    try {
      this.reclamation = await prendreSessionAudio(OPTIONS_SESSION_DEBAT)
    } catch (erreur) {
      throw new ErreurDebatAudio(`session audio : ${messageDe(erreur)}`)
    }

    const contexte = new AudioContext({ sampleRate: FREQUENCE_VOIX_HZ })
    const file = contexte.createBufferQueueSource({ pitchCorrection: false })
    file.connect(contexte.destination)
    // Both arguments, always. In react-native-audio-api 0.13.3 the queue source's `start` has a
    // default offset of -1 and then rejects any negative offset, so `start()` throws on every
    // phone (« offset must be a finite non-negative number: -1 », Roch's screen, 2026-09-17).
    // An offset of 0 on an empty queue is a plain start on the native side.
    file.start(0, 0)
    this.contexte = contexte
    this.fileVoix = file

    const recorder = new AudioRecorder()
    recorder.onAudioReady(
      { sampleRate: FREQUENCE_DEBAT_HZ, bufferLength: TRAME_DEBAT, channelCount: 1 },
      (evenement) => {
        if (!this.envoiActif) return
        const echantillons = evenement.buffer.getChannelData(0)
        // The same frames drive the wave on screen. A person speaking into a microphone has to
        // see that it hears them, or they are talking into an object.
        if (surNiveau) surNiveau(niveauDbfs(echantillons))
        surTrame(enBase64(versInt16(echantillons)))
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
      this.reclamation = await prendreSessionAudio(OPTIONS_SESSION_DEBAT)
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
      await rendreSessionAudio(this.reclamation)
    } catch {
      // Giving the session back is best effort: nothing useful is left to do if it refuses.
    }
    this.reclamation = null
  }
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}
