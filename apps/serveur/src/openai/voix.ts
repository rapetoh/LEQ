// Rétor's voice.
//
// The phone plays 24 kHz, 16-bit, mono PCM, and that is exactly what `response_format: pcm`
// gives, so nothing is decoded on either side. The body is streamed and handed on chunk by
// chunk: the app starts playing the first words while the last are still being made, which is
// most of the two-second budget.
import type { ConsommationVoix } from '../debat/consommation.js'
import type { QuiParle, Voix } from '../debat/fournisseurs.js'
import { appeler, type ConfigOpenAI } from './client.js'

/**
 * The two voices, and how each is asked to speak. The provider ships eleven presets; these two
 * are the ones that hold a French debate without sounding like a news bulletin. The name of a
 * preset never leaves this file: the rest of the code says « homme » or « femme ».
 */
const VOIX: Record<QuiParle, { preset: string; consigne: string }> = {
  homme: {
    preset: 'onyx',
    consigne:
      "Voix d'homme française, naturelle, posée, celle d'un contradicteur sûr de lui dans un débat. Débit de conversation, pas de ton de présentateur, pas d'emphase à la fin des phrases.",
  },
  femme: {
    preset: 'sage',
    consigne:
      "Voix de femme française, naturelle, posée, celle d'une contradictrice sûre d'elle dans un débat. Débit de conversation, pas de ton de présentatrice, pas d'emphase à la fin des phrases.",
  },
}

export class VoixOpenAI implements Voix {
  readonly nom = 'openai:tts'

  constructor(private readonly config: ConfigOpenAI) {}

  async *dire(
    texte: string,
    surConsommation?: (partie: ConsommationVoix) => void,
    qui: QuiParle = 'homme',
  ): AsyncIterable<Uint8Array> {
    const voix = VOIX[qui] ?? VOIX.homme
    let octets = 0
    const reponse = await appeler(this.config, '/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: voix.preset,
        input: texte,
        response_format: 'pcm',
        instructions: voix.consigne,
      }),
      delaiMs: 30_000,
    })
    if (!reponse.body) return
    // 24 kHz, 16-bit, mono: 48 000 bytes a second of voice.
    const rapporter = () =>
      surConsommation?.({
        caracteres: texte.length,
        audio_s: Math.round((octets / 48_000) * 100) / 100,
        appels: 1,
      })
    const lecteur = reponse.body.getReader()
    // PCM16: a chunk boundary in the middle of a sample would shift every sample after it. The
    // odd byte, if any, waits for the next chunk.
    let reste: Uint8Array | null = null
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) {
        rapporter()
        break
      }
      if (!value || value.length === 0) continue
      octets += value.length
      let morceau = value
      if (reste) {
        const joint = new Uint8Array(reste.length + value.length)
        joint.set(reste, 0)
        joint.set(value, reste.length)
        morceau = joint
        reste = null
      }
      if (morceau.length % 2 === 1) {
        reste = morceau.slice(morceau.length - 1)
        morceau = morceau.slice(0, morceau.length - 1)
      }
      if (morceau.length > 0) yield morceau
    }
  }
}
