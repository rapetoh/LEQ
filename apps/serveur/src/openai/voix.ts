// Rétor's voice.
//
// The phone plays 24 kHz, 16-bit, mono PCM, and that is exactly what `response_format: pcm`
// gives, so nothing is decoded on either side. The body is streamed and handed on chunk by
// chunk: the app starts playing the first words while the last are still being made, which is
// most of the two-second budget.
import type { Voix } from '../debat/fournisseurs.js'
import { appeler, type ConfigOpenAI } from './client.js'

export class VoixOpenAI implements Voix {
  readonly nom = 'openai:tts'

  constructor(private readonly config: ConfigOpenAI) {}

  async *dire(texte: string): AsyncIterable<Uint8Array> {
    const reponse = await appeler(this.config, '/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'onyx',
        input: texte,
        response_format: 'pcm',
        instructions:
          "Voix française naturelle, posée, celle d'un contradicteur sûr de lui dans un débat. Pas de ton de présentateur.",
      }),
      delaiMs: 30_000,
    })
    if (!reponse.body) return
    const lecteur = reponse.body.getReader()
    // PCM16: a chunk boundary in the middle of a sample would shift every sample after it. The
    // odd byte, if any, waits for the next chunk.
    let reste: Uint8Array | null = null
    for (;;) {
      const { done, value } = await lecteur.read()
      if (done) break
      if (!value || value.length === 0) continue
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
