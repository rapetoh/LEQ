// Listening to a public take (C6, C7): a signed URL from the private bucket, then playback
// through the same audio library that records. Storage decides who may read (migration 0012).
import { BUCKET_AUDIO_PUBLIC } from '@leq/domaine'
import { AudioContext, decodeAudioData, type AudioBufferSourceNode } from 'react-native-audio-api'

import { supabase } from './supabase'

const DUREE_SIGNATURE_S = 60 * 60

export async function urlSignee(chemin: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_AUDIO_PUBLIC)
    .createSignedUrl(chemin, DUREE_SIGNATURE_S)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'URL indisponible')
  }
  return data.signedUrl
}

/**
 * One take at a time: starting a second one stops the first.
 *
 * Decoding takes a moment, and on a slow network a second tap used to arrive while the first was
 * still decoding. Both then started, only the last was remembered, and the other played on over
 * the next screen with nothing able to stop it. Each play now carries a number, and a play that
 * has been superseded by the time it is ready simply does not start.
 */
export class Lecteur {
  private contexte: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private surFin: (() => void) | null = null
  private generation = 0

  async jouer(url: string, surFin?: () => void): Promise<void> {
    this.arreter()
    const mienne = ++this.generation
    const contexte = this.contexte ?? new AudioContext()
    this.contexte = contexte
    const mémoire = await decodeAudioData(url)
    if (mienne !== this.generation) return
    const source = contexte.createBufferSource()
    source.buffer = mémoire
    source.connect(contexte.destination)
    this.surFin = surFin ?? null
    source.onEnded = () => {
      // Only the play that is still current may clear the state and tell the screen it is over.
      if (mienne !== this.generation) return
      this.source = null
      this.surFin?.()
    }
    source.start(contexte.currentTime)
    this.source = source
  }

  arreter(): void {
    this.generation += 1
    try {
      this.source?.stop()
    } catch {
      // Already stopped: nothing to do.
    }
    this.source = null
  }

  estEnLecture(): boolean {
    return this.source !== null
  }
}

export const lecteur = new Lecteur()
